/**
 * Speed / network audit for the live site (default https://vetechiq.com).
 *
 * Read-only: it logs in, loads pages, types into inputs and opens dialogs, but never submits a form,
 * so no data is created. Everything it finds is written to test-results/speed/report.md and report.json.
 *
 * Run:
 *   SPEED_EMAIL='you@clinic.com' SPEED_PASSWORD='...' BASE_URL=https://vetechiq.com \
 *     npx playwright test e2e/speed-vetechiq.spec.ts --workers=1 --reporter=list
 *
 * Optional: SPEED_PROFILE=fast4g | slow4g   (network + CPU throttling, to see what a weak clinic PC / phone gets)
 *
 * What it measures
 *   - Network:   DNS/TCP/TLS, TTFB, HTTP version, compression, caching headers, request count, bytes,
 *                round-trip latency (10 probes), download bandwidth, which Vercel region served the API.
 *   - Per page:  FCP, LCP, CLS, TBT, time until the network goes quiet, number + slowest server calls.
 *   - Inputs:    time per keystroke when typing, worst event (INP-style) delay, login round trip.
 *   - Actions:   open quick menu, open purchase bill form, product search, global search.
 *   - Cache:     repeat visit vs first visit.
 * Budgets below are soft: a miss is reported, the run still finishes so you get the full picture.
 */
import { test, expect, type Browser, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.BASE_URL || 'https://vetechiq.com').replace(/\/$/, '');
const EMAIL = process.env.SPEED_EMAIL || '';
const PASSWORD = process.env.SPEED_PASSWORD || '';
const PROFILE = process.env.SPEED_PROFILE || 'none';
const OUT = path.join('test-results', 'speed');

// "Very fast" targets (ms unless noted). Tighten or loosen here.
const BUDGET = {
  ttfb: 500,
  fcp: 1500,
  lcp: 2500,
  cls: 0.1,
  tbt: 200,
  pageSettle: 3000, // page fully loaded and network quiet
  api: 600, // one server call
  login: 2500,
  keystroke: 50, // average ms per typed character
  worstEvent: 200, // slowest input event (INP-style)
  openDialog: 800,
  rtt: 100, // browser -> site round trip
  jsKb: 1200, // JS transferred on one page
  totalKb: 2500, // all bytes on one page
};

// ─────────────────────────────── instrumentation ───────────────────────────────

interface Req {
  id: string;
  url: string;
  method: string;
  type: string;
  status: number;
  protocol: string;
  fromCache: boolean;
  encoded: number;
  ms: number;
  ttfb: number;
  headers: Record<string, string>;
  t0: number;
  done: boolean;
  failed: string;
}

class NetLog {
  list: Req[] = [];
  private byId = new Map<string, Req>();
  cdp!: CDPSession;

