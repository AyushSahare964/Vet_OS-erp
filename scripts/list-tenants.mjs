/** Read-only: lists registered clinics, flagging E2E/test ones. Usage: node --env-file=.env scripts/list-tenants.mjs */
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db();
const tenants = await db.collection("tenants").find({}, { projection: { tenantId: 1, name: 1, status: 1, createdAt: 1, "doctor.councilRegNo": 1, email: 1, adminEmail: 1 } }).toArray();
const isTest = (t) => /^E2E\b/i.test(t.name || "") || /@vetos\.test$/i.test(t.adminEmail || t.email || "");
const real = tenants.filter((t) => !isTest(t));
console.log(`total=${tenants.length} test=${tenants.length - real.length} real=${real.length}`);
for (const t of real) console.log(`${t.tenantId}\t${t.name}\t${t.status}\t${t.createdAt?.toISOString?.().slice(0, 10)}`);
await client.close();
