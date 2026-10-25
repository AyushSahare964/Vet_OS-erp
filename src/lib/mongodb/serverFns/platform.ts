/**
 * Platform-level server functions: clinic (tenant) self-registration +
 * provisioning, and the platform-admin tenant control plane.
 *
 * ponytail: no Razorpay integration (no live payment provider key available)
 * — every registration starts a TRIAL_DAYS (30-day) TRIAL with the chosen plan's features
 * active immediately, no payment step blocks first use. Add real recurring
 * billing when a Razorpay key is provided.
 */

import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { runWithTenant } from "@/lib/mongodb/tenantContext";
import { getMeFn } from "./auth";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { TenantModel, type SubscriptionPlanId } from "@/lib/mongodb/models/Tenant";
import { User } from "@/lib/mongodb/models/User";
import { RefreshToken } from "@/lib/mongodb/models/RefreshToken";
import { OrgBranchModel } from "@/lib/mongodb/models/OrgBranch";
import { TaxCodeModel } from "@/lib/mongodb/models/TaxCode";
import { UomModel } from "@/lib/mongodb/models/Uom";
import { NumberSeriesModel, SERIES_DOC_TYPES } from "@/lib/mongodb/models/NumberSeries";
import { seedExpenseCategories } from "@/lib/mongodb/models/ExpenseCategory";
import { seedPaymentAccounts } from "@/lib/mongodb/models/PaymentAccount";
import { ClinicConfigModel } from "@/lib/mongodb/models/ClinicConfig";
import { signAccessToken, signRefreshToken, hashToken } from "@/lib/mongodb/tokens";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/erp/features";
import { PlanPaymentModel } from "@/lib/mongodb/models/PlanPayment";
import { ROLES } from "@/lib/erp/config";
import type { AuthResponse, UserProfile } from "@/lib/erp/auth";
import { appUrl, logoUrl, sendEmail } from "@/lib/email/emailjs";

const SALT_ROUNDS = 12;
const COOKIE_NAME = "vetos_refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STATE_NAME_TO_CODE: Record<string, string> = {
  "maharashtra": "27", "karnataka": "29", "delhi": "07", "uttar pradesh": "09",
  "gujarat": "24", "tamil nadu": "33", "west bengal": "19", "rajasthan": "08",
  "telangana": "36", "kerala": "32", "punjab": "03", "haryana": "06",
  "madhya pradesh": "23", "bihar": "10", "andhra pradesh": "37",
};

function toStateCode(state: string): string {
  return STATE_NAME_TO_CODE[state.trim().toLowerCase()] ?? "27";
}

function generateTenantSlug(clinicName: string, city: string): string {
  const name = clinicName.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_").slice(0, 24);
  const cityCode = city.toLowerCase().replace(/[^a-z]/g, "").slice(0, 3);
  return `${name || "clinic"}_${cityCode || "in"}`;
}

const TAX_CODES = [
  { code: "3004", kind: "HSN", description: "Medicaments for therapeutic use", gstRate: 12 },
  { code: "30049099", kind: "HSN", description: "Other medicaments, veterinary", gstRate: 12 },
  { code: "3002", kind: "HSN", description: "Vaccines for veterinary medicine", gstRate: 5 },
  { code: "2309", kind: "HSN", description: "Animal feed preparations", gstRate: 18 },
  { code: "9018", kind: "HSN", description: "Medical / veterinary instruments", gstRate: 12 },
  { code: "3808", kind: "HSN", description: "Disinfectants, ectoparasiticides", gstRate: 18 },
  { code: "998351", kind: "SAC", description: "Veterinary services for pet animals", gstRate: 0 },
  { code: "998729", kind: "SAC", description: "Grooming and boarding services", gstRate: 18 },
] as const;

const UOMS = [
  { code: "PCS", name: "Pieces", decimals: 0, sortOrder: 1 },
  { code: "STRIP", name: "Strip", decimals: 0, sortOrder: 2 },
  { code: "TAB", name: "Tablet", decimals: 0, sortOrder: 3 },
  { code: "BOTTLE", name: "Bottle", decimals: 0, sortOrder: 4 },
  { code: "VIAL", name: "Vial", decimals: 0, sortOrder: 5 },
  { code: "ML", name: "Millilitre", decimals: 2, sortOrder: 6 },
  { code: "KG", name: "Kilogram", decimals: 3, sortOrder: 7 },
  { code: "DOSE", name: "Dose", decimals: 0, sortOrder: 8 },
  { code: "BOX", name: "Box", decimals: 0, sortOrder: 9 },
];

