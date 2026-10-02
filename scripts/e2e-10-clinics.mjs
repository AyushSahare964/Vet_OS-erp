/**
 * E2E: register 10 different clinics through the real UI (headed Chromium), write one
 * credentials file per clinic, then log in as each and open every printable document
 * (invoice, quotation, purchase bill, lab report, clinical report, pharmacy receipt,
 * prescription) checking it carries THAT clinic's branding and nobody else's.
 *
 *   node scripts/e2e-10-clinics.mjs                 # headed, all 10
 *   ONLY=1 node scripts/e2e-10-clinics.mjs          # just the first clinic (debugging)
 *   HEADLESS=1 node scripts/e2e-10-clinics.mjs
 *
 * Output: clinic-credentials/NN-<slug>.txt (gitignored), e2e-output/<slug>/*.png
 */
import { chromium } from "playwright-core";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CHROME = "C:\\Users\\LENOVO\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe";
const BASE = "http://localhost:8080";
const CRED_DIR = path.join(ROOT, "clinic-credentials");
const OUT_DIR = path.join(ROOT, "e2e-output");
const HEADLESS = process.env.HEADLESS === "1";
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : 0;
const LEAK = /Real Care|Makarand|petsdmart|M\.S\.V\.C|Rohit Sharma/i;

const CLINICS = [
  { name: "Alpha Paws Vet Hospital", city: "Pune", color: "#dc2626", letter: "A", tagline: "Alpha care for every paw", doctor: "Dr Anita Kulkarni" },
  { name: "Beta Pet Wellness", city: "Mumbai", color: "#16a34a", letter: "B", tagline: "Wellness first, always", doctor: "Dr Bharat Menon" },
  { name: "Gamma Animal Hospital", city: "Nashik", color: "#2563eb", letter: "G", tagline: "Trusted animal hospital", doctor: "Dr Gauri Deshpande" },
  { name: "Delta Vet Studio", city: "Nagpur", color: "#9333ea", letter: "D", tagline: "Modern vet studio", doctor: "Dr Dev Patil" },
  { name: "Epsilon Pet Clinic", city: "Thane", color: "#ea580c", letter: "E", tagline: "Every pet, every day", doctor: "Dr Esha Joshi" },
  { name: "Zeta Companion Care", city: "Surat", color: "#0891b2", letter: "Z", tagline: "Companions for life", doctor: "Dr Zoya Khan" },
  { name: "Eta Small Animal Centre", city: "Indore", color: "#be185d", letter: "H", tagline: "Small animals, big care", doctor: "Dr Harsh Vora" },
  { name: "Theta Furry Friends Clinic", city: "Jaipur", color: "#65a30d", letter: "T", tagline: "Friends with fur", doctor: "Dr Tanvi Rao" },
  { name: "Iota Pet Health Hub", city: "Bengaluru", color: "#4f46e5", letter: "I", tagline: "Your pet's health hub", doctor: "Dr Ishaan Nair" },
  { name: "Kappa Vet Care Point", city: "Chennai", color: "#b45309", letter: "K", tagline: "Care at every point", doctor: "Dr Kavya Iyer" },
];

