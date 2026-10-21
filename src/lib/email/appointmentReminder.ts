/**
 * Appointment-reminder email (EmailJS template "VetOS - Appointment Reminder"), sent server-side.
 * Appointments store `appointment_date` as a "YYYY-MM-DD" string and `time`/`slot` as "11:30 AM" (ErpRow, moduleId "appointments").
 * Everything is parsed as clinic-local wall-clock text — never through `new Date(string)` — so the calendar day cannot shift with UTC.
 */
const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Clinic timezone is Asia/Kolkata (fixed +05:30, no DST), same assumption as todayIST() in dateUtils. */
export const CLINIC_UTC_OFFSET_MIN = 330;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" (or an ISO string starting with it) → [y, m, d]; null for anything else, incl. numbers and impossible dates. */
function parseYmd(v: unknown): [number, number, number] | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const chk = new Date(Date.UTC(y, mo - 1, d));
  return chk.getUTCFullYear() === y && chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === d ? [y, mo, d] : null;
}

/** "2026-10-21" → "21/10/2026"; "" when missing or invalid. */
export function formatApptDate(v: unknown): string {
  const p = parseYmd(v);
  return p ? `${pad(p[2])}/${pad(p[1])}/${p[0]}` : "";
}

/** "10:30 AM", "9:30 pm", "14:30" or "09:05" → [hour24, minute]; null when unreadable. */
function parseTime(v: unknown): [number, number] | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})\s*([ap]m)?$/i.exec(v.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap === "pm" ? 12 : 0);
  } else if (h > 23) return null;
  return [h, min];
}

/** → "10:30 AM"; "" when missing or invalid. */
export function formatApptTime(v: unknown): string {
  const t = parseTime(v);
  return t ? `${t[0] % 12 || 12}:${pad(t[1])} ${t[0] < 12 ? "AM" : "PM"}` : "";
}

/** Appointment start as epoch ms (UTC), or null when date or time is unreadable. */
export function apptStartMs(date: unknown, time: unknown): number | null {
  const d = parseYmd(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  return Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]) - CLINIC_UTC_OFFSET_MIN * 60_000;
}

const env = (k: string) => process.env[k] || "";

/** .env is only read at server start; pick up values added later (loadEnvFile never overrides real env vars). */
export function ensureEnv() {
  if (env("EMAILJS_REMINDER_TEST_RECIPIENT") || env("CRON_SECRET")) return;
  for (const f of [".env.local", ".env"]) {
    try {
      (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(f);
    } catch {
      /* file absent (deployed host) — real env vars are used */
    }
  }
}

/** Test mode is ON unless EMAILJS_REMINDER_TEST_MODE=off, so production needs an explicit config change. */
export function reminderTestRecipient(): string {
  ensureEnv();
  if (env("EMAILJS_REMINDER_TEST_MODE").toLowerCase() === "off") return "";
  return env("EMAILJS_REMINDER_TEST_RECIPIENT") || "guildifyprojects@gmail.com";
}

export interface ReminderInput {
  toEmail: string;
  ownerName: string;
  petName: string;
  date: unknown;
  time: unknown;
  doctorName: string;
  clinicName: string;
}

/** Posts one template send to EmailJS (service/public/private key from env). Throws a credential-free message unless EmailJS accepts it. */
export async function postEmailJs(templateId: string, templateParams: Record<string, string>): Promise<void> {
  ensureEnv();
  const privateKey = env("EMAILJS_REMINDER_PRIVATE_KEY");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: env("EMAILJS_REMINDER_SERVICE_ID") || "service_bxqqzum",
      template_id: templateId,
      user_id: env("EMAILJS_REMINDER_PUBLIC_KEY") || "WeGjDfivGGj9_LXGK",
      ...(privateKey ? { accessToken: privateKey } : {}),
      template_params: templateParams,
    }),
  });
  const body = (await res.text()).slice(0, 200);
  if (!res.ok) throw new Error(`EmailJS ${res.status}: ${body}`);
}

/** Sends one reminder. Returns the address used; throws a credential-free message on any failure. */
export async function sendAppointmentReminder(i: ReminderInput): Promise<string> {
  ensureEnv();
  const to = (reminderTestRecipient() || i.toEmail).trim();
  if (!EMAIL_RE.test(to)) throw new Error("no_email");
  const date = formatApptDate(i.date);
  const time = formatApptTime(i.time);
  if (!date || !time) throw new Error("Appointment date or time is missing or unreadable");
  await postEmailJs(env("EMAILJS_REMINDER_TEMPLATE_ID") || "template_haqxgwp", {
    to_email: to,
    to_name: i.ownerName,
    clinic_name: i.clinicName,
    pet_name: i.petName,
    appointment_date: date,
    appointment_time: time,
    doctor_name: i.doctorName,
  });
  return to;
}
