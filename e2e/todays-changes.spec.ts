import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { gotoReady, fillStable } from './support/dom-helpers';

/**
 * Covers the changes made in one session, inside a brand-new test hospital (its own isolated
 * tenant, so no real clinic data is touched):
 *   - "Client Communication" renamed to Documentation; forms editable, saved, listed under Saved documents
 *   - Purchase-order drafts: saved by a clinic (tenant) admin, listed as DRAFT, admin Edit / Delete
 *   - Date-range filter next to each billing register's search box
 *   - Stock Reconciliation panel (physical count -> adjusts stock and ledger)
 *   - Stock Valuation never shows a negative figure
 *
 *   BASE_URL=https://vettechiq.vercel.app npx playwright test e2e/todays-changes.spec.ts --workers=1
 *
 * NOTE: registers one real "E2E TC" clinic in whichever database the app uses (left in place;
 * suspend it from the platform admin Tenants list if you want it inert).
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const suffix = Date.now().toString().slice(-7);
const password = `Test@${suffix}`;
const clinic = {
  name: `E2E TC Clinic ${suffix}`,
  adminName: `TC Admin ${suffix}`,
  adminEmail: `tc.admin.${suffix}@vetos.test`,
  regNo: `MSVC-${suffix}T/2026`,
};
const owner = { name: `TC Owner ${suffix}`, phone: `9${suffix}1`.slice(0, 10) };
const petName = `TCPet${suffix}`;
const itemName = `TC-Item-${suffix}`;

async function registerClinic(page: Page) {
  await gotoReady(page, '/register-clinic');
  await page.waitForLoadState('load').catch(() => {});
  const cont = page.getByRole('button', { name: /^continue/i });
  // This page hydrates late and can reset a filled form, so refill until Continue enables.
  for (let attempt = 0; attempt < 5; attempt++) {
    await fillStable(page.getByPlaceholder('Sunrise Pet Hospital'), clinic.name);
    await fillStable(page.getByPlaceholder('98765 43210'), '9876543210');
    await fillStable(page.getByPlaceholder('clinic@example.com'), clinic.adminEmail);
    await fillStable(page.getByPlaceholder('Street, area'), '12 Test Road');
    await fillStable(page.getByPlaceholder('Nagpur'), 'Nagpur');
    await fillStable(page.getByPlaceholder('440001'), '440010');
    if (await cont.isEnabled().catch(() => false)) break;
    await page.waitForTimeout(2000);
  }
  await cont.click();

  await fillStable(page.getByPlaceholder('Dr. Makarand Mukund Dixit'), `Dr. ${clinic.adminName}`);
  await fillStable(page.getByPlaceholder('MSVC-8648/2011'), clinic.regNo);
  await page.locator('input[type="date"]').fill('2031-08-02');
  await page.locator('input[type="file"]').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByAltText('ID card preview')).toBeVisible();
  await cont.click();
  await cont.click(); // branding: defaults

  await fillStable(page.getByPlaceholder('Dr. Jane Doe'), clinic.adminName);
  await fillStable(page.getByPlaceholder('you@example.com'), clinic.adminEmail);
  const pw = page.getByPlaceholder('••••••••');
  await fillStable(pw.nth(0), password);
  await fillStable(pw.nth(1), password);
  await page.getByRole('button', { name: /review & create clinic/i }).click();
  await page.getByRole('button', { name: /confirm & create clinic/i }).click();
  await expect(page).not.toHaveURL(/register-clinic/, { timeout: 45_000 });
}

/** Radix confirm()/prompt() are native dialogs here: accept them. */
const acceptDialogs = (page: Page) => page.on('dialog', (d) => void d.accept());