const results = [];
const check = (clinic, name, ok, detail = "") => {
  results.push({ clinic, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${clinic}] ${name}${detail ? "  — " + detail : ""}`);
};
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const type = async (page, sel, text) => {
  const el = page.locator(sel).first();
  await el.click();
  await el.pressSequentially(text, { delay: 4 });
};
const shell = (page) => page.waitForFunction(() => document.body.innerText.includes("NAVIGATION"), null, { timeout: 90000 });

async function makeLogo(browser, color, letter) {
  const p = await browser.newPage();
  const dataUrl = await p.evaluate(({ color, letter }) => {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 200;
    const x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, 200, 200);
    x.fillStyle = "#fff"; x.font = "bold 110px sans-serif"; x.fillText(letter, 55, 140);
    return c.toDataURL("image/png");
  }, { color, letter });
  await p.close();
  const file = path.join(ROOT, `_logo_${letter}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  return file;
}

async function register(browser, c, i, logoFile) {
  const stamp = Date.now() % 100000;
  const clinicName = c.name;
  const phone = `+91 9${String(i + 1).repeat(4)} ${String(10000 + i * 1111).slice(0, 5)}`;
  const slug = slugify(clinicName);
  const adminEmail = `${slug}.owner${stamp}@example.com`;
  const password = `Vet@${crypto.randomBytes(4).toString("hex")}!${i + 1}`;
  const page = await browser.newPage();
  for (let a = 1; a <= 4; a++) {
    await page.goto(`${BASE}/register-clinic`, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector('input[placeholder="Sunrise Pet Hospital"]', { timeout: 30000 });
    await page.waitForTimeout(3000 + a * 2000);
    await type(page, 'input[placeholder="Sunrise Pet Hospital"]', clinicName);
    await type(page, 'input[placeholder="+91 98765 43210"]', phone);
    await type(page, 'input[placeholder="clinic@example.com"]', `contact.${slug}${stamp}@example.com`);
    await type(page, 'input[placeholder="Street, area"]', `${i + 12} ${c.city} Main Road`);
    await type(page, 'input[placeholder="Nagpur"]', c.city);
    await type(page, 'input[placeholder="440001"]', "411001");
    await page.waitForTimeout(500);
    if (!(await page.locator('button:has-text("Continue")').first().isDisabled())) break;
  }
  await page.click('button:has-text("Continue")', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.setInputFiles('input[type="file"]', logoFile);
  await page.waitForTimeout(1200);
  await type(page, 'input[placeholder="Caring for your pets, always"]', c.tagline);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(700);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(700);
  await type(page, 'input[placeholder="Dr. Jane Doe"]', c.doctor);
  await type(page, 'input[placeholder="you@example.com"]', adminEmail);
  const pw = await page.locator('input[type="password"]').all();
  await pw[0].click(); await pw[0].pressSequentially(password, { delay: 4 });
  await pw[1].click(); await pw[1].pressSequentially(password, { delay: 4 });
  await page.click('button:has-text("Create My Clinic")');
  await page.waitForTimeout(5000);
  const ok = page.url() === `${BASE}/`;
  await page.close();
  return { ...c, clinicName, phone, adminEmail, password, slug, registered: ok };
}

async function login(browser, email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.waitForTimeout(3500);
  for (let i = 0; i < 4; i++) {
    const e = page.locator('input[type="email"]'); await e.click(); await e.fill(""); await e.pressSequentially(email, { delay: 5 });
    const p = page.locator('input[type="password"]'); await p.click(); await p.fill(""); await p.pressSequentially(password, { delay: 5 });
    await page.click('button[type="submit"]:has-text("Sign In")');
    await page.waitForTimeout(3500);
    if (page.url() === `${BASE}/`) { await shell(page); return { page, ctx }; }
  }
  return { page, ctx, failed: true };
}

const docNames = (cl, n) => {
  const P = `${cl.letter}${n}`;
  return { owner: `${cl.city} Owner ${P}`, pet: `Buddy${P}`, lab: `LAB-${P}-0001`, report: `RPT-${P}-0001`, sale: `RS-${P}-0001`, billNo: `SUP-${P}-77` };
};

// REUSE=1: re-verify clinics already registered (from clinic-credentials/*.txt) instead of registering new ones.
function loadExisting() {
  return fs.readdirSync(CRED_DIR).filter((f) => /^\d\d-.*\.txt$/.test(f)).sort().map((f) => {
    const n = Number(f.slice(0, 2));
    const kv = Object.fromEntries(fs.readFileSync(path.join(CRED_DIR, f), "utf8").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, 16).trim(), l.slice(18).trim()]));
    const base = CLINICS[n - 1];
    const cl = { ...base, clinicName: kv["Clinic"], phone: kv["Clinic phone"], adminEmail: kv["Login email"], password: kv["Login password"], tenantId: kv["Tenant ID"], slug: slugify(kv["Clinic"]) };
    cl.docs = docNames(cl, n);
    return cl;
  });
}

