import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { gotoReady, fillStable } from './support/dom-helpers';

/**
 * Multi-tenant module: clinic self-registration (4 steps + plan confirmation), tenant data isolation,
 * and the platform-admin control plane (/m/tenants: search, details, plan, trial, doctor verification,
 * suspend/activate). Three hospitals with their own logo, colour and tagline are registered, and
 * screenshots of what each one sees are saved to multi-tenant-preview/ with an index.html gallery.
 *
 *   BASE_URL=https://vettechiq.vercel.app npx playwright test e2e/multi-tenant.spec.ts
 *
 * NOTE: registers three real "E2E MT" clinics in whichever database the target app uses; the last
 * test suspends every still-active "E2E MT" clinic. Platform credentials come from the built-in
 * system account (override with E2E_PLATFORM_EMAIL / E2E_PLATFORM_PASSWORD).
 */

const PLATFORM = {
  email: process.env['E2E_PLATFORM_EMAIL'] || 'ayush.sahare@vit.edu',
  password: process.env['E2E_PLATFORM_PASSWORD'] || 'ayush@123',
};

const PREVIEW_DIR = path.resolve('multi-tenant-preview');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const logoSvg = (letter: string, color: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" rx="56" fill="#ffffff"/><circle cx="128" cy="128" r="96" fill="${color}"/><text x="128" y="164" font-size="112" font-family="Arial" font-weight="700" text-anchor="middle" fill="#ffffff">${letter}</text></svg>`,
  );

const suffix = Date.now().toString().slice(-7);
const password = `Test@${suffix}`;

interface Clinic {
  key: string;
  name: string;
  city: string;
  state: string;
  tagline: string;
  color: string;
  letter: string;
  adminName: string;
  adminEmail: string;
  regNo: string;
}

const mk = (key: string, label: string, city: string, state: string, tagline: string, color: string, regSuffix: string): Clinic => ({
  key, name: `E2E MT ${label} ${suffix}`, city, state, tagline, color, letter: label[0]!,
  adminName: `${label} Admin ${suffix}`, adminEmail: `mt.${key}.${suffix}@vetos.test`, regNo: `MSVC-${suffix}${regSuffix}/2026`,
});

const clinicA = mk('alpha', 'Alpha', 'Pune', 'Maharashtra', 'Caring for every paw in Pune', '#e11d48', 'A');
const clinicB = mk('bravo', 'Bravo', 'Nagpur', 'Maharashtra', 'Nagpur\'s friendliest vets', '#059669', 'B');
const clinicC = mk('charlie', 'Charlie', 'Bengaluru', 'Karnataka', 'Advanced care, gentle hands', '#7c3aed', 'C');
const CLINICS = [clinicA, clinicB, clinicC];

const shot = async (page: Page, name: string) => {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  await page.screenshot({ path: path.join(PREVIEW_DIR, `${name}.png`) });
};

async function registerClinic(page: Page, c: Clinic, opts: { expectSuccess: boolean }) {
  await gotoReady(page, '/register-clinic');
  const next = () => page.getByRole('button', { name: /^continue/i }).click();

  // Step 1 — clinic details. This page hydrates late and a controlled form can be reset after it is
  // filled, so refill until the Continue button actually enables.
  await page.waitForLoadState('load').catch(() => {});
  const cont = page.getByRole('button', { name: /^continue/i });
  for (let attempt = 0; attempt < 5; attempt++) {
    await fillStable(page.getByPlaceholder('Sunrise Pet Hospital'), c.name);
    await fillStable(page.getByPlaceholder('98765 43210'), '9876543210');
    await fillStable(page.getByPlaceholder('clinic@example.com'), c.adminEmail);
    await fillStable(page.getByPlaceholder('Street, area'), `12 ${c.city} Road`);
    await fillStable(page.getByPlaceholder('Nagpur'), c.city);
    await page.locator('select').first().selectOption(c.state);
    await fillStable(page.getByPlaceholder('440001'), '440010');
    if (await cont.isEnabled({ timeout: 2000 }).catch(() => false)) break;
    await page.waitForTimeout(2000);
  }
  await next();

  // Step 2 — doctor (registration must be valid in the future)
  await fillStable(page.getByPlaceholder('Dr. Makarand Mukund Dixit'), `Dr. ${c.adminName}`);
  await fillStable(page.getByPlaceholder('MSVC-8648/2011'), c.regNo);
  await page.locator('input[type="date"]').fill('2031-08-02');
  await page.locator('input[type="file"]').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByAltText('ID card preview')).toBeVisible();
  await next();

  // Step 3 — branding: logo, tagline, brand colour
  await page.locator('input[type="file"]').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: logoSvg(c.letter, c.color) });
  await expect(page.getByAltText('Logo preview')).toBeVisible({ timeout: 15_000 });
  await fillStable(page.getByPlaceholder('Caring for your pets, always'), c.tagline);
  await page.locator('input[type="color"]').fill(c.color);
  await next();

  // Step 4 — admin account, then confirm the (default Starter) plan
  await fillStable(page.getByPlaceholder('Dr. Jane Doe'), c.adminName);
  await fillStable(page.getByPlaceholder('you@example.com'), c.adminEmail);
  const pw = page.getByPlaceholder('••••••••');
  await fillStable(pw.nth(0), password);
  await fillStable(pw.nth(1), password);
  await page.getByRole('button', { name: /review & create clinic/i }).click();
  await expect(page.getByText(/confirm your plan/i)).toBeVisible();
  await page.getByRole('button', { name: /confirm & create clinic/i }).click();

  if (opts.expectSuccess) {
    await expect(page).not.toHaveURL(/register-clinic/, { timeout: 45_000 });
  }
}