  async attach(page: Page) {
    this.cdp = await page.context().newCDPSession(page);
    await this.cdp.send('Network.enable');
    if (PROFILE !== 'none') {
      const p =
        PROFILE === 'slow4g'
          ? { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }
          : { latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 };
      await this.cdp.send('Network.emulateNetworkConditions', { offline: false, ...p });
      await this.cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE === 'slow4g' ? 4 : 2 });
    }
    this.cdp.on('Network.requestWillBeSent', (e: any) => {
      const r: Req = {
        id: e.requestId, url: e.request.url, method: e.request.method, type: e.type || '', status: 0, protocol: '',
        fromCache: false, encoded: 0, ms: 0, ttfb: 0, headers: {}, t0: e.timestamp, done: false, failed: '',
      };
      if (!this.byId.has(e.requestId) || e.redirectResponse) {
        this.byId.set(e.requestId, r);
        this.list.push(r);
      }
    });
    this.cdp.on('Network.responseReceived', (e: any) => {
      const r = this.byId.get(e.requestId);
      if (!r) return;
      r.status = e.response.status;
      r.protocol = e.response.protocol || '';
      r.fromCache = !!(e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker);
      r.headers = Object.fromEntries(Object.entries(e.response.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
      r.type = e.type || r.type;
      r.ttfb = (e.timestamp - r.t0) * 1000;
    });
    this.cdp.on('Network.loadingFinished', (e: any) => {
      const r = this.byId.get(e.requestId);
      if (!r) return;
      r.encoded = e.encodedDataLength || 0;
      r.ms = (e.timestamp - r.t0) * 1000;
      r.done = true;
    });
    this.cdp.on('Network.loadingFailed', (e: any) => {
      const r = this.byId.get(e.requestId);
      if (!r) return;
      r.failed = e.errorText || 'failed';
      r.done = true;
    });
  }

  mark() { return this.list.length; }
  since(i: number) { return this.list.slice(i); }

  /** Resolves when no request has been in flight for `quiet` ms (or after `max`). Returns ms waited. */
  async settle(max = 45000, quiet = 700) {
    const start = Date.now();
    let quietSince = Date.now();
    while (Date.now() - start < max) {
      const inflight = this.list.filter((r) => !r.done && r.type !== 'WebSocket' && r.type !== 'EventSource').length;
      if (inflight > 0) quietSince = Date.now();
      else if (Date.now() - quietSince >= quiet) return Date.now() - start - quiet;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Never went quiet: remember what was still running, so a request that never ends is visible in the report.
    for (const r of this.list.filter((x) => !x.done)) stuck.add(`${r.method} ${r.type} ${r.url.slice(0, 110)}`);
    return max;
  }
}

const initVitals = () => {
  const w = window as any;
  w.__p = { fcp: 0, lcp: 0, cls: 0, long: [] as { s: number; d: number }[], ev: [] as { n: string; d: number }[] };
  const obs = (type: string, cb: (e: any) => void, extra: any = {}) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra } as any);
    } catch { /* not supported */ }
  };
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') w.__p.fcp = e.startTime; });
  obs('largest-contentful-paint', (e) => { w.__p.lcp = e.startTime; });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) w.__p.cls += e.value; });
  obs('longtask', (e) => { w.__p.long.push({ s: e.startTime, d: e.duration }); });
  obs('event', (e) => { w.__p.ev.push({ n: e.name, d: e.duration }); }, { durationThreshold: 16 });
};

// ─────────────────────────────── results ───────────────────────────────

interface Row {
  section: string;
  name: string;
  ms: number;
  budget?: number;
  notes: string[];
  reqs: number;
  api: number;
  apiSlowMs: number;
  apiSlowUrl: string;
  kb: number;
  jsKb: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  tbt?: number;
  worstEvent?: number;
  ttfb?: number;
}
const stuck = new Set<string>();
const rows: Row[] = [];
const issues: string[] = [];
const extra: Record<string, unknown> = {};
const allReqs: Req[] = [];

const host = new URL(BASE).host;
const isApi = (r: Req) => (r.type === 'Fetch' || r.type === 'XHR') && new URL(r.url).host === host;
const short = (u: string) => { try { const x = new URL(u); return x.pathname.slice(0, 70) + (x.search ? '?…' : ''); } catch { return u.slice(0, 70); } };
const kb = (n: number) => Math.round((n / 1024) * 10) / 10;
const round = (n: number) => Math.round(n);

function miss(label: string, value: number, budget: number, unit = 'ms') {
  if (value > budget) issues.push(`${label}: ${round(value * 10) / 10}${unit} (budget ${budget}${unit})`);
}

async function readVitals(page: Page) {
  return page.evaluate(() => {
    const p = (window as any).__p || { fcp: 0, lcp: 0, cls: 0, long: [], ev: [] };
    const tbt = p.long.reduce((s: number, t: any) => s + Math.max(0, t.d - 50), 0);
    const worst = p.ev.reduce((m: number, e: any) => Math.max(m, e.d), 0);
    return { fcp: p.fcp, lcp: p.lcp, cls: p.cls, tbt, worst };
  }).catch(() => ({ fcp: 0, lcp: 0, cls: 0, tbt: 0, worst: 0 }));
}
const resetVitals = (page: Page) =>
  page.evaluate(() => { const p = (window as any).__p; if (p) { p.long = []; p.ev = []; } }).catch(() => {});