// ── Seeding (raw collections, tenantId set explicitly) ───────────────────────────────────
async function seed(db, cl, n) {
  const user = await db.collection("users").findOne({ email: cl.adminEmail });
  if (!user?.tenantId) throw new Error(`no tenant for ${cl.adminEmail}`);
  const tenantId = user.tenantId;
  cl.tenantId = tenantId;
  const P = `${cl.letter}${n}`; // makes every clinic's document numbers distinguishable
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const owner = `${cl.city} Owner ${P}`;
  const pet = `Buddy${P}`;
  cl.docs = docNames(cl, n);

  await db.collection("owners").insertOne({ tenantId, ownerId: `OWN-${P}`, name: owner, phone: "+91 90000 1" + String(n).padStart(4, "0"), city: cl.city, status: "Active", createdAt: now, updatedAt: now });
  await db.collection("pets").insertOne({ tenantId, petId: `PET-${P}`, ownerId: `OWN-${P}`, name: pet, species: "Canine", breed: "Labrador", gender: "Male", status: "Active", allergies: [], chronicConditions: [], createdAt: now, updatedAt: now });

  const row = (moduleId, data) => ({ tenantId, moduleId, data, createdAt: now, updatedAt: now });
  await db.collection("erp_rows").insertMany([
    row("lab_orders", {
      order: cl.docs.lab, orderId: cl.docs.lab, date, pet, petId: `PET-${P}`, owner, test: "Complete Blood Count", sample: "Blood", doctor: cl.doctor,
      collected: date, status: "Reported", priority: "Routine",
      parameters: [
        { name: "Hemoglobin", value: "13.2", unit: "g/dL", refInterval: "12 - 18", flag: "Normal" },
        { name: "WBC", value: "18.4", unit: "10^3/uL", refInterval: "6 - 17", flag: "High" },
      ],
    }),
    row("clinical_reports", {
      reportId: cl.docs.report, title: "Abdominal Ultrasound", category: "Radiology", pet, petId: `PET-${P}`, owner, doctor: cl.doctor, date,
      status: "Verified & Signed", isNarrative: true, narrative: `Findings for ${pet}: unremarkable.`, impression: "No abnormality detected.",
    }),
    row("retail_sales", {
      bill: cl.docs.sale, customer: `Walkin ${P}`, date, item: `Dewormer ${P}`, category: "Medicine", qty: 2, amount: 236, payment: "UPI",
      subtotal: 200, gst: 36, items: [{ name: `Dewormer ${P}`, quantity: 2, unitPrice: 100 }],
    }),
  ]);

  const sup = await db.collection("suppliers").insertOne({ tenantId, name: `Supplier ${P} Pharma`, createdAt: now, updatedAt: now });
  await db.collection("purchasebills").insertOne({
    tenantId, internalRef: `PB-${P}-0001`, supplierId: String(sup.insertedId), supplierName: `Supplier ${P} Pharma`, billNumber: cl.docs.billNo,
    billDate: date, taxType: "INTRA", subtotal: 1000, discountTotal: 0, taxableTotal: 1000, cgstTotal: 90, sgstTotal: 90, igstTotal: 0,
    otherCharges: 0, roundOff: 0, grandTotal: 1180, amountPaid: 0, status: "UNPAID",
    items: [{ lineNo: 1, itemType: "NON_INVENTORY", description: `Stock item ${P}`, qty: 10, freeQty: 0, purchaseRate: 100, discountPct: 0, gstPct: 18, taxableAmount: 1000, taxAmount: 180, lineTotal: 1180 }],
    createdAt: now, updatedAt: now,
  });
}

// ── Document checks ──────────────────────────────────────────────────────────────────────
async function goModule(page, route, waitMs = 5000) {
  await page.goto(`${BASE}/m/${route}`, { waitUntil: "load", timeout: 90000 });
  await shell(page);
  await page.waitForTimeout(waitMs);
}

async function verifyDialog(page, cl, label, seen, { logo: wantLogo = true, area } = {}) {
  const dlg = (area ? page.locator(area) : page.locator('[role="dialog"]')).last();
  await dlg.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1200);
  const text = (await dlg.innerText()).toLowerCase();
  const logo = await dlg.locator("img").first().getAttribute("src").catch(() => "");
  const shot = path.join(OUT_DIR, cl.slug, `${label}.png`);
  await page.screenshot({ path: shot });
  check(cl.slug, `${label}: shows clinic name`, text.includes(cl.clinicName.toLowerCase()));
  check(cl.slug, `${label}: shows clinic phone`, text.includes(cl.phone.replace("+91 ", "").toLowerCase()) || text.includes(cl.phone.toLowerCase()), cl.phone);
  if (wantLogo) check(cl.slug, `${label}: uploaded logo (not default)`, (logo || "").startsWith("data:image"), (logo || "").slice(0, 30));
  const others = CLINICS.filter((o) => o.name !== cl.name && text.includes(o.name.toLowerCase()));
  check(cl.slug, `${label}: no other clinic's name`, others.length === 0, others.map((o) => o.name).join(","));
  const m = text.match(LEAK);
  check(cl.slug, `${label}: no Real Care / Dr Makarand leak`, !m, m?.[0] || "");
  if (logo) seen.set(logo, cl.slug);
  return { text, logo };
}
const closeDialog = async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(800); };

