/**
 * Resend email sender for VetOS Cloud.
 * Used for transactional platform emails: clinic welcome, credential delivery, etc.
 * Never throws — email failures must never break clinic provisioning.
 *
 * Env vars:
 *   RESEND_API_KEY   — your Resend secret key (re_...)
 *   RESEND_FROM      — verified "From" address (e.g. "VetOS Cloud <noreply@yourdomain.com>")
 *                      Defaults to onboarding@resend.dev for local/testing.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ensureEnv() {
  if (process.env["RESEND_API_KEY"]) return;
  try {
    (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
  } catch {
    /* deployed — real env vars are used */
  }
}

function getConfig() {
  ensureEnv();
  return {
    apiKey: process.env["RESEND_API_KEY"] ?? "",
    from: process.env["RESEND_FROM"] ?? "VetOS Cloud <onboarding@resend.dev>",
  };
}

export interface ResendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Optional reply-to address */
  replyTo?: string;
}

/**
 * Send a transactional email via Resend.
 * Returns true on success, false on any failure (logs a warning).
 */
export async function sendResendEmail(input: ResendEmailInput): Promise<boolean> {
  const to = (input.to ?? "").trim();
  if (!EMAIL_RE.test(to)) {
    console.warn(`[resend] Skipped email — invalid address: "${to}"`);
    return false;
  }

  const { apiKey, from } = getConfig();
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY is not set — skipping email send.");
    return false;
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: [to],
      subject: input.subject,
      html: input.html,
    };
    if (input.replyTo) body["reply_to"] = input.replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[resend] Rejected "${input.subject}" → ${to}: ${res.status} ${errText}`);
      return false;
    }

    const json = await res.json() as { id?: string };
    console.log(`[resend] Sent "${input.subject}" → ${to} (id: ${json.id ?? "n/a"})`);
    return true;
  } catch (e) {
    console.warn("[resend] send failed:", e);
    return false;
  }
}
