// Seeds DEMO clinics (tagged isDemo + demoBatch) into the LOCAL database for Tenants-page UI work.
//   node scripts/seed-demo-tenants.mjs          -> the 4 named clinics
//   node scripts/seed-demo-tenants.mjs --bulk   -> also pads the tenant list to 91 clinics
// Re-runnable (upserts by tenantId / email). Remove everything with scripts/cleanup-demo-tenants.mjs.
import bcrypt from "bcryptjs";
import { connectLocalOnly, DEMO_BATCH } from "./lib/local-db-guard.mjs";

const { db, host, dbName } = await connectLocalOnly();
const DEMO = { isDemo: true, demoBatch: DEMO_BATCH };
const DAY = 86_400_000;
const at = (iso) => new Date(iso + "T00:00:00+05:30");
const inDays = (days) => new Date(Date.now() + days * DAY);
const TRIAL_DAYS = 30;
// 1x1 PNG so the document View / Download buttons work.
const PLACEHOLDER_ID_CARD = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
// Starter (plan_starter): every module, limited by staff and pet counts
const FEATURES = { crm: true, appointments: true, clinical: true, billing: true, inventory: true, laboratory: true, pharmacy: true, boarding: true, accounting: true, reports: true, nutrition: true, maxUsers: 5, maxPets: 500 }; // Starter: every module, small limits
const DEMO_PASSWORD = "Demo@12345";
const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

/** Upserts one clinic: tenant + clinic config + default branch + admin user, all tagged as demo. */
async function seedClinic(c) {
  const now = new Date();
  const { tenantId } = c;
  await db.collection("tenants").updateOne(
    { tenantId },
    {
      $set: {
        slug: c.slug, name: c.name, legalName: c.legalName ?? c.name, clinicType: "Small Animal",
        address: c.address, city: c.city, state: c.state, stateCode: c.stateCode, pin: c.pin,
        phone: c.phone, whatsappNumber: c.phone, email: c.email, website: "", gstin: "", pan: "",
        adminUserId: c.adminEmail, doctorVerified: false, planId: "plan_starter", subscriptionStatus: "TRIAL", status: "ACTIVE",
        trialEndsAt: c.trialEndsAt, features: FEATURES, vetCouncilRegNo: c.doctor.councilRegNo,
        doctor: {
          fullName: c.doctor.fullName, councilRegNo: c.doctor.councilRegNo.replace(/\s+/g, "").toUpperCase(),
          councilName: c.doctor.councilName, regValidUpto: c.doctor.validUpto, qualification: c.doctor.qualification,
          idCardDataUri: PLACEHOLDER_ID_CARD,
        },
        updatedAt: now, ...DEMO,
      },
      $setOnInsert: { tenantId, createdAt: c.registeredAt },
    },
    { upsert: true },
  );

  await db.collection("clinic_configs").updateOne(
    { tenantId },
    {
      $set: {
        clinicName: c.name, tagline: c.tagline ?? "", primaryColor: c.color ?? "#2563eb", address: c.address, city: c.city,
        state: c.state, pin: c.pin, phone: c.phone, email: c.email, doctorName: c.doctor.fullName,
        doctorQualifications: c.doctor.qualification, doctorLicenseNumber: c.doctor.councilRegNo,
        kennelCapacity: c.kennelCapacity ?? 20, hasBoardingFacility: c.boarding ?? true, hasSwimmingPool: false,
        updatedAt: now, ...DEMO,
      },
      $setOnInsert: { tenantId, createdAt: c.registeredAt },
    },
    { upsert: true },
  );

  await db.collection("org_branches").updateOne(
    { tenantId, code: "MAIN" },
    {
      $set: {
        name: c.name, legalName: c.legalName ?? c.name, gstin: "", stateCode: c.stateCode, address: c.address, city: c.city,
        pin: c.pin, phone: c.phone, email: c.email, isComposition: c.composition ?? false, lutEnabled: false,
        isDefault: true, isActive: true, updatedAt: now, ...DEMO,
      },
      $setOnInsert: { tenantId, code: "MAIN", createdAt: c.registeredAt },
    },
    { upsert: true },
  );

  const initials = c.adminName.replace(/^Dr\.\s*/, "").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  await db.collection("users").updateOne(
    { email: c.adminEmail },
    {
      $set: {
        passwordHash, fullName: c.adminName, phone: c.adminPhone, clinicName: c.name, branch: "MAIN", roleId: "admin",
        roleName: "Admin", initials, specialty: "Administration", approvalStatus: "approved", isSystemAccount: false,
        isActive: true, tenantId, updatedAt: now, ...DEMO,
      },
      $setOnInsert: { email: c.adminEmail, loginCount: 0, createdAt: c.registeredAt },
    },
    { upsert: true },
  );
}