const EFFECTIVE_FROM = "2026-04-01";
const FY_CODE = "2026-27";

// ─── registerTenantFn ────────────────────────────────────────────────────────

const registerTenantSchema = z.object({
  clinicName: z.string().min(2),
  legalName: z.string().optional(),
  clinicType: z.string().default("Small Animal"),
  // Official doctor entry (from the state veterinary council ID card)
  doctorName: z.string().min(2),
  doctorRegNo: z.string().min(3),
  doctorCouncil: z.string().min(3),
  doctorRegValidUpto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorQualification: z.string().optional(),
  doctorIdCardDataUri: z.string().max(2_000_000).regex(/^data:image\/(png|jpeg|jpg|webp);base64,/),
  // Optional supporting documents (clinic licence, GST certificate, ...) for the platform admin to review.
  documents: z.array(z.object({
    name: z.string().min(1).max(80),
    dataUri: z.string().max(1_800_000).regex(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/),
  })).max(5).optional().default([]),
  address: z.string().min(3),
  city: z.string().min(1),
  state: z.string().min(1),
  pin: z.string().min(4),
  phone: z.string().min(6),
  whatsappNumber: z.string().optional(),
  email: z.string().email(),
  website: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  isCompositionDealer: z.boolean().optional().default(false),
  // Only Starter (free trial) and Pro (paid first) can be registered; Basic/Max are not on sale.
  planId: z.enum(["plan_starter", "plan_professional"]).default("plan_starter"),
  paymentId: z.string().max(80).optional(),
  adminFullName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminPhone: z.string().optional(),
  // Branding
  tagline: z.string().optional(),
  primaryColor: z.string().optional(),
  // data:image/...;base64,... — capped well under Mongo's 16MB doc limit;
  // client resizes before sending, this is just a hard backstop.
  logoDataUri: z.string().max(2_000_000).regex(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/).optional(),
  hasBoardingFacility: z.boolean().optional().default(true),
  hasSwimmingPool: z.boolean().optional().default(false),
  kennelCapacity: z.number().optional().default(20),
});

