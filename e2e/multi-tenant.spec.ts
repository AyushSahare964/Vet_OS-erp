import { test, expect, type Browser, type Page } from '@playwright/test';
import { gotoReady, fillStable } from './support/dom-helpers';

/**
 * Multi-tenant module: clinic self-registration, tenant data isolation, and the platform-admin
 * control plane (/m/tenants: search, details, plan, trial, doctor verification, suspend/activate).
 *
 *   BASE_URL=https://vettechiq.vercel.app npx playwright test e2e/multi-tenant.spec.ts
 *
 * NOTE: registers two real "E2E MT" clinics in whichever database the target app uses; both are
 * left SUSPENDED at the end. Platform credentials come from the built-in system account
 * (override with E2E_PLATFORM_EMAIL / E2E_PLATFORM_PASSWORD).
 */

const PLATFORM = {
  email: process.env['E2E_PLATFORM_EMAIL'] || 'ayush.sahare@vit.edu',
  password: process.env['E2E_PLATFORM_PASSWORD'] || 'ayush@123',
};

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const suffix = Date.now().toString().slice(-7);
const password = `Test@${suffix}`;

interface Clinic {
  name: string;
  city: string;
  adminName: string;
  adminEmail: string;
  regNo: string;
  plan: 'Basic' | 'Professional';
}
const clinicA: Clinic = {
  name: `E2E MT Alpha ${suffix}`, city: 'Nagpur', adminName: `Alpha Admin ${suffix}`,
  adminEmail: `mt.alpha.${suffix}@vetos.test`, regNo: `MSVC-${suffix}A/2026`, plan: 'Basic',
};
const clinicB: Clinic = {
  name: `E2E MT Bravo ${suffix}`, city: 'Pune', adminName: `Bravo Admin ${suffix}`,
  adminEmail: `mt.bravo.${suffix}@vetos.test`, regNo: `MSVC-${suffix}B/2026`, plan: 'Professional',
};

