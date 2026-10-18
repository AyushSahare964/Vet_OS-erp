import { test, expect } from '@playwright/test';
import { gotoReady, fillStable } from './support/dom-helpers';

/**
 * Registers a brand-new clinic through the 5-step /register-clinic flow. On success the server
 * sends the admin-credentials email (EmailJS template_1s5wswj) to the admin address.
 *
 * Playwright can't read the inbox, so this asserts the registration succeeds and prints the
 * address to check. Delivery failures are logged server-side as "[email] ..." (Vercel logs).
 *
 * Gmail delivers astroiddistroyer5+anything@gmail.com to astroiddistroyer5@gmail.com, so each run
 * uses a unique "+tag" address (admin emails and council reg numbers must be unique per clinic).
 * Set E2E_ADMIN_EMAIL to use an exact address instead (works once only).
 *
 *   BASE_URL=https://vet-os-erp.vercel.app npx playwright test e2e/clinic-registration-email.spec.ts
 *
 * NOTE: creates a real test clinic in whichever database the target app uses.
 */

const MAILBOX = 'astroiddistroyer5';
// 1x1 PNG — stands in for the council ID card photo
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('clinic registration completes and sends the credentials email', async ({ page }) => {
  test.setTimeout(120_000);

  const suffix = Date.now().toString().slice(-8);
  const adminEmail = process.env['E2E_ADMIN_EMAIL'] || `${MAILBOX}+vettechiq${suffix}@gmail.com`;
  const clinicName = `E2E Test Clinic ${suffix}`;

  await gotoReady(page, '/register-clinic');

  // Step 1 — Clinic details
  await fillStable(page.getByPlaceholder('Sunrise Pet Hospital'), clinicName);
  await fillStable(page.getByPlaceholder('+91 98765 43210'), '9876543210');
  await fillStable(page.getByPlaceholder('clinic@example.com'), adminEmail);
  await fillStable(page.getByPlaceholder('Street, area'), '12 Test Road, Dharampeth');
  await fillStable(page.getByPlaceholder('Nagpur'), 'Nagpur');
  await fillStable(page.getByPlaceholder('440001'), '440010');
  await page.getByRole('button', { name: /^continue/i }).click();

  // Step 2 — Doctor details (council registration must be valid in the future)
  await fillStable(page.getByPlaceholder('Dr. Makarand Mukund Dixit'), 'Dr. E2E Tester');
  await fillStable(page.getByPlaceholder('MSVC-8648/2011'), `MSVC-${suffix}/2026`);
  await page.locator('input[type="date"]').fill('2031-08-02');
  await page.locator('input[type="file"]').setInputFiles({ name: 'id-card.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByAltText('ID card preview')).toBeVisible();
  await page.getByRole('button', { name: /^continue/i }).click();

  // Step 3 — Branding (defaults), Step 4 — Plan (default)
  await page.getByRole('button', { name: /^continue/i }).click();
  await page.getByRole('button', { name: /^continue/i }).click();

  // Step 5 — Admin account
  await fillStable(page.getByPlaceholder('Dr. Jane Doe'), 'E2E Admin');
  await fillStable(page.getByPlaceholder('you@example.com'), adminEmail);
  const password = `Test@${suffix}`;
  const passwordFields = page.getByPlaceholder('••••••••');
  await fillStable(passwordFields.nth(0), password);
  await fillStable(passwordFields.nth(1), password);
  await page.getByRole('button', { name: /create my clinic/i }).click();

  // Registration succeeded: success toast, then redirect into the app
  await expect(page.getByText(/welcome to vettechiq/i)).toBeVisible({ timeout: 30_000 });
  await expect(page).not.toHaveURL(/register-clinic/);

  console.log(`\n✔ Clinic "${clinicName}" registered. Credentials email sent to ${adminEmail} (inbox: ${MAILBOX}@gmail.com).`);
  console.log(`  Login: ${adminEmail} / ${password}`);
});
