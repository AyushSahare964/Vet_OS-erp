/**
 * ERP Row Server Functions — CRUD for all module rows stored in MongoDB.
 * Replaces the localStorage row store in store.tsx.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { WORKSPACES, type Row } from "@/lib/erp/workspaces";

function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ─── getRowsFn ───────────────────────────────────────────────────────────────

export const getRowsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ moduleId: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<Row[]> => {
    await connectDB();

    const docs = await ErpRow.find({ moduleId: data.moduleId })
      .sort({ createdAt: -1 })
      .lean();

    return toPlain(docs.map((d) => d.data as Row));
  }));

// ─── addRowFn ────────────────────────────────────────────────────────────────

export const addRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      moduleId: z.string(),
      row:      z.record(z.unknown()),
    }).parse(raw)
  )
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean; id: string }> => {
    await connectDB();

    const doc = await ErpRow.create({
      moduleId: data.moduleId,
      data:     data.row,
    });

    return { success: true, id: (doc._id as { toString(): string }).toString() };
  }));

// ─── deleteRowFn ─────────────────────────────────────────────────────────────

export const deleteRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      moduleId: z.string(),
      index:    z.number().int().min(0),
    }).parse(raw)
  )
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();

    // Find all docs for the module sorted newest-first (matches UI order)
    const docs = await ErpRow.find({ moduleId: data.moduleId })
      .sort({ createdAt: -1 })
      .lean();

    const target = docs[data.index];
    if (!target) return { success: false };

    await ErpRow.deleteOne({ _id: target._id });
    return { success: true };
  }));

// ─── updateRowFn ─────────────────────────────────────────────────────────────

export const updateRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      moduleId: z.string(),
      index:    z.number().int().min(0).optional(),
      match:    z.record(z.unknown()).optional(),
      row:      z.record(z.unknown()),
    }).parse(raw)
  )
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();

    // Match by specific field in data (e.g. { code: "TST-001" })
    if (data.match && Object.keys(data.match).length > 0) {
      const filter: Record<string, any> = { moduleId: data.moduleId };
      for (const [k, v] of Object.entries(data.match)) {
        filter[`data.${k}`] = v;
      }
      const doc = await ErpRow.findOne(filter);
      if (doc) {
        doc.data = data.row;
        doc.markModified("data");
        await doc.save();
        return { success: true };
      }
    }

    // Fallback: match by index in newest-first sorted list
    if (data.index !== undefined) {
      const docs = await ErpRow.find({ moduleId: data.moduleId })
        .sort({ createdAt: -1 })
        .lean();

      const target = docs[data.index];
      if (!target) return { success: false };

      await ErpRow.updateOne({ _id: target._id }, { $set: { data: data.row } });
      return { success: true };
    }

    return { success: false };
  }));

// ─── resetRowsFn ─────────────────────────────────────────────────────────────

export const resetRowsFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ moduleId: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<{ success: boolean }> => {
    await connectDB();

    // Delete all persisted rows for this module
    await ErpRow.deleteMany({ moduleId: data.moduleId });
    return { success: true };
  }));
