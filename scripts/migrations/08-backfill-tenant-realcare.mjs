/**
 * Migration 08 — turn the existing single-tenant "Real Care" install into a
 * real Tenant #1 of the new multi-tenant platform.
 *
 * Idempotent: creates the Tenant + ClinicConfig docs via upsert, and only
 * backfills tenantId onto documents that don't already have one.
 *
 *   node scripts/migrations/08-backfill-tenant-realcare.mjs            # apply
 *   node scripts/migrations/08-backfill-tenant-realcare.mjs --dry-run  # report only
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SALT_ROUNDS = 12;

// Mirrors SYSTEM_CREDENTIALS in src/lib/mongodb/serverFns/auth.ts — seeded here
// directly (bcrypt-hashed) only if the users collection is still empty, so a
// brand new cluster has a working admin login without a manual UI step.
const SYSTEM_CREDENTIALS = [
  {
    fullName: "Ayush Sahare", email: "ayush.sahare@vit.edu", password: "ayush@123", phone: "",
    clinicName: "Real Care Small Animal Clinic", branch: "Nagpur", roleId: "admin",
    roleName: "Clinic Administrator / Medical Director", initials: "AS",
    licenseNumber: "SYS-DEV-0001", qualification: "B.Tech Computer Science",
    department: "System Administration", specialty: "Administration",
    approvalStatus: "approved", isSystemAccount: true, isActive: true, loginCount: 0,
  },
  {
    fullName: "Dr. Makarand Dixit", email: "makarand.dixit@gmail.com", password: "12345678", phone: "+91 87674 84342",
    clinicName: "Real Care Small Animal Clinic", branch: "Nagpur Main Clinic", roleId: "admin",
    roleName: "Clinic Administrator / Medical Director", initials: "MD",
    licenseNumber: "M.S.V.C.-8648", qualification: "B.V.Sc & AH, M.V.Sc, PGDAW",
    department: "Clinical Administration & Surgery", specialty: "General Practice",
    approvalStatus: "approved", isSystemAccount: false, isActive: true, loginCount: 0,
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DRY_RUN = process.argv.includes("--dry-run");

const TENANT_ID = "tid_legacy_realcare";
const TENANT_SLUG = "real_care_ngp";

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
      console.log(`[08-backfill-tenant] trying ${source}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      console.log(`[08-backfill-tenant] connected via ${source}`);
      return;
    } catch (err) {
      lastError = err;
      await mongoose.disconnect().catch(() => {});
    }
  }
  throw lastError;
}

// Mirrors SUBSCRIPTION_PLANS.plan_enterprise.features in src/lib/erp/features.ts
const ENTERPRISE_FEATURES = {
  crm: true, appointments: true, clinical: true, billing: true, inventory: true,
  laboratory: true, pharmacy: true, boarding: true, accounting: true,
  reports: true, nutrition: true, maxUsers: -1, maxPets: -1,
};

// Never stamp a tenantId onto the tenant registry itself, and never touch
// MongoDB's own system collections.
const EXCLUDED_COLLECTIONS = new Set(["tenants"]);

async function main() {
  console.log(`[08-backfill-tenant] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connectWithFallback();
  const db = mongoose.connection.db;
  const usersColl = db.collection("users");

  const usersExist = await usersColl.countDocuments();
  if (usersExist === 0) {
    for (const cred of SYSTEM_CREDENTIALS) {
      const { password, ...rest } = cred;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      if (!DRY_RUN) {
        await usersColl.insertOne({ ...rest, passwordHash, tenantId: TENANT_ID, createdAt: new Date(), updatedAt: new Date() });
      }
    }
    console.log(`[08-backfill-tenant] ${DRY_RUN ? "would seed" : "seeded"} ${SYSTEM_CREDENTIALS.length} system credential(s) into an empty users collection.`);
  }

  const adminUser =
    (await usersColl.findOne({ email: "makarand.dixit@gmail.com" })) ??
    (await usersColl.findOne({ roleId: "admin", isSystemAccount: { $ne: true } })) ??
    (await usersColl.findOne({}));

  const tenantDoc = {
    tenantId: TENANT_ID,
    slug: TENANT_SLUG,
    name: "Real Care Small Animal Clinic",
    legalName: "Real Care Small Animal Clinic",
    clinicType: "Small Animal",
    address: "Central Avenue, Nagpur",
    city: "Nagpur",
    state: "Maharashtra",
    stateCode: "27",
    pin: "440001",
    phone: "+91 87674 84342",
    email: "care@realcareclinic.com",
    gstin: "",
    pan: "",
    adminUserId: adminUser ? String(adminUser._id) : "",
    planId: "plan_enterprise",
    subscriptionStatus: "ACTIVE",
    features: ENTERPRISE_FEATURES,
    status: "ACTIVE",
    updatedAt: new Date(),
  };

  if (!DRY_RUN) {
    await db.collection("tenants").updateOne(
      { tenantId: TENANT_ID },
      { $set: tenantDoc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    await db.collection("clinic_configs").updateOne(
      { tenantId: TENANT_ID },
      {
        $set: {
          tenantId: TENANT_ID,
          clinicName: "Real Care Small Animal Clinic",
          tagline: "An Animal's Eyes Have The Power to Speak a Great Language",
          logoUrl: "/clinic-logo.png",
          primaryColor: "#2563eb",
          address: "Central Avenue, Nagpur",
          city: "Nagpur",
          state: "Maharashtra",
          pin: "440001",
          phone: "+91 87674 84342",
          email: "care@realcareclinic.com",
          website: "www.petsdmart.com",
          gstin: "",
          doctorName: "Dr. Makarand M. Dixit",
          doctorQualifications: "B.V.Sc & AH, M.V.Sc, PGDAW",
          doctorLicenseNumber: "M.S.V.C.-8648",
          hasBoardingFacility: true,
          hasSwimmingPool: false,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  console.log(`[08-backfill-tenant] Tenant "${tenantDoc.name}" (${TENANT_ID}) ${DRY_RUN ? "would be upserted" : "upserted"}.`);

  const collections = await db.listCollections().toArray();
  const report = [];
  for (const { name } of collections) {
    if (EXCLUDED_COLLECTIONS.has(name) || name.startsWith("system.")) continue;
    const coll = db.collection(name);
    const toBackfill = await coll.countDocuments({ tenantId: { $exists: false } });
    if (toBackfill === 0) continue;
    if (!DRY_RUN) {
      await coll.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: TENANT_ID } });
    }
    report.push({ collection: name, backfilled: toBackfill });
  }

  console.table(report);
  const total = report.reduce((s, r) => s + r.backfilled, 0);
  console.log(
    DRY_RUN
      ? `[08-backfill-tenant] dry run complete — ${total} document(s) across ${report.length} collection(s) would be backfilled.`
      : `[08-backfill-tenant] done — ${total} document(s) across ${report.length} collection(s) backfilled with tenantId.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[08-backfill-tenant] FAILED:", err.message);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => {});
});
