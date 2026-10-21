/**
 * Pure trial-reminder rules (no database, no email): day maths, which stage is due, and the wording of each stage.
 * All dates are clinic-local "YYYY-MM-DD" strings (IST), never `new Date(string)`, so the calendar day cannot shift.
 */
import { formatApptDate } from "@/lib/email/appointmentReminder";

export const TRIAL_DAYS = 15;

export type TrialStage = "welcome" | "day8" | "day12" | "day14" | "expiry" | "followup";

/** `remaining` = days left on the trial when the stage becomes due (the trial ends on its end date). */
const STAGES: { key: TrialStage; remaining: number }[] = [
  { key: "welcome", remaining: TRIAL_DAYS },
  { key: "day8", remaining: 7 },
  { key: "day12", remaining: 3 },
  { key: "day14", remaining: 1 },
  { key: "expiry", remaining: 0 },
];

const DAY = 86_400_000;
const ymdMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Today's clinic-local date (IST, fixed +05:30). */
export const istToday = (nowMs: number = Date.now()) => new Date(nowMs + 330 * 60_000).toISOString().slice(0, 10);

export const addDaysYmd = (d: string, n: number) => new Date(ymdMs(d) + n * DAY).toISOString().slice(0, 10);

/** Whole days from `today` to `end` (negative once the end date has passed). */
export const daysRemaining = (end: string, today: string) => Math.round((ymdMs(end) - ymdMs(today)) / DAY);

/**
 * The single stage to send now, or null. If the scheduler was down, only the latest due stage is sent
 * (a "3 days left" mail is pointless once the trial has ended).
 * @param followupDays days after expiry for the optional follow-up; 0 disables it.
 */
export function dueStage(endDate: string, today: string, followupDays: number): TrialStage | null {
  const rem = daysRemaining(endDate, today);
  const all = followupDays > 0 ? [...STAGES, { key: "followup" as const, remaining: -followupDays }] : STAGES;
  const due = all.filter((s) => s.remaining >= rem);
  return due.length ? due[due.length - 1]!.key : null;
}

export interface StageContent {
  email_subject: string;
  email_heading: string;
  email_message: string;
  trial_status_text: string;
  next_steps_message: string;
  cta_text: string;
}

export function stageContent(stage: TrialStage, clinicName: string, endDate: string): StageContent {
  const end = formatApptDate(endDate);
  const sub = "Subscribe to keep using VetOS without interruption.";
  switch (stage) {
    case "welcome":
      return {
        email_subject: `Welcome to VetOS — your ${TRIAL_DAYS}-day free trial has started`,
        email_heading: "Welcome to VetOS!",
        email_message: `Thank you for choosing VetOS for ${clinicName}. Your ${TRIAL_DAYS}-day free trial has started and runs until ${end}.`,
        trial_status_text: `${TRIAL_DAYS} days remaining`,
        next_steps_message: "Explore patients, appointments, billing and prescriptions, and invite your team. You can subscribe at any time during the trial.",
        cta_text: "View Subscription Plans",
      };
    case "day8":
      return {
        email_subject: "Your VetOS free trial has 7 days left",
        email_heading: "7 days left in your free trial",
        email_message: `Your free trial for ${clinicName} ends on ${end}. A week remains to explore everything VetOS offers.`,
        trial_status_text: "7 days remaining",
        next_steps_message: sub,
        cta_text: "Choose a Plan",
      };
    case "day12":
      return {
        email_subject: "Your VetOS free trial ends in 3 days",
        email_heading: "Only 3 days left",
        email_message: `Your free trial for ${clinicName} ends on ${end}.`,
        trial_status_text: "3 days remaining",
        next_steps_message: sub,
        cta_text: "Subscribe Now",
      };
    case "day14":
      return {
        email_subject: "Final reminder: your VetOS free trial ends tomorrow",
        email_heading: "Your free trial ends tomorrow",
        email_message: `This is a final reminder that the free trial for ${clinicName} ends tomorrow, ${end}.`,
        trial_status_text: "1 day remaining",
        next_steps_message: sub,
        cta_text: "Subscribe Now",
      };
    case "expiry":
      return {
        email_subject: "Your VetOS free trial has ended",
        email_heading: "Your free trial has ended",
        email_message: `The ${TRIAL_DAYS}-day free trial for ${clinicName} ended on ${end}.`,
        trial_status_text: "Trial ended",
        next_steps_message: "Subscribe to continue using VetOS. If you need help or more time to decide, contact our support team.",
        cta_text: "Subscribe to Continue",
      };
    case "followup":
      return {
        email_subject: "We'd love to have you back on VetOS",
        email_heading: "Still thinking it over?",
        email_message: `The free trial for ${clinicName} ended on ${end}, and we haven't seen a subscription yet.`,
        trial_status_text: "Trial ended",
        next_steps_message: "Subscribe to pick up where you left off, or contact support if you have questions.",
        cta_text: "Subscribe to Continue",
      };
  }
}
