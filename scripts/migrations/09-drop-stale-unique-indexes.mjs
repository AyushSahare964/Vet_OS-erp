/**
 * Migration 09 — drop the old single-tenant unique indexes that are now
 * superseded by per-tenant compound indexes (tenantScopePlugin + the
 * {tenantId, ...} unique indexes added across the model files).
 *
 * Mongoose's autoIndex creates NEW indexes declared on a schema but never
 * drops indexes it doesn't recognize, so the old global-uniqueness indexes
 * (e.g. org_branches.code_1) would otherwise keep rejecting a second
 * tenant's "MAIN" branch forever. This is idempotent — safe to re-run.
 *
 *   node scripts/migrations/09-drop-stale-unique-indexes.mjs            # apply
 *   node scripts/migrations/09-drop-stale-unique-indexes.mjs --dry-run  # report only
 */

import mongoose from "mongoose";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DRY_RUN = process.argv.includes("--dry-run");

// Collections whose indexes must NOT be touched — the tenant registry itself
// and anything without a tenantId-scoping concept.
const EXCLUDED_COLLECTIONS = new Set(["tenants"]);

async function connectWithFallback() {
  const candidates = [];
  if (process.env.MONGODB_URI) candidates.push(["MONGODB_URI env", process.env.MONGODB_URI]);
  const envPath = path.join(ROOT, "atlas-credentials.env");
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("MONGODB_URI="));
    const value = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
    if (value) candidates.push(["atlas-credentials.env", value]);
  }
  const clientPath = path.join(ROOT, "src", "lib", "mongodb", "client.ts");
  if (fs.existsSync(clientPath)) {
    const m = fs.readFileSync(clientPath, "utf8").match(/DEFAULT_URI\s*=\s*["'`]([^"'`]+)["'`]/);
    if (m?.[1]) candidates.push(["client.ts DEFAULT_URI", m[1]]);
  }
  if (!candidates.length) throw new Error("No MongoDB connection string found.");
  let lastError;
  for (const [source, uri] of candidates) {
    try {
      console.log(`[09-drop-stale-indexes] trying ${source}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      console.log(`[09-drop-stale-indexes] connected via ${source}`);
      return;
    } catch (err) {
      lastError = err;
      await mongoose.disconnect().catch(() => {});
    }
  }
  throw lastError;
}

async function main() {
  console.log(`[09-drop-stale-indexes] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connectWithFallback();
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  const report = [];

  for (const { name } of collections) {
    if (EXCLUDED_COLLECTIONS.has(name) || name.startsWith("system.")) continue;
    const coll = db.collection(name);
    const indexes = await coll.indexes();

    for (const idx of indexes) {
      if (idx.name === "_id_") continue;
      if (!idx.unique) continue;
      const keys = Object.keys(idx.key);
      // A correctly tenant-scoped unique index has "tenantId" as its FIRST key.
      // Anything else with unique:true is a stale, globally-unique index from
      // before multi-tenancy (e.g. { code: 1 } on org_branches) — except the
      // deliberately-global users.email_1 index, which must stay untouched.
      if (keys[0] === "tenantId") continue;
      if (name === "users" && keys.length === 1 && keys[0] === "email") continue;

      report.push({ collection: name, index: idx.name, keys: idx.key });
      if (!DRY_RUN) {
        await coll.dropIndex(idx.name).catch((err) => {
          console.error(`  ! failed to drop ${name}.${idx.name}: ${err.message}`);
        });
      }
    }
  }

  console.table(report);
  console.log(
    DRY_RUN
      ? `[09-drop-stale-indexes] dry run complete — ${report.length} stale unique index(es) would be dropped.`
      : `[09-drop-stale-indexes] done — ${report.length} stale unique index(es) dropped. Mongoose autoIndex will recreate the correct per-tenant compound indexes on next connect.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[09-drop-stale-indexes] FAILED:", err.message);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => {});
});
