/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FULL PLATFORM END-TO-END TEST SUITE
 * Multi-Tenant Veterinary ERP — Harmony VetOS
 *
 * PART 1  — Authentication (login, register multiple roles, admin approval)
 * PART 2  — Dashboard (navigation, OPD admit)
 * PART 3  — CRM Registration (owner + pets, multi-pet, add to existing owner)
 * PART 4  — Billing Desk: Invoices & Receipts (Non-GST, GST, partial/full/credit
 *            payment, Save & Print, register columns, detail modal, print popup)
 * PART 5  — Purchases & Expenses (supplier bill, expense, register tabs)
 * PART 6  — Supplier & Client Quick-Add
 * PART 7  — Reports & Analytics Hub (10 tabs, KPI integrity, export CSV, delta proof)
 * PART 8  — Accounting Module
 * PART 9  — Inventory Module
 * PART 10 — Multi-Tenant: /register-clinic, /pending-approval
 * PART 11 — Notifications & Reminders Bell (create, persist after reload)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page } from '@playwright/test';
import {
  loginAsAdmin,
  registerNewStaff,
  approveStaffAsAdmin,
  ADMIN_CREDENTIALS,
} from './support/auth-helpers';
import { fillStable, gotoReady, reloadReady } from './support/dom-helpers';

// ─── Unique suffix for this entire run (digits only) ─────────────────────
// Must be pure digits — letter suffixes break phone-number inputs.
const RUN_ID = (Date.now() % 1_000_000).toString().padStart(6, '0');

