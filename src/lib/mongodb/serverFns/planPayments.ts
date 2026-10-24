/**
 * Razorpay SUBSCRIPTION for the Pro plan, taken on the public pricing page before the clinic registers.
 * The customer pays the first month at checkout and Razorpay then bills Rs 1,999 + GST every month.
 * Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server env. The secret never leaves the server:
 * the browser only gets the public key id and the subscription id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { PlanPaymentModel } from "@/lib/mongodb/models/PlanPayment";
import { SUBSCRIPTION_PLANS, planChargePaise } from "@/lib/erp/features";
import { isValidSubscriptionSignature } from "@/lib/erp/razorpaySignature";

const API = "https://api.razorpay.com/v1";
/** Razorpay needs a finite cycle count; 120 monthly cycles = 10 years, after which it stops billing. */
const TOTAL_COUNT = 120;
const PLAN_NAME = "VetechIQ Pro (monthly, incl. 18% GST)";

export const keys = () => {
  // .env is only read at server start; re-read it so keys added later are picked up (same trick as emailjs.ts).
  if (!process.env["RAZORPAY_KEY_SECRET"]) {
    try {
      (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
    } catch {
      /* no .env on this host: real env vars are used */
    }
  }
  return { id: process.env["RAZORPAY_KEY_ID"] || "", secret: process.env["RAZORPAY_KEY_SECRET"] || "" };
};

const call = async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
  const k = keys();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${k.id}:${k.secret}`).toString("base64")}` },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) throw new Error(`Razorpay ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
};

interface RzpPlan { id: string; period: string; interval: number; item: { name: string; amount: number; currency: string } }

/** The monthly Pro plan on the Razorpay account, created the first time it is needed. Price comes from features.ts. */
/** test = TEMPORARY Rs 1 plan for trying the Razorpay flow end to end; remove with the Max test card. */
export async function ensureProRazorpayPlan(test = false): Promise<string> {
  const amount = test ? 100 : planChargePaise("plan_professional");
  const planName = test ? "VetechIQ Test (Rs 1)" : PLAN_NAME;
  const existing = await call<{ items: RzpPlan[] }>("/plans?count=100");
  const hit = existing.items.find((p) => p.period === "monthly" && p.interval === 1 && p.item.name === planName && p.item.amount === amount);
  if (hit) return hit.id;
  const made = await call<RzpPlan>("/plans", {
    method: "POST",
    body: {
      period: "monthly",
      interval: 1,
      item: {
        name: planName,
        amount,
        currency: "INR",
        description: `${SUBSCRIPTION_PLANS.plan_professional.name} plan: Rs ${SUBSCRIPTION_PLANS.plan_professional.monthlyPriceInr} + 18% GST per month`,
      },
    },
  });
  return made.id;
}

export const createPlanSubscriptionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ planId: z.literal("plan_professional"), test: z.boolean().optional() }).parse(raw))
  .handler(
    async ({ data }): Promise<{ ok: true; subscriptionId: string; keyId: string } | { ok: false; message: string }> => {
      const k = keys();
      if (!k.id || !k.secret) return { ok: false, message: "Online payment is not configured yet. Please contact us." };
      try {
        const planId = await ensureProRazorpayPlan(data.test);
        const sub = await call<{ id: string }>("/subscriptions", {
          method: "POST",
          body: { plan_id: planId, total_count: TOTAL_COUNT, customer_notify: 1, notes: { vetechiqPlan: data.planId } },
        });
        await connectDB();
        await PlanPaymentModel.create({ subscriptionId: sub.id, planId: data.planId, amountPaise: data.test ? 100 : planChargePaise(data.planId) });
        return { ok: true, subscriptionId: sub.id, keyId: k.id };
      } catch (e) {
        console.warn("[razorpay] could not create subscription:", e);
        return { ok: false, message: "Could not start the payment. Please try again." };
      }
    },
  );

export const verifyPlanPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ subscriptionId: z.string().min(5), paymentId: z.string().min(5), signature: z.string().min(10) }).parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; message?: string }> => {
    const k = keys();
    if (!k.secret) return { ok: false, message: "Online payment is not configured." };
    if (!isValidSubscriptionSignature(data.paymentId, data.subscriptionId, data.signature, k.secret)) {
      return { ok: false, message: "Payment could not be verified." };
    }
    await connectDB();
    const res = await PlanPaymentModel.updateOne(
      { subscriptionId: data.subscriptionId, status: "CREATED" },
      { status: "PAID", paymentId: data.paymentId },
    );
    return res.matchedCount ? { ok: true } : { ok: false, message: "Unknown or already verified payment." };
  });
