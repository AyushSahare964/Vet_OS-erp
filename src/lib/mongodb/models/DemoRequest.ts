import mongoose, { Schema, type Document } from "mongoose";

/** A "Request Demo" lead from the public landing page. Not tenant-scoped: it exists before any clinic does. */
export interface IDemoRequest extends Document {
  name: string;
  clinicName: string;
  email: string;
  phone: string;
  city: string;
  clinicSize?: string;
  preferredTime?: string;
  message?: string;
  /** Where the request came from, e.g. "max" for the Max plan "Notify Me" button. */
  interest?: string;
  emailed: boolean;
  createdAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequest>(
  {
    name: { type: String, required: true, trim: true },
    clinicName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    clinicSize: { type: String },
    preferredTime: { type: String },
    message: { type: String },
    interest: { type: String },
    emailed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DemoRequestModel =
  (mongoose.models["DemoRequest"] as mongoose.Model<IDemoRequest>) ??
  mongoose.model<IDemoRequest>("DemoRequest", DemoRequestSchema);