export const registerTenantFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => registerTenantSchema.parse(raw))
  .handler(async ({ data }): Promise<AuthResponse & { accessToken?: string }> => {
    await connectDB();

    const cleanAdminEmail = data.adminEmail.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanAdminEmail }).lean();
    if (existingUser) {
      return { success: false, message: "An account with this admin email already exists." };
    }

    // Pro is paid first: the payment must be verified, for this plan, and not used by another clinic.
    const paid = data.planId === "plan_professional";
    let subscriptionId = "";
    if (paid) {
      const pay = data.paymentId
        ? await PlanPaymentModel.findOne({ paymentId: data.paymentId, planId: data.planId, status: "PAID" }).lean()
        : null;
      if (!pay) return { success: false, message: "Payment is required for the Pro plan. Please complete payment from the pricing page." };
      if (pay.usedByTenantId) return { success: false, message: "This payment has already been used to register a clinic." };
      subscriptionId = pay.subscriptionId;
    }

    const doctorRegNo = data.doctorRegNo.replace(/\s+/g, "").toUpperCase();
    const regValidUpto = new Date(`${data.doctorRegValidUpto}T23:59:59+05:30`);
    if (Number.isNaN(regValidUpto.getTime()) || regValidUpto.getTime() < Date.now()) {
      return { success: false, message: "The doctor's council registration has expired (check the 'Valid Upto' date)." };
    }
    if (await TenantModel.exists({ "doctor.councilRegNo": doctorRegNo })) {
      return { success: false, message: "A clinic is already registered with this veterinary council registration number." };
    }

    // Slug is only a URL/identifier handle, not a uniqueness claim on the clinic's
    // name — two different clinics can legitimately share the first 24 chars, so
    // on collision disambiguate with a short random suffix instead of refusing.
    let slug = generateTenantSlug(data.clinicName, data.city);
    for (let attempt = 0; attempt < 5 && (await TenantModel.exists({ slug })); attempt++) {
      slug = `${generateTenantSlug(data.clinicName, data.city)}_${crypto.randomBytes(2).toString("hex")}`;
    }
    if (await TenantModel.exists({ slug })) {
      return { success: false, message: "Could not allocate a unique clinic identifier. Please try again." };
    }

    const tenantId = `tid_${crypto.randomBytes(8).toString("hex")}`;
    const stateCode = toStateCode(data.state);
    const plan = SUBSCRIPTION_PLANS[data.planId as SubscriptionPlanId];

    // Everything below runs inside the new tenant's context so
    // tenantScopePlugin auto-stamps tenantId on every created document.
    const { user, accessToken, refreshToken, expiresAt } = await runWithTenant(
      { tenantId, userId: "provisioning", roleId: "admin" },
      async () => {
        await OrgBranchModel.create({
          code: "MAIN",
          name: data.clinicName.trim(),
          legalName: data.legalName?.trim() || data.clinicName.trim(),
          gstin: data.gstin?.trim() || "",
          stateCode,
          address: data.address.trim(),
          city: data.city.trim(),
          pin: data.pin.trim(),
          phone: data.phone.trim(),
          email: cleanAdminEmail,
          isComposition: data.isCompositionDealer ?? false,
          lutEnabled: false,
          isDefault: true,
          isActive: true,
        });

        await TaxCodeModel.insertMany(
          TAX_CODES.map((t) => ({ ...t, cessRate: 0, effectiveFrom: EFFECTIVE_FROM, effectiveTo: null, isActive: true })),
        );

        await UomModel.insertMany(UOMS.map((u) => ({ ...u, isActive: true })));

        await NumberSeriesModel.insertMany(
          SERIES_DOC_TYPES.map((docType) => ({ branchId: "MAIN", docType, fyCode: FY_CODE, prefix: docType, padding: 4, lastNumber: 0 })),
        );

        await seedExpenseCategories();
        await seedPaymentAccounts();

        await ClinicConfigModel.create({
          clinicName: data.clinicName.trim(),
          address: data.address.trim(),
          city: data.city.trim(),
          state: data.state.trim(),
          pin: data.pin.trim(),
          phone: data.phone.trim(),
          email: cleanAdminEmail,
          ...(data.gstin?.trim() ? { gstin: data.gstin.trim() } : {}),
          ...(data.tagline?.trim() ? { tagline: data.tagline.trim() } : {}),
          ...(data.website?.trim() ? { website: data.website.trim() } : {}),
          ...(data.primaryColor?.trim() ? { primaryColor: data.primaryColor.trim() } : {}),
          ...(data.logoDataUri ? { logoUrl: data.logoDataUri } : {}),
          hasBoardingFacility: (data.hasBoardingFacility ?? true) && plan.features.boarding,
          hasSwimmingPool: data.hasSwimmingPool ?? false,
          ...(data.kennelCapacity ? { kennelCapacity: data.kennelCapacity } : {}),
        });

        const passwordHash = await bcrypt.hash(data.adminPassword, SALT_ROUNDS);
        const initials = data.adminFullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "AD";
        const adminUser = await User.create({
          fullName: data.adminFullName.trim(),
          email: cleanAdminEmail,
          passwordHash,
          ...(data.adminPhone?.trim() ? { phone: data.adminPhone.trim() } : {}),
          clinicName: data.clinicName.trim(),
          branch: "MAIN",
          roleId: "admin",
          roleName: ROLES.admin?.name ?? "Clinic Administrator",
          initials,
          approvalStatus: "approved",
          approvedBy: "Self-service registration",
          approvedAt: new Date(),
          isActive: true,
        });

        const accessTok = signAccessToken(String(adminUser._id), cleanAdminEmail, "admin", tenantId, slug);
        const { token: refreshTok } = signRefreshToken(String(adminUser._id));
        const expiry = new Date(Date.now() + REFRESH_TTL_MS);
        await RefreshToken.create({ userId: String(adminUser._id) as never, tokenHash: hashToken(refreshTok), expiresAt: expiry });

        return { user: adminUser, accessToken: accessTok, refreshToken: refreshTok, expiresAt: expiry };
      },
    );

    // Atomically claim the payment so two simultaneous registrations cannot both use it.
    if (paid) {
      const claimed = await PlanPaymentModel.findOneAndUpdate(
        { paymentId: data.paymentId ?? "", status: "PAID", usedByTenantId: { $exists: false } },
        { usedByTenantId: tenantId },
      );
      if (!claimed) return { success: false, message: "This payment has already been used to register a clinic." };
    }
    await TenantModel.create({
      tenantId,
      slug,
      name: data.clinicName.trim(),
      legalName: data.legalName?.trim() || data.clinicName.trim(),
      clinicType: data.clinicType,
      vetCouncilRegNo: doctorRegNo,
      doctor: {
        fullName: data.doctorName.trim(),
        councilRegNo: doctorRegNo,
        councilName: data.doctorCouncil.trim(),
        regValidUpto,
        ...(data.doctorQualification?.trim() ? { qualification: data.doctorQualification.trim() } : {}),
        idCardDataUri: data.doctorIdCardDataUri,
      },
      documents: data.documents.map((d) => ({ name: d.name.trim(), dataUri: d.dataUri, uploadedAt: new Date() })),
      address: data.address.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      stateCode,
      pin: data.pin.trim(),
      phone: data.phone.trim(),
      ...(data.whatsappNumber?.trim() ? { whatsappNumber: data.whatsappNumber.trim() } : {}),
      email: cleanAdminEmail,
      ...(data.website?.trim() ? { website: data.website.trim() } : {}),
      ...(data.gstin?.trim() ? { gstin: data.gstin.trim() } : {}),
      ...(data.pan?.trim() ? { pan: data.pan.trim() } : {}),
      adminUserId: String(user._id),
      planId: data.planId,
      ...(paid
        ? { subscriptionStatus: "ACTIVE" as const, razorpaySubscriptionId: subscriptionId } // Pro: no end date, access follows the Razorpay subscription
        : { subscriptionStatus: "TRIAL" as const, trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) }),
      features: plan.features,
      status: "ACTIVE",
    }).catch(async (e: unknown) => {
      // give the payment back so the customer can retry
      if (paid) await PlanPaymentModel.updateOne({ paymentId: data.paymentId ?? "" }, { $unset: { usedByTenantId: 1 } });
      throw e;
    });

    setCookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    const profile: UserProfile = {
      id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      clinicName: data.clinicName.trim(),
      branch: "MAIN",
      roleId: "admin",
      roleName: user.roleName,
      initials: user.initials,
      approvalStatus: "approved",
      createdAt: new Date().toISOString(),
    };

    // Credentials email (EmailJS template_1s5wswj). Awaited — a fire-and-forget promise is killed when the
    // serverless function returns. sendEmail never throws, so a mail failure can't undo the registration.
    const sent = await sendEmail({
      to: cleanAdminEmail,
      toName: data.adminFullName.trim(),
      subject: `Welcome to VetTechIQ — ${data.clinicName.trim()} is ready`,
      queryType: "clinicWelcome",
      templateParams: {
        clinic_name: data.clinicName.trim(),
        clinic_id: slug,
        clinic_logo_url: logoUrl("/vettechiq-logo.png"),
        user_id: cleanAdminEmail,
        password: data.adminPassword,
        login_url: `${appUrl()}/login`,
        staff_register_url: `${appUrl()}/login`,
        plan_name: plan.name,
        trial_days: TRIAL_DAYS,
        trial_ends: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        doctor_name: data.doctorName.trim(),
        doctor_reg_no: doctorRegNo,
        doctor_council: data.doctorCouncil.trim(),
        doctor_valid_upto: data.doctorRegValidUpto,
      },
    });
    if (!sent) console.warn(`[registration] Credentials email not delivered to ${cleanAdminEmail}`);

    return {
      success: true,
      user: profile,
      accessToken,
      message: paid
        ? `Welcome to VetTechIQ, ${data.clinicName.trim()}! Your ${plan.name} plan is active.`
        : `Welcome to VetTechIQ, ${data.clinicName.trim()}! Your ${TRIAL_DAYS}-day ${plan.name} trial is live.`,
    };
  });