async function registerClinic(page: Page, c: Clinic, opts: { expectSuccess: boolean }) {
  await gotoReady(page, '/register-clinic');
  const next = () => page.getByRole('button', { name: /^continue/i }).click();

  await fillStable(page.getByPlaceholder('Sunrise Pet Hospital'), c.name);
  await fillStable(page.getByPlaceholder('+91 98765 43210'), '9876543210');
  await fillStable(page.getByPlaceholder('clinic@example.com'), c.adminEmail);
  await fillStable(page.getByPlaceholder('Street, area'), '12 Test Road');
  await fillStable(page.getByPlaceholder('Nagpur'), c.city);
  await fillStable(page.getByPlaceholder('440001'), '440010');
  await next();

  await fillStable(page.getByPlaceholder('Dr. Makarand Mukund Dixit'), `Dr. ${c.adminName}`);
  await fillStable(page.getByPlaceholder('MSVC-8648/2011'), c.regNo);
  await page.locator('input[type="date"]').fill('2031-08-02');
  await page.locator('input[type="file"]').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByAltText('ID card preview')).toBeVisible();
  await next();

  await next(); // branding defaults
  await page.getByRole('button', { name: new RegExp(`^${c.plan}`) }).click();
  await next();

  await fillStable(page.getByPlaceholder('Dr. Jane Doe'), c.adminName);
  await fillStable(page.getByPlaceholder('you@example.com'), c.adminEmail);
  const pw = page.getByPlaceholder('••••••••');
  await fillStable(pw.nth(0), password);
  await fillStable(pw.nth(1), password);
  await page.getByRole('button', { name: /create my clinic/i }).click();

  if (opts.expectSuccess) {
    await expect(page.getByText(/welcome to vettechiq/i)).toBeVisible({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/register-clinic/);
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
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe.serial('Multi-tenant: registration, isolation, platform control plane', () => {
  test('registers two independent clinics, each logged in as its own admin', async ({ browser }) => {
    test.setTimeout(240_000);
    for (const c of [clinicA, clinicB]) {
      const { ctx, page } = await newPage(browser);
      await registerClinic(page, c, { expectSuccess: true });
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
    const dup: Clinic = { ...clinicB, name: `E2E MT Dup2 ${suffix}`, regNo: `MSVC-${suffix}C/2026`, adminEmail: clinicA.adminEmail };
    await registerClinic(page, dup, { expectSuccess: false });
    await expect(page).toHaveURL(/register-clinic/);
    await expect(page.getByText(/already|exists|in use/i).first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test('clinic admins only see their own staff (tenant data isolation)', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, clinicA.adminEmail, password);
    await expect(page).not.toHaveURL(/\/login/);
    await gotoReady(page, '/m/identity');
    await expect(page.getByText(clinicA.adminName).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(clinicB.adminName)).toHaveCount(0);
    await expect(page.getByText(PLATFORM.email)).toHaveCount(0);
    await ctx.close();
  });

  test('clinic admin cannot open the platform tenant list', async ({ browser }) => {
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

  test('platform admin sees both clinics, can search and filter them', async ({ browser }) => {
    test.setTimeout(120_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, PLATFORM.email, PLATFORM.password);
    await expect(page).not.toHaveURL(/\/login/);
    await gotoReady(page, '/m/tenants');
    await expect(page.getByText('Total clinics')).toBeVisible({ timeout: 20_000 });

    const search = page.getByPlaceholder(/search clinic, city, doctor, email/i);
    await fillStable(search, `E2E MT Alpha ${suffix}`);
    await expect(page.locator('tr', { hasText: clinicA.name })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('tr', { hasText: clinicB.name })).toHaveCount(0);

    await fillStable(search, `E2E MT Bravo ${suffix}`);
    const rowB = page.locator('tr', { hasText: clinicB.name });
    await expect(rowB).toBeVisible();
    await expect(rowB).toContainText('Professional');
    await expect(rowB).toContainText('TRIAL');
    await expect(rowB).toContainText('ACTIVE');
    await expect(rowB).toContainText(clinicB.regNo);
    await ctx.close();
  });

  test('platform admin manages a clinic: details, doctor verification, plan, trial, suspend/activate', async ({ browser }) => {
    test.setTimeout(180_000);
    const { ctx, page } = await newPage(browser);
    await signIn(page, PLATFORM.email, PLATFORM.password);
    await gotoReady(page, '/m/tenants');
    await fillStable(page.getByPlaceholder(/search clinic, city, doctor, email/i), clinicA.name);
    await page.locator('tr', { hasText: clinicA.name }).getByRole('button', { name: /view details/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(clinicA.name).first()).toBeVisible({ timeout: 20_000 });

    // Registration data is shown per tab
    await expect(dialog.getByText(clinicA.adminEmail).first()).toBeVisible();
    await dialog.getByRole('tab', { name: 'Doctor' }).click();
    await expect(dialog.getByText(clinicA.regNo).first()).toBeVisible();
    await dialog.getByRole('button', { name: /mark doctor as verified/i }).click();
    await expect(page.getByText(/doctor marked as verified/i)).toBeVisible({ timeout: 20_000 });

    // Plan: starts Basic, move to Professional, extend trial
    await dialog.getByRole('tab', { name: 'Plan' }).click();
    await expect(dialog.getByText('Basic').first()).toBeVisible();
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Professional' }).click();
    await expect(page.getByText(/moved to the professional plan/i)).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: /extend trial \+7 days/i }).click();
    await expect(page.getByText(/trial extended by 7 days/i)).toBeVisible({ timeout: 20_000 });

    // Usage tab: a brand-new tenant has only its own admin
    await dialog.getByRole('tab', { name: /admin & usage/i }).click();
    await expect(dialog.getByText(clinicA.adminName).first()).toBeVisible();

    // Suspend, then activate again
    await dialog.getByRole('button', { name: /suspend clinic/i }).click();
    await expect(page.getByText(/is now suspended/i)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole('button', { name: /activate clinic/i })).toBeVisible();
    await ctx.close();
  });

  test('suspended clinic cannot sign in, other clinic is unaffected, reactivation restores access', async ({ browser }) => {
    test.setTimeout(180_000);

    // Clinic A is suspended by the previous test
    const a = await newPage(browser);
    await signIn(a.page, clinicA.adminEmail, password);
    await expect(a.page).toHaveURL(/\/login/);
    await expect(a.page.getByText(/suspended/i).first()).toBeVisible({ timeout: 15_000 });
    await a.ctx.close();

    // Clinic B keeps working
    const b = await newPage(browser);
    await signIn(b.page, clinicB.adminEmail, password);
    await expect(b.page).not.toHaveURL(/\/login/);
    await b.ctx.close();

    // Platform reactivates A, A can sign in again; then suspend both to leave test data inert
    const p = await newPage(browser);
    await signIn(p.page, PLATFORM.email, PLATFORM.password);
    for (const [c, from, to] of [[clinicA, /activate clinic/i, /is now active/i], [clinicA, /suspend clinic/i, /is now suspended/i]] as const) {
      await gotoReady(p.page, '/m/tenants');
      await fillStable(p.page.getByPlaceholder(/search clinic, city, doctor, email/i), c.name);
      await p.page.locator('tr', { hasText: c.name }).getByRole('button', { name: /view details/i }).click();
      const dlg = p.page.getByRole('dialog');
      await dlg.getByRole('button', { name: from }).click();
      await expect(p.page.getByText(to)).toBeVisible({ timeout: 20_000 });
      if (to.source.includes('active')) {
        const re = await newPage(browser);
        await signIn(re.page, clinicA.adminEmail, password);
        await expect(re.page).not.toHaveURL(/\/login/);
        await re.ctx.close();
      }
    }

    await p.ctx.close();
  });

  test('cleanup: suspends every still-active "E2E MT" test clinic', async ({ browser }) => {
    test.setTimeout(300_000);
    const p = await newPage(browser);
    await signIn(p.page, PLATFORM.email, PLATFORM.password);
    await gotoReady(p.page, '/m/tenants');
    await fillStable(p.page.getByPlaceholder(/search clinic, city, doctor, email/i), 'E2E MT');
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
  });
});
