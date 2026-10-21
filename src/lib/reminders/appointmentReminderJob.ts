/**
 * Sends the 24-hour appointment reminder. Run hourly by the cron route (src/routes/api.cron.appointment-reminders.ts).
 * State lives on the appointment row at `data.reminder`, so no schema change and no extra collection.
 *
 * Policy:
 *  - due once now >= start - 24h; an appointment booked inside 24h is reminded on the next run, unless it starts within 1h.
 *  - rescheduling changes `slotKey` (date|time), which makes any earlier reminder irrelevant: the new slot is reminded afresh.
 *  - cancelled / completed / no-show appointments are never reminded.
 *  - a reminder is claimed with a compare-and-set on `nonce` before sending, so overlapping runs cannot double-send.
 *  - failures retry on later runs, up to MAX_ATTEMPTS.
 */
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { Owner } from "@/lib/mongodb/models/Owner";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { apptStartMs, reminderTestRecipient, sendAppointmentReminder } from "@/lib/email/appointmentReminder";

const HOUR = 3_600_000;
const MAX_ATTEMPTS = 3;
const CLAIM_STALE_MS = 10 * 60_000;
const INACTIVE = /cancel|complete|no[-\s]?show/i;

type Reminder = { slotKey?: string; status?: string; attempts?: number; nonce?: string; claimedAt?: string; testMode?: boolean };

export interface JobResult {
  testMode: boolean;
  checked: number;
  sent: string[];
  skipped: Record<string, string>;
  failed: Record<string, string>;
}

export async function runAppointmentReminders(opts: { dryRun?: boolean; now?: number } = {}): Promise<JobResult> {
  await connectDB();
  const now = opts.now ?? Date.now();
  const testRecipient = reminderTestRecipient();
  const testMode = !!testRecipient;
  const out: JobResult = { testMode, checked: 0, sent: [], skipped: {}, failed: {} };

  // Prefilter by date text (clinic-local "YYYY-MM-DD"): today through two days ahead, in IST.
  const istDay = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
  const rows = await ErpRow.find({
    moduleId: "appointments",
    "data.appointment_date": { $gte: istDay(now), $lte: istDay(now + 48 * HOUR) },
  }).lean();

  for (const row of rows) {
    const d = (row.data || {}) as Record<string, any>;
    const id = String(d["token"] ?? row._id);
    out.checked++;
    if (INACTIVE.test(String(d["status"] || ""))) { out.skipped[id] = "inactive status"; continue; }

    const time = d["time"] || d["slot"];
    const start = apptStartMs(d["appointment_date"], time);
    if (start === null) { out.skipped[id] = "unreadable date/time"; continue; }
    if (now < start - 24 * HOUR) { out.skipped[id] = "not due yet"; continue; }
    if (start - now < HOUR) { out.skipped[id] = "too late"; continue; }

    const slotKey = `${String(d["appointment_date"]).slice(0, 10)}|${time}`;
    const r: Reminder = d["reminder"]?.slotKey === slotKey ? d["reminder"] : {};
    if (r.status === "sent" && !!r.testMode === testMode) { out.skipped[id] = "already sent"; continue; }
    if (r.status === "failed" && (r.attempts ?? 0) >= MAX_ATTEMPTS && !!r.testMode === testMode) { out.skipped[id] = "retries exhausted"; continue; }
    if (r.status === "sending" && now - Date.parse(r.claimedAt || "") < CLAIM_STALE_MS) { out.skipped[id] = "in progress"; continue; }

    let email = String(d["ownerEmail"] || "").trim();
    if (!email && d["ownerId"]) email = String((await Owner.findOne({ ownerId: d["ownerId"] }).lean())?.email || "").trim();
    if (opts.dryRun) { out.sent.push(`${id} (dry run → ${testRecipient || email || "NO EMAIL"})`); continue; }

    // Compare-and-set claim: only one concurrent run gets past this.
    const nonce = `${now}-${Math.random().toString(36).slice(2)}`;
    const attempts = (r.attempts ?? 0) + (r.status === "failed" ? 1 : 0);
    const claim = await ErpRow.updateOne(
      { _id: row._id, ...(d["reminder"]?.nonce ? { "data.reminder.nonce": d["reminder"].nonce } : { "data.reminder": { $exists: false } }) },
      { $set: { "data.reminder": { slotKey, status: "sending", attempts, nonce, claimedAt: new Date(now).toISOString(), testMode } } },
    );
    if (claim.modifiedCount !== 1) { out.skipped[id] = "claimed elsewhere"; continue; }

    let next: Record<string, unknown>;
    try {
      const to = await sendAppointmentReminder({
        toEmail: email,
        ownerName: String(d["owner"] || ""),
        petName: String(d["pet"] || ""),
        date: d["appointment_date"],
        time,
        doctorName: String(d["doctor"] || ""),
        clinicName: CLINIC_CONFIG.fullName,
      });
      next = { status: "sent", sentAt: new Date().toISOString(), sentTo: testMode ? "(test recipient)" : to, error: "" };
      out.sent.push(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // No address is a data gap, not a failed attempt: it is retried (free) once an email is added.
      next = msg === "no_email"
        ? { status: "no_email", error: "No email on file" }
        : { status: "failed", error: msg.slice(0, 300) };
      out.failed[id] = String(next["error"]);
    }
    const set = Object.fromEntries(Object.entries(next).map(([k, v]) => [`data.reminder.${k}`, v]));
    await ErpRow.updateOne({ _id: row._id, "data.reminder.nonce": nonce }, { $set: set });
  }
  return out;
}
