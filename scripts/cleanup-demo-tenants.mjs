// Deletes ONLY records tagged demoBatch = "tenants-ui-redesign", in every collection.
//   node scripts/cleanup-demo-tenants.mjs            -> dry run (counts only)
//   node scripts/cleanup-demo-tenants.mjs --confirm  -> actually delete
import { connectLocalOnly, DEMO_BATCH } from "./lib/local-db-guard.mjs";

const { db, host, dbName } = await connectLocalOnly();
const confirm = process.argv.includes("--confirm");
const filter = { demoBatch: DEMO_BATCH };
let total = 0;
for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
  if (name.startsWith("system.")) continue;
  const col = db.collection(name);
  const count = await col.countDocuments(filter);
  if (!count) continue;
  total += count;
  if (confirm) {
    const r = await col.deleteMany(filter);
    console.log(`  ${name}: deleted ${r.deletedCount}`);
  } else {
    console.log(`  ${name}: ${count} would be deleted`);
  }
}
console.log(confirm
  ? `Deleted ${total} records from local db "${dbName}" @ ${host}.`
  : `DRY RUN on "${dbName}": ${total} records would be deleted. Re-run with --confirm to delete.`);
process.exit(0);
