/**
 * Counters — atomic MongoDB sequence for auto-ID generation.
 * Uses findOneAndUpdate with $inc to guarantee uniqueness across concurrent requests.
 */

import mongoose, { Schema, model } from "mongoose";
import { tenantScopePlugin } from "../tenantScopePlugin";

export interface ICounter {
  _id: string; // counter name e.g. "inventory_item"
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: "counters", versionKey: false }
);

counterSchema.plugin(tenantScopePlugin);

export const Counter: mongoose.Model<ICounter> =
  (mongoose.models["Counter"] as mongoose.Model<ICounter>) ??
  model<ICounter>("Counter", counterSchema);