async function signIn(page: Page, email: string, pw: string) {
  await gotoReady(page, '/login');
  const form = page.locator('form');
  for (let i = 0; i < 4; i++) {
    await fillStable(page.locator('input[type="email"]'), email);
    await fillStable(page.locator('input[type="password"]'), pw);
    await form.getByRole('button', { name: /sign in/i }).click();
    // Either leaves /login (success) or stays with an error; both are the caller's to assert.
    await page.waitForTimeout(3000);
    if (!page.url().includes('/login')) return;
    if (await page.getByText(/suspended|invalid|incorrect/i).first().isVisible().catch(() => false)) return;
  }
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

const SEARCH = /search clinic, city, doctor, email/i;

async function openClinicDetails(page: Page, name: string) {
  await gotoReady(page, '/m/tenants');
  await fillStable(page.getByPlaceholder(SEARCH), name);
  await page.locator('tr', { hasText: name }).getByRole('button', { name: /view details/i }).click();
  return page.getByRole('dialog');
}

test.describe.serial('Multi-tenant: registration, isolation, platform control plane', () => {
  test('registers three independent hospitals, each logged in as its own admin with its own branding', async ({ browser }) => {
    test.setTimeout(360_000);
    fs.rmSync(PREVIEW_DIR, { recursive: true, force: true });
    for (const c of CLINICS) {
      const { ctx, page } = await newPage(browser);
      await registerClinic(page, c, { expectSuccess: true });
      await page.waitForTimeout(4000); // let the branded home finish loading logo + name
      await shot(page, `${c.key}-1-home`);

      await gotoReady(page, '/m/hospital');
      await expect(page.getByText(c.name).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(new RegExp(c.city)).first()).toBeVisible();
      await shot(page, `${c.key}-2-hospital-profile`);
      await ctx.close();
    }
  });

  test('rejects a second clinic that reuses an existing council registration number', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    const dup: Clinic = { ...clinicB, name: `E2E MT Dup ${suffix}`, adminEmail: `mt.dup.${suffix}@vetos.test`, regNo: clinicA.regNo };
    await registerClinic(page, dup, { expectSuccess: false });
    await expect(page).toHaveURL(/register-clinic/);
    await expect(page.getByText(/already|registered|linked|exists/i).first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test('rejects a clinic whose admin email is already used by another clinic', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    const dup: Clinic = { ...clinicB, name: `E2E MT Dup2 ${suffix}`, regNo: `MSVC-${suffix}D/2026`, adminEmail: clinicA.adminEmail };
    await registerClinic(page, dup, { expectSuccess: false });
    await expect(page).toHaveURL(/register-clinic/);
    await expect(page.getByText(/already|exists|in use/i).first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test('each hospital only sees its own data (tenant isolation)', async ({ browser }) => {
    test.setTimeout(240_000);
    for (const [me, others] of [[clinicA, [clinicB, clinicC]], [clinicB, [clinicA, clinicC]]] as const) {
      const { ctx, page } = await newPage(browser);
      await signIn(page, me.adminEmail, password);
      await expect(page).not.toHaveURL(/\/login/);

      await gotoReady(page, '/m/identity');
      await expect(page.getByText(me.adminName).first()).toBeVisible({ timeout: 20_000 });
      for (const o of others) await expect(page.getByText(o.adminName)).toHaveCount(0);
      await expect(page.getByText(PLATFORM.email)).toHaveCount(0);
      await shot(page, `${me.key}-3-staff-only-own`);

      await gotoReady(page, '/m/hospital');
      await expect(page.getByText(me.name).first()).toBeVisible({ timeout: 20_000 });
      for (const o of others) await expect(page.getByText(o.name)).toHaveCount(0);
      await ctx.close();
    }
  });

  test('a clinic admin cannot open the platform tenant list', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, clinicB.adminEmail, password);
    await gotoReady(page, '/m/tenants');
    // The app bounces non-platform roles back to their own hospital page; no other clinic may leak.
    await expect(page.getByText(clinicB.name).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Total clinics')).toHaveCount(0);
    await expect(page.getByText(clinicA.name)).toHaveCount(0);
    await ctx.close();
  });

  test('platform admin sees all three hospitals and can search and filter them', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, PLATFORM.email, PLATFORM.password);
    await expect(page).not.toHaveURL(/\/login/);
    await gotoReady(page, '/m/tenants');
    await expect(page.getByText('Total clinics')).toBeVisible({ timeout: 20_000 });

    const search = page.getByPlaceholder(SEARCH);
    await fillStable(search, `E2E MT`);
    for (const c of CLINICS) {
      const row = page.locator('tr', { hasText: c.name });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText(c.city);
      await expect(row).toContainText('Starter');
      await expect(row).toContainText('TRIAL');
      await expect(row).toContainText('ACTIVE');
      await expect(row).toContainText(c.regNo);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await fillStable(search, suffix); // only this run's three hospitals
    await expect(page.locator('tr', { hasText: clinicC.name })).toBeVisible();
    await shot(page, 'platform-1-all-hospitals');

    await fillStable(search, clinicA.name);
    await expect(page.locator('tr', { hasText: clinicA.name })).toBeVisible();
    await expect(page.locator('tr', { hasText: clinicB.name })).toHaveCount(0);
    await ctx.close();
  });

  test('platform admin manages a clinic: details, doctor verification, plan, trial, suspend', async ({ browser }) => {
    test.setTimeout(180_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, PLATFORM.email, PLATFORM.password);
    const dialog = await openClinicDetails(page, clinicA.name);
    await expect(dialog.getByText(clinicA.name).first()).toBeVisible({ timeout: 20_000 });

    await expect(dialog.getByText(clinicA.adminEmail).first()).toBeVisible();
    await shot(page, 'platform-2-clinic-details');

    await dialog.getByRole('tab', { name: 'Doctor' }).click();
    await expect(dialog.getByText(clinicA.regNo).first()).toBeVisible();
    await dialog.getByRole('button', { name: /mark doctor as verified/i }).click();
    await expect(page.getByText(/doctor marked as verified/i)).toBeVisible({ timeout: 20_000 });

    await dialog.getByRole('tab', { name: 'Branding' }).click();
    await expect(dialog.getByText(clinicA.tagline).first()).toBeVisible();
    await shot(page, 'platform-3-clinic-branding');

    // Plan: starts Starter, move to Pro, extend trial
    await dialog.getByRole('tab', { name: 'Plan' }).click();
    await expect(dialog.getByText('Starter').first()).toBeVisible();
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Pro', exact: true }).click();
    await expect(page.getByText(/moved to the pro plan/i)).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: /extend trial \+7 days/i }).click();
    await expect(page.getByText(/trial extended by 7 days/i)).toBeVisible({ timeout: 20_000 });

    await dialog.getByRole('tab', { name: /admin & usage/i }).click();
    await expect(dialog.getByText(clinicA.adminName).first()).toBeVisible();

    await dialog.getByRole('button', { name: /suspend clinic/i }).click();
    await expect(page.getByText(/is now suspended/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: /activate clinic/i })).toBeVisible();
    await ctx.close();
  });

  test('suspended clinic cannot sign in, other clinics are unaffected, reactivation restores access', async ({ browser }) => {
    test.setTimeout(240_000);

    const a = await newPage(browser);
    await signIn(a.page, clinicA.adminEmail, password);
    await expect(a.page).toHaveURL(/\/login/);
    await expect(a.page.getByText(/suspended/i).first()).toBeVisible({ timeout: 15_000 });
    await shot(a.page, 'alpha-4-suspended-login');
    await a.ctx.close();

    const b = await newPage(browser);
    await signIn(b.page, clinicB.adminEmail, password);
    await expect(b.page).not.toHaveURL(/\/login/);
    await b.ctx.close();

    const p = await newPage(browser);
    await signIn(p.page, PLATFORM.email, PLATFORM.password);
    const dlg = await openClinicDetails(p.page, clinicA.name);
    await dlg.getByRole('button', { name: /activate clinic/i }).click();
    await expect(p.page.getByText(/is now active/i)).toBeVisible({ timeout: 20_000 });
    await p.ctx.close();

    const re = await newPage(browser);
    await signIn(re.page, clinicA.adminEmail, password);
    await expect(re.page).not.toHaveURL(/\/login/);
    await re.ctx.close();
  });

  test('cleanup: suspends every still-active "E2E MT" clinic, then writes the preview page', async ({ browser }) => {
    test.setTimeout(420_000);
    const p = await newPage(browser);
    await signIn(p.page, PLATFORM.email, PLATFORM.password);
    await gotoReady(p.page, '/m/tenants');
    await fillStable(p.page.getByPlaceholder(SEARCH), 'E2E MT');
    const active = p.page.locator('tr', { hasText: 'E2E MT' }).filter({ hasText: 'ACTIVE' });
    while ((await active.count()) > 0) {
      const name = (await active.first().locator('td').first().locator('div').first().innerText()).trim();
      await active.first().getByRole('button', { name: /view details/i }).click();
      await p.page.getByRole('dialog').getByRole('button', { name: /suspend clinic/i }).click();
      await expect(p.page.getByText(/is now suspended/i)).toBeVisible({ timeout: 20_000 });
      await p.page.keyboard.press('Escape');
      await expect(p.page.getByRole('dialog')).toHaveCount(0);
      // the list reloads after the change; wait for it so the same row isn't picked again
      await expect(p.page.locator('tr', { hasText: name })).toContainText('SUSPENDED', { timeout: 20_000 });
    }
    await p.ctx.close();
    writePreview();
  });
});

