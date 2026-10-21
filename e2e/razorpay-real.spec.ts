import { expect, test } from '@playwright/test';
import { gotoReady } from './support/dom-helpers';

/**
 * REAL Razorpay, no mocks: our server creates the monthly plan + subscription on the Razorpay account in .env,
 * and Razorpay's own checkout window opens. The test reads what the customer would be asked to pay and then
 * closes the window WITHOUT paying, so nothing is charged. Each run leaves one unpaid ("created") subscription
 * in Razorpay, so it only runs when asked:
 *
 *   RAZORPAY_E2E=1 npx playwright test e2e/razorpay-real.spec.ts --headed --workers=1
 *
 * To also pay with a test card, put Razorpay TEST keys (rzp_test_...) in .env and extend this spec.
 */
test.skip(!process.env['RAZORPAY_E2E'], 'set RAZORPAY_E2E=1 to run against the real Razorpay account');

test('real Razorpay checkout asks for Rs 2,360 a month for Pro', async ({ page }) => {
  test.setTimeout(120_000);
  await gotoReady(page, '/pricing');
  await expect(page.getByText('₹2,360 a month')).toBeVisible();

  // wait until React has hydrated the button, otherwise the click does nothing
  await page.getByRole('button', { name: 'Pay & Register' }).evaluate(
    (el) => new Promise<void>((res) => {
      const t = setInterval(() => {
        if (Object.keys(el).some((k) => k.startsWith('__reactProps'))) { clearInterval(t); res(); }
      }, 50);
    }),
  );
  await page.getByRole('button', { name: 'Pay & Register' }).click();

  const frame = page.frameLocator('iframe.razorpay-checkout-frame');
  await expect(frame.locator('body')).toContainText('₹2,360', { timeout: 60_000 });
  await expect(frame.locator('body')).toContainText('VetechIQ');
  await page.screenshot({ path: 'e2e-output/razorpay-real-checkout.png' });
  await page.keyboard.press('Escape'); // close without paying
});
