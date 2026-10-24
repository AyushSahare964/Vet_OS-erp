/**
 * Single source of truth for a clinic's plan period / days left. Every Tenants-page view
 * (list, details popup, countdown) must call this so the numbers always agree.
 * Calendar days are counted in IST (Asia/Kolkata), the clinics' timezone, whatever the browser's zone is.
 */

export interface PlanTimeline {
  startsAt: Date | null;
  endsAt: Date | null;
  /** Calendar days (IST) until the end date; 0 = ends today, negative = already expired. null = no end date. */
  daysLeft: number | null;
  /** 0-100, how much of the plan period has passed. */
  percentUsed: number;
  state: "no-end" | "expired" | "ends-today" | "ending-soon" | "running";
  /** Epoch ms of the last instant of the end day (IST). The live countdown runs to this. */
  countdownTarget: number | null;
}

export const ENDING_SOON_DAYS = 7;
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** IST calendar-day index (days since epoch) for an instant. */
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

export function getPlanTimeline(
  tenant: {
    createdAt?: string | Date | undefined;
    trialEndsAt?: string | Date | null | undefined;
    /** Paid plans end here; a trial ends at trialEndsAt. */
    paidUntil?: string | Date | null | undefined;
    subscriptionStatus?: string | undefined;
  },
  now: Date = new Date(),
): PlanTimeline {
  const startsAt = tenant.createdAt ? new Date(tenant.createdAt) : null;
  const endRaw = tenant.subscriptionStatus === "TRIAL" ? tenant.trialEndsAt : (tenant.paidUntil ?? tenant.trialEndsAt);
  const endsAt = endRaw ? new Date(endRaw) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    return { startsAt, endsAt: null, daysLeft: null, percentUsed: 0, state: "no-end", countdownTarget: null };
  }
  const daysLeft = istDay(endsAt.getTime()) - istDay(now.getTime());
  let percentUsed = 100;
  if (startsAt && endsAt.getTime() > startsAt.getTime()) {
    percentUsed = Math.min(100, Math.max(0, ((now.getTime() - startsAt.getTime()) / (endsAt.getTime() - startsAt.getTime())) * 100));
  }
  const state: PlanTimeline["state"] =
    daysLeft < 0 ? "expired" : daysLeft === 0 ? "ends-today" : daysLeft <= ENDING_SOON_DAYS ? "ending-soon" : "running";
  const countdownTarget = (istDay(endsAt.getTime()) + 1) * DAY_MS - IST_OFFSET_MS - 1;
  return { startsAt, endsAt, daysLeft, percentUsed, state, countdownTarget };
}

export function daysLeftLabel(t: PlanTimeline): string {
  if (t.daysLeft === null) return "No end date";
  if (t.daysLeft < 0) return `Expired ${-t.daysLeft} day${t.daysLeft === -1 ? "" : "s"} ago`;
  if (t.daysLeft === 0) return "Ends today";
  return `${t.daysLeft} day${t.daysLeft === 1 ? "" : "s"} left`;
}

export function formatPlanDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
}