/** Public: active clinics for the staff-registration clinic picker. Name/city/slug only. */
export const listClinicsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<{ slug: string; name: string; city: string }>> => {
    await connectDB();
    const rows = await TenantModel.find({ status: "ACTIVE" }).select("slug name city").sort({ name: 1 }).lean();
    return rows.map((t) => ({ slug: t.slug, name: t.name, city: t.city }));
  },
);

// ─── Platform admin control plane ───────────────────────────────────────────

/** Every control-plane call is platform-admin only: it reads and changes other clinics' records. */
async function requirePlatform() {
  const me = await getMeFn();
  if (!me || me.roleId !== "platform") throw new Error("Not permitted");
  return me;
}

/** Register rows: everything except the two large images (ID card, logo), which the detail call returns. */
export const listTenantsFn = createServerFn({ method: "GET" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async (): Promise<any[]> => {
    await requirePlatform();
    await connectDB();
    const tenants = await TenantModel.find({}).select("-doctor.idCardDataUri -documents.dataUri").sort({ createdAt: -1 }).lean();
    return JSON.parse(JSON.stringify(tenants));
  });

/** One clinic, section by section: registration data, doctor + ID card, branding, admin account and usage. */
export const getTenantDetailFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ tenantId: z.string() }).parse(raw))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .handler(async ({ data }): Promise<any> => {
    await requirePlatform();
    await connectDB();
    const tenant = await TenantModel.findOne({ tenantId: data.tenantId }).lean();
    if (!tenant) throw new Error("Clinic not found.");
    // Tenant-scoped models only see their own clinic's rows inside runWithTenant.
    const inside = await runWithTenant({ tenantId: data.tenantId, userId: "platform", roleId: "platform" }, async () => {
      const [config, branch, admin, staff, pets, owners, visits] = await Promise.all([
        ClinicConfigModel.findOne({}).lean(),
        OrgBranchModel.findOne({ isDefault: true }).lean(),
        User.findById(tenant.adminUserId).select("fullName email phone createdAt").lean(),
        User.countDocuments({ isActive: true }),
        Pet.countDocuments({}),
        Owner.countDocuments({}),
        ClinicalVisit.countDocuments({}),
      ]);
      return { config, branch, admin, usage: { staff, pets, owners, visits } };
    });
    return JSON.parse(JSON.stringify({ tenant, ...inside }));
  });

