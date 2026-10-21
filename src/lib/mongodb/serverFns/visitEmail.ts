/**
 * Bill + prescription email: server-side checks for the "Email to Client" button.
 * The PDFs themselves are built and sent from the browser (see lib/email/visitDocsEmail.ts),
 * so they never touch this server or any storage.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { getMeFn } from "./auth";

const visitZ = z.object({ visitId: z.string().min(1) });

async function requireStaff() {
  const me = await getMeFn();
  if (!me || !["admin", "doctor", "reception"].includes(me.roleId)) throw new Error("Not permitted");
}

export interface VisitEmailTarget {
  visitId: string;
  invoiceNo: string;
  prescriptionNo: string;
  petName: string;
  ownerName: string;
  /** From the owner record, not from the browser. Empty when none is on file. */
  email: string;
  billEmailSentAt?: string | undefined;
}

/** The visit's owner email, after confirming visit, pet and owner all point at the same patient. */
export const getVisitEmailTargetFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => visitZ.parse(raw))
  .handler(async ({ data }): Promise<VisitEmailTarget> => {
    await requireStaff();
    await connectDB();
    const visit = await ClinicalVisit.findOne({ visitId: data.visitId }).lean();
    if (!visit) throw new Error("Visit not found");
    const pet = await Pet.findOne({ petId: visit.petId }).lean();
    if (!pet) throw new Error("Visit's patient not found; not sending.");
    const owner = await Owner.findOne({ ownerId: visit.ownerId }).lean();
    // A re-registered client can leave the pet under an earlier owner record; accept it only when it is the same person (same phone).
    const petOwner = pet.ownerId === visit.ownerId ? owner : await Owner.findOne({ ownerId: pet.ownerId }).lean();
    const digits = (v?: string) => (v || "").replace(/\D/g, "").slice(-10);
    if (pet.ownerId !== visit.ownerId && (!owner || !petOwner || !digits(owner.phone) || digits(owner.phone) !== digits(petOwner.phone))) {
      throw new Error("Visit's patient and owner do not match; not sending.");
    }
    return {
      visitId: visit.visitId,
      invoiceNo: visit.invoiceNo,
      prescriptionNo: visit.prescriptionNo,
      petName: visit.petName,
      ownerName: owner?.name || visit.ownerName,
      email: (owner?.email || petOwner?.email || "").trim(),
      billEmailSentAt: visit.billEmailSentAt,
    };
  });

const logZ = visitZ.extend({
  to: z.string().max(200),
  status: z.enum(["sent", "failed"]),
  error: z.string().max(300).optional(),
  test: z.boolean().optional(),
});

/** Records one send attempt. A real (non-test) accepted send also sets billEmailSentAt, which drives the resend confirmation. */
export const logVisitEmailFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => logZ.parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await requireStaff();
    await connectDB();
    const at = new Date().toISOString();
    const entry = { at, to: data.to, status: data.status, ...(data.error ? { error: data.error } : {}), ...(data.test ? { test: true } : {}) };
    await ClinicalVisit.updateOne(
      { visitId: data.visitId },
      { $push: { emailHistory: entry }, ...(data.status === "sent" && !data.test ? { $set: { billEmailSentAt: at } } : {}) },
    );
    return { ok: true };
  });
