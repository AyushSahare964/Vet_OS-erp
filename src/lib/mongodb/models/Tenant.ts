/**
 * Tenant — one document per registered clinic. Lives in the same shared
 * database as everything else (see ADR note in tenantScopePlugin.ts) and is
 * deliberately NOT run through tenantScopePlugin: it IS the tenant registry,
 * so platform code needs to query across all of them.
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface TenantFeatures {
  crm: boolean;
  appointments: boolean;
  clinical: boolean;
  billing: boolean;
  inventory: boolean;
  laboratory: boolean;
  pharmacy: boolean;
  boarding: boolean;
  accounting: boolean;
  reports: boolean;
  nutrition: boolean;
  maxUsers: number; // -1 = unlimited
  maxPets: number;  // -1 = unlimited
}

export type SubscriptionPlanId = "plan_starter" | "plan_basic" | "plan_professional" | "plan_enterprise";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type TenantStatus = "ACTIVE" | "SUSPENDED";

/** Official registered-veterinarian entry captured at clinic registration (from the state council ID card). */
export interface TenantDoctor {
  fullName: string;
  councilRegNo: string; // normalised: upper-case, no spaces — unique across tenants
  councilName: string;
  regValidUpto: Date;
  qualification?: string;
  idCardDataUri: string; // photo of the council ID card, for manual verification
}

/** A supporting document uploaded at registration (clinic licence, GST certificate, ...), kept for the platform admin. */
export interface TenantDocument {
  name: string;
  dataUri: string; // data:image/...;base64,... or data:application/pdf;base64,...
  uploadedAt: Date;
}

export interface ITenant extends Document {
  tenantId: string; // stable opaque id, also used as the tenantScopePlugin filter value
  slug: string;
  name: string;
  legalName?: string;
  clinicType: string;
  vetCouncilRegNo?: string;
  doctor?: TenantDoctor;
  documents?: TenantDocument[];
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pin: string;
  phone: string;
  whatsappNumber?: string;
  email: string;
  website?: string;
  gstin?: string;
  pan?: string;
  adminUserId: string;
  /** Set by the platform admin after checking the council ID card. */
  doctorVerified?: boolean;
  doctorVerifiedAt?: Date;
  planId: SubscriptionPlanId;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Date;
  /** Paid plans: the paid period ends here (a trial uses trialEndsAt). */
  paidUntil?: Date;
  /** Razorpay subscription billing this clinic monthly (Pro). Renewals arrive through the webhook. */
  razorpaySubscriptionId?: string;
  features: TenantFeatures;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String },
    clinicType: { type: String, default: "Small Animal" },
    vetCouncilRegNo: { type: String },
    doctor: {
      type: new Schema<TenantDoctor>(
        {
          fullName: { type: String, required: true, trim: true },
          councilRegNo: { type: String, required: true },
          councilName: { type: String, required: true, trim: true },
          regValidUpto: { type: Date, required: true },
          qualification: { type: String },
          idCardDataUri: { type: String, required: true },
        },
        { _id: false },
      ),
    },
    documents: {
      type: [
        new Schema<TenantDocument>(
          {
            name: { type: String, required: true, trim: true },
            dataUri: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    stateCode: { type: String, required: true },
    pin: { type: String, required: true },
    phone: { type: String, required: true },
    whatsappNumber: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    website: { type: String },
    gstin: { type: String },
    pan: { type: String },
    adminUserId: { type: String, required: true },
    doctorVerified: { type: Boolean, default: false },
    doctorVerifiedAt: { type: Date },
    planId: { type: String, enum: ["plan_starter", "plan_basic", "plan_professional", "plan_enterprise"], required: true },
    subscriptionStatus: { type: String, enum: ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"], default: "TRIAL" },
    trialEndsAt: { type: Date },
    paidUntil: { type: Date },
    razorpaySubscriptionId: { type: String, index: true },
    features: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
  },
  { timestamps: true, collection: "tenants" },
);

// One council registration = one clinic. Partial so legacy tenants without a doctor entry don't collide.
TenantSchema.index({ "doctor.councilRegNo": 1 }, { unique: true, partialFilterExpression: { "doctor.councilRegNo": { $type: "string" } } });

export const TenantModel =
  (mongoose.models["Tenant"] as mongoose.Model<ITenant>) ??
  mongoose.model<ITenant>("Tenant", TenantSchema);
