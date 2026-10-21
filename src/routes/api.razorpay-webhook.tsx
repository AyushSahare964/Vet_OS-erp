import { createFileRoute } from "@tanstack/react-router";
import { connectDB } from "@/lib/mongodb/client";
import { TenantModel } from "@/lib/mongodb/models/Tenant";
import { isValidWebhookSignature } from "@/lib/erp/razorpaySignature";

/**
 * Razorpay -> us, for the monthly renewals. Set up once in the Razorpay dashboard (Settings > Webhooks):
 *   URL    https://<your-domain>/api/razorpay-webhook
 *   Secret the same value as RAZORPAY_WEBHOOK_SECRET in the server env
 *   Events subscription.charged, subscription.halted, subscription.cancelled, subscription.completed
 */
interface RzpEvent {
  event: string;
  payload?: { subscription?: { entity?: { id?: string; current_end?: number } } };
}

export const Route = createFileRoute("/api/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"] || "";
        const raw = await request.text();
        if (!isValidWebhookSignature(raw, request.headers.get("x-razorpay-signature") || "", secret)) {
          return new Response("invalid signature", { status: 400 });
        }
        const evt = JSON.parse(raw) as RzpEvent;
        const sub = evt.payload?.subscription?.entity;
        if (!sub?.id) return new Response("ok");

        await connectDB();
        if (evt.event === "subscription.charged" && sub.current_end) {
          // a renewal went through: the paid period now runs to the end of this billing cycle
          await TenantModel.updateOne(
            { razorpaySubscriptionId: sub.id },
            { subscriptionStatus: "ACTIVE", paidUntil: new Date(sub.current_end * 1000) },
          );
        } else if (["subscription.halted", "subscription.cancelled", "subscription.completed"].includes(evt.event)) {
          // paidUntil is left alone so the clinic keeps access until the period it already paid for ends
          await TenantModel.updateOne({ razorpaySubscriptionId: sub.id }, { subscriptionStatus: "CANCELLED" });
        }
        return new Response("ok");
      },
    },
  },
});
