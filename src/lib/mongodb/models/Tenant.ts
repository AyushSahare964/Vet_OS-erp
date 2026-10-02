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

export type SubscriptionPlanId = "plan_basic" | "plan_professional" | "plan_enterprise";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type TenantStatus = "ACTIVE" | "SUSPENDED";

export interface ITenant extends Document {
  tenantId: string; // stable opaque id, also used as the tenantScopePlugin filter value
  slug: string;
  name: string;
  legalName?: string;
  clinicType: string;
  vetCouncilRegNo?: string;
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
  planId: SubscriptionPlanId;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Date;
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
    planId: { type: String, enum: ["plan_basic", "plan_professional", "plan_enterprise"], required: true },
    subscriptionStatus: { type: String, enum: ["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"], default: "TRIAL" },
    trialEndsAt: { type: Date },
    features: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
  },
  { timestamps: true, collection: "tenants" },
);

export const TenantModel =
  (mongoose.models["Tenant"] as mongoose.Model<ITenant>) ??
  mongoose.model<ITenant>("Tenant", TenantSchema);
