import mongoose, { Schema, type Document } from "mongoose";
import { tenantScopePlugin } from "../tenantScopePlugin";

export interface IPaymentAccount extends Document {
  name: string;
  type: "CASH" | "BANK";
  glAccountCode?: string;
  isDefault: boolean;
  isActive: boolean;
}

const PaymentAccountSchema = new Schema<IPaymentAccount>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["CASH", "BANK"], required: true },
    glAccountCode: { type: String },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const SEED_ACCOUNTS = [
  { name: "Cash in Hand", type: "CASH", isDefault: false, isActive: true },
  { name: "HDFC Current A/c", type: "BANK", isDefault: true, isActive: true },
];

export async function seedPaymentAccounts() {
  const count = await PaymentAccountModel.countDocuments();
  if (count === 0) {
    // Fresh copies — see the matching comment in ExpenseCategory.ts's
    // seedExpenseCategories(): insertMany's tenant-stamping hook mutates
    // each doc in place, and SEED_ACCOUNTS is a shared module-level const.
    await PaymentAccountModel.insertMany(SEED_ACCOUNTS.map((a) => ({ ...a })));
  }
}

PaymentAccountSchema.plugin(tenantScopePlugin);

export const PaymentAccountModel =
  (mongoose.models["PaymentAccount"] as mongoose.Model<IPaymentAccount>) ??
  mongoose.model<IPaymentAccount>("PaymentAccount", PaymentAccountSchema);
