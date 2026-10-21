/**
 * ClinicTrial — one 15-day VetOS free trial per clinic (keyed by lower-cased clinicName).
 * Dates are clinic-local "YYYY-MM-DD" strings, written once at creation and never recalculated.
 * `reminders[stage]` holds delivery state: { status, attempts, sentAt?, error?, nonce, claimedAt, testMode }.
 */
import mongoose, { Schema, type Document } from "mongoose";

export type TrialStatus = "trial" | "expired" | "paid" | "cancelled";

export interface IClinicTrial extends Document {
  clinicKey: string;
  clinicName: string;
  ownerUserId?: string;
  ownerName: string;
  ownerEmail: string;
  startDate: string;
  endDate: string;
  status: TrialStatus;
  reminders: Record<string, Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicTrialSchema = new Schema<IClinicTrial>(
  {
    clinicKey: { type: String, required: true, unique: true, index: true },
    clinicName: { type: String, required: true },
    ownerUserId: { type: String },
    ownerName: { type: String, required: true },
    ownerEmail: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ["trial", "expired", "paid", "cancelled"], default: "trial", index: true },
    reminders: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "clinic_trials", minimize: false },
);

export const ClinicTrial =
  (mongoose.models["ClinicTrial"] as mongoose.Model<IClinicTrial>) ??
  mongoose.model<IClinicTrial>("ClinicTrial", ClinicTrialSchema);