/** Runs `fn`, waits for the network to go quiet, and records timing + network + vitals for it. */
async function step(
  page: Page, net: NetLog, section: string, name: string, fn: () => Promise<void>,
  opts: { budget?: number; full?: boolean; settle?: boolean } = {},
) {
  const budget = opts.budget ?? BUDGET.pageSettle;
  await resetVitals(page);
  const i = net.mark();
  const t0 = Date.now();
  const notes: string[] = [];
  try { await fn(); } catch (e: any) { notes.push(`step error: ${String(e.message).split('\n')[0]}`); }
  if (opts.settle !== false) await net.settle();
  const ms = Date.now() - t0;
  const rs = net.since(i);
  allReqs.push(...rs);
  const api = rs.filter(isApi);
  const slow = api.reduce<Req | null>((m, r) => (!m || r.ms > m.ms ? r : m), null);
  const v = await readVitals(page);
  const nav = opts.full
    ? await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        return n ? { ttfb: n.responseStart - n.startTime, dns: n.domainLookupEnd - n.domainLookupStart, tcp: n.connectEnd - n.connectStart, tls: n.secureConnectionStart > 0 ? n.connectEnd - n.secureConnectionStart : 0 } : null;
      }).catch(() => null)
    : null;
  const row: Row = {
    section, name, ms, budget, notes, reqs: rs.length, api: api.length,
    apiSlowMs: slow ? round(slow.ms) : 0, apiSlowUrl: slow ? short(slow.url) : '',
    kb: kb(rs.reduce((s, r) => s + r.encoded, 0)),
    jsKb: kb(rs.filter((r) => r.type === 'Script').reduce((s, r) => s + r.encoded, 0)),
    ...(opts.full ? { fcp: round(v.fcp), lcp: round(v.lcp), cls: Math.round(v.cls * 1000) / 1000, tbt: round(v.tbt), ttfb: nav ? round(nav.ttfb) : 0 } : {}),
    worstEvent: round(v.worst),
  };
  rows.push(row);
  miss(`${section} / ${name} total`, ms, budget);
  if (opts.full) {
    if (nav) miss(`${name} TTFB`, nav.ttfb, BUDGET.ttfb);
    if (v.fcp) miss(`${name} FCP`, v.fcp, BUDGET.fcp);
    if (v.lcp) miss(`${name} LCP`, v.lcp, BUDGET.lcp);
    miss(`${name} CLS`, v.cls, BUDGET.cls, '');
    miss(`${name} TBT`, v.tbt, BUDGET.tbt);
    miss(`${name} JS transferred`, row.jsKb, BUDGET.jsKb, 'KB');
    miss(`${name} total transferred`, row.kb, BUDGET.totalKb, 'KB');
  }
  for (const r of api) if (r.ms > BUDGET.api) issues.push(`Slow server call on ${name}: ${short(r.url)} took ${round(r.ms)}ms`);
  for (const r of rs) if (r.failed && !/ABORTED/i.test(r.failed)) issues.push(`Failed request on ${name}: ${short(r.url)} (${r.failed})`);
  for (const r of rs) if (r.status >= 400) issues.push(`HTTP ${r.status} on ${name}: ${short(r.url)}`);
  return row;
}

async function openPage(browser: Browser): Promise<{ ctx: BrowserContext; page: Page; net: NetLog }> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.addInitScript(initVitals);
  const net = new NetLog();
  await net.attach(page);
  return { ctx, page, net };
}

// ─────────────────────────────── tests ───────────────────────────────