const named = [
  {
    tenantId: "tid_demoui_0001", slug: "ayush_pet_clinic_pun", name: "Ayush Pet clinic", legalName: "Ayush Pet clinic",
    address: "Free Zone Road, Phase1", city: "Pune", state: "Maharashtra", stateCode: "27", pin: "440001",
    phone: "+91 7972273293", email: "sanskruti.ruyarkar1604@gmail.com", composition: true, tagline: "Caring for your pet, always",
    color: "#4524eb", boarding: true, kennelCapacity: 20, registeredAt: at("2026-10-24"), trialEndsAt: at("2026-11-23"),
    adminName: "Dr. Ayush Sahare", adminEmail: "sanskruti.ruyarkar1604@gmail.com", adminPhone: "+91 8999880619",
    doctor: { fullName: "Dr. Ayush Sahare", qualification: "BVsc", councilRegNo: "MSVC-8990/1234", councilName: "Maharashtra State Veterinary Council", validUpto: at("2040-06-24") },
  },
  {
    tenantId: "tid_demoui_0002", slug: "sunrise_pet_hospital_del", name: "Sunrise Pet Hospital",
    address: "12 Demo Marg", city: "Delhi", state: "Delhi", stateCode: "07", pin: "110001", phone: "+91 9000000002", email: "sdfsf@gmail.com",
    registeredAt: at("2026-10-24"), trialEndsAt: at("2026-11-23"),
    adminName: "Dr. Demo Admin Two", adminEmail: "sdfsf@gmail.com", adminPhone: "+91 9000000002",
    doctor: { fullName: "sdfsdf", qualification: "BVSc", councilRegNo: "SDFSDF", councilName: "Delhi Veterinary Council", validUpto: at("2035-01-01") },
  },
  {
    tenantId: "tid_demoui_0003", slug: "e2e_tc_clinic_6193188", name: "E2E TC Clinic 6193188",
    address: "3 Test Lane", city: "Nagpur", state: "Maharashtra", stateCode: "27", pin: "440010", phone: "+91 9000000003", email: "tc.admin.6193188@vetos.test",
    registeredAt: at("2026-10-23"), trialEndsAt: at("2026-11-22"),
    adminName: "Dr. TC Admin 6193188", adminEmail: "tc.admin.6193188@vetos.test", adminPhone: "+91 9000000003",
    doctor: { fullName: "Dr. TC Admin 6193188", qualification: "BVSc & AH", councilRegNo: "MSVC-6193188T/2026", councilName: "Maharashtra State Veterinary Council", validUpto: at("2036-01-01") },
  },
  {
    tenantId: "tid_demoui_0004", slug: "e2e_mt_bravo_6012721", name: "E2E MT Bravo 6012721",
    address: "4 Test Lane", city: "Nagpur", state: "Maharashtra", stateCode: "27", pin: "440010", phone: "+91 9000000004", email: "mt.bravo.6012721@vetos.test",
    registeredAt: at("2026-10-23"), trialEndsAt: at("2026-11-22"),
    adminName: "Dr. Bravo Admin 6012721", adminEmail: "mt.bravo.6012721@vetos.test", adminPhone: "+91 9000000004",
    doctor: { fullName: "Dr. Bravo Admin 6012721", qualification: "BVSc & AH", councilRegNo: "MSVC-6012721B/2026", councilName: "Maharashtra State Veterinary Council", validUpto: at("2036-01-01") },
  },
];
for (const c of named) await seedClinic(c);
console.log(`Seeded ${named.length} named demo clinics.`);

// ── --bulk: pad the tenant list to 91 clinics ───────────────────────────────
if (process.argv.includes("--bulk")) {
  const TARGET = 91;
  const others = await db.collection("tenants").countDocuments({ demoGroup: { $ne: "bulk" } });
  const n = Math.max(0, TARGET - others);
  // days until plan end: includes <=7 days, today (0) and already expired (<0)
  const END = [28, 21, 14, 9, 7, 5, 3, 2, 1, 0, 0, -1, -4, -12, 25, 18, 11, 29, 16, 6];
  const CITIES = [["Pune", "Maharashtra", "27", "411001"], ["Mumbai", "Maharashtra", "27", "400001"], ["Nagpur", "Maharashtra", "27", "440001"], ["Delhi", "Delhi", "07", "110001"], ["Bengaluru", "Karnataka", "29", "560001"], ["Chennai", "Tamil Nadu", "33", "600001"]];
  for (let i = 1; i <= n; i++) {
    const k = String(i).padStart(3, "0");
    const [city, state, stateCode, pin] = CITIES[i % CITIES.length];
    const ends = END[i % END.length];
    const phone = `+91 91000${k.padStart(5, "0")}`;
    const c = {
      tenantId: `tid_demoui_b${k}`, slug: `demo_bulk_clinic_${k}`, name: `Demo Bulk Clinic ${k}`,
      address: `${i} Bulk Street`, city, state, stateCode, pin, phone, email: `bulk${k}@demo.local.test`,
      registeredAt: inDays(ends - TRIAL_DAYS), trialEndsAt: inDays(ends),
      adminName: `Dr. Bulk Admin ${k}`, adminEmail: `bulk${k}@demo.local.test`, adminPhone: phone,
      doctor: { fullName: `Dr. Bulk Doctor ${k}`, qualification: "BVSc & AH", councilRegNo: `BULKVC-${k}`, councilName: `${state} State Veterinary Council`, validUpto: at("2035-01-01") },
    };
    await seedClinic(c);
    // Tag as bulk and mirror the deployed mix: one non-trial subscription, ~3 verified doctors, the rest unverified.
    const set = { demoGroup: "bulk", doctorVerified: i % 29 === 0 };
    if (i === 17) set.subscriptionStatus = "ACTIVE";
    await db.collection("tenants").updateOne({ tenantId: c.tenantId }, { $set: set });
  }
  console.log(`Bulk: created/refreshed ${n} extra demo clinics.`);
}

const all = await db.collection("tenants").find({}).toArray();
console.log(`Tenants in db: ${all.length} | active: ${all.filter((t) => t.status === "ACTIVE").length} | suspended: ${all.filter((t) => t.status === "SUSPENDED").length} | on trial: ${all.filter((t) => t.subscriptionStatus === "TRIAL").length} | unverified doctor: ${all.filter((t) => t.doctorVerified !== true).length}`);
console.log(`Written ONLY to local db "${dbName}" @ ${host}. Demo admin password for seeded users: ${DEMO_PASSWORD}`);
process.exit(0);
