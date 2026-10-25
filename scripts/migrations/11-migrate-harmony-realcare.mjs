/**
 * Migration 11 — move the live single-clinic Harmony install (Real Care Small Animal
 * Clinic) into the multi-tenant cluster as a proper tenant.
 *
 *   source : harmony-erp-suite/.env      MONGODB_URI  (read-only)
 *   target : Multi-tenent/.env           MONGODB_URI
 *
 * Creates the Tenant (+ doctor from the council ID card), ClinicConfig (+ logo), admin
 * user, then copies every business collection stamped with the tenantId and re-keys
 * counters to "<tenantId>:<name>". Any leftover docs of this tenantId from an earlier
 * partial run are backed up to backups/ and removed first; a failure rolls everything back.
 *
 *   node scripts/migrations/11-migrate-harmony-realcare.mjs --dry-run
 *   ADMIN_PASSWORD='...' node scripts/migrations/11-migrate-harmony-realcare.mjs
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const HARMONY = path.resolve(ROOT, "..", "harmony-erp-suite");
const DRY_RUN = process.argv.includes("--dry-run");
const ASSETS = process.env.ASSETS_DIR ?? path.join(ROOT, "scripts", "data");

const TENANT_ID = "tid_legacy_realcare";
const SLUG = "real_care_ngp";
const CLINIC = "Real Care Small Animal Clinic";
const ADMIN_EMAIL = "realcarepetclinic@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? `RealCare@${crypto.randomBytes(3).toString("hex")}!`;

// Never copied: sessions/tokens/OTPs are per-install, users are handled explicitly below.
const SKIP = new Set(["users", "refresh_tokens", "passwordresets", "registrationotps", "counters", "clinic_trials", "subscriptionplans", "clientsubscriptions"]);
// Harmony dev logins whose emails already live on other tenants (users.email is globally unique).
const SKIP_USERS = new Set(["ayush.sahare@vit.edu", "ayushsahare899@gmail.com"]);

const uriFrom = (envFile) =>
  fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("MONGODB_URI="))
    .slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");

const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;

const FEATURES = {
  crm: true, appointments: true, clinical: true, billing: true, inventory: true, laboratory: true,
  pharmacy: true, boarding: true, accounting: true, reports: true, nutrition: true, maxUsers: -1, maxPets: -1,
};

const src = await mongoose.createConnection(uriFrom(path.join(HARMONY, ".env"))).asPromise();
const dst = await mongoose.createConnection(uriFrom(path.join(ROOT, ".env"))).asPromise();
const S = src.db, D = dst.db;
console.log(`[11] ${DRY_RUN ? "DRY RUN" : "APPLY"}  src=${S.databaseName}  dst=${D.databaseName}`);

const dstCollections = (await D.listCollections().toArray()).map((c) => c.name);

async function wipeTenant() {
  for (const name of dstCollections) {
    if (name === "tenants") continue;
    const rows = await D.collection(name).find({ tenantId: TENANT_ID }).toArray();
    if (!rows.length) continue;
    if (!DRY_RUN) {
      fs.mkdirSync(path.join(ROOT, "backups"), { recursive: true });
      fs.writeFileSync(path.join(ROOT, "backups", `pre-11-${name}-${Date.now()}.json`), JSON.stringify(rows));
      await D.collection(name).deleteMany({ tenantId: TENANT_ID });
    }
    console.log(`[11]   ${DRY_RUN ? "would remove" : "removed"} ${rows.length} stale ${name}`);
  }
  if (!DRY_RUN) await D.collection("tenants").deleteOne({ tenantId: TENANT_ID });
}

let mutating = false; // rollback only touches data this run created, never a pre-existing tenant
try {
  if (await D.collection("tenants").findOne({ $or: [{ tenantId: TENANT_ID }, { slug: SLUG }] })) {
    throw new Error("Tenant already exists — refusing to run twice. Delete it first if you really want a re-run.");
  }
  if (await D.collection("users").findOne({ email: ADMIN_EMAIL })) throw new Error(`${ADMIN_EMAIL} already has an account.`);
  mutating = true;
  await wipeTenant();

  const now = new Date();
  const stamp = (doc) => ({ ...doc, tenantId: TENANT_ID });

  // ── 1. Admin user + tenant + clinic config ────────────────────────────────
  const adminId = new mongoose.Types.ObjectId();
  const admin = {
    _id: adminId, tenantId: TENANT_ID,
    fullName: "Dr. Makarand Mukund Dixit", email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    phone: "+91 87674 84342", clinicName: CLINIC, branch: "MAIN",
    roleId: "admin", roleName: "Clinic Administrator / Medical Director", initials: "MD",
    licenseNumber: "MSVC-8648/2011", qualification: "B.V.Sc & AH, M.V.Sc, PGDAW",
    department: "Clinical Administration & Surgery", specialty: "General Practice",
    approvalStatus: "approved", approvedBy: "Platform migration", approvedAt: now,
    isActive: true, isSystemAccount: false, loginCount: 0, createdAt: now, updatedAt: now,
  };

  const tenant = {
    tenantId: TENANT_ID, slug: SLUG, name: CLINIC, legalName: CLINIC, clinicType: "Small Animal",
    vetCouncilRegNo: "MSVC-8648/2011",
    doctor: {
      fullName: "Dr. Makarand Mukund Dixit", councilRegNo: "MSVC-8648/2011",
      councilName: "Maharashtra State Veterinary Council, Nagpur",
      regValidUpto: new Date("2031-08-02T23:59:59+05:30"),
      qualification: "B.V.Sc & AH, M.V.Sc, PGDAW",
      idCardDataUri: dataUri(path.join(ASSETS, "realcare-council-id.jpg"), "image/jpeg"),
    },
    address: "Central Avenue, Nagpur", city: "Nagpur", state: "Maharashtra", stateCode: "27", pin: "440001",
    phone: "+91 87674 84342", whatsappNumber: "+91 87674 84342", email: ADMIN_EMAIL,
    website: "www.realcarepet.com", adminUserId: String(adminId),
    planId: "plan_enterprise", subscriptionStatus: "ACTIVE", features: FEATURES, status: "ACTIVE",
    createdAt: now, updatedAt: now,
  };

  const clinicConfig = {
    tenantId: TENANT_ID, clinicName: CLINIC,
    tagline: "An Animal's Eyes Have The Power to Speak a Great Language",
    logoUrl: dataUri(path.join(ASSETS, "realcare-logo.png"), "image/png"),
    primaryColor: "#2563eb", address: tenant.address, city: "Nagpur", state: "Maharashtra", pin: "440001",
    phone: tenant.phone, email: ADMIN_EMAIL, website: "www.realcarepet.com",
    doctorName: "Dr. Makarand M. Dixit", doctorQualifications: "B.V.Sc & AH, M.V.Sc, PGDAW",
    doctorLicenseNumber: "MSVC-8648/2011", kennelCapacity: 20,
    hasBoardingFacility: true, hasSwimmingPool: false, createdAt: now, updatedAt: now,
  };

  // ── 2. Staff users (existing hashes kept, so current passwords still work) ─
  const staff = (await S.collection("users").find({ email: { $nin: [...SKIP_USERS] } }).toArray()).map((u) =>
    stamp({ ...u, clinicName: CLINIC, branch: u.branch === "Nagpur Main Clinic" ? "MAIN" : u.branch }),
  );
  const staffEmails = staff.map((u) => u.email);
  const clash = await D.collection("users").find({ email: { $in: staffEmails } }).toArray();
  if (clash.length) throw new Error(`Staff emails already used on the platform: ${clash.map((u) => u.email)}`);

  const plan = [{ collection: "tenants", rows: 1 }, { collection: "clinic_configs", rows: 1 }, { collection: "users", rows: 1 + staff.length }];

  if (!DRY_RUN) {
    await D.collection("tenants").insertOne(tenant);
    await D.collection("clinic_configs").insertOne(clinicConfig);
    await D.collection("users").insertMany([admin, ...staff]);
  }

  // ── 3. Business data ──────────────────────────────────────────────────────
  for (const { name } of await S.listCollections().toArray()) {
    if (SKIP.has(name) || name.startsWith("system.")) continue;
    const rows = await S.collection(name).find().toArray();
    if (!rows.length) continue;
    plan.push({ collection: name, rows: rows.length });
    if (!DRY_RUN) await D.collection(name).insertMany(rows.map(stamp), { ordered: true });
  }

  // org_branches copied verbatim above; fill in the contact fields the registration flow sets.
  if (!DRY_RUN) {
    await D.collection("org_branches").updateMany(
      { tenantId: TENANT_ID },
      { $set: { address: tenant.address, pin: "440001", phone: tenant.phone, email: ADMIN_EMAIL } },
    );
  }

  // ── 4. Counters, re-keyed so numbering continues ─────────────────────────
  const counters = await S.collection("counters").find().toArray();
  plan.push({ collection: "counters", rows: counters.length });
  if (!DRY_RUN && counters.length) {
    await D.collection("counters").insertMany(
      counters.map((c) => ({ _id: `${TENANT_ID}:${c._id}`, tenantId: TENANT_ID, seq: c.seq })),
    );
  }

  console.table(plan);

  // ── 5. Verify ─────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    const bad = [];
    for (const p of plan) {
      if (p.collection === "tenants") continue;
      const n = await D.collection(p.collection).countDocuments({ tenantId: TENANT_ID });
      if (n !== p.rows) bad.push(`${p.collection}: expected ${p.rows}, got ${n}`);
    }
    if (bad.length) throw new Error(`Verification failed:\n${bad.join("\n")}`);

    const out = [
      `Clinic          : ${CLINIC}`,
      `Clinic ID (slug): ${SLUG}`,
      `Tenant ID       : ${TENANT_ID}`,
      `Doctor          : Dr. Makarand Mukund Dixit (MSVC-8648/2011, valid upto 02-08-2031)`,
      `Login URL       : http://localhost:8080/login`,
      `Admin email     : ${ADMIN_EMAIL}`,
      `Admin password  : ${ADMIN_PASSWORD}`,
      `Other staff     : ${staffEmails.join(", ")} (existing passwords unchanged)`,
      `Created         : ${now.toISOString()}`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(ROOT, "clinic-credentials", "00-real-care-small-animal-clinic.txt"), out);
    console.log("[11] verified. Credentials written to clinic-credentials/00-real-care-small-animal-clinic.txt");
  }
} catch (err) {
  console.error("[11] FAILED:", err.message);
  if (!DRY_RUN && mutating) {
    console.error("[11] rolling back…");
    for (const name of (await D.listCollections().toArray()).map((c) => c.name)) {
      await D.collection(name).deleteMany({ tenantId: TENANT_ID });
    }
    await D.collection("tenants").deleteOne({ tenantId: TENANT_ID });
    await D.collection("users").deleteOne({ email: ADMIN_EMAIL });
  }
  process.exitCode = 1;
} finally {
  await src.close();
  await dst.close();
}