test.describe.serial('vetechiq.com speed audit', () => {
  test.setTimeout(1_200_000); // the live site can stall for 20s+ per page, so allow a long run
  let ctx: BrowserContext;
  let page: Page;
  let net: NetLog;

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    ({ ctx, page, net } = await openPage(browser));
  });

  test.afterAll(async () => {
    writeReport();
    await ctx?.close();
  });

  test('1. public pages: first visit (cold cache) and repeat visit', async ({ browser }) => {
    for (const p of ['/', '/login', '/pricing', '/register-clinic']) {
      const c = await openPage(browser); // fresh context = nothing cached
      await step(c.page, c.net, 'Public (cold)', p, async () => { await c.page.goto(BASE + p, { waitUntil: 'load' }); }, { full: true });
      if (p === '/') {
        await step(c.page, c.net, 'Public (warm)', `${p} reload`, async () => { await c.page.reload({ waitUntil: 'load' }); }, { full: true });
        const cached = c.net.list.filter((r) => r.fromCache).length;
        extra['warmReloadRequestsServedFromCache'] = `${cached} of ${c.net.list.length}`;
      }
      await c.ctx.close();
    }
  });

  test('2. network diagnostics: latency, bandwidth, protocol, compression, caching, region', async () => {
    await page.goto(BASE + '/login', { waitUntil: 'load' });
    await net.settle();

    // Round trip to the site, 10 probes (no body, no cache)
    const rtts: number[] = await page.evaluate(async (u) => {
      const out: number[] = [];
      for (let i = 0; i < 10; i++) {
        const t = performance.now();
        await fetch(u + '/login?probe=' + i + Date.now(), { method: 'HEAD', cache: 'no-store' });
        out.push(performance.now() - t);
      }
      return out;
    }, BASE);
    const sorted = [...rtts].sort((a, b) => a - b);
    const rtt = { min: round(sorted[0]), median: round(sorted[5]), p95: round(sorted[9]) };
    extra['roundTripMs'] = rtt;
    miss('Round trip browser -> site (median)', rtt.median, BUDGET.rtt);

    // Bandwidth: pull the biggest script seen so far, bypassing cache
    const biggest = [...net.list].filter((r) => r.type === 'Script' && r.encoded > 20_000).sort((a, b) => b.encoded - a.encoded)[0];
    if (biggest) {
      const bw = await page.evaluate(async (u) => {
        const t = performance.now();
        const buf = await (await fetch(u, { cache: 'reload' })).arrayBuffer();
        return { bytes: buf.byteLength, ms: performance.now() - t };
      }, biggest.url);
      const mbps = (bw.bytes * 8) / 1e6 / (bw.ms / 1000);
      extra['downloadThroughput'] = `${Math.round(mbps * 10) / 10} Mbps (${kb(bw.bytes)} KB in ${round(bw.ms)} ms) from ${short(biggest.url)}`;
    }

    // Protocol, compression, caching
    const doc = net.list.find((r) => r.type === 'Document');
    extra['mainDocument'] = doc ? { protocol: doc.protocol, status: doc.status, server: doc.headers['server'], 'x-vercel-id': doc.headers['x-vercel-id'], 'x-vercel-cache': doc.headers['x-vercel-cache'], 'content-encoding': doc.headers['content-encoding'], 'cache-control': doc.headers['cache-control'] } : null;
    const protocols: Record<string, number> = {};
    for (const r of net.list) protocols[r.protocol || 'n/a'] = (protocols[r.protocol || 'n/a'] || 0) + 1;
    extra['protocols'] = protocols;
    if (!Object.keys(protocols).some((p) => /h2|h3/.test(p))) issues.push('Site is not served over HTTP/2 or HTTP/3');

    const textTypes = ['Script', 'Stylesheet', 'Document', 'Fetch', 'XHR'];
    for (const r of net.list) {
      if (!r.done || r.status !== 200 || r.fromCache) continue;
      if (textTypes.includes(r.type) && r.encoded > 4096 && !r.headers['content-encoding']) issues.push(`Not compressed: ${short(r.url)} (${kb(r.encoded)} KB)`);
      if ((r.type === 'Script' || r.type === 'Stylesheet' || r.type === 'Image' || r.type === 'Font') && new URL(r.url).host === host && !/max-age=(\d{6,}|[1-9]\d{5,})|immutable/.test(r.headers['cache-control'] || '')) {
        issues.push(`Weak caching (cache-control: ${r.headers['cache-control'] || 'none'}): ${short(r.url)}`);
      }
    }
  });

  test('3. login: typing speed and sign-in round trip', async () => {
    test.skip(!EMAIL || !PASSWORD, 'Set SPEED_EMAIL and SPEED_PASSWORD to run the logged-in tests');
    await page.goto(BASE + '/login', { waitUntil: 'load' });
    await net.settle();
    await page.waitForTimeout(1500); // let hydration finish: it can clear a form filled too early
    const email = page.locator('input[type="email"]');
    const pass = page.locator('input[type="password"]').first();

    let typed = 0;
    let perKey = 0;
    await step(page, net, 'Login', 'type email + password', async () => {
      const t = Date.now();
      await email.click();
      await email.pressSequentially(EMAIL, { delay: 0 });
      await pass.click();
      await pass.pressSequentially(PASSWORD, { delay: 0 });
      typed = EMAIL.length + PASSWORD.length;
      perKey = (Date.now() - t) / typed;
    }, { budget: 6000 });
    rows[rows.length - 1]!.notes.push(`${round(perKey * 10) / 10} ms per character`);
    miss('Login typing (per character)', perKey, BUDGET.keystroke);

    const signIn = page.locator('form').getByRole('button', { name: /sign in/i });
    const i = net.mark();
    await step(page, net, 'Login', 'click Sign in -> dashboard ready', async () => {
      // The form can still be reset by a late re-render, so refill if it was cleared, and retry the submit.
      for (let attempt = 0; attempt < 4 && /\/login/.test(page.url()); attempt++) {
        if ((await email.inputValue()) !== EMAIL) await email.fill(EMAIL);
        if ((await pass.inputValue()) !== PASSWORD) await pass.fill(PASSWORD);
        await signIn.click();
        await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 }).catch(() => {});
      }
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    }, { budget: BUDGET.login });
    const calls = net.since(i).filter(isApi).sort((a, b) => b.ms - a.ms).slice(0, 5).map((r) => `${short(r.url)} ${round(r.ms)}ms`);
    extra['loginTopCalls'] = calls;
    extra['landedOn'] = new URL(page.url()).pathname;
  });

  test('4. every module: full page load until the network is quiet', async () => {
    test.skip(!EMAIL || !PASSWORD, 'needs login');
    const modules: [string, string][] = [
      ['Dashboard', '/clinic'], ['Appointments & Queue', '/m/appointments'], ['Patient CRM', '/m/crm-pets'],
      ['Pharmacy & Retail', '/m/consultation'], ['Vaccination', '/m/vaccination'], ['Lab', '/m/laboratory'],
      ['Billing', '/m/billing'], ['Inventory', '/m/inventory'], ['Ledgers', '/m/ledgers'],
      ['Accounting & Reports', '/m/accounts'], ['Business dashboard', '/m/business'], ['Hospital settings', '/m/hospital'],
      ['Staff & audit', '/m/identity'],
    ];
    for (const [label, url] of modules) {
      await step(page, net, 'Module', `${label} (${url})`, async () => {
        await page.goto(BASE + url, { waitUntil: 'load' });
        if (/\/login/.test(page.url())) throw new Error('sent back to /login: not signed in, numbers for this page are not valid');
      }, { full: true });
    }
  });

  test('5. dashboard JavaScript: how much of it is actually used', async () => {
    test.skip(!EMAIL || !PASSWORD, 'needs login');
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await page.goto(BASE + '/clinic', { waitUntil: 'load' });
    await net.settle();
    const cov = await page.coverage.stopJSCoverage();
    let total = 0, used = 0;
    for (const e of cov) {
      if (!e.url.startsWith(BASE)) continue;
      total += e.source?.length || 0;
      for (const f of e.functions) for (const r of f.ranges) if (r.count > 0) used += r.endOffset - r.startOffset;
    }
    const pct = total ? Math.round((used / total) * 100) : 0;
    extra['dashboardJavaScript'] = `${kb(total)} KB parsed, about ${pct}% executed on first load`;
    if (total > 0 && pct < 40) issues.push(`Dashboard loads ${kb(total)} KB of JavaScript but runs only ~${pct}% of it: split by route / lazy-load heavy screens`);
  });

  test('6. inputs and actions: typing, search, dialogs', async () => {
    test.skip(!EMAIL || !PASSWORD, 'needs login');
    await page.goto(BASE + '/clinic', { waitUntil: 'load' });
    await net.settle();

    // Global search box: typing speed + how long results take
    const search = page.getByPlaceholder(/search patients/i).first();
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      let perKey = 0;
      const row = await step(page, net, 'Input', 'global search: type "bruno"', async () => {
        await search.click();
        const t = Date.now();
        await search.pressSequentially('bruno', { delay: 0 });
        perKey = (Date.now() - t) / 5;
      }, { budget: 2500 });
      row.notes.push(`${round(perKey * 10) / 10} ms per character`);
      miss('Global search typing (per character)', perKey, BUDGET.keystroke);
      miss('Global search worst event', row.worstEvent || 0, BUDGET.worstEvent);
      await search.fill('');
    } else {
      issues.push('Global search box not found on dashboard (selector may have changed)');
    }

    // Quick menu -> purchase bill form -> product search
    const quick = page.getByRole('button', { name: /quick/i }).first();
    if (await quick.isVisible({ timeout: 3000 }).catch(() => false)) {
      await step(page, net, 'Action', 'open Quick menu', async () => {
        await quick.click();
        await page.getByText(/add purchase bill|add purchase/i).first().waitFor({ timeout: 8000 });
      }, { budget: BUDGET.openDialog });

      const dlg = page.locator('[role="dialog"]').first();
      await step(page, net, 'Action', 'open Add Purchase Bill form', async () => {
        await page.getByText(/add purchase bill|add purchase/i).first().click();
        await dlg.waitFor({ timeout: 15000 });
        await dlg.getByText(/product name/i).first().waitFor({ timeout: 15000 });
      }, { budget: BUDGET.openDialog });

      const combo = dlg.getByRole('combobox').first();
      if (await combo.isVisible({ timeout: 3000 }).catch(() => false)) {
        const row = await step(page, net, 'Input', 'purchase bill: open product list and type "syr"', async () => {
          await combo.click();
          await page.keyboard.type('syr', { delay: 0 });
        }, { budget: 1500 });
        miss('Purchase bill product search worst event', row.worstEvent || 0, BUDGET.worstEvent);
      }
      await page.keyboard.press('Escape');
    } else {
      issues.push('Quick action button not found (selector may have changed)');
    }

    // Inventory: switch tabs inside the module
    await page.goto(BASE + '/m/inventory', { waitUntil: 'load' });
    await net.settle();
    for (const tab of [/purchases/i, /suppliers/i, /inventory/i]) {
      const t = page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab })).first();
      if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
        await step(page, net, 'Action', `inventory tab ${tab.source.replace(/\\|\/|i$/g, '')}`, async () => { await t.click(); }, { budget: 1500 });
      }
    }
  });

  test('7. repeat visit with warm cache: dashboard reload', async () => {
    test.skip(!EMAIL || !PASSWORD, 'needs login');
    await step(page, net, 'Warm', 'dashboard reload', async () => { await page.reload({ waitUntil: 'load' }); }, { full: true });
  });
});