async function verifyClinic(browser, cl, seenLogos) {
  fs.mkdirSync(path.join(OUT_DIR, cl.slug), { recursive: true });
  let { page, ctx, failed } = await login(browser, cl.adminEmail, cl.password);
  check(cl.slug, "login with generated credentials", !failed);
  if (failed) { await ctx.close(); return; }
  const home = await page.locator("body").innerText();
  check(cl.slug, "dashboard shows own name and no Real Care", home.includes(cl.clinicName) && !LEAK.test(home));
  const sideLogo = await page.locator("img").first().getAttribute("src");
  check(cl.slug, "sidebar logo unique to this clinic", (sideLogo || "").startsWith("data:image") && ![...seenLogos.entries()].some(([l, s]) => l === sideLogo && s !== cl.slug));
  seenLogos.set(sideLogo, cl.slug);
  const step = async (label, fn) => {
    if (process.env.STEPS && !process.env.STEPS.split(",").includes(label)) return; // STEPS=prescription,invoice to re-run a subset
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { await fn(); return; } catch (e) {
        const msg = String(e.message).split(/\r?\n/)[0];
        if (attempt === 1 && /crash|closed/i.test(msg)) { // headed Chromium occasionally dies on the heavy dev pages: fresh session, retry once
          await ctx.close().catch(() => {});
          ({ page, ctx } = await login(browser, cl.adminEmail, cl.password));
          continue;
        }
        check(cl.slug, `${label}: opened`, false, msg);
        await page.screenshot({ path: path.join(OUT_DIR, cl.slug, `${label}-FAILED.png`) }).catch(() => {});
        await page.keyboard.press("Escape").catch(() => {});
        return;
      }
    }
  };

  await step("invoice", async () => {
    await goModule(page, "billing", 4000);
    await page.keyboard.press("F2");
    await page.waitForTimeout(2000);
    await page.locator('input[placeholder="CASH"]').fill(`Cust ${cl.letter}`);
    await type(page, 'input[placeholder="e.g. +91 83438 43834"]', "+91 90000 22222");
    await type(page, 'input[placeholder="Type or select item name..."]', `Checkup ${cl.letter}`);
    await page.locator('legend:has-text("Invoice information")').click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('div:has(> label:has-text("Quantity")) input[type="number"]').first().fill("2");
    await page.locator('div.col-span-1:has(label:has-text("Sale Price")) input[type="number"]').first().fill("500");
    await page.locator('button[title="Add Line (Enter)"]').click();
    await page.waitForTimeout(700);
    await page.locator('button:has-text("Save and Print")').click();
    await page.waitForTimeout(3500);
    const r = await verifyDialog(page, cl, "invoice", seenLogos);
    check(cl.slug, "invoice: INV number present & total 1,180", /INV\/\d{4}-\d{2}-\d{4}/i.test(r.text) && /1,?180/.test(r.text));
    await closeDialog(page);
  });

  await step("quotation", async () => {
    await goModule(page, "reports", 4000);
    await page.locator('button:has-text("Medical Reports & Records")').click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Medical Quotations")').click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("New Quotation")').first().click();
    await page.waitForTimeout(2000);
    await type(page, 'input[placeholder="Select or type item name..."]', `Estimate ${cl.letter}`);
    await page.locator('div:has(> label:has-text("Sale Price")) input[type="number"]').first().fill("1000").catch(async () => {
      await page.locator('label:has-text("Sale Price")').locator("xpath=..").locator('input[type="number"]').first().fill("1000");
    });
    await page.locator('button[title="Add line item to quotation"]').click();
    await page.waitForTimeout(700);
    await page.locator('button:has-text("Save and Print")').click();
    await page.waitForTimeout(3500);
    await verifyDialog(page, cl, "quotation", seenLogos);
    await closeDialog(page);
  });

  await step("purchase-bill", async () => {
    await goModule(page, "accounting", 4000);
    await page.locator('button:has-text("Supplier Bills")').first().click();
    await page.waitForTimeout(3500);
    await page.locator(`tr:has-text("${cl.docs.billNo}") button[title="View Purchase Bill"]`).first().click();
    await verifyDialog(page, cl, "purchase-bill", seenLogos);
    await closeDialog(page);
  });

  await step("lab-report", async () => {
    await goModule(page, "laboratory", 4000);
    await page.locator(`tr:has-text("${cl.docs.lab}") button:has-text("View Report")`).first().click();
    await verifyDialog(page, cl, "lab-report", seenLogos);
    await closeDialog(page);
  });

  await step("clinical-report", async () => {
    await goModule(page, "reports", 4000);
    await page.locator('button:has-text("Medical Reports & Records")').click();
    await page.waitForTimeout(1500);
    await page.locator(`tr:has-text("${cl.docs.report}") button:has-text("View Report")`).first().click();
    await verifyDialog(page, cl, "clinical-report", seenLogos);
    await closeDialog(page);
  });

  await step("pharmacy-receipt", async () => {
    await goModule(page, "pharmacy", 4000);
    await page.locator(`tr:has-text("${cl.docs.sale}") button:has-text("Receipt")`).first().click();
    await verifyDialog(page, cl, "pharmacy-receipt", seenLogos, { logo: false }); // POS receipt is text-only by design
    await closeDialog(page);
  });

  await step("prescription", async () => {
    await goModule(page, "crm-pets", 4000);
    await page.locator(`tr:has-text("${cl.docs.pet}") button:has-text("Admit OPD")`).first().click();
    await page.waitForTimeout(3000);
    await page.locator('button:has-text("Proceed to Billing")').first().click();
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Finalize & Collect")').first().click();
    await page.waitForTimeout(5000);
    // 'Print Rx' in the completed panel calls window.print() (blocks headed Chromium); the preview modal is the on-screen document
    await page.locator('button:has-text("1. Doctor Rx")').first().click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Rx Print Preview")').first().click();
    await verifyDialog(page, cl, "prescription", seenLogos, { area: "#prescription-printable-area" });
    await closeDialog(page);
  });

  await ctx.close();
}

