/**
 * Migration 10 — re-key counter documents to be tenant-prefixed.
 *
 * counters._id was the bare sequence name ("invoice_no"), unique across the whole
 * collection, so only one tenant could ever own it. counterKey() in
 * serverFns/counters.ts now looks up "<tenantId>:<name>"; this renames existing
 * rows (delete + insert, since _id is immutable) so that tenant's numbering
 * continues rather than restarting at 1. Idempotent.
 *
 *   node scripts/migrations/10-tenant-prefix-counters.mjs [--dry-run]
 */

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DRY_RUN = process.argv.includes("--dry-run");

const envLine = fs
  .readFileSync(path.join(ROOT, "atlas-credentials.env"), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("MONGODB_URI="));
const uri = envLine.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");

await mongoose.connect(uri);
const coll = mongoose.connection.db.collection("counters");

let renamed = 0;
for (const doc of await coll.find({ tenantId: { $type: "string" } }).toArray()) {
  if (String(doc._id).startsWith(`${doc.tenantId}:`)) continue; // already migrated
  const newId = `${doc.tenantId}:${doc._id}`;
  console.log(`${DRY_RUN ? "would rename" : "renaming"} ${doc._id} -> ${newId} (seq ${doc.seq})`);
  if (!DRY_RUN) {
    await coll.updateOne({ _id: newId }, { $max: { seq: doc.seq }, $setOnInsert: { tenantId: doc.tenantId } }, { upsert: true });
    await coll.deleteOne({ _id: doc._id });
  }
  renamed++;
}
console.log(`[10-tenant-prefix-counters] ${renamed} counter(s) ${DRY_RUN ? "would be " : ""}re-keyed.`);
await mongoose.disconnect();
