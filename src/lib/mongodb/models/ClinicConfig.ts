/**
 * ClinicConfig — one document per tenant (singleton within that tenant's
 * scope, enforced by the unique index below). Replaces the static
 * CLINIC_CONFIG constant in src/lib/config/clinicConfig.ts with a per-tenant,
 * DB-backed source of branding truth.
 */

import mongoose, { Schema, type Document } from "mongoose";
import { tenantScopePlugin } from "../tenantScopePlugin";

export interface IClinicConfig extends Document {
  tenantId?: string;
  clinicName: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  phone: string;
  email: string;
  website?: string;
  gstin?: string;
  invoiceFooter?: string;
  doctorName?: string;
  doctorQualifications?: string;
  doctorLicenseNumber?: string;
  kennelCapacity?: number;
  hasBoardingFacility: boolean;
  hasSwimmingPool: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicConfigSchema = new Schema<IClinicConfig>(
  {
    clinicName: { type: String, required: true, trim: true },
    tagline: { type: String },
    logoUrl: { type: String },
    primaryColor: { type: String, default: "#2563eb" },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pin: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    website: { type: String },
    gstin: { type: String },
    invoiceFooter: { type: String },
    doctorName: { type: String },
    doctorQualifications: { type: String },
    doctorLicenseNumber: { type: String },
    kennelCapacity: { type: Number, default: 20 },
    hasBoardingFacility: { type: Boolean, default: true },
    hasSwimmingPool: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "clinic_configs" },
);

ClinicConfigSchema.plugin(tenantScopePlugin);
ClinicConfigSchema.index({ tenantId: 1 }, { unique: true });

export const ClinicConfigModel =
  (mongoose.models["ClinicConfig"] as mongoose.Model<IClinicConfig>) ??
  mongoose.model<IClinicConfig>("ClinicConfig", ClinicConfigSchema);
