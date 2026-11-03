/**
 * Purchase-bill drafts — shared server-side (erp_rows), same rules as PO drafts:
 * admin/reception/accounts/doctor can create; only admin can edit/delete, and only within the month they were created.
 * A draft nobody edited within the month they were created is saved as a real purchase bill automatically
 * (swept whenever the drafts are listed).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { getMeFn } from "./auth";
import { CreateBillZ } from "./purchaseBills";

const MODULE_ID = "purchase-bill-drafts";
import { draftEditableUntil, currentMonthStart } from "@/lib/draftWindow";

/** `bill` is the ready-to-post payload; `form` is the modal's own state, to reopen it. */
export interface PurchaseBillDraft {
  id: string;
  bill: z.infer<typeof CreateBillZ>;
  form: any;
  createdAt: string;
  editableUntil: string;
}

const inputZ = z.object({ bill: CreateBillZ, form: z.record(z.unknown()) });

// Every role that can open Billing/Inventory can save a draft; only admin edits/deletes.
const DRAFT_ROLES = ["admin", "reception", "accounts", "doctor"];

async function requireRole(allowed: string[]) {
  const me = await getMeFn();
  if (!me) throw new Error("Your session has expired. Please sign out and sign in again.");
  if (!allowed.includes(me.roleId)) throw new Error(`Not permitted for role "${me.roleId}"`);
  return me;
}

const toDraft = (d: any): PurchaseBillDraft => ({
  id: String(d._id),
  bill: d.data.bill,
  form: d.data.form,
  createdAt: d.createdAt.toISOString(),
  editableUntil: new Date(draftEditableUntil(d.createdAt)).toISOString(),
});

export const listBillDraftsFn = createServerFn({ method: "GET" })
  .handler(tenantScoped(async (): Promise<PurchaseBillDraft[]> => {
    await requireRole(DRAFT_ROLES);
    await connectDB();
    // Auto-save drafts that outlived the edit window. If posting fails (e.g. the bill no. was
    // since used) the draft stays, locked, until an admin deletes it.
    const expired = await ErpRow.find({
      moduleId: MODULE_ID,
      createdAt: { $lt: new Date(currentMonthStart()) },
    });
    for (const d of expired) {
      try {
        const { createPurchaseBill } = await import("@/lib/mongodb/purchaseBillCreate");
        const bill = (d.data as any).bill;
        // receive stock too (old drafts say false), but only if every linked line has batch + expiry, else the post would fail
        const canReceive = bill.items.every((i: any) => !i.inventoryItemId || (i.batchNo?.trim() && i.expiryDate?.trim()));
        await createPurchaseBill({ ...bill, receiveStock: canReceive });
        await ErpRow.deleteOne({ _id: d._id });
      } catch (e) {
        console.error("[purchaseBillDrafts] auto-save failed for", String(d._id), e);
      }
    }
    const docs = await ErpRow.find({ moduleId: MODULE_ID }).sort({ createdAt: -1 }).lean();
    return docs.map(toDraft);
  }));

export const saveBillDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => inputZ.parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ id: string }> => {
    await requireRole(DRAFT_ROLES);
    await connectDB();
    const doc = await ErpRow.create({ moduleId: MODULE_ID, data: data });
    return { id: String(doc._id) };
  }));

/** Admin only, and only while the draft is from the current month. */
export const updateBillDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => inputZ.extend({ id: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await requireRole(["admin"]);
    await connectDB();
    const doc = await ErpRow.findOne({ _id: data.id, moduleId: MODULE_ID });
    if (!doc) throw new Error("Draft not found");
    if (Date.now() > draftEditableUntil(doc.createdAt)) {
      throw new Error(`Draft is from a previous month and can no longer be changed`);
    }
    doc.data = { bill: data.bill, form: data.form };
    doc.markModified("data");
    await doc.save();
    return { success: true };
  }));

/** Admin only. Used after a draft is saved as a real bill, or to discard it. */
export const deleteBillDraftFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await requireRole(["admin"]);
    await connectDB();
    await ErpRow.deleteOne({ _id: data.id, moduleId: MODULE_ID });
    return { success: true };
  }));
