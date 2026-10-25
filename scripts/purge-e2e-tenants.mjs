/**
 * Removes the clinics (and their data) created by the Playwright e2e tests: name starts with "E2E" AND the admin
 * email ends with @vetos.test. Dry run by default; pass --delete to remove.
 * Usage: node --env-file=.env scripts/purge-e2e-tenants.mjs [--delete]
 */
import { MongoClient } from "mongodb";

const doDelete = process.argv.includes("--delete");
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db();

const tenants = await db.collection("tenants").find({ name: /^E2E\b/ }).toArray();
const test = [];
for (const t of tenants) {
  const admin = await db.collection("users").findOne({ tenantId: t.tenantId, email: /@vetos\.test$/i });
  if (admin) test.push(t);
}
const ids = test.map((t) => t.tenantId);
console.log(`${doDelete ? "DELETING" : "DRY RUN"}: ${test.length} test clinic(s):`);
for (const t of test) console.log("  ", t.tenantId, t.name);

const colls = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => n !== "tenants");
for (const name of colls) {
  const filter = { tenantId: { $in: ids } };
  const n = await db.collection(name).countDocuments(filter);
  if (!n) continue;
  console.log(`  ${name}: ${n}`);
  if (doDelete) await db.collection(name).deleteMany(filter);
}
if (doDelete && ids.length) await db.collection("tenants").deleteMany({ tenantId: { $in: ids } });
await client.close();