/** Static gallery of what was captured; open multi-tenant-preview/index.html in a browser. */
function writePreview() {
  const img = (file: string, caption: string) =>
    fs.existsSync(path.join(PREVIEW_DIR, file))
      ? `<figure><img src="${file}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`
      : '';
  const sections = CLINICS.map(
    (c) => `<section>
  <h2><span class="dot" style="background:${c.color}"></span>${c.name} <small>${c.city}, ${c.state} · "${c.tagline}"</small></h2>
  <div class="grid">
    ${img(`${c.key}-1-home.png`, `${c.key}: home dashboard right after registration`)}
    ${img(`${c.key}-2-hospital-profile.png`, `${c.key}: Hospital profile (own name, address, doctor)`)}
    ${img(`${c.key}-3-staff-only-own.png`, `${c.key}: Staff list — only this clinic's people`)}
  </div></section>`,
  ).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Multi-tenant preview</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
header{background:#001d39;color:#fff;padding:24px 32px}header p{margin:4px 0 0;color:#bcd0e2}
main{max-width:1400px;margin:0 auto;padding:24px 32px}
section{background:#fff;border-radius:16px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px #0001}
h2{margin:0 0 14px;font-size:20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}h2 small{font-weight:400;color:#64748b;font-size:13px}
.dot{width:14px;height:14px;border-radius:50%;display:inline-block}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px}
figure{margin:0}img{width:100%;border:1px solid #cbd5e1;border-radius:10px;display:block}
figcaption{font-size:12px;color:#475569;margin-top:6px}
</style></head><body>
<header><h1>VetechIQ multi-tenant preview</h1><p>${CLINICS.length} hospitals registered independently — run ${suffix}. Each one has its own workspace, branding, staff and data.</p></header>
<main>
<section><h2>Platform admin view — all registered hospitals</h2><div class="grid">
${img('platform-1-all-hospitals.png', 'Platform admin: every hospital with plan, trial, doctor and status')}
${img('platform-2-clinic-details.png', 'Platform admin: one hospital\'s registration details')}
${img('platform-3-clinic-branding.png', 'Platform admin: that hospital\'s branding')}
${img('alpha-4-suspended-login.png', 'A suspended hospital cannot sign in')}
</div></section>
${sections}
</main></body></html>`;
  fs.writeFileSync(path.join(PREVIEW_DIR, 'index.html'), html);
}
