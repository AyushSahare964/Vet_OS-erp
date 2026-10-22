import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidSubscriptionSignature, isValidWebhookSignature } from "../razorpaySignature";
import { PLAN_GST_RATE, SUBSCRIPTION_PLANS, TRIAL_DAYS, planChargePaise } from "../features";

const SECRET = "test_secret_not_a_real_key";

describe("what the customer is charged", () => {
  it("Pro costs Rs 1,999 + 18% GST = Rs 2,358.82 a month, sent to Razorpay in paise", () => {
    expect(SUBSCRIPTION_PLANS.plan_professional.monthlyPriceInr).toBe(1999);
    expect(PLAN_GST_RATE).toBe(0.18);
    expect(planChargePaise("plan_professional")).toBe(235882);
  });

  it("the paise amount is always a whole number (Razorpay rejects fractions)", () => {
    for (const id of Object.keys(SUBSCRIPTION_PLANS) as Array<keyof typeof SUBSCRIPTION_PLANS>) {
      expect(Number.isInteger(planChargePaise(id))).toBe(true);
    }
  });

  it("Starter is free and the trial is the 30 days the landing page promises", () => {
    expect(planChargePaise("plan_starter")).toBe(0);
    expect(TRIAL_DAYS).toBe(30);
  });
});

describe("Razorpay checkout signature (subscriptions)", () => {
  const sub = "sub_Abc12345";
  const pay = "pay_Xyz98765";
  const sign = (p: string, s: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(`${p}|${s}`).digest("hex");

  it("accepts the signature Razorpay produces: HMAC(payment_id|subscription_id)", () => {
    expect(isValidSubscriptionSignature(pay, sub, sign(pay, sub), SECRET)).toBe(true);
  });

  it("does NOT accept the order-style order (subscription_id|payment_id)", () => {
    expect(isValidSubscriptionSignature(pay, sub, sign(sub, pay), SECRET)).toBe(false);
  });

  it("rejects tampered, swapped, wrong-secret, empty, short and wrong-length signatures without throwing", () => {
    const good = sign(pay, sub);
    expect(isValidSubscriptionSignature(pay, sub, (good[0] === "a" ? "b" : "a") + good.slice(1), SECRET)).toBe(false);
    expect(isValidSubscriptionSignature("pay_Other0001", sub, good, SECRET)).toBe(false);
    expect(isValidSubscriptionSignature(pay, "sub_Other0001", good, SECRET)).toBe(false);
    expect(isValidSubscriptionSignature(pay, sub, sign(pay, sub, "someone_elses_secret"), SECRET)).toBe(false);
    for (const bad of ["", "deadbeef", good + "00", good.toUpperCase()]) expect(isValidSubscriptionSignature(pay, sub, bad, SECRET)).toBe(false);
  });

  it("never trusts anything when the secret is missing", () => {
    expect(isValidSubscriptionSignature(pay, sub, sign(pay, sub, ""), "")).toBe(false);
  });
});

describe("Razorpay webhook signature", () => {
  const body = JSON.stringify({ event: "subscription.charged", payload: { subscription: { entity: { id: "sub_1", current_end: 1900000000 } } } });
  const hook = (b: string, secret = "whsec_test") => crypto.createHmac("sha256", secret).update(b).digest("hex");

  it("accepts a correctly signed body and rejects any change to it", () => {
    expect(isValidWebhookSignature(body, hook(body), "whsec_test")).toBe(true);
    expect(isValidWebhookSignature(body.replace("1900000000", "2900000000"), hook(body), "whsec_test")).toBe(false);
  });

  it("rejects a wrong secret, a missing signature and an unset webhook secret", () => {
    expect(isValidWebhookSignature(body, hook(body, "other"), "whsec_test")).toBe(false);
    expect(isValidWebhookSignature(body, "", "whsec_test")).toBe(false);
    expect(isValidWebhookSignature(body, hook(body, ""), "")).toBe(false);
  });
});
