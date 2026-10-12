/**
 * Clinic Welcome Email — sent once after a new clinic self-registers on VetOS Cloud.
 * Delivers the admin's login credentials (email + password) so they can immediately
 * sign in and start adding staff.
 *
 * Intentionally standalone — does NOT import CLINIC_CONFIG because the new
 * tenant's clinic_config document was just seeded and is not yet in the
 * resolution cache. All branding data is passed in as explicit parameters.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClinicWelcomeEmailProps {
  /** Full name of the registered admin (e.g. "Dr. Jane Doe") */
  adminName: string;
  /** Admin login email — also used as the user ID */
  adminEmail: string;
  /** Plain-text password chosen during registration */
  adminPassword: string;
  /** Clinic display name (e.g. "Sunrise Pet Hospital") */
  clinicName: string;
  /** Plan name (e.g. "Professional") */
  planName: string;
  /** ISO date string for trial end (e.g. "2026-10-24") */
  trialEndsAt: string;
  /** Public URL of the login page (e.g. "https://app.yourdomain.com/login") */
  loginUrl: string;
  /** Optional primary brand colour — defaults to VetOS blue */
  primaryColor?: string;
}

// ─── Template ────────────────────────────────────────────────────────────────

export function buildClinicWelcomeEmail(p: ClinicWelcomeEmailProps): { subject: string; html: string } {
  const primary = p.primaryColor || "#2563eb";
  const primaryDark = darken(primary);
  const trialDate = (() => {
    try {
      return new Date(p.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return p.trialEndsAt;
    }
  })();

  const subject = `Welcome to VetOS Cloud — Your ${p.clinicName} Admin Credentials`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">

  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f1f5f9;opacity:0;">
    Your ${esc(p.clinicName)} admin credentials are ready. Log in now to get started!
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f1f5f9;padding:40px 12px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 32px rgba(15,23,42,0.08);">

          <!-- Hero Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${esc(primary)} 0%,${esc(primaryDark)} 100%);padding:36px 32px 0 32px;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border-radius:9999px;margin-bottom:18px;">
                VetOS Cloud Platform
              </div>
              <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.25;margin-bottom:8px;">
                Welcome aboard,<br>${esc(p.adminName)}! &#127881;
              </div>
              <div style="font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;padding-bottom:28px;">
                Your clinic <strong style="color:#ffffff;">${esc(p.clinicName)}</strong> is live on VetOS Cloud.
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="line-height:0;padding:0;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 30" width="600" height="30" style="display:block;width:100%;">
                    <path d="M0,30 L0,15 Q150,0 300,15 Q450,30 600,15 L600,30 Z" fill="#ffffff"/>
                  </svg>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:20px 32px 8px 32px;">
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#475569;">
                Your clinic workspace has been provisioned and is ready to use. Below are your <strong>administrator login credentials</strong>. Keep them safe and change your password after your first login.
              </p>
            </td>
          </tr>

          <!-- Credentials Box -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:2px solid #bae6fd;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px 24px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${esc(primary)};margin-bottom:14px;">
                      &#128274; Your Login Credentials
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                           style="background:#ffffff;border-radius:8px;border:1px solid #bae6fd;">
                      <tr>
                        <td style="padding:14px 18px;border-bottom:1px solid #e0f2fe;">
                          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;">Login Email (User ID)</div>
                          <div style="font-size:15px;font-weight:700;color:#0f172a;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;">${esc(p.adminEmail)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 18px;">
                          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;">Password</div>
                          <div style="font-size:15px;font-weight:700;color:#0f172a;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;letter-spacing:2px;">${esc(p.adminPassword)}</div>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:12px;color:#0369a1;font-style:italic;margin-top:10px;padding-bottom:4px;">
                      &#128161; We recommend changing your password immediately after your first login.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Clinic Summary -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Clinic Summary</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:9px 16px;color:#64748b;font-size:13px;font-weight:500;width:38%;border-bottom:1px solid #e2e8f0;">Clinic Name</td>
                  <td style="padding:9px 16px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${esc(p.clinicName)}</td>
                </tr>
                <tr>
                  <td style="padding:9px 16px;color:#64748b;font-size:13px;font-weight:500;width:38%;border-bottom:1px solid #e2e8f0;">Subscription Plan</td>
                  <td style="padding:9px 16px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${esc(p.planName)} &mdash; 14-Day Free Trial</td>
                </tr>
                <tr>
                  <td style="padding:9px 16px;color:#64748b;font-size:13px;font-weight:500;width:38%;border-bottom:1px solid #e2e8f0;">Trial Ends</td>
                  <td style="padding:9px 16px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">${esc(trialDate)}</td>
                </tr>
                <tr>
                  <td style="padding:9px 16px;color:#64748b;font-size:13px;font-weight:500;width:38%;">Administrator</td>
                  <td style="padding:9px 16px;color:#0f172a;font-size:13px;font-weight:600;">${esc(p.adminName)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px 32px;text-align:center;">
              <a href="${esc(p.loginUrl)}"
                 style="display:inline-block;background:linear-gradient(135deg,${esc(primary)} 0%,${esc(primaryDark)} 100%);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:10px;letter-spacing:0.2px;">
                Sign In to Your Clinic &rarr;
              </a>
              <div style="margin-top:10px;font-size:11px;color:#94a3b8;">${esc(p.loginUrl)}</div>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
                <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.8px;">&#9989; Getting Started</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="28" style="vertical-align:top;padding-right:8px;padding-bottom:10px;">
                      <div style="width:20px;height:20px;background:#16a34a;border-radius:50%;color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:20px;">1</div>
                    </td>
                    <td style="vertical-align:top;padding-bottom:10px;">
                      <div style="font-size:13px;font-weight:700;color:#166534;">Sign in</div>
                      <div style="font-size:12px;color:#15803d;">Use the credentials above to access your admin dashboard.</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="28" style="vertical-align:top;padding-right:8px;padding-bottom:10px;">
                      <div style="width:20px;height:20px;background:#16a34a;border-radius:50%;color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:20px;">2</div>
                    </td>
                    <td style="vertical-align:top;padding-bottom:10px;">
                      <div style="font-size:13px;font-weight:700;color:#166534;">Add your staff</div>
                      <div style="font-size:12px;color:#15803d;">Go to Staff &rarr; Invite your doctors, receptionists &amp; support team.</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="28" style="vertical-align:top;padding-right:8px;padding-bottom:10px;">
                      <div style="width:20px;height:20px;background:#16a34a;border-radius:50%;color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:20px;">3</div>
                    </td>
                    <td style="vertical-align:top;padding-bottom:10px;">
                      <div style="font-size:13px;font-weight:700;color:#166534;">Configure your branding</div>
                      <div style="font-size:12px;color:#15803d;">Upload your clinic logo and set your brand colour in Settings.</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="28" style="vertical-align:top;padding-right:8px;">
                      <div style="width:20px;height:20px;background:#16a34a;border-radius:50%;color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:20px;">4</div>
                    </td>
                    <td style="vertical-align:top;">
                      <div style="font-size:13px;font-weight:700;color:#166534;">Start serving patients</div>
                      <div style="font-size:12px;color:#15803d;">Add your first client &amp; pet &mdash; you&rsquo;re all set!</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;">
                <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">&#9888; Security Notice</div>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#92400e;">
                  This email contains sensitive credentials. If you did not register <strong>${esc(p.clinicName)}</strong> on VetOS Cloud, please contact support immediately. Never forward this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:4px;">VetOS Cloud</div>
              <div style="font-size:12px;color:#64748b;margin-bottom:12px;">Multi-tenant Veterinary Practice Management Platform</div>
              <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
                This is an automated credential delivery email. Please do not reply.<br>
                &copy; ${new Date().getFullYear()} VetOS Cloud. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, html };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Very rough colour darkening: subtract ~38 from each RGB channel */
function darken(hex: string): string {
  try {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (n >> 16) - 38);
    const g = Math.max(0, ((n >> 8) & 0xff) - 38);
    const b = Math.max(0, (n & 0xff) - 38);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return "#1d4ed8";
  }
}
