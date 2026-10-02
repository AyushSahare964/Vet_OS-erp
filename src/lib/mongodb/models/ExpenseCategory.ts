import mongoose, { Schema, type Document } from "mongoose";
import { tenantScopePlugin } from "../tenantScopePlugin";

export interface IExpenseCategory extends Document {
  name: string;
  nature: "BUSINESS" | "PERSONAL";
  glAccountCode?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nature: { type: String, enum: ["BUSINESS", "PERSONAL"], default: "BUSINESS" },
    glAccountCode: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Seed data — matches the Hitech BillSoft category list (all BUSINESS per doctor's instruction)
const SEED_CATEGORIES = [
  { name: "Advertisement", nature: "BUSINESS", sortOrder: 1 },
  { name: "Bank Charges", nature: "BUSINESS", sortOrder: 2 },
  { name: "Business Expansion", nature: "BUSINESS", sortOrder: 3 },
  { name: "Clinic Expenditure", nature: "BUSINESS", sortOrder: 4 },
  { name: "Education", nature: "BUSINESS", sortOrder: 5 },
  { name: "Home Loan EMI", nature: "BUSINESS", sortOrder: 6 },
  { name: "Household & Personal", nature: "BUSINESS", sortOrder: 7 },
  { name: "Laboratory Expenditure", nature: "BUSINESS", sortOrder: 8 },
  { name: "Marketing Expenditure", nature: "BUSINESS", sortOrder: 9 },
  { name: "Party", nature: "BUSINESS", sortOrder: 10 },
  { name: "Power and Fuel", nature: "BUSINESS", sortOrder: 11 },
  { name: "Printing and Stationery", nature: "BUSINESS", sortOrder: 12 },
  { name: "Professional Charges", nature: "BUSINESS", sortOrder: 13 },
  { name: "Rent", nature: "BUSINESS", sortOrder: 14 },
  { name: "Salary", nature: "BUSINESS", sortOrder: 15 },
  { name: "Telephone & Internet", nature: "BUSINESS", sortOrder: 16 },
];

export async function seedExpenseCategories() {
  const count = await ExpenseCategoryModel.countDocuments();
  if (count === 0) {
    // Fresh copies — insertMany's tenant-stamping hook mutates each doc in
    // place, and SEED_CATEGORIES is a module-level const reused by every
    // caller, so inserting the originals directly would leak one tenant's
    // ID into every other tenant's seed data from then on.
    await ExpenseCategoryModel.insertMany(SEED_CATEGORIES.map((c) => ({ ...c })));
  }
}

ExpenseCategorySchema.plugin(tenantScopePlugin);
ExpenseCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const ExpenseCategoryModel =
  (mongoose.models["ExpenseCategory"] as mongoose.Model<IExpenseCategory>) ??
  mongoose.model<IExpenseCategory>("ExpenseCategory", ExpenseCategorySchema);
