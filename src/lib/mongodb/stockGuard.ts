/**
 * Stock can never be negative. Sales, prescriptions and returns decrement stock with `$inc`, which
 * Mongoose validators don't see, so this floors anything that dipped below zero back to 0 — call it
 * after a decrement, and on item-list reads so rows already negative in the database are healed.
 */

import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";

export async function clampNegativeStock(): Promise<void> {
  await Promise.all([
    InventoryItem.updateMany({ currentStock: { $lt: 0 } }, { $set: { currentStock: 0 } }),
    StockBatch.updateMany({ qty: { $lt: 0 } }, { $set: { qty: 0 } }),
  ]).catch((err) => console.warn("[stockGuard] could not floor negative stock:", err));
}
