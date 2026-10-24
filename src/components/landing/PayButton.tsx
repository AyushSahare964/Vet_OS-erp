import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createPlanSubscriptionFn, verifyPlanPaymentFn } from "@/lib/mongodb/serverFns/planPayments";

interface RazorpaySuccess {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayCheckout {
  open: () => void;
  on: (event: "payment.failed", cb: () => void) => void;
}
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayCheckout;

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<RazorpayCtor | null> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.onload = () => resolve(w.Razorpay ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

/** Pro plan button: Razorpay checkout, then straight on to clinic registration with the verified payment. */
export function PayButton({ className, label, onMessage, onPaid, test }: { className: string; label: string; test?: boolean; onMessage: (m: string) => void; onPaid?: (paymentId: string) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    onMessage("");
    try {
      const [Razorpay, order] = await Promise.all([loadCheckout(), createPlanSubscriptionFn({ data: { planId: "plan_professional", test } })]);
      if (!order.ok) return onMessage(order.message);
      if (!Razorpay) return onMessage("Could not load the payment window. Check your connection and try again.");
      const rz = new Razorpay({
        key: order.keyId,
        subscription_id: order.subscriptionId,
        name: "VetechIQ",
        description: test ? "TEST payment, Rs 1" : "Pro plan, monthly (incl. 18% GST)",
        theme: { color: "#5B32E8" },
        handler: async (r: RazorpaySuccess) => {
          const v = await verifyPlanPaymentFn({
            data: { subscriptionId: r.razorpay_subscription_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature },
          });
          if (!v.ok) return onMessage(v.message ?? "Payment could not be verified.");
          if (onPaid) return onPaid(r.razorpay_payment_id);
          void navigate({ to: "/register-clinic", search: { plan: "plan_professional", pay: r.razorpay_payment_id } });
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on("payment.failed", () => onMessage("Payment failed. Please try again."));
      rz.open();
    } catch {
      onMessage("Something went wrong starting the payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={pay} disabled={busy} className={`${className} disabled:opacity-60`}>
      {busy ? "Opening payment…" : label}
    </button>
  );
}
