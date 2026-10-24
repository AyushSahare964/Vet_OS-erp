// Integration test (needs MONGODB_URI): bill deletion puts sold stock back / removes purchased stock.
// Uses a throw-away item and cleans up after itself.
import { afterAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/mongodb/client";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { restoreInvoiceStock, removePurchaseBillStock } from "@/lib/mongodb/stockReceipt";

const code = `ZZTEST-${Date.now()}`;
const ref = `ZZ/BILL/${Date.now()}`;
const stockOf = async () => (await InventoryItem.collection.findOne({ itemCode: code }))?.currentStock;
const batchQty = async () => (await StockBatch.collection.findOne({ itemCode: code }))?.qty;

describe("bill delete -> stock", () => {
  afterAll(async () => {
    await InventoryItem.collection.deleteMany({ itemCode: code });
    await StockBatch.collection.deleteMany({ itemCode: code });
    await ErpRow.collection.deleteMany({ "data.medicineId": code });
  });

  it("restores sold stock when an invoice is deleted, only once the invoice had deducted it", async () => {
    await connectDB();
    await InventoryItem.collection.insertOne({ itemCode: code, name: "ZZ Test", currentStock: 7 });
    await StockBatch.collection.insertOne({ itemCode: code, itemName: "ZZ Test", batchCode: "BZZ", batchNo: "X1", qty: 7, status: "Active", expiryDate: "2030-01-31" });
    const visit = { invoiceNo: "ZZ-INV", inventoryDeducted: true, items: [{ itemCode: code, name: "ZZ Test", quantity: 3 }] };

    expect(await restoreInvoiceStock({ ...visit, inventoryDeducted: false }, "test")).toBe(0);
    expect(await stockOf()).toBe(7);

    expect(await restoreInvoiceStock(visit, "test")).toBe(1);
    expect(await stockOf()).toBe(10);
    expect(await batchQty()).toBe(10);
  });

  it("removes the stock a purchase bill brought in when the bill is deleted", async () => {
    await StockBatch.collection.insertOne({ itemCode: code, itemName: "ZZ Test", batchCode: "BZZ2", batchNo: "X2", qty: 4, status: "Active", expiryDate: "2030-01-31", remarks: `Received from purchase bill ${ref}` });
    await InventoryItem.collection.updateOne({ itemCode: code }, { $inc: { currentStock: 4 } });
    expect(await stockOf()).toBe(14);

    const removed = await removePurchaseBillStock(ref, "test");
    expect(removed).toEqual([{ itemName: "ZZ Test", qty: 4 }]);
    expect(await stockOf()).toBe(10);
    expect(await StockBatch.collection.findOne({ batchCode: "BZZ2" })).toBeNull();
  });
});
