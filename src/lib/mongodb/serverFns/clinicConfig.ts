import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ClinicConfigModel } from "@/lib/mongodb/models/ClinicConfig";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { OrgBranchModel } from "@/lib/mongodb/models/OrgBranch";
import { getMeFn } from "./auth";
import { validateGstin, validatePin } from "@/lib/finance/validators";
import { TenantModel } from "@/lib/mongodb/models/Tenant";

function toPlain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The current tenant's branding — null for a logged-out / platform-level session. */
export const getClinicConfigFn = createServerFn({ method: "GET" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(tenantScoped(async (): Promise<any> => {
    await connectDB();
    const ctx = getTenantContext();
    if (!ctx?.tenantId) {
      // A clinic set up before multi-tenancy has no tenant id: it keeps its own tenant-less profile, if it saved one.
      const me = await getMeFn();
      if (!me || me.roleId === "platform") return null;
      const legacy = await ClinicConfigModel.findOne({ tenantId: null }).lean();
      return legacy ? toPlain(legacy) : null;
    }
    const config = await ClinicConfigModel.findOne({}).lean();
    if (!config) return null;
    // The plan rides along so the shell can hide Upgrade for Pro and count down a trial.
    const t = await TenantModel.findOne({ tenantId: ctx.tenantId }, "planId subscriptionStatus trialEndsAt").lean();
    return toPlain({ ...config, planId: t?.planId, subscriptionStatus: t?.subscriptionStatus, trialEndsAt: t?.trialEndsAt });
  }));

const updateClinicConfigSchema = z.object({
  clinicName: z.string().trim().min(1, "Hospital name is required").optional(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin: z.string().trim().refine((v) => validatePin(v) === null, "PIN code must be 6 digits").optional(),
  phone: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 13, "Enter a valid phone number").optional(),
  email: z.string().trim().email("Enter a valid email address").optional(),
  website: z.string().optional(),
  gstin: z.string().trim().toUpperCase().refine((v) => validateGstin(v) === null, "GSTIN format is invalid").optional(),
  invoiceFooter: z.string().optional(),
  doctorName: z.string().optional(),
  doctorQualifications: z.string().optional(),
  doctorLicenseNumber: z.string().optional(),
  kennelCapacity: z.number().optional(),
  hasBoardingFacility: z.boolean().optional(),
  hasSwimmingPool: z.boolean().optional(),
});

export const updateClinicConfigFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => updateClinicConfigSchema.parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await connectDB();
    const me = await getMeFn();
    if (me?.roleId !== "admin") throw new Error("Only the clinic admin can change the hospital profile.");
    const tenantId = getTenantContext()?.tenantId;
    // Tenant clinics always have a profile; a pre-multi-tenancy clinic gets one created on its first save.
    const updated = tenantId
      ? await ClinicConfigModel.findOneAndUpdate({}, { $set: data }, { new: true })
      : await ClinicConfigModel.findOneAndUpdate(
          { tenantId: null },
          { $set: data, ...(data.clinicName ? {} : { $setOnInsert: { clinicName: me.clinicName || "Veterinary Clinic" } }) },
          { new: true, upsert: true },
        );
    if (!updated) return { success: false, message: "Clinic profile not found." };
    // The default branch prints on invoices, so it follows the profile's address.
    const addr: Record<string, string> = {};
    for (const k of ["address", "city", "pin", "phone", "email"] as const) if (data[k] !== undefined) addr[k] = data[k];
    if (Object.keys(addr).length) await OrgBranchModel.updateOne({ isDefault: true }, { $set: addr });
    return { success: true, message: "Clinic profile updated." };
  }));