// ─────────────────────────────── report ───────────────────────────────

function writeReport() {
  // Server calls, aggregated
  const calls = new Map<string, { n: number; total: number; max: number; kb: number; region: string }>();
  for (const r of allReqs.filter(isApi)) {
    const k = `${r.method} ${short(r.url)}`;
    const c = calls.get(k) || { n: 0, total: 0, max: 0, kb: 0, region: '' };
    c.n++; c.total += r.ms; c.max = Math.max(c.max, r.ms); c.kb += r.encoded / 1024;
    c.region = c.region || (r.headers['x-vercel-id'] || '');
    calls.set(k, c);
  }
  const apiTable = [...calls.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 20);
  const regions = new Set<string>();
  for (const r of allReqs.filter(isApi)) { const id = r.headers['x-vercel-id']; if (id) regions.add(id.split('::').slice(0, -1).join(' -> ')); }
  extra['vercelRegionsServingApi'] = [...regions];
  extra['requestsStillRunningWhenNetworkNeverWentQuiet'] = [...stuck].slice(0, 12);
  if ([...regions].some((x) => !/bom1/.test(x))) issues.push(`API is not served from Mumbai (bom1). Seen: ${[...regions].join(', ')}. The database is in Mumbai, so each query pays a cross-world round trip.`);

  // Heaviest assets
  const seen = new Set<string>();
  const heavy = allReqs.filter((r) => r.encoded > 0).sort((a, b) => b.encoded - a.encoded).filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true))).slice(0, 12);

  const bad = (v: number | undefined, b: number) => (v !== undefined && v > b ? ' ❌' : '');
  const pageRows = rows.filter((r) => r.section !== 'Input' && r.section !== 'Action' && r.section !== 'Login');
  let md = `# Speed audit: ${BASE}\n\nRun: ${new Date().toISOString()} · profile: ${PROFILE} · budgets are targets for a "very fast" system\n\n`;
  md += `## Problems found (${issues.length})\n\n${issues.length ? [...new Set(issues)].map((i) => `- ${i}`).join('\n') : '- none: everything is inside the budgets'}\n\n`;
  md += `## Network\n\n\`\`\`json\n${JSON.stringify(extra, null, 2)}\n\`\`\`\n\n`;
  md += `## Pages\n\n| Page | Total ms | TTFB | FCP | LCP | CLS | TBT | Requests | Server calls | Slowest call | KB | JS KB |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of pageRows) md += `| ${r.section}: ${r.name} | ${r.ms}${bad(r.ms, r.budget || BUDGET.pageSettle)} | ${r.ttfb ?? ''}${bad(r.ttfb, BUDGET.ttfb)} | ${r.fcp ?? ''}${bad(r.fcp, BUDGET.fcp)} | ${r.lcp ?? ''}${bad(r.lcp, BUDGET.lcp)} | ${r.cls ?? ''}${bad(r.cls, BUDGET.cls)} | ${r.tbt ?? ''}${bad(r.tbt, BUDGET.tbt)} | ${r.reqs} | ${r.api} | ${r.apiSlowMs ? `${r.apiSlowMs}ms ${r.apiSlowUrl}` : ''} | ${r.kb} | ${r.jsKb} |\n`;
  md += `\n## Inputs, login and actions\n\n| Step | ms | Budget | Worst input event ms | Server calls | Notes |\n|---|---|---|---|---|---|\n`;
  for (const r of rows.filter((x) => x.section === 'Input' || x.section === 'Action' || x.section === 'Login')) md += `| ${r.section}: ${r.name} | ${r.ms}${bad(r.ms, r.budget)} | ${r.budget} | ${r.worstEvent ?? ''}${bad(r.worstEvent, BUDGET.worstEvent)} | ${r.api} | ${r.notes.join('; ')} |\n`;
  md += `\n## Server calls, by total time\n\n| Call | Count | Total ms | Slowest ms | KB | Served by (edge -> function) |\n|---|---|---|---|---|---|\n`;
  for (const [k, c] of apiTable) md += `| ${k} | ${c.n} | ${round(c.total)} | ${round(c.max)}${bad(c.max, BUDGET.api)} | ${Math.round(c.kb * 10) / 10} | ${c.region.split('::').slice(0, -1).join(' -> ')} |\n`;
  md += `\n## Heaviest downloads\n\n| File | KB | Type | Protocol | Compressed | Cache-control |\n|---|---|---|---|---|---|\n`;
  for (const r of heavy) md += `| ${short(r.url)} | ${kb(r.encoded)} | ${r.type} | ${r.protocol} | ${r.headers['content-encoding'] || 'no'} | ${r.headers['cache-control'] || 'none'} |\n`;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, profile: PROFILE, budgets: BUDGET, issues: [...new Set(issues)], network: extra, rows, apiCalls: apiTable }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`\nSpeed report written to ${path.join(OUT, 'report.md')}  (${new Set(issues).size} problems)\n`);
}
