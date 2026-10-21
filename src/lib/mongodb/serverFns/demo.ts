/** Public "Request Demo" endpoint: saves the lead, then emails animovatetech@gmail.com. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { DemoRequestModel } from "@/lib/mongodb/models/DemoRequest";
import { sendEmail } from "@/lib/email/emailjs";

/** Every demo request goes here (override with DEMO_NOTIFY_EMAIL). */
const notifyEmail = () => process.env["DEMO_NOTIFY_EMAIL"] || "animovatetech@gmail.com";
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  clinicName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().min(6).max(20),
  city: z.string().trim().min(2).max(60),
  clinicSize: z.string().trim().max(40).optional(),
  preferredTime: z.string().trim().max(60).optional(),
  message: z.string().trim().max(1000).optional(),
  interest: z.string().trim().max(20).optional(),
  /** Honeypot: real visitors never see or fill this field. */
  website: z.string().max(0).optional(),
});

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const requestDemoFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => schema.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await connectDB();
    const { website: _bot, ...lead } = data;

    const dup = await DemoRequestModel.findOne({
      email: lead.email.toLowerCase(),
      createdAt: { $gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    }).lean();
    if (dup) return { success: true, message: "We already have your request. Our team will contact you shortly." };

    const doc = await DemoRequestModel.create(lead as Record<string, unknown>);

    const rows: Array<[string, string | undefined]> = [
      ["Name", lead.name], ["Clinic", lead.clinicName], ["Email", lead.email], ["Phone", lead.phone],
      ["City", lead.city], ["Clinic size", lead.clinicSize], ["Preferred time", lead.preferredTime],
      ["Interested in", lead.interest], ["Message", lead.message],
    ];
    const html = `<h2>New demo request</h2><table cellpadding="6">${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v as string)}</td></tr>`)
      .join("")}</table>`;
    const emailed = await sendEmail({
      to: notifyEmail(),
      toName: "VetechIQ Sales",
      subject: `Demo request: ${lead.clinicName} (${lead.city})`,
      queryType: "demoRequest",
      html,
      templateParams: { reply_to: lead.email },
    });
    if (emailed) await DemoRequestModel.updateOne({ _id: doc._id }, { emailed: true });

    return { success: true, message: "Thank you! Our team will contact you to schedule your demo." };
  });