test.describe.serial("Today's changes (in a fresh test hospital)", () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await ctx.newPage();
    acceptDialogs(page);
  });
  test.afterAll(async () => {
    await ctx.close();
  });

  test('setup: register a fresh hospital and land logged in as its admin', async () => {
    test.setTimeout(180_000);
    await registerClinic(page);
    await expect(page.getByText(new RegExp(clinic.adminName)).first()).toBeVisible({ timeout: 30_000 });
  });

  test('tenant isolation: a brand-new hospital starts with no appointments and no stock ledger from other clinics', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/appointments');
    await expect(page.getByText('Appointments & Queue').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/0 of 0 records/)).toBeVisible({ timeout: 20_000 });
    for (const leaked of ['Jyoti Shahare', 'Makarand', 'A-907']) await expect(page.getByText(leaked)).toHaveCount(0);

    await gotoReady(page, '/m/inventory');
    await page.locator('#inv-tab-movements').click();
    await expect(page.getByText(/^0 entries$/)).toBeVisible({ timeout: 20_000 });
  });

  test('"Client Communication" is now called Documentation', async () => {
    await gotoReady(page, '/m/communication');
    await expect(page.getByRole('heading', { name: 'Documentation', level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Client Communication')).toHaveCount(0);
    await expect(page.getByText('Docs', { exact: true }).first()).toBeVisible(); // left-bar label
    // the three document views
    for (const t of ['Forms & Certificates', 'Saved documents', 'Uploaded documents']) {
      await expect(page.getByRole('button', { name: t })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /save document/i })).toBeDisabled(); // needs a patient
  });

  test('setup: register an owner and pet to fill documents for', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/crm-pets');
    await page.getByRole('button', { name: /add new pet/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();
    await fillStable(modal.getByPlaceholder(/atul bhise/i), owner.name);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), owner.phone);
    await fillStable(modal.getByPlaceholder(/dharampeth extension/i), '12 Test Road, Nagpur');
    await modal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), petName);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Beagle');
    await modal.getByRole('button', { name: /complete registration/i }).click();
    // the form resets for the next pet; the new pet shows up in the list behind it
    await expect(page.getByText(petName).first()).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  });

  test('Documentation: edit a form in place, save it, find it under Saved documents, view and delete it', async () => {
    test.setTimeout(120_000);
    // The box can be filled before React hydrates (DOM shows the text, state stays empty), and the pet
    // list is fetched once on page load: retype a few times, and reload the page if it still shows nothing.
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

    // header cell + paragraph are editable in place
    const edited = `Edited by test ${suffix}`;
    const doc = page.locator('#doc-print');
    await expect(doc.getByText(petName).first()).toBeVisible();
    const para = doc.locator('p[contenteditable="true"]').first();
    await para.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(edited);
    await doc.getByLabel('Microchip').fill(`CHIP-${suffix}`);
    await page.getByRole('heading', { name: 'Documentation', level: 1 }).click(); // blur to commit the paragraph
    await expect(doc.getByText(edited)).toBeVisible();
    await expect(page.getByRole('button', { name: /reset edits/i })).toBeVisible();

    await page.getByRole('button', { name: /save document/i }).click();
    await expect(page.getByText(/saved as DOC-\d+/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Saved documents' }).click();
    const row = page.locator('tr', { hasText: petName });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('General Treatment Consent');
    await expect(row).toContainText(clinic.adminName);

    await row.getByRole('button', { name: /view/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(edited)).toBeVisible();
    await expect(dialog.getByText(`CHIP-${suffix}`).or(dialog.locator(`input[value="CHIP-${suffix}"]`))).toBeVisible();
    await expect(dialog.locator('p[contenteditable="true"]')).toHaveCount(0); // read-only when viewing
    await expect(dialog.getByRole('button', { name: /print/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await row.getByRole('button', { name: /delete/i }).click(); // admin only; native confirm is auto-accepted
    await expect(page.locator('tr', { hasText: petName })).toHaveCount(0, { timeout: 15_000 });
  });

  test('Purchase-order draft: a clinic admin can save it (was "Not permitted"), then Edit and Delete it', async () => {
    test.setTimeout(120_000);
    await gotoReady(page, '/m/billing');
    await page.getByText('Purchase Orders').first().click();
    await page.getByRole('button', { name: /new purchase order/i }).click();
    await page.getByRole('button', { name: /antibiotics bulk/i }).click();
    await page.getByRole('button', { name: /save as draft/i }).click();
    await expect(page.getByText(/draft .* saved/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/not permitted|session has expired/i)).toHaveCount(0);

    const draftRow = page.locator('tr', { hasText: 'DRAFT' }).first();
    await expect(draftRow).toBeVisible({ timeout: 20_000 });
    // draft rows have Edit + Delete, and none of the issued-PO actions
    await expect(draftRow.getByRole('button', { name: /^edit$/i })).toBeVisible();
    await expect(draftRow.getByRole('button', { name: /receive/i })).toHaveCount(0);
    await expect(draftRow.getByRole('button', { name: /^view$/i })).toHaveCount(0);

    await draftRow.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('button', { name: /update draft/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /save po/i })).toBeVisible(); // admin can issue the final PO
    await page.keyboard.press('Escape');

    const before = await page.locator('tr', { hasText: 'DRAFT' }).count();
    await page.locator('tr', { hasText: 'DRAFT' }).first().getByTitle('Delete draft').click();
    await expect(page.getByText(/draft .* deleted/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('tr', { hasText: 'DRAFT' })).toHaveCount(before - 1, { timeout: 15_000 });
  });

  test('Billing registers have a date-range filter next to the search box', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/billing');
    const range = page.getByRole('button', { name: /this month \(mtd\)/i });
    // Suppliers has no date filter, so only the page-level one shows there
    await page.getByRole('button', { name: /^Suppliers/ }).first().click();
    await expect(range).toHaveCount(1, { timeout: 10_000 });
    const top = 1;
    for (const tab of ['Invoices', 'Payments', 'Purchases', 'Expenses', 'Credit Notes']) {
      await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
      await expect(range).toHaveCount(top + 1, { timeout: 10_000 }); // + the toolbar one
    }
    // changing it from the toolbar updates the shared range
    await page.getByRole('button', { name: /^Purchases/ }).first().click();
    await range.last().click();
    await page.getByRole('menuitem', { name: 'Today' }).click();
    await expect(page.getByRole('button', { name: /^today$/i })).toHaveCount(top + 1);
  });

  test('Inventory: Stock Reconciliation adjusts stock down and up, and is ledgered', async () => {
    test.setTimeout(180_000);
    // create an item and receive 10
    await gotoReady(page, '/m/inventory');
    await page.getByRole('button', { name: /add medicine/i }).click();
    const form = page.locator('div[role="dialog"][data-state="open"]');
    await expect(form).toBeVisible();
    await fillStable(form.getByPlaceholder('e.g. Amoxicillin 250mg', { exact: true }), itemName);
    // required: base unit and purchase unit (first option of each)
    await fillStable(form.getByPlaceholder('e.g. Tablet, Vial, Piece'), 'Tablet');
    await fillStable(form.getByPlaceholder('e.g. Box, Pack'), 'Box');
    await form.getByText('Packaging Hierarchy').click(); // close any suggestion list
    await form.getByRole('button', { name: /save item/i }).click();
    await expect(form).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);

    await page.locator('#inv-tab-movements').click();
    await page.locator('#add-item').click();
    await page.getByRole('option', { name: new RegExp(itemName) }).click();
    await fillStable(page.locator('#add-batch'), `B-${suffix}`);
    await fillStable(page.locator('#add-qty'), '10');
    await page.getByRole('button', { name: /add stock to inventory/i }).click();
    await expect(page.getByText(/added to stock/i)).toBeVisible({ timeout: 10_000 });

    const panel = page.locator('.erp-card', { hasText: 'Stock Reconciliation (Physical Count)' });
    // The product dropdown is a snapshot taken when it opens, so poll by reopening until the new balance shows.
    const expectStock = (n: number) =>
      expect(async () => {
        await page.locator('#add-item').click();
        try {
          await expect(page.getByRole('option', { name: new RegExp(`${itemName}.*${n} in stock`) })).toBeVisible({ timeout: 3000 });
        } finally {
          await page.keyboard.press('Escape');
        }
      }).toPass({ timeout: 40_000 });
    const reconcile = async (physical: string) => {
      await panel.getByRole('combobox').first().click();
      await page.getByRole('option', { name: new RegExp(itemName) }).click();
      await fillStable(panel.getByPlaceholder('0'), physical);
      await panel.getByRole('button', { name: 'Add to reconciliation' }).click();
    };

    // 10 -> 7 (shortfall)
    await reconcile('7');
    const line = panel.locator('tr', { hasText: itemName });
    await expect(line).toContainText('10'); // available
    await expect(line).toContainText('-3'); // change
    await panel.getByRole('button', { name: /process items/i }).click();
    await expect(page.getByText(/stock reconciled \(REC-\d+\)/i)).toBeVisible({ timeout: 20_000 });
    await expectStock(7);

    // 7 -> 12 (surplus)
    await reconcile('12');
    await expect(panel.locator('tr', { hasText: itemName })).toContainText('+5');
    await panel.getByRole('button', { name: /process items/i }).click();
    await expect(page.getByText(/stock reconciled \(REC-\d+\)/i).last()).toBeVisible({ timeout: 20_000 });
    await expectStock(12);

    // both corrections are in the ledger under REC- references
    const ledgerRows = page.locator('tr').filter({ hasText: itemName }).filter({ hasText: /REC-\d+/ });
    await expect(ledgerRows).toHaveCount(2, { timeout: 15_000 });

    // a count of 0 is allowed; stock never goes below zero, so a negative count is refused client-side
    await panel.getByRole('combobox').first().click();
    await page.getByRole('option', { name: new RegExp(itemName) }).click();
    await fillStable(panel.getByPlaceholder('0'), '-4');
    await panel.getByRole('button', { name: 'Add to reconciliation' }).click();
    await expect(page.getByText(/enter the physical stock \(0 or more\)/i)).toBeVisible();
  });

  test('Stock Valuation & Inventory Summary never shows a negative figure', async () => {
    test.setTimeout(90_000);
    await gotoReady(page, '/m/billing');
    await page.getByText('Stock Valuation').first().click();
    const modal = page.getByText('Stock Valuation & Inventory Summary');
    await expect(modal).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('div.fixed.inset-0').last().innerText();
    expect(body).not.toMatch(/[-−]\s?₹|₹\s?[-−]\d/); // no negative rupee value
    expect(body).not.toMatch(/(^|\s)[-−]\d+(\s|$)/m); // no negative quantity
  });
});
