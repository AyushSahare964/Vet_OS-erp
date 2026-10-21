import crypto from "node:crypto";

const hmacHex = (secret: string, message: string) => crypto.createHmac("sha256", secret).update(message).digest("hex");

function safeEqual(expectedHex: string, given: string): boolean {
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checkout success for a SUBSCRIPTION: Razorpay signs HMAC-SHA256(`${payment_id}|${subscription_id}`, key_secret).
 * (Orders use `${order_id}|${payment_id}`; subscriptions are the other way round.)
 * A payment is trusted ONLY if this matches; the browser's word that it paid is never enough.
 */
export function isValidSubscriptionSignature(paymentId: string, subscriptionId: string, signature: string, secret: string): boolean {
  if (!secret || !paymentId || !subscriptionId || !signature) return false;
  return safeEqual(hmacHex(secret, `${paymentId}|${subscriptionId}`), signature);
}

/** Webhook calls: X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret). */
export function isValidWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false;
  return safeEqual(hmacHex(webhookSecret, rawBody), signature);
}
