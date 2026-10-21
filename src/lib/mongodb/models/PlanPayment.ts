import mongoose, { Schema, type Document } from "mongoose";

/**
 * A plan purchase made on the public pricing page, BEFORE the clinic (tenant) exists, so it is not tenant-scoped.
 * Razorpay subscription -> verified first payment -> consumed once by clinic registration.
 */
export interface IPlanPayment extends Document {
  subscriptionId: string;
  planId: string;
  /** Amount of one monthly charge, in paise (price + GST). */
  amountPaise: number;
  status: "CREATED" | "PAID";
  paymentId?: string;
  /** Set when registration used this payment, so one payment can create only one clinic. */
  usedByTenantId?: string;
  createdAt: Date;
}

const PlanPaymentSchema = new Schema<IPlanPayment>(
  {
    subscriptionId: { type: String, required: true, unique: true },
    planId: { type: String, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ["CREATED", "PAID"], default: "CREATED" },
    paymentId: { type: String, index: true },
    usedByTenantId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PlanPaymentModel =
  (mongoose.models["PlanPayment"] as mongoose.Model<IPlanPayment>) ??
  mongoose.model<IPlanPayment>("PlanPayment", PlanPaymentSchema);
