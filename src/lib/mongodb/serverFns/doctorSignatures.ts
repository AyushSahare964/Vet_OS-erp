/**
 * One signature per doctor (stored on the user), so each doctor's prescriptions and bills carry that doctor's own signature.
 * Admin can set anyone's; a doctor can set their own.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { User } from "@/lib/mongodb/models/User";
import { getMeFn } from "./auth";

export interface DoctorSignatureRow {
  id: string;
  name: string;
  /** Qualification / specialty shown as the designation */
  designation: string;
  signatureUrl?: string;
}

export const listDoctorSignaturesFn = createServerFn({ method: "GET" })
  .handler(tenantScoped(async (): Promise<DoctorSignatureRow[]> => {
    const me = await getMeFn();
    if (!me) return [];
    await connectDB();
    const docs = await User.find({
      roleId: { $in: ["doctor", "admin"] },
      approvalStatus: "approved",
      isSystemAccount: { $ne: true },
      isActive: true,
    }).sort({ fullName: 1 }).lean();
    return docs.map((d: any) => ({
      id: String(d._id),
      name: /^dr\.?\s/i.test(d.fullName) ? d.fullName : `Dr. ${d.fullName}`,
      designation: d.qualification || d.specialty || d.roleName || "Veterinary Doctor",
      ...(d.signatureUrl ? { signatureUrl: d.signatureUrl as string } : {}),
    }));
  }));

export const setDoctorSignatureFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ userId: z.string(), signatureUrl: z.string().max(500_000, "Signature image is too large") }).parse(raw)
  )
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    const me = await getMeFn();
    if (!me) throw new Error("Your session has expired. Please sign in again.");
    if (me.roleId !== "admin" && me.id !== data.userId) throw new Error("You can only change your own signature.");
    await connectDB();
    // strict:false so the write works even while a running server still holds the older User schema
    const res = await User.updateOne(
      { _id: data.userId },
      data.signatureUrl ? { $set: { signatureUrl: data.signatureUrl } } : { $unset: { signatureUrl: "" } },
      { strict: false },
    );
    if (!res.matchedCount) throw new Error("Doctor not found.");
    // Read it back: never report success for a signature that was not stored
    const stored = (await User.findById(data.userId).lean()) as { signatureUrl?: string } | null;
    if ((stored?.signatureUrl ?? "") !== data.signatureUrl) throw new Error("The signature could not be stored. Please restart the server and try again.");
    return { success: true };
  }));
