import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { daysLeftLabel, formatPlanDate, getPlanTimeline, type PlanTimeline } from "@/lib/erp/planTimeline";

type Tone = "good" | "warn" | "bad";
const TONE: Record<Tone, { box: string; text: string; bar: string }> = {
  good: { box: "border-success/30 bg-success-soft", text: "text-success", bar: "bg-success" },
  warn: { box: "border-warning/40 bg-warning-soft", text: "text-warning", bar: "bg-warning" },
  bad: { box: "border-destructive/30 bg-destructive/10", text: "text-destructive", bar: "bg-destructive" },
};
/** green above 7 days, amber at 7 or less, red once expired. */
const toneOf = (tl: PlanTimeline): Tone => (tl.state === "expired" ? "bad" : tl.state === "ending-soon" || tl.state === "ends-today" ? "warn" : "good");

/** Updates once a second while mounted; the interval is cleared on unmount (popup close / tab change). */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Live countdown to the plan end date. Days match the "days left" shown in the clinics list and Overview (same helper). */
export function PlanCountdown({
  tenant,
}: {
  tenant: { createdAt?: string; trialEndsAt?: string; paidUntil?: string; subscriptionStatus?: string };
}) {
  const now = useNow(1000);
  const tl = getPlanTimeline(tenant, now);
  const tone = toneOf(tl);
  const remaining = tl.countdownTarget === null ? 0 : Math.max(0, tl.countdownTarget - now.getTime());
  const parts: Array<[string, number]> = [
    ["Days", Math.floor(remaining / 86_400_000)],
    ["Hours", Math.floor(remaining / 3_600_000) % 24],
    ["Minutes", Math.floor(remaining / 60_000) % 60],
    ["Seconds", Math.floor(remaining / 1000) % 60],
  ];
  return (
    <section className={`rounded-lg border p-4 ${TONE[tone].box}`} aria-label="Plan countdown">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><CalendarClock className="size-3.5" /> Plan countdown</h3>
      {tl.state === "no-end" ? (
        <p className="text-sm text-muted-foreground">No end date set</p>
      ) : tl.state === "expired" ? (
        <p className={`text-lg font-bold ${TONE[tone].text}`}>{daysLeftLabel(tl)}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
          {parts.map(([label, n]) => (
            <div key={label} className="rounded-lg border border-border bg-background py-2 text-center">
              <p className={`text-2xl font-bold tabular-nums ${TONE[tone].text}`}>{String(n).padStart(2, "0")}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      {tl.state !== "no-end" && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(tl.percentUsed)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${TONE[tone].bar}`} style={{ width: `${tl.percentUsed}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 text-xs text-muted-foreground">
            <span>Plan started {formatPlanDate(tl.startsAt)}</span>
            <span>{tenant.subscriptionStatus === "TRIAL" ? "Trial ends" : "Plan ends"} {formatPlanDate(tl.endsAt)}</span>
          </div>
        </>
      )}
    </section>
  );
}