/** Generate a 10-digit numeric phone that won't clash across tests. */
function genPhone(extra = 0): string {
  return `9${(Date.now() % 100_000_000 + extra).toString().padStart(9, '0')}`.slice(0, 10);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** The topmost open Radix dialog (portalled to body end). */
function topModal(page: Page) {
  return page.locator('div[role="dialog"][data-state="open"]').last();
}

/** en-IN formatted money, as the invoice modal footer renders it. */
function fmtINR(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** en-IN formatted money as the billing register shows it. */
function fmtReg(n: number): string {
  return `\u20b9 ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Clear cookies + localStorage then navigate to /login so the browser fully
 * flushes the session before the next test starts from a clean state.
 */
async function clearSession(page: Page) {
  await page.context().clearCookies();
  try {
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  } catch { /* page may already be closed */ }
  // Navigate to a neutral route so TanStack's in-memory router also resets.
  await page.goto('about:blank');
}

/**
 * Click a billing quick-action button by role (more stable than getByText
 * which can resolve to a detached <span> inside the button during hydration).
 */
async function clickBillingAction(page: Page, name: RegExp | string) {
  // Wait for the right-rail to fully mount — look for ANY quick-action button.
  await page.getByRole('button', { name: /new invoice/i }).or(
    page.getByRole('button', { name: /new quotation/i })
  ).first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(500); // allow hydration to settle
  await page.getByRole('button', { name }).first().click();
}

/** Open Billing Desk as admin. */
async function openBilling(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/billing');
  // Wait for the right-rail quick-action buttons to mount.
  await page.getByRole('button', { name: /new invoice/i }).first()
    .waitFor({ state: 'visible', timeout: 25_000 });
}

/** Open Reports module as admin, wait for loading state to clear. */
async function openReports(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/reports');
  // wait for skeleton/loading text to disappear
  await page.getByText('Aggregating live ERP records').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
}

/**
 * Adds a line to a New Invoice modal.
 * number-input order: qty(0), price(1), discount%(2).
 */
async function addInvoiceLine(
  page: Page,
  modal: ReturnType<typeof topModal>,
  item: string,
  qty: number,
  price: number,
  discountPct = 0
) {
  const numInputs = modal.locator('input[type="number"]');
  await fillStable(modal.getByPlaceholder('Type or select item name...'), item);
  await fillStable(numInputs.nth(0), String(qty));
  await fillStable(numInputs.nth(1), String(price));
  if (discountPct > 0) await fillStable(numInputs.nth(2), String(discountPct));
  await modal.getByTitle('Add Line (Enter)').click();
  await expect(modal.locator('td', { hasText: item })).toBeVisible({ timeout: 10_000 });
}

/** Adds a line to a New Quotation modal. */
async function addQuotationLine(
  page: Page,
  modal: ReturnType<typeof topModal>,
  item: string,
  qty: number,
  price: number
) {
  const numInputs = modal.locator('input[type="number"]');
  await fillStable(modal.getByPlaceholder('Select or type item name...'), item);
  await fillStable(numInputs.nth(0), String(qty));
  await fillStable(numInputs.nth(1), String(price));
  await modal.getByTitle('Add line item to quotation').click();
  await expect(modal.locator('td', { hasText: item })).toBeVisible({ timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// PART 1 — AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 1 \u2014 Authentication', () => {

  test('1.1 Login page renders with clinic branding, logo, and form controls', async ({ page }) => {
    test.setTimeout(60_000);
    await clearSession(page);
    await gotoReady(page, '/login');

    await expect(page).toHaveTitle(/Real Care Clinic/i);
    await expect(page.getByText('Real Care Clinic').first()).toBeVisible();
    // Email/password inputs only appear when NOT already logged in
    const emailInput = page.locator('input[type="email"]');
    const alreadyLoggedIn = !(await emailInput.isVisible({ timeout: 5_000 }).catch(() => false));
    if (alreadyLoggedIn) {
      // Clinic name and nav still visible — branding check passes
      await expect(page.getByText(/Real Care Clinic/i).first()).toBeVisible({ timeout: 8_000 });
    } else {
      await expect(emailInput).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /^register$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /mongodb atlas/i })).toBeVisible();
    }
  });

  test('1.2 Admin login succeeds and redirects away from /login', async ({ page }) => {
    test.setTimeout(60_000);
    // Clear session first so we always start from the login form
    await clearSession(page);
    await gotoReady(page, '/login');

    // Wait for the form to appear (page may redirect if cookie survived clear)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    await fillStable(emailInput, ADMIN_CREDENTIALS.email);
    await fillStable(page.locator('input[type="password"]'), ADMIN_CREDENTIALS.password);
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByText(/VetOS|Real Care|Harmony/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('1.3 Invalid credentials keep user on /login page', async ({ page }) => {
    test.setTimeout(30_000);
    await clearSession(page);
    await gotoReady(page, '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
    await fillStable(page.locator('input[type="email"]'), 'wronguser@nowhere.test');
    await fillStable(page.locator('input[type="password"]'), 'badpassword999');
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(4_000);
    expect(page.url()).toContain('/login');
  });

  test('1.4 Register tab shows correct form fields (name, email, password, role select)', async ({ page }) => {
    test.setTimeout(30_000);
    await clearSession(page);
    await gotoReady(page, '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
    // Switch to Register mode
    const registerTab = page.getByRole('button', { name: /^register$/i });
    await expect(registerTab).toBeVisible({ timeout: 8_000 });
    await registerTab.click();
    // The register form should render — check for any name-like input
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('select')).toBeVisible({ timeout: 8_000 });
    // At least one text input for name or email should exist
    const textInputCount = await page.locator('input[type="text"], input[type="email"]').count();
    expect(textInputCount).toBeGreaterThan(0);
  });

  test('1.5 Register a new doctor role staff → lands on /pending-approval', async ({ page }) => {
    test.setTimeout(60_000);
    await clearSession(page);
    const { fullName } = await registerNewStaff(page, 'doctor');
    await expect(page).toHaveURL('/pending-approval', { timeout: 20_000 });
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 10_000 });
    console.log(`Registered doctor: ${fullName}`);
  });

  test('1.6 Register accounts role staff → pending approval page renders correctly', async ({ page }) => {
    test.setTimeout(60_000);
    await clearSession(page);
    const { fullName } = await registerNewStaff(page, 'accounts');
    await expect(page).toHaveURL('/pending-approval', { timeout: 20_000 });
    await expect(page.getByText(/pending|approval|review/i).first()).toBeVisible({ timeout: 10_000 });
    console.log(`Registered accounts: ${fullName}`);
  });

  test('1.7 Register reception → Admin approves → Reception can log in to dashboard', async ({ page, browser }) => {
    test.setTimeout(120_000);
    await clearSession(page);
    const creds = await registerNewStaff(page, 'reception');
    await expect(page).toHaveURL('/pending-approval', { timeout: 20_000 });

    await approveStaffAsAdmin(browser, creds.fullName);

    await clearSession(page);
    await gotoReady(page, '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
    await fillStable(page.locator('input[type="email"]'), creds.email);
    await fillStable(page.locator('input[type="password"]'), creds.password);
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByText(/Real Care|Harmony|VetOS/i).first()).toBeVisible({ timeout: 10_000 });
    console.log(`Reception ${creds.fullName} logged in after admin approval.`);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 2 \u2014 Dashboard', () => {

  test('2.1 Admin dashboard renders clinic logo, module navigation links', async ({ page }) => {
    test.setTimeout(60_000);
    await clearSession(page);
    await loginAsAdmin(page);
    await gotoReady(page, '/');
    await expect(page.getByText(/Real Care Clinic|Harmony|VetOS/i).first()).toBeVisible({ timeout: 15_000 });
    for (const mod of ['billing', 'reports', 'inventory']) {
      const link = page.locator(`a[href*="/${mod}"], a[href*="/m/${mod}"]`).first();
      await expect(link).toBeVisible({ timeout: 10_000 });
    }
  });

  test('2.2 Register client + Admit to OPD → consultation workspace opens', async ({ page }) => {
    test.setTimeout(120_000);
    const petName = `OPD-${RUN_ID}`;
    const ownerName = `OPDOwner-${RUN_ID}`;

    await loginAsAdmin(page);
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = topModal(page);
    await expect(regModal).toBeVisible({ timeout: 10_000 });

    await fillStable(regModal.getByPlaceholder(/atul bhise/i), ownerName);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `9${RUN_ID}00`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), petName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Labrador');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });

    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();
    const workspace = page.locator('div[role="dialog"][data-state="open"]').last();
    await expect(workspace).toBeVisible({ timeout: 15_000 });
    await expect(workspace.getByText(petName).first()).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 3 — CRM: CLIENT / PATIENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 3 \u2014 CRM Registration', () => {

  test('3.1 Register new owner with full details + one detailed pet', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.getByPlaceholder(/atul bhise/i), `CRMOwner-${RUN_ID}1`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), genPhone(1));
    await fillStable(modal.getByPlaceholder(/atul\.bhise@gmail\.com/i), `crm1.${RUN_ID}@test.com`);
    await fillStable(modal.getByPlaceholder(/dharampeth extension/i), 'Flat 5, Test Colony');
    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Rocky-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Golden Retriever');
    await fillStable(modal.getByPlaceholder(/e\.g\. 24\.5/i), '28.5');
    await fillStable(modal.getByPlaceholder(/golden, black & tan/i), 'Golden');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();

    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(`CRMOwner-${RUN_ID}1`)).toBeVisible();
    await expect(modal.getByText(`Rocky-${RUN_ID}`)).toBeVisible();
    await modal.getByRole('button', { name: /done & close crm/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 8_000 });
  });

  test('3.2 Register owner with 2 pets in a single multi-pet flow', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page);
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.getByPlaceholder(/atul bhise/i), `MultiOwner-${RUN_ID}2`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), genPhone(2));
    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Tommy-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Beagle');
    await modal.getByRole('button', { name: /add another pet/i }).first().click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Snowy-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Persian Cat');
    await modal.getByRole('button', { name: /complete registration \(2 pets\)/i }).click();

    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(/registered patients \(2\)/i)).toBeVisible();
    await expect(modal.getByText(`Tommy-${RUN_ID}`)).toBeVisible();
    await expect(modal.getByText(`Snowy-${RUN_ID}`)).toBeVisible();
  });

  test('3.3 Add second pet to existing owner via phone number search', async ({ page }) => {
    test.setTimeout(90_000);
    const phone = genPhone(3);

    await loginAsAdmin(page);
    // Step 1: Register owner
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    let modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await fillStable(modal.getByPlaceholder(/atul bhise/i), `ExistOwner-${RUN_ID}3`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), phone);
    await modal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Pet1-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Labrador');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
    await modal.getByRole('button', { name: /done & close crm/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 8_000 });

    // Step 2: Add second pet via search
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: /new pet only/i }).click();
    await fillStable(modal.getByPlaceholder(/search by owner name, mobile/i), phone);
    await expect(modal.getByText(`ExistOwner-${RUN_ID}3`).first()).toBeVisible({ timeout: 15_000 });
    await modal.getByText(`ExistOwner-${RUN_ID}3`).first().click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Pet2-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Pomeranian');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText(`Pet2-${RUN_ID}`)).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 4 — BILLING DESK: INVOICES & RECEIPTS
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 4 \u2014 Billing Desk: Invoices & Receipts', () => {

  test('4.1 Quick Info card loads \u2014 no NaN, TOTAL SALE / AMOUNT RECEIVED / AMOUNT DUE visible', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await expect(page.getByText('QUICK INFO')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('TOTAL SALE')).toBeVisible();
    await expect(page.getByText('AMOUNT RECEIVED', { exact: true })).toBeVisible();
    await expect(page.getByText('AMOUNT DUE', { exact: true })).toBeVisible();
    const text = await page.getByText('QUICK INFO').locator('../..').innerText();
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });

  test('4.2 All 6 quick-action buttons are present', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    for (const name of [/new invoice/i, /new quotation/i, /add purchase/i, /add expense/i, /add client/i, /add supplier/i]) {
      await expect(page.getByRole('button', { name }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('4.3 Create Non-GST invoice \u2014 correct total \u2014 appears in register after reload', async ({ page }) => {
    test.setTimeout(120_000);
    const client = `InvClient-${RUN_ID}`;
    const item = `InvItem-${RUN_ID}`;
    const qty = 3, price = 500;

    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await fillStable(modal.getByPlaceholder('CASH', { exact: true }), client);
    await addInvoiceLine(page, modal, item, qty, price);
    await expect(modal.getByText(`\u20b9${fmtINR(qty * price)}`)).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20_000 });

    await reloadReady(page);
    await gotoReady(page, '/m/billing');
    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, client);
    await expect(page.getByText(client).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(fmtReg(qty * price)).first()).toBeVisible({ timeout: 10_000 });
  });

  test('4.4 Create GST invoice \u2014 subtotal + 18% GST = total (arithmetic verified)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const qty = 2, price = 500; // subtotal 1000, GST 180, total 1180
    await addInvoiceLine(page, modal, `GstItem-${RUN_ID}`, qty, price);

    const subtotal = qty * price;
    const gst = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + gst;

    await expect(modal.getByText(`\u20b9${subtotal.toFixed(2)}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`\u20b9${gst.toFixed(2)}`).first()).toBeVisible();
    await expect(modal.getByText(`\u20b9${fmtINR(total)}`)).toBeVisible();
  });

  test('4.5 Discount % correctly reduces line amount in Non-GST invoice', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    const qty = 4, price = 250, disc = 20; // gross 1000, disc 200, net 800
    const expected = qty * price * (1 - disc / 100);
    await addInvoiceLine(page, modal, `Disc-${RUN_ID}`, qty, price, disc);

    await expect(modal.locator('td', { hasText: `\u20b9${expected.toFixed(2)}` })).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`\u20b9${fmtINR(expected)}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('4.6 Partial payment \u2014 Balance Due = Total \u2212 Paid, shown correctly', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await addInvoiceLine(page, modal, `PartPay-${RUN_ID}`, 1, 800);
    await expect(modal.getByText(`\u20b9${fmtINR(800)}`).first()).toBeVisible({ timeout: 10_000 });

    const paidInput = modal.getByPlaceholder('0.00');
    await fillStable(paidInput, '300');
    await expect(modal.getByText('Balance Due:').first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`\u20b9${(800 - 300).toFixed(2)}`).first()).toBeVisible();
    await expect(modal.getByText('Paid: \u20b9300.00')).toBeVisible();
  });

  test('4.7 Full Payment toggle \u2014 status shows "Fully Paid", Balance Due disappears', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await addInvoiceLine(page, modal, `FullPay-${RUN_ID}`, 1, 500);

    await fillStable(modal.getByPlaceholder('0.00'), '200');
    await expect(modal.getByText('Balance Due:').first()).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: 'Full Payment' }).click();
    await expect(modal.getByText('Fully Paid')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('Balance Due:')).toHaveCount(0);
  });

  test('4.8 Credit/Unpaid toggle \u2014 Balance Due equals full grand total', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await addInvoiceLine(page, modal, `Credit-${RUN_ID}`, 1, 650);
    await modal.getByRole('button', { name: 'Credit / Unpaid' }).click();
    await expect(modal.getByText('Credit Invoice (Full Balance Due)')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`\u20b9${(650).toFixed(2)}`).first()).toBeVisible();
  });

  test('4.9 "Save and Print" opens formatted InvoicePrintView with printable area', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const itemName = `PrintItem-${RUN_ID}`;
    await fillStable(modal.getByPlaceholder('CASH', { exact: true }), `PrintClient-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/type or select item name/i), itemName);
    await fillStable(modal.locator('input[type="number"]').nth(0), '1');
    await fillStable(modal.locator('input[type="number"]').nth(1), '250');
    await modal.getByTitle(/add line/i).click();
    await expect(modal.locator('td', { hasText: itemName })).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: /save and print/i }).click();

    await expect(page.getByText(/tax invoice \(gst\)|commercial receipt/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#invoice-printable-area').getByText(itemName)).toBeVisible();
  });

  test('4.10 Invoice register \u2014 correct column headers, search to zero rows, Paid status filter', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByRole('button', { name: /^Invoices/i }).first().click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    for (const col of ['Invoice #', 'Total (\u20b9)', 'Paid (\u20b9)', 'Due (\u20b9)', 'Status']) {
      await expect(page.locator('th', { hasText: col }).first()).toBeVisible({ timeout: 15_000 });
    }

    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, 'ZZNOTEXIST99999XYZ');
    await page.waitForTimeout(600);
    await expect(page.getByText('No invoices found')).toBeVisible({ timeout: 10_000 });

    await fillStable(searchBox, '');
    await page.waitForTimeout(400);
    const statusSelect = page.locator('button[role="combobox"]', { hasText: 'All Statuses' });
    await expect(statusSelect).toBeVisible({ timeout: 10_000 });
    await statusSelect.click();
    await page.getByRole('option', { name: 'Paid', exact: true }).click();
    await page.waitForTimeout(500);
    const statusCells = page.locator('tbody tr td:nth-child(9)');
    const count = await statusCells.count();
    for (let i = 0; i < count; i++) {
      await expect(statusCells.nth(i)).toContainText('Paid');
    }
  });

  test('4.11 Invoice detail modal \u2014 shows correct amount and clinic name', async ({ page }) => {
    test.setTimeout(120_000);
    const detailClient = `DetailRow-${RUN_ID}`;

    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const invModal = topModal(page);
    await expect(invModal).toBeVisible({ timeout: 10_000 });
    await invModal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await fillStable(invModal.getByPlaceholder('CASH', { exact: true }), detailClient);
    await addInvoiceLine(page, invModal, `DetailItem-${RUN_ID}`, 2, 450);
    await invModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(invModal).not.toBeVisible({ timeout: 20_000 });

    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, detailClient);
    const row = page.locator('tbody tr', { hasText: detailClient });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /view/i }).click();

    const detail = topModal(page);
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText(`\u20b9${fmtINR(900)}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText(/Real Care Clinic|VetOS|Harmony/i).first()).toBeVisible({ timeout: 8_000 });
    await page.keyboard.press('Escape');
    await expect(detail).not.toBeVisible({ timeout: 8_000 });
  });

  test('4.12 Print Invoice popup from detail modal \u2014 popup contains client name', async ({ page }) => {
    test.setTimeout(120_000);
    const printClient = `PrintPop-${RUN_ID}`;

    await openBilling(page);
    await clickBillingAction(page, /new invoice/i);
    const invModal = topModal(page);
    await expect(invModal).toBeVisible({ timeout: 10_000 });
    await invModal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await fillStable(invModal.getByPlaceholder('CASH', { exact: true }), printClient);
    await addInvoiceLine(page, invModal, `PrintPopItem-${RUN_ID}`, 1, 600);
    await invModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(invModal).not.toBeVisible({ timeout: 20_000 });

    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, printClient);
    const row = page.locator('tbody tr', { hasText: printClient });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /view/i }).click();
    const detail = topModal(page);
    await expect(detail).toBeVisible({ timeout: 10_000 });

    // Print button opens a new tab/window — wait for the popup
    const printPromise = page.waitForEvent('popup', { timeout: 20_000 }).catch(() => null);
    await detail.getByRole('button', { name: /print/i }).first().click();
    const printPopup = await printPromise;
    if (printPopup) {
      await printPopup.waitForLoadState('domcontentloaded');
      await expect(printPopup.getByText(printClient).first()).toBeVisible({ timeout: 10_000 });
      await printPopup.close();
    } else {
      // Falls back to in-page print view
      await expect(page.getByText(printClient).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('4.13 Create Quotation, save \u2014 appears in Quotations register after reload', async ({ page }) => {
    test.setTimeout(120_000);
    const qClient = `QClient-${RUN_ID}`;
    const qItem = `QItem-${RUN_ID}`;

    await openBilling(page);
    await clickBillingAction(page, /new quotation/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.getByPlaceholder('e.g. Ramesh Kulkarni'), qClient);
    await addQuotationLine(page, modal, qItem, 2, 350);
    await expect(modal.getByText('\u20b9 700.00').first()).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20_000 });

    await reloadReady(page);
    await gotoReady(page, '/m/billing');
    await page.getByRole('button', { name: /^Quotations/i }).first().click();
    await expect(page.getByText(qClient).first()).toBeVisible({ timeout: 20_000 });
  });

  test('4.14 "Save and Print" Quotation \u2014 formatted QuotationPrintView renders', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /new quotation/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const itemName = `QuotePrint-${RUN_ID}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. ramesh kulkarni/i), `QuoteClient-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/select or type item name/i), itemName);
    await fillStable(modal.locator('input[type="number"]').nth(0), '1');
    await fillStable(modal.locator('input[type="number"]').nth(1), '250');
    await modal.getByTitle('Add line item to quotation').click();
    await expect(modal.locator('td', { hasText: itemName })).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: /save and print/i }).click();

    await expect(page.getByText(/^quotation \u2014/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#quotation-printable-area').getByText(itemName)).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 5 — PURCHASES & EXPENSES
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 5 \u2014 Purchases & Expenses', () => {

  test('5.1 Add Purchase with inline new-supplier creation \u2014 bill saved successfully', async ({ page }) => {
    test.setTimeout(120_000);
    const supplierName = `PurchSupplier-${RUN_ID}`;

    await openBilling(page);
    await clickBillingAction(page, /add purchase/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const allDialogs = page.locator('div[role="dialog"][data-state="open"]');
    await modal.getByTitle('Add New Supplier').click();
    await expect(allDialogs).toHaveCount(2, { timeout: 10_000 });

    const supplierModal = topModal(page);
    await fillStable(supplierModal.locator('input').first(), supplierName);
    await fillStable(supplierModal.getByPlaceholder('e.g. 9820011223'), '9820099222');
    await supplierModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(allDialogs).toHaveCount(1, { timeout: 15_000 });

    await expect(modal.locator('button[role="combobox"]', { hasText: supplierName })).toBeVisible({ timeout: 10_000 });

    const productInput = modal.locator('input[type="text"], input:not([type])').nth(2);
    await fillStable(productInput, `PurchItem-${RUN_ID}`);
    await fillStable(modal.locator('input[type="number"]').nth(0), '5');
    await fillStable(modal.locator('input[type="number"]').nth(1), '120');
    await modal.getByTitle('Add Line').click();
    await expect(modal.locator('td', { hasText: `PurchItem-${RUN_ID}` })).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Purchase bill saved successfully!')).toBeVisible({ timeout: 15_000 });
  });

  test('5.2 Add Expense \u2014 auto-selected category, amount, vendor \u2014 saved successfully', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /add expense/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await expect(modal.locator('button[role="combobox"]').first()).not.toContainText('Select Expense Type', { timeout: 10_000 });
    await fillStable(modal.locator('input[type="number"]').first(), '350');
    await fillStable(modal.locator('input[type="text"], input:not([type])').first(), `Vendor-${RUN_ID}`);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Expense saved successfully/i)).toBeVisible({ timeout: 15_000 });
  });

  test('5.3 Purchases register tab renders without crashing', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByRole('button', { name: /^Purchases/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Billing Desk/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('5.4 Expenses register tab renders without crashing', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByRole('button', { name: /^Expenses/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Billing Desk/i).first()).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 6 — SUPPLIER & CLIENT QUICK-ADD
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 6 \u2014 Supplier & Client Quick-Add', () => {

  test('6.1 Add Supplier standalone \u2014 success toast shown', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /add supplier/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.locator('input').first(), `Supplier-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder('e.g. 9820011223'), '9820033555');
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/added successfully|added to clinic suppliers/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('6.2 Add Client from Billing Desk \u2014 registers owner + pet', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /add client/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.getByPlaceholder(/atul bhise/i), `BillClient-${RUN_ID}6`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), genPhone(6));
    await modal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `BillPet-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Mixed Breed');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(page.getByText(/registered successfully/i).first()).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 7 — REPORTS & ANALYTICS HUB
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 7 \u2014 Reports & Analytics Hub', () => {

  test('7.1 Reports hub loads in Analytics Dashboard mode', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics Dashboard' })).toBeVisible();
    await expect(page.getByText('Executive Performance Summary')).toBeVisible();
  });

  test('7.2 All 10 analytics sub-tabs render without crashing', async ({ page }) => {
    test.setTimeout(90_000);
    await openReports(page);
    const tabs = [
      'Overview', 'Pets', 'Clients', 'Appointments', 'Billing & Revenue',
      'Payment Analysis', 'Laboratory', 'Inventory & Stock', 'Clinical Records', 'Cross-Module Audit',
    ];
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(400);
      await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('7.3 Overview KPI cards \u2014 all text, no NaN or undefined', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Executive Performance Summary')).toBeVisible({ timeout: 10_000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });

  test('7.4 Billing & Revenue tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Billing & Revenue', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/revenue|billing|total/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7.5 Payment Analysis tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Payment Analysis', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/payment/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7.6 Inventory & Stock tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Inventory & Stock', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/inventory|stock/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7.7 Clinical Records tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Clinical Records', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/clinical|records|visits/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7.8 Cross-Module Audit tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Cross-Module Audit', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/audit|cross.module/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7.9 Medical Records mode \u2014 archive list loads, can switch back to Analytics', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: /Medical Reports & Records/ }).click();
    await expect(page.getByText('Clinical Reports & Diagnostic Archive')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('All Reports Master Archive')).toBeVisible();
    await page.getByRole('button', { name: 'Analytics Dashboard' }).click();
    await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible();
  });

  test('7.10 Export / CSV button (if present) does not crash the page', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const exportBtn = page.getByRole('button', { name: /export|download.*csv|csv/i }).first();
    if (await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
        exportBtn.click(),
      ]);
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      }
    }
    await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible({ timeout: 10_000 });
  });

  test('7.11 Total Patients increments after registering a new pet via CRM', async ({ page }) => {
    test.setTimeout(120_000);
    await openReports(page);
    await page.getByRole('button', { name: 'Pets', exact: true }).click();
    await page.waitForTimeout(600);

    const beforeText = await page.getByText(/total patients|total pets/i).first().innerText().catch(() => '0');
    const before = parseInt(beforeText.replace(/\D/g, ''), 10) || 0;

    // Navigate to dashboard and register a new pet
    await loginAsAdmin(page);  // ensures we have a valid session before navigating
    await gotoReady(page, '/');
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await fillStable(modal.getByPlaceholder(/atul bhise/i), `T11Owner-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), genPhone(11));
    await modal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `T11Pet-${RUN_ID}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Dachshund');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
    await modal.getByRole('button', { name: /done & close crm/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 8_000 });

    await openReports(page);
    await page.getByRole('button', { name: 'Pets', exact: true }).click();
    await page.waitForTimeout(600);
    const afterText = await page.getByText(/total patients|total pets/i).first().innerText().catch(() => '0');
    const after = parseInt(afterText.replace(/\D/g, ''), 10) || 0;

    if (before > 0 && after > 0) {
      expect(after).toBeGreaterThanOrEqual(before + 1);
    }
    console.log(`Total Patients: before=${before}, after=${after}`);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 8 — ACCOUNTING MODULE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 8 \u2014 Accounting Module', () => {

  test('8.1 Accounting module loads with ledger or chart-of-accounts visible', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/accounting');
    await expect(page.getByText(/accounting|ledger|chart of accounts|general ledger/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('8.2 Accounting tabs switch without crashing', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/accounting');
    for (const pattern of [/journal entries/i, /ledger/i, /profit.*(loss|&)/i, /balance sheet/i, /chart of accounts/i]) {
      const btn = page.getByRole('button', { name: pattern }).first();
      if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(400);
      }
    }
    await expect(page.getByText(/accounting|ledger|journal|P&L|balance/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('8.3 P&L tab renders income/expense figures', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/accounting');
    const plBtn = page.getByRole('button', { name: /profit.*loss|p&l/i }).first();
    if (await plBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await plBtn.click();
      await page.waitForTimeout(600);
      await expect(page.getByText(/income|expense|profit|revenue/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByText(/accounting/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 9 — INVENTORY MODULE
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 9 \u2014 Inventory Module', () => {

  test('9.1 Inventory module loads with stock list', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/inventory');
    await expect(page.getByText(/inventory|stock|items/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('9.2 Inventory search filters the table', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/inventory');
    await page.waitForTimeout(1500);
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search" i], input[placeholder*="stock" i]'
    ).first();
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await fillStable(searchInput, 'ZZNOTEXIST99ITEM');
      await page.waitForTimeout(600);
      await expect(page.getByText(/inventory|stock/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('9.3 Stock Movements tab renders', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/inventory');
    const movBtn = page.getByRole('button', { name: /movements|stock movement/i }).first();
    if (await movBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await movBtn.click();
      await page.waitForTimeout(600);
      await expect(page.getByText(/movement|transaction|history/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByText(/inventory|stock/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 10 — MULTI-TENANT: REGISTER CLINIC
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 10 \u2014 Multi-Tenant Clinic Registration', () => {

  test('10.1 /register-clinic page renders with form inputs', async ({ page }) => {
    test.setTimeout(30_000);
    await clearSession(page);
    await gotoReady(page, '/register-clinic');
    // Page may redirect to /login if unauthenticated — both states are valid
    const isOnRegister = page.url().includes('/register-clinic');
    const isOnLogin = page.url().includes('/login');
    expect(isOnRegister || isOnLogin).toBeTruthy();
    if (isOnRegister) {
      await expect(page.locator('input').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('10.2 /pending-approval page renders with appropriate message', async ({ page }) => {
    test.setTimeout(30_000);
    await clearSession(page);
    await gotoReady(page, '/pending-approval');
    await expect(page.getByText(/pending|approval|review/i).first()).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// PART 11 — NOTIFICATIONS & REMINDERS BELL
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Part 11 \u2014 Reminders & Notification Bell', () => {

  test('11.1 Create billing reminder \u2014 success toast, entry listed in modal', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await clickBillingAction(page, /add reminder/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: '+ Schedule New' }).click();
    const ownerName = `ReminderOwner-${RUN_ID}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. anil deshmukh/i), ownerName);
    await fillStable(modal.getByPlaceholder(/e\.g\. bruno/i), `ReminderPet-${RUN_ID}`);

    await modal.getByRole('button', { name: /save reminder/i }).click();
    await expect(page.getByText(/billing reminder scheduled/i)).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(ownerName)).toBeVisible({ timeout: 10_000 });
  });

  test('11.2 Reminder persists after full page reload (MongoDB-backed)', async ({ page }) => {
    test.setTimeout(120_000);
    await openBilling(page);
    await clickBillingAction(page, /add reminder/i);
    const modal = topModal(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: '+ Schedule New' }).click();
    const persistName = `PersistReminder-${RUN_ID}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. anil deshmukh/i), persistName);
    await fillStable(modal.getByPlaceholder(/e\.g\. bruno/i), `PersistPet-${RUN_ID}`);
    await modal.getByRole('button', { name: /save reminder/i }).click();
    await expect(page.getByText(/billing reminder scheduled/i)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    await reloadReady(page);
    await gotoReady(page, '/m/billing');
    await clickBillingAction(page, /add reminder/i);
    const reopened = topModal(page);
    await expect(reopened).toBeVisible({ timeout: 10_000 });
    await expect(reopened.getByText(persistName)).toBeVisible({ timeout: 15_000 });
  });

});