const setTenantStatusSchema = z.object({
  tenantId: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const setTenantStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => setTenantStatusSchema.parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await requirePlatform();
    await connectDB();
    const tenant = await TenantModel.findOneAndUpdate({ tenantId: data.tenantId }, { $set: { status: data.status } });
    if (!tenant) return { success: false, message: "Tenant not found." };
    return { success: true, message: `${tenant.name} is now ${data.status}.` };
  });

/** Move a clinic to another plan; its feature flags and limits follow the plan. */
export const setTenantPlanFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ tenantId: z.string(), planId: z.enum(["plan_starter", "plan_basic", "plan_professional", "plan_enterprise"]) }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await requirePlatform();
    await connectDB();
    const plan = SUBSCRIPTION_PLANS[data.planId];
    const tenant = await TenantModel.findOneAndUpdate({ tenantId: data.tenantId }, { $set: { planId: data.planId, features: plan.features } });
    if (!tenant) return { success: false, message: "Tenant not found." };
    return { success: true, message: `${tenant.name} moved to the ${plan.name} plan.` };
  });

/** Push the trial end out by N days (from today if the trial already ended). */
export const extendTenantTrialFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ tenantId: z.string(), days: z.number().int().min(1).max(90) }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string; trialEndsAt?: string }> => {
    await requirePlatform();
    await connectDB();
    const tenant = await TenantModel.findOne({ tenantId: data.tenantId });
    if (!tenant) return { success: false, message: "Tenant not found." };
    const from = Math.max(Date.now(), tenant.trialEndsAt?.getTime() ?? 0);
    tenant.trialEndsAt = new Date(from + data.days * 864e5);
    tenant.subscriptionStatus = "TRIAL";
    await tenant.save();
    return { success: true, message: `Trial extended by ${data.days} days.`, trialEndsAt: tenant.trialEndsAt.toISOString() };
  });

/** Mark the doctor's council registration as checked against the uploaded ID card (or undo it). */
export const verifyTenantDoctorFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ tenantId: z.string(), verified: z.boolean() }).parse(raw))
  .handler(async ({ data }): Promise<{ success: boolean; message: string }> => {
    await requirePlatform();
    await connectDB();
    const tenant = await TenantModel.findOneAndUpdate(
      { tenantId: data.tenantId },
      data.verified ? { $set: { doctorVerified: true, doctorVerifiedAt: new Date() } } : { $set: { doctorVerified: false }, $unset: { doctorVerifiedAt: "" } },
    );
    if (!tenant) return { success: false, message: "Tenant not found." };
    return { success: true, message: data.verified ? "Doctor marked as verified." : "Verification removed." };
  });
