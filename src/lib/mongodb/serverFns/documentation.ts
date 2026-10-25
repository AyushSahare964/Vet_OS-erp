/**
 * Saved forms, consents and certificates (Documentation). The filled-in document is stored as a
 * snapshot, so it still reads the same later even if the patient, owner or template changes.
 * Stored in the generic erp_rows collection. Admin, doctor and reception can save; only admin deletes.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { getMeFn } from "./auth";
import { nextSeq } from "./counters";

const MODULE_ID = "documentation-records";
const SAVE_ROLES = ["admin", "doctor", "reception"];

async function requireRole(allowed: string[]) {
  const me = await getMeFn();
  if (!me) throw new Error("Your session has expired. Please sign out and sign in again.");
  if (!allowed.includes(me.roleId)) throw new Error(`Not permitted for role "${me.roleId}"`);
  return me;
}

export interface DocRecordRow {
  id: string;
  docNo: string;
  templateId: string;
  title: string;
  petId: string;
  petName: string;
  ownerName: string;
  doctor: string;
  savedBy: string;
  savedAt: string;
  /** Header cells, filled paragraphs and the vaccine table exactly as saved */
  header: Record<string, string>;
  paragraphs: string[];
  vaccines: Array<Record<string, string>>;
  vaccineTable: boolean;
  signatures: string[];
}

const saveZ = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  petId: z.string().default(""),
  petName: z.string().default(""),
  ownerName: z.string().default(""),
  doctor: z.string().default(""),
  header: z.record(z.string()),
  paragraphs: z.array(z.string()).max(60),
  vaccines: z.array(z.record(z.string())).max(200).default([]),
  vaccineTable: z.boolean().default(false),
  signatures: z.array(z.string()).max(6),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (d: any): DocRecordRow => ({ ...(d.data as Omit<DocRecordRow, "id">), id: String(d._id) });

export const listDocRecordsFn = createServerFn({ method: "GET" })
  .handler(tenantScoped(async (): Promise<DocRecordRow[]> => {
    await requireRole(SAVE_ROLES);
    await connectDB();
    const docs = await ErpRow.find({ moduleId: MODULE_ID }).sort({ createdAt: -1 }).limit(500).lean();
    return docs.map(toRow);
  }));

export const saveDocRecordFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => saveZ.parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ id: string; docNo: string }> => {
    const me = await requireRole(SAVE_ROLES);
    await connectDB();
    const docNo = await nextSeq("documentation_record", "DOC", 4);
    const doc = await ErpRow.create({
      moduleId: MODULE_ID,
      data: { ...data, docNo, savedBy: me.fullName, savedAt: new Date().toISOString() },
    });
    return { id: String(doc._id), docNo };
  }));

export const deleteDocRecordFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await requireRole(["admin"]);
    await connectDB();
    await ErpRow.deleteOne({ _id: data.id, moduleId: MODULE_ID });
    return { success: true };
  }));
