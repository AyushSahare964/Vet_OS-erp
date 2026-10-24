import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { gotoReady, fillStable } from './support/dom-helpers';

/**
 * Hospital profile save, Documentation form search, lab test catalog "Delete all", global search and
 * the patient-records search. Logs in with E2E_EMAIL / E2E_PASSWORD, uses an existing patient, and restores the hospital details at the end.
 *
 *   BASE_URL=http://localhost:8080 npx playwright test e2e/five-changes.spec.ts --workers=1
 *
 * NOTE: the lab test catalog test deletes every test profile of that clinic (by design).
 */
const suffix = Date.now().toString().slice(-7);
const CREDS = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
let petName = '';
let visitTerm = '';
let ownerName = '';
let ownerPhone = '';
let original = { address: '', website: '', tagline: '', pin: '' };
const newAddress = `77 Saved Lane ${suffix}`;

async function login(page: Page) {
  await gotoReady(page, '/login');
  for (let i = 0; i < 4; i++) {
    await fillStable(page.locator('input[type="email"]'), CREDS.email);
    await fillStable(page.locator('input[type="password"]'), CREDS.password);
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error('login failed');
}

test.describe.serial('Five changes (in a fresh test hospital)', () => {
  let ctx: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    if (!CREDS.email) throw new Error('Set E2E_EMAIL and E2E_PASSWORD');
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    page.on('dialog', (d) => void d.accept());
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test('setup: log in and pick an existing patient', async () => {
    test.setTimeout(120_000);
    await login(page);
    await gotoReady(page, '/m/crm-pets');
    const row = page.locator('tbody tr').first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    petName = (await row.locator('td').nth(1).locator('p').first().innerText()).trim();
    ownerName = (await row.locator('td').nth(4).locator('p').first().innerText()).trim();
    ownerPhone = (await row.locator('td').nth(5).innerText()).replace(/\D/g, '').slice(-10);
    expect(petName).not.toBe('');
  });

  test('1. Hospital profile: validation, save without reload, persists after reload, then restore', async () => {
    test.setTimeout(120_000);
    await gotoReady(page, '/m/hospital');
    await page.getByRole('button', { name: /edit hospital details/i }).click();
    const pin = page.getByLabel(/PIN code/);
    const address = page.getByLabel(/^Address/);
    const website = page.getByLabel(/^Website/);
    const tagline = page.getByLabel(/^Tagline/);
    original = {
      pin: await pin.inputValue(),
      address: await address.inputValue(),
      website: await website.inputValue(),
      tagline: await tagline.inputValue(),
    };
    await pin.fill('12AB');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/PIN code must be 6 digits/i)).toBeVisible();

    await pin.fill('440022');
    await address.fill(newAddress);
    await website.fill('www.saved-test.com');
    await tagline.fill('Tagline saved');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/hospital profile saved/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0); // form closed without a reload
    await expect(page.getByText(newAddress).first()).toBeVisible();
    await expect(page.getByText('www.saved-test.com')).toBeVisible();

    await gotoReady(page, '/m/hospital');
    await expect(page.getByText(newAddress).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Tagline saved')).toBeVisible();
  });

  test('2. Documentation: search a form, patient details fill, letterhead follows saved address', async () => {
    test.setTimeout(120_000);
    const search = page.getByPlaceholder('Pet, owner or phone');
    const match = page.getByRole('button', { name: new RegExp(petName) }).first();
    let found = false;
    for (let load = 0; load < 3 && !found; load++) {
      await gotoReady(page, '/m/communication');
      for (let i = 0; i < 4 && !found; i++) {
        await search.fill('');
        await search.fill(petName);
        await page.waitForTimeout(1500);
        found = await match.isVisible().catch(() => false);
      }
    }
    await match.click();

    const formSearch = page.getByLabel('Search forms');
    await formSearch.fill('euthan');
    await expect(page.getByRole('button', { name: /Euthanasia Consent/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /General Treatment Consent/ })).toHaveCount(0);
    await formSearch.fill('zzzz');
    await expect(page.getByText(/No form matches/)).toBeVisible();
    await formSearch.fill('estimated');
    await formSearch.press('Enter'); // opens the first match
    const doc = page.locator('#doc-print');
    await expect(doc.getByRole('heading', { name: /Estimated Cost/ })).toBeVisible();
    await expect(doc.getByText(petName).first()).toBeVisible();
    await expect(doc.getByText(ownerName).first()).toBeVisible();
    const fromVisit = page.getByLabel('Fill from visit');
    if (await fromVisit.isVisible().catch(() => false)) {
      await expect(page.getByText(/Filled from this visit/)).toBeVisible();
      const label = (await fromVisit.innerText()).split(' · ')[1]?.trim() ?? '';
      if (label && label !== 'Consultation') visitTerm = label.split(/[,;]/)[0]!.slice(0, 30);
    } else {
      await expect(page.getByText(/No visits on record/)).toBeVisible();
    }
    await expect(doc.getByText(newAddress)).toBeVisible();
  });

  test('3. Lab Test Master: add a test, Delete all empties the catalog', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/laboratory');
    await page.getByRole('button', { name: /Test Master/ }).click();
    await page.getByRole('button', { name: /New Test Profile/ }).click();
    await page.getByPlaceholder('e.g. Fecal Occult Blood Test').fill(`FC Test ${suffix}`);
    await page.getByPlaceholder('e.g. Serum (SST Yellow)').fill('Serum');
    await page.getByPlaceholder('e.g. 750').fill('500');
    await page.getByRole('button', { name: /Save Test Profile/ }).click();
    await expect(page.getByText(`FC Test ${suffix}`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Delete all/ }).click(); // native confirm auto-accepted
    await expect(page.getByText(/Test catalog cleared/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/0 of 0 test profiles/)).toBeVisible();
    await gotoReady(page, '/m/laboratory');
    await page.getByRole('button', { name: /Test Master/ }).click();
    await expect(page.getByText(/0 of 0 test profiles/)).toBeVisible({ timeout: 20_000 }); // still empty after reload
  });

  test('4. Global search finds the pet by name and owner phone, and shows an empty state', async () => {
    await gotoReady(page, '/');
    const box = page.getByPlaceholder(/search patients/i);
    for (const term of [petName, ownerPhone]) {
      await box.fill('');
      await box.fill(term);
      await expect(page.locator('[role="button"]', { hasText: petName }).first()).toBeVisible({ timeout: 15_000 });
    }
    await box.fill(`nothing-${suffix}-xyz`);
    await expect(page.getByText(/Nothing found for/)).toBeVisible({ timeout: 15_000 });
  });

  test('5. Patient records search: by owner, by a term from a real visit, and a term nobody has', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/crm-pets');
    const box = page.getByPlaceholder(/Search pet, owner, or anything in their records/);
    await box.fill(ownerName);
    await expect(page.locator('tbody tr', { hasText: petName }).first()).toBeVisible({ timeout: 15_000 });
    if (visitTerm) {
      await box.fill(visitTerm);
      await expect(page.getByText(/Found in records/).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/with ".*" in their records/)).toBeVisible();
    }
    await box.fill(`zzqq${suffix}`);
    await expect(page.getByText(/^0 of \d+ records/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Found in records/)).toHaveCount(0);
  });

  test('cleanup: restore the original hospital details', async () => {
    test.setTimeout(60_000);
    await gotoReady(page, '/m/hospital');
    await page.getByRole('button', { name: /edit hospital details/i }).click();
    await page.getByLabel(/PIN code/).fill(original.pin);
    await page.getByLabel(/^Address/).fill(original.address);
    await page.getByLabel(/^Website/).fill(original.website);
    await page.getByLabel(/^Tagline/).fill(original.tagline);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/hospital profile saved/i)).toBeVisible({ timeout: 20_000 });
  });
});
