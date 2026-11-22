/**
 * Imports the Real Care invoices in bills/parsed.json (made by scripts/extract-bills.py) into the
 * "Real Care Small Animal Clinic" tenant, the same way finalizeVisitAndBillFn stores a billed visit:
 * ClinicalVisit + owner/pet + FEFO stock deduction (matched items only) + sales journal + payment entry.
 *
 *   npx tsx --env-file=.env scripts/import-realcare-bills.ts           # dry run: prints the plan, writes nothing
 *   npx tsx --env-file=.env scripts/import-realcare-bills.ts --apply   # writes
 *
 * Safe to re-run: an invoice number that already exists in the tenant is skipped.
 * Payment mode is not printed on the PDFs, so paid bills are recorded as Cash (PAYMENT_MODE below).
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { runWithTenant } from "../src/lib/mongodb/tenantContext";
import { TenantModel } from "../src/lib/mongodb/models/Tenant";
import { ClinicalVisit } from "../src/lib/mongodb/models/ClinicalVisit";
import { Owner } from "../src/lib/mongodb/models/Owner";
import { Pet } from "../src/lib/mongodb/models/Pet";
import { InventoryItem } from "../src/lib/mongodb/models/InventoryItem";
import { StockBatch } from "../src/lib/mongodb/models/StockBatch";
import { FinanceTransaction } from "../src/lib/mongodb/models/FinanceTransaction";
import { ErpRow } from "../src/lib/mongodb/models/ErpRow";
import { Counter } from "../src/lib/mongodb/models/Counters";

const APPLY = process.argv.includes("--apply");
const PAYMENT_MODE = "Cash" as const;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

interface Item { category: string; name: string; qty: number; price: number; total: number; gst?: number }
interface Bill {
  file: string; invoiceNo: string; owner: string; date: string; nextVisit?: string | null; phone: string;
  pet: { name: string; species: string; breed: string; sex: string };
  items: Item[]; totals: Record<string, number>;
}

const bills: Bill[] = JSON.parse(fs.readFileSync(path.join("bills", "parsed.json"), "utf8"));
const round = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const iso = (d: string) => {
  const m = /^(\d+)\s+([A-Za-z]+)\s+(\d{4})$/.exec(d.trim())!;
  return `${m[3]}-${String(MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
};
const appInvoiceNo = (n: string) => `INV/2026-27-${n.split("/").pop()!.padStart(4, "0")}`;

function lineType(it: Item, productType?: string): "Vaccine" | "Pharmacy" | "Food" | "Accessory" | "Consultation" | "Diagnostic" | "Service" {
  const n = it.name.toLowerCase();
  if (it.category === "Vaccine") return "Vaccine";
  if (it.category === "Medicine" || it.category === "Deworming") return "Pharmacy";
  if (it.category.startsWith("Product")) return productType === "ACCESSORY" ? "Accessory" : "Food";
  if (/consult|home visit/.test(n)) return "Consultation";
  if (/^(cbc|lft|kft|slide)\b|stool/.test(n)) return "Diagnostic";
  return "Service";
}
const STOP = new Set(["tab", "syp", "syrup", "inj", "mg", "ml", "kg", "gm", "tape", "oral", "suspention", "suspension", "for", "and", "med", "large", "dog", "cat"]);
const stockable = (it: Item) => ["Medicine", "Vaccine", "Deworming"].includes(it.category) || it.category.startsWith("Product");

async function nextNum(key: string, prefix: string, pad: number, existingMax: number) {
  const id = `${tenantId}:${key}`;
  await Counter.findOneAndUpdate({ _id: id }, { $max: { seq: existingMax } }, { upsert: true });
  const r = await Counter.findOneAndUpdate({ _id: id }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return `${prefix}-${String(r!.seq).padStart(pad, "0")}`;
}
const maxOf = async (model: any, field: string, re: RegExp) => {
  const docs = await model.find({ [field]: { $regex: re } }).select(field).lean();
  return docs.reduce((m: number, d: any) => Math.max(m, parseInt(String(d[field]).replace(/^\D+/, ""), 10) || 0), 0);
};

let tenantId = "";

async function main() {
  await mongoose.connect(process.env["MONGODB_URI"]!);
  const tenants = await TenantModel.find({ name: /real care small animal clinic/i }).lean();
  if (tenants.length !== 1) throw new Error(`Expected exactly 1 "Real Care Small Animal Clinic" tenant, found ${tenants.length}`);
  tenantId = (tenants[0] as any).tenantId;
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} -> tenant ${tenantId} (${(tenants[0] as any).name}), db ${mongoose.connection.name}\n`);

  await runWithTenant({ tenantId, userId: "bill-import", roleId: "admin" }, async () => {
    const inventory = await InventoryItem.find({}).lean();
    let created = 0, skipped = 0;
    const unmatched: string[] = [];

    for (const b of bills) {
      const invoiceNo = appInvoiceNo(b.invoiceNo);
      const date = iso(b.date);
      if (await ClinicalVisit.exists({ invoiceNo })) { console.log(`SKIP ${invoiceNo}: already exists`); skipped++; continue; }

      const lines = b.items.reduce((s, i) => s + i.total, 0);
      const t = b.totals;
      const discount = round(t["DISCOUNT"] !== undefined ? Math.abs(t["DISCOUNT"]) : lines - (t["SUBTOTAL"] ?? lines));
      const roundOff = t["ROUND-OFF"] ?? 0;
      const total = t["TOTAL AMOUNT"]!;
      const gstAmount = t["GST AMOUNT"] ?? 0;
      const paid = Math.min(t["AMOUNT PAID"] ?? 0, total); // 207 printed paid 2750 on a 2746 bill (change given)
      const balance = round(total - paid);
      if (Math.abs(round(lines - discount + roundOff) - total) > 0.011) throw new Error(`${invoiceNo}: totals do not reconcile`);

      // inventory match: exact normalized name, else a unique contains match (flagged)
      const planLines = b.items.map((it) => {
        let inv: any, how = "";
        if (stockable(it)) {
          const k = norm(it.name);
          const exact = inventory.filter((x: any) => norm(x.name) === k);
          const toks = it.name.toLowerCase().split(/[^a-z0-9.]+/).map((w) => w.replace(/\./g, "")).filter((w) => w.length >= 2 && !STOP.has(w));
          const byTokens = (x: any) => toks.length > 0 && toks.every((w) => norm(`${x.name} ${x.brand ?? ""}`).includes(w));
          const fuzzy = exact.length ? [] : inventory.filter((x: any) => (k.length >= 6 && (norm(x.name).includes(k) || k.includes(norm(x.name)))) || byTokens(x));
          if (exact.length === 1) { inv = exact[0]; how = "exact"; }
          else if (fuzzy.length === 1) { inv = fuzzy[0]; how = "fuzzy"; }
          else unmatched.push(`${invoiceNo}: "${it.name}"${fuzzy.length > 1 ? " (ambiguous)" : ""}`);
        }
        return { it, inv, how };
      });

      console.log(`${invoiceNo} ${date} ${b.owner} (${b.phone}) pet ${b.pet.name}/${b.pet.species}  total ${total} paid ${paid} bal ${balance}${discount ? ` disc ${discount}` : ""}`);
      for (const { it, inv, how } of planLines) {
        console.log(`    ${it.category.padEnd(10)} ${it.name} x${it.qty} @${it.price} = ${it.total}  ${inv ? `-> ${inv.itemCode} ${inv.name} [${how}] stock ${inv.currentStock}` : stockable(it) ? "-> NO INVENTORY MATCH (no stock deduction)" : ""}`);
      }
      if (!APPLY) { created++; continue; }

      // ── owner / pet ──
      const phone = b.phone.replace(/\D/g, "").slice(-10);
      let owner: any = await Owner.findOne({ phone }).lean();
      if (!owner) {
        const ownerId = await nextNum("owner", "OWN", 4, await maxOf(Owner, "ownerId", /^OWN-/));
        owner = (await Owner.create({ ownerId, name: b.owner, phone, city: "Nagpur", outstandingBalance: 0, status: "Active" })).toObject();
      }
      let pet: any = await Pet.findOne({ ownerId: owner.ownerId, name: new RegExp(`^${b.pet.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
      const species = /cat/i.test(b.pet.species) ? "Feline" : /dog/i.test(b.pet.species) ? "Canine" : /parakeet|bird|parrot/i.test(b.pet.species) ? "Avian" : "Other";
      if (!pet) {
        const petId = await nextNum("pet", "PET", 4, await maxOf(Pet, "petId", /^PET-/));
        pet = (await Pet.create({ petId, ownerId: owner.ownerId, name: b.pet.name, species, breed: b.pet.breed || "Mixed", gender: /female/i.test(b.pet.sex) ? "Female" : "Male", allergies: [], chronicConditions: [] })).toObject();
      }

      // ── stock (FEFO) + inventory ledger, matched items only ──
      for (const { it, inv } of planLines) {
        if (!inv) continue;
        const batch = await StockBatch.findOne({ itemCode: inv.itemCode, qty: { $gt: 0 } }).sort({ expiryDate: 1 });
        const deducted = batch ? Math.min(batch.qty, it.qty) : 0;
        if (batch && deducted > 0) { batch.qty -= deducted; await batch.save(); await InventoryItem.updateOne({ itemCode: inv.itemCode }, { $inc: { currentStock: -deducted } }); }
        await ErpRow.create({
          moduleId: "inventory_ledger",
          data: {
            id: await nextNum("ledger_entry", "L", 4, 0), medicineId: inv.itemCode, medicineName: inv.name,
            batchId: (batch as any)?.batchCode || "B-GENERAL", batchNo: batch?.batchNo || "IMPORT", movementType: "sale_out",
            quantity: it.qty, sourceType: "invoice", sourceRef: invoiceNo, balanceAfter: batch ? batch.qty : 0, actorName: "Bill import",
            createdAt: `${date} 10:00`, reason: `Imported historical invoice ${b.invoiceNo} for ${b.pet.name}`,
          },
        });
      }

      // ── the visit / invoice ──
      const visitId = await nextNum("clinical_visit", "V", 4, await maxOf(ClinicalVisit, "visitId", /^V-/));
      const prescriptionNo = await nextNum("prescription_no", "RX", 4, await maxOf(ClinicalVisit, "prescriptionNo", /^RX-/));
      const isGst = gstAmount > 0;
      const mode = paid > 0 ? PAYMENT_MODE : "Account Due";
      await ClinicalVisit.create({
        visitId, invoiceNo, prescriptionNo, date, branch: "Main Clinic", billType: isGst ? "GST" : "Non-GST",
        petId: pet.petId, petName: pet.name, species: pet.species, breed: pet.breed, ownerId: owner.ownerId, ownerName: owner.name, ownerPhone: owner.phone,
        doctorName: "", receptionistName: "Front Desk", status: balance === 0 ? "Paid" : "Billed",
        diagnosis: "Imported historical invoice", clinicalNotes: `Imported from paper/PDF invoice ${b.invoiceNo}.`,
        ...(b.nextVisit ? { nextVisitDate: iso(b.nextVisit) } : {}),
        items: planLines.map(({ it, inv }, i) => ({
          id: `imp-${invoiceNo}-${i + 1}`, lineType: lineType(it, inv?.productType), name: it.name, quantity: it.qty, unitPrice: it.price,
          ...(inv ? { itemCode: inv.itemCode } : {}), discountPercent: 0, discountType: "percentage", discountValue: 0, discountAmount: 0,
          taxableAmount: it.gst ? round(it.total - (gstAmount || 0)) : it.total, gstRate: it.gst ?? 0, gstApplicable: Boolean(it.gst), lineTotal: it.total,
        })),
        subtotal: round(lines), billDiscount: discount, taxableAmount: round(total - roundOff - gstAmount), gstAmount, roundOff, totalAmount: total,
        amountPaid: paid, balanceDue: balance, pendingAmount: balance, paymentStatus: balance === 0 ? "Full" : paid > 0 ? "Partial" : "Unpaid",
        paymentMode: mode,
        payments: paid > 0 ? [{ id: `PAY-IMP-${invoiceNo}`, paymentId: `PAY-IMP-${invoiceNo}`, mode: PAYMENT_MODE, amount: paid, timestamp: `${date}T10:00:00.000Z`, recordedBy: "Bill import" }] : [],
        inventoryDeducted: true, accountingPosted: true,
      } as any);

      // ── accounting, same shape as finalizeVisitAndBillFn ──
      const jvNo = await nextNum("journal_entry", "JV", 4, 0);
      await FinanceTransaction.create({
        type: "journal",
        data: {
          journalNo: jvNo, date, voucherType: "Sales Invoice",
          lines: [
            { account: paid > 0 ? "1200" : "1300", debit: total, credit: 0 },
            { account: "4100", debit: 0, credit: round(total - gstAmount) },
            ...(gstAmount > 0 ? [{ account: "2200", debit: 0, credit: gstAmount }] : []),
          ],
          narration: `Clinical Invoice ${invoiceNo} for ${pet.name} (Owner: ${owner.name})`, isOpeningEntry: false, isAccrual: false,
        },
      } as any);
      if (paid > 0) {
        await FinanceTransaction.create({
          type: "payment",
          data: {
            paymentNo: await nextNum("payment_entry", "PE", 4, 0), paymentType: "Receive", paymentDate: date, partyType: "Customer", partyName: owner.name,
            modeOfPayment: PAYMENT_MODE, bankAccount: "Cash on Hand", referenceNo: invoiceNo, paidAmount: paid, narration: `Payment received for ${invoiceNo}`,
            references: [{ invoiceNo, invoiceDate: date, dueDate: date, invoiceAmount: total, outstanding: balance, allocatedAmount: paid }],
          },
        } as any);
      }
      created++;
    }

    // keep the live invoice counter ahead of the imported numbers
    if (APPLY) await Counter.findOneAndUpdate({ _id: `${tenantId}:invoice_no` }, { $max: { seq: Math.max(...bills.map((x) => parseInt(x.invoiceNo.split("/").pop()!, 10))) } }, { upsert: true });

    console.log(`\n${APPLY ? "Imported" : "Would import"} ${created}, skipped ${skipped}.`);
    if (unmatched.length) console.log(`\nNo inventory match (no stock deducted):\n  ${unmatched.join("\n  ")}`);
  });
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
