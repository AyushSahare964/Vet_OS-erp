import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ClinicConfigModel } from "@/lib/mongodb/models/ClinicConfig";

function toPlain<T>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The current tenant's branding — null for a logged-out / platform-level session. */
export const getClinicConfigFn = createServerFn({ method: "GET" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(tenantScoped(async (): Promise<any> => {
    await connectDB();
    const config = await ClinicConfigModel.findOne({}).lean();
    return config ? toPlain(config) : null;
  }));

const updateClinicConfigSchema = z.object({
  clinicName: z.string().min(1).optional(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pin: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  gstin: z.string().optional(),
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
    const updated = await ClinicConfigModel.findOneAndUpdate({}, { $set: data }, { new: true });
    if (!updated) return { success: false, message: "Clinic profile not found." };
    return { success: true, message: "Clinic profile updated." };
  }));
