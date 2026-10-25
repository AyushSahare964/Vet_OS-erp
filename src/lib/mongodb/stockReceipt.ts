/**
 * Server-only: receive one lot into stock (batch + item balance + ledger row).
 * Shared by addStockFn (manual Add Stock) and createPurchaseBillFn (receive from a bill).
 * Kept out of serverFns/ so it is never bundled into the browser.
 */
import { connectDB } from "@/lib/mongodb/client";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { nextSeq } from "@/lib/mongodb/serverFns/counters";

export interface StockReceiptInput {
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNo: string;
  manufacturingDate: string;
  expiryDate: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderRef: string;
  invoiceBillNo: string;
  receivedDate: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason: string;
  purchasePricePerUnit: number;
  landingCost: number;
  gstOnPurchase: number;
  storageLocation: string;
  qualityChecked: boolean;
  qcInspectorName: string;
  remarks: string;
  actor: string;
}

export async function receiveStockBatch(data: StockReceiptInput) {
  await connectDB();

  const batchCode = await nextSeq("stock_batch", "B", 4);
  const landingCostPerUnit = data.acceptedQty > 0 ? data.landingCost / data.acceptedQty : 0;
  const totalValue = data.acceptedQty * (data.purchasePricePerUnit + landingCostPerUnit);

  const batch = await StockBatch.create({
    ...data,
    batchCode,
    qty: data.acceptedQty,
    landingCostPerUnit,
    totalValue,
  });

  // Update lastPurchaseRate and currentStock on the item
  await InventoryItem.findOneAndUpdate(
    { itemCode: data.itemCode },
    { lastPurchaseRate: data.purchasePricePerUnit, $inc: { currentStock: data.acceptedQty } }
  );

  // Record ledger entry in ErpRow
  await ErpRow.create({
    moduleId: "inventory_ledger",
    data: {
      id: await nextSeq("ledger_entry", "L", 4),
      medicineId: data.itemCode,
      medicineName: data.itemName,
      batchId: batch.batchCode,
      batchNo: data.batchNo,
      movementType: "purchase_in",
      quantity: data.acceptedQty,
      sourceType: "purchase",
      sourceRef: data.purchaseOrderRef || `GRN-${Date.now()}`,
      balanceAfter: data.acceptedQty,
      actorName: data.actor,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    },
  });

  return batch;
}

const ledgerRow = async (r: { itemCode: string; itemName: string; batch: any; type: "return_in" | "adjustment_out"; qty: number; ref: string; reason: string; actor: string }) =>
  ErpRow.create({
    moduleId: "inventory_ledger",
    data: {
      id: await nextSeq("ledger_entry", "L", 4),
      medicineId: r.itemCode,
      medicineName: r.itemName,
      batchId: r.batch.batchCode,
      batchNo: r.batch.batchNo,
      movementType: r.type,
      quantity: r.qty,
      sourceType: r.type === "return_in" ? "invoice" : "purchase",
      sourceRef: r.ref,
      balanceAfter: r.batch.qty,
      actorName: r.actor,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      reason: r.reason,
    },
  });

/**
 * Deleting a sales invoice puts its stock back: the mirror of the deduction done when the invoice was finalized
 * (same quantity, same batch rule). Only runs if that deduction happened. Returns how many lines were restored.
 */
export async function restoreInvoiceStock(visit: { invoiceNo?: string; visitId?: string; inventoryDeducted?: boolean; items?: any[] }, actor: string) {
  if (!visit.inventoryDeducted) return 0;
  await connectDB();
  let restored = 0;
  for (const it of visit.items ?? []) {
    const qty = Number(it.quantity) || 0;
    if (!it.itemCode || qty <= 0) continue;
    const batch =
      (it.batchNo ? await StockBatch.findOne({ itemCode: it.itemCode, batchNo: it.batchNo }) : null) ??
      (await StockBatch.findOne({ itemCode: it.itemCode }).sort({ expiryDate: 1 }));
    if (!batch) continue;
    await StockBatch.updateOne({ _id: batch._id }, { $inc: { qty }, ...(batch.status === "Exhausted" ? { $set: { status: "Active" } } : {}) });
    batch.qty += qty;
    await InventoryItem.updateOne({ itemCode: it.itemCode }, { $inc: { currentStock: qty } });
    await ledgerRow({ itemCode: it.itemCode, itemName: it.name, batch, type: "return_in", qty, ref: visit.invoiceNo || visit.visitId || "", reason: `Invoice ${visit.invoiceNo} deleted: stock returned`, actor });
    restored++;
  }
  return restored;
}

/**
 * Deleting a purchase bill removes the stock it received: its batches go, and the items' totals drop by what is
 * still on hand in them (units already sold stay sold). Returns the removed lines.
 */
export async function removePurchaseBillStock(internalRef: string, actor: string) {
  await connectDB();
  const batches = await StockBatch.find({ remarks: `Received from purchase bill ${internalRef}` });
  const removed: { itemName: string; qty: number }[] = [];
  for (const batch of batches) {
    const qty = Math.max(0, batch.qty);
    if (qty > 0) await InventoryItem.updateOne({ itemCode: batch.itemCode }, { $inc: { currentStock: -qty } });
    await ledgerRow({ itemCode: batch.itemCode, itemName: batch.itemName, batch: { ...batch.toObject(), qty: 0 }, type: "adjustment_out", qty, ref: internalRef, reason: `Purchase bill ${internalRef} deleted: stock removed`, actor });
    await StockBatch.deleteOne({ _id: batch._id });
    removed.push({ itemName: batch.itemName, qty });
  }
  return removed;
}
