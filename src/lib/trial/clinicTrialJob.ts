/**
 * Sends the VetOS free-trial reminders (EmailJS template "Subscription Reminder"). Runs hourly from the cron route
 * (src/routes/api.cron.appointment-reminders.ts). State is on the ClinicTrial row, so repeated or overlapping runs are safe:
 *  - one stage is chosen per run (the latest due one) and claimed with a compare-and-set on its `nonce` before sending;
 *  - only a send that EmailJS accepted is recorded as "sent"; failures retry on later runs, up to MAX_ATTEMPTS;
 *  - paid / cancelled clinics are never selected, and the claim re-checks status, so a clinic that subscribes mid-run is skipped;
 *  - this job only sends mail and flips trial -> expired; it never touches login or access.
 */
import { connectDB } from "@/lib/mongodb/client";
import { ClinicTrial } from "@/lib/mongodb/models/ClinicTrial";
import { User } from "@/lib/mongodb/models/User";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { appUrl } from "@/lib/email/emailjs";
import { ensureEnv, postEmailJs } from "@/lib/email/appointmentReminder";
import { dueStage, istToday, stageContent } from "@/lib/trial/trialSchedule";
import { formatApptDate } from "@/lib/email/appointmentReminder";

const MAX_ATTEMPTS = 3;
const CLAIM_STALE_MS = 10 * 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const env = (k: string) => process.env[k] || "";

/** Test mode is ON unless EMAILJS_TRIAL_TEST_MODE=off: production needs an explicit config change. */
export function trialTestRecipient(): string {
  ensureEnv();
  if (env("EMAILJS_TRIAL_TEST_MODE").toLowerCase() === "off") return "";
  return env("EMAILJS_TRIAL_TEST_RECIPIENT") || "guildifyprojects@gmail.com";
}

export interface TrialJobResult {
  testMode: boolean;
  checked: number;
  sent: string[];
  skipped: Record<string, string>;
  failed: Record<string, string>;
}

type Rem = { status?: string; attempts?: number; nonce?: string; claimedAt?: string; testMode?: boolean };

export async function runTrialReminders(opts: { dryRun?: boolean; now?: number } = {}): Promise<TrialJobResult> {
  await connectDB();
  ensureEnv();
  const now = opts.now ?? Date.now();
  const today = istToday(now);
  const testRecipient = trialTestRecipient();
  const testMode = !!testRecipient;
  const followupDays = Math.max(0, Number(env("TRIAL_FOLLOWUP_DAYS") || 3) || 0);
  const out: TrialJobResult = { testMode, checked: 0, sent: [], skipped: {}, failed: {} };

  const trials = await ClinicTrial.find({ status: { $in: ["trial", "expired"] } }).lean();
  for (const t of trials) {
    const id = t.clinicKey;
    out.checked++;
    if (t.status === "trial" && today >= t.endDate && !opts.dryRun) {
      await ClinicTrial.updateOne({ _id: t._id, status: "trial" }, { $set: { status: "expired" } });
    }

    const stage = dueStage(t.endDate, today, followupDays);
    if (!stage) { out.skipped[id] = "no stage due"; continue; }
    const r = ((t.reminders || {})[stage] || {}) as Rem;
    if (r.status === "sent" && !!r.testMode === testMode) { out.skipped[id] = `${stage}: already sent`; continue; }
    if (r.status === "failed" && (r.attempts ?? 0) >= MAX_ATTEMPTS && !!r.testMode === testMode) { out.skipped[id] = `${stage}: retries exhausted`; continue; }
    if (r.status === "sending" && now - Date.parse(r.claimedAt || "") < CLAIM_STALE_MS) { out.skipped[id] = `${stage}: in progress`; continue; }

    // Contact: the registering admin if still eligible, else another active approved admin of the clinic.
    let contact: { name: string; email: string } | null = null;
    if (t.ownerUserId) {
      let u = await User.findById(t.ownerUserId).lean().catch(() => null);
      if (!u || !u.isActive || u.approvalStatus === "rejected") {
        u = await User.findOne({ clinicName: t.clinicName, roleId: "admin", isActive: true, approvalStatus: "approved" }).lean();
      }
      if (u) contact = { name: u.fullName, email: u.email };
    } else {
      contact = { name: t.ownerName, email: t.ownerEmail };
    }
    if (!contact) { out.skipped[id] = "no eligible contact"; continue; }
    if (opts.dryRun) { out.sent.push(`${id}:${stage} (dry run → ${testRecipient || "client"})`); continue; }

    const path = `reminders.${stage}`;
    const nonce = `${now}-${Math.random().toString(36).slice(2)}`;
    const attempts = (r.attempts ?? 0) + (r.status === "failed" ? 1 : 0);
    const claim = await ClinicTrial.updateOne(
      { _id: t._id, status: { $in: ["trial", "expired"] }, ...(r.nonce ? { [`${path}.nonce`]: r.nonce } : { [path]: { $exists: false } }) },
      { $set: { [path]: { status: "sending", attempts, nonce, claimedAt: new Date(now).toISOString(), testMode } } },
    );
    if (claim.modifiedCount !== 1) { out.skipped[id] = `${stage}: claimed elsewhere or status changed`; continue; }

    let next: Record<string, unknown>;
    try {
      const to = (testRecipient || contact.email).trim();
      if (!EMAIL_RE.test(to)) throw new Error("no_email");
      const c = stageContent(stage, t.clinicName, t.endDate);
      await postEmailJs(env("EMAILJS_TRIAL_TEMPLATE_ID") || "template_kcs6lzp", {
        email_subject: c.email_subject,
        to_name: contact.name,
        email_heading: c.email_heading,
        email_message: c.email_message,
        clinic_name: t.clinicName,
        trial_end_date: formatApptDate(t.endDate),
        trial_status_text: c.trial_status_text,
        next_steps_message: c.next_steps_message,
        subscription_url: env("TRIAL_SUBSCRIPTION_URL") || `${appUrl()}/m/subscriptions`,
        cta_text: c.cta_text,
        support_email: env("TRIAL_SUPPORT_EMAIL") || CLINIC_CONFIG.email,
        to_email: to,
      });
      next = { status: "sent", sentAt: new Date().toISOString(), error: "" };
      out.sent.push(`${id}:${stage}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      next = msg === "no_email" ? { status: "no_email", error: "No email on file" } : { status: "failed", error: msg.slice(0, 300) };
      out.failed[`${id}:${stage}`] = String(next["error"]);
    }
    const set = Object.fromEntries(Object.entries(next).map(([k, v]) => [`${path}.${k}`, v]));
    await ClinicTrial.updateOne({ _id: t._id, [`${path}.nonce`]: nonce }, { $set: set });
  }
  return out;
}