function writeCredentials(cl, n) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
  const file = path.join(CRED_DIR, `${String(n).padStart(2, "0")}-${cl.slug}.txt`);
  fs.writeFileSync(file, [
    `Clinic          : ${cl.clinicName}`,
    `City            : ${cl.city}`,
    `Clinic phone    : ${cl.phone}`,
    `Owner / doctor  : ${cl.doctor}`,
    `Login URL       : ${BASE}/login`,
    `Login email     : ${cl.adminEmail}`,
    `Login password  : ${cl.password}`,
    `Tenant ID       : ${cl.tenantId || "(not resolved)"}`,
    `Created         : ${new Date().toISOString()}`,
    "",
  ].join("\n"));
}

const run = async () => {
  const envLine = fs.readFileSync(path.join(ROOT, "atlas-credentials.env"), "utf8").split(/\r?\n/).find((l) => l.startsWith("MONGODB_URI="));
  await mongoose.connect(envLine.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, ""));
  const db = mongoose.connection.db;
  const browser = await chromium.launch({ executablePath: CHROME, headless: HEADLESS, slowMo: HEADLESS ? 0 : 40, args: ["--start-maximized"] });

  const list = ONLY ? CLINICS.slice(0, ONLY) : CLINICS;
  const registered = [];
  const reuse = process.env.REUSE === "1";
  if (reuse) registered.push(...loadExisting());
  else console.log(`\n=== Registering ${list.length} clinics ===`);
  for (let i = 0; i < (reuse ? 0 : list.length); i++) {
    const logo = await makeLogo(browser, list[i].color, list[i].letter);
    const cl = await register(browser, list[i], i, logo);
    fs.rmSync(logo, { force: true });
    check(cl.slug, "registered via UI", cl.registered);
    if (!cl.registered) continue;
    await seed(db, cl, i + 1);
    writeCredentials(cl, i + 1);
    registered.push(cl);
  }

  console.log(`\n=== Verifying ${registered.length} clinics ===`);
  const seenLogos = new Map();
  for (const cl of registered) {
    console.log(`\n--- ${cl.clinicName} ---`);
    await verifyClinic(browser, cl, seenLogos);
  }

  await browser.close();
  await mongoose.disconnect();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} passed ===`);
  failed.forEach((f) => console.log(`  FAILED: [${f.clinic}] ${f.name} ${f.detail}`));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
};
run().catch((e) => { console.error("FATAL:", e); process.exit(2); });
