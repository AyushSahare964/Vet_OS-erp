import mongoose, { Schema, type Document } from "mongoose";
import { tenantScopePlugin } from "../tenantScopePlugin";

export interface IDiscountScheme extends Document {
  tenantId?: string;
  name: string;
  description?: string;
  discountPercent: number;
  /** Inclusive, local calendar dates as YYYY-MM-DD */
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const DiscountSchemeSchema = new Schema<IDiscountScheme>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    discountPercent: { type: Number, required: true, min: 0.01, max: 100 },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "discount_schemes" },
);

DiscountSchemeSchema.plugin(tenantScopePlugin);
DiscountSchemeSchema.index({ tenantId: 1, isActive: 1, startDate: 1, endDate: 1 });

export const DiscountSchemeModel: mongoose.Model<IDiscountScheme> =
  (mongoose.models["DiscountScheme"] as mongoose.Model<IDiscountScheme>) ??
  mongoose.model<IDiscountScheme>("DiscountScheme", DiscountSchemeSchema);

