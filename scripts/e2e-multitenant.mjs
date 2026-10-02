import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:\\Users\\LENOVO\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe";
const BASE = "http://localhost:8080";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const type = async (page, sel, text) => {
  const el = page.locator(sel).first();
  await el.click();
  await el.pressSequentially(text, { delay: 4 });
};
const shell = (page) => page.waitForFunction(() => document.body.innerText.includes("NAVIGATION"), null, { timeout: 90000 });

async function makeLogo(browser, color, label) {
  const p = await browser.newPage();
  const dataUrl = await p.evaluate(({ color, label }) => {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 200;
    const x = c.getContext("2d");
    x.fillStyle = color; x.fillRect(0, 0, 200, 200);
    x.fillStyle = "#fff"; x.font = "bold 90px sans-serif"; x.fillText(label, 60, 130);
    return c.toDataURL("image/png");
  }, { color, label });
  await p.close();
  const file = path.join(process.cwd(), `_logo_${label}.png`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
  return file;
}

async function register(browser, { name, city, phone, logoFile, tagline }) {
  const stamp = Date.now() + Math.floor(Math.random() * 999);
  const clinicName = `${name} ${String(stamp).slice(-5)}`;
  const adminEmail = `owner${stamp}@example.com`;
  const page = await browser.newPage();
  for (let a = 1; a <= 4; a++) {
    await page.goto(`${BASE}/register-clinic`, { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector('input[placeholder="Sunrise Pet Hospital"]', { timeout: 30000 });
    await page.waitForTimeout(4000 + a * 2000);
    await type(page, 'input[placeholder="Sunrise Pet Hospital"]', clinicName);
    await type(page, 'input[placeholder="+91 98765 43210"]', phone);
    await type(page, 'input[placeholder="clinic@example.com"]', `c${stamp}@example.com`);
    await type(page, 'input[placeholder="Street, area"]', `${city} Main Road`);
    await type(page, 'input[placeholder="Nagpur"]', city);
    await type(page, 'input[placeholder="440001"]', "411001");
    await page.waitForTimeout(500);
    if (!(await page.locator('button:has-text("Continue")').first().isDisabled())) break;
  }
  await page.click('button:has-text("Continue")', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.setInputFiles('input[type="file"]', logoFile);
  await page.waitForTimeout(1200);
  await type(page, 'input[placeholder="Caring for your pets, always"]', tagline);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(700);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(700);
  await type(page, 'input[placeholder="Dr. Jane Doe"]', `Dr ${name.split(" ")[0]} Owner`);
  await type(page, 'input[placeholder="you@example.com"]', adminEmail);
  const pw = await page.locator('input[type="password"]').all();
  await pw[0].click(); await pw[0].pressSequentially("Passw0rd!x", { delay: 4 });
  await pw[1].click(); await pw[1].pressSequentially("Passw0rd!x", { delay: 4 });
  await page.click('button:has-text("Create My Clinic")');
  await page.waitForTimeout(5000);
  const ok = page.url() === `${BASE}/`;
  await page.close();
  return { clinicName, adminEmail, password: "Passw0rd!x", registered: ok, tagline };
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

async function createInvoice(page, { customer, item, qty, price }) {
  await page.goto(`${BASE}/m/billing`, { waitUntil: "load", timeout: 90000 });
  await shell(page);
  await page.waitForTimeout(4000);
  await page.keyboard.press("F2");
  await page.waitForTimeout(2000);
  const cash = page.locator('input[placeholder="CASH"]');
  await cash.fill(customer);
  await type(page, 'input[placeholder="e.g. +91 83438 43834"]', "+91 90000 22222");
  await type(page, 'input[placeholder="Type or select item name..."]', item);
  await page.locator('legend:has-text("Invoice information")').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('div:has(> label:has-text("Quantity")) input[type="number"]').first().fill(String(qty));
  await page.locator('div.col-span-1:has(label:has-text("Sale Price")) input[type="number"]').first().fill(String(price));
  await page.locator('button[title="Add Line (Enter)"]').click();
  await page.waitForTimeout(700);
  await page.locator('button:has-text("Save and Print")').click();
  await page.waitForTimeout(3500);
  const toast = (await page.locator("[data-sonner-toast]").allTextContents().catch(() => [])).join(" | ");
  const area = page.locator("#invoice-printable-area");
  const visible = await area.isVisible().catch(() => false);
  const text = visible ? await area.innerText() : "";
  const logoSrc = visible ? await area.locator("img").first().getAttribute("src").catch(() => "") : "";
  return { toast, text, logoSrc, invoiceNo: (toast.match(/INV\/[\w-]+/) || [""])[0] };
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const logoA = await makeLogo(browser, "#dc2626", "A");
  const logoB = await makeLogo(browser, "#16a34a", "B");

  console.log("\n=== 1. Register two new clinics ===");
  const A = await register(browser, { name: "Alpha Vet Clinic", city: "Pune", phone: "+91 91111 11111", logoFile: logoA, tagline: "Alpha tagline" });
  const B = await register(browser, { name: "Beta Pet Care", city: "Mumbai", phone: "+91 92222 22222", logoFile: logoB, tagline: "Beta tagline" });
  check("Clinic A registered", A.registered, A.clinicName);
  check("Clinic B registered", B.registered, B.clinicName);

  console.log("\n=== 2. Clinic A: login, sidebar branding, invoice ===");
  const a = await login(browser, A.adminEmail, A.password);
  check("Clinic A login", !a.failed);
  const aSide = await a.page.locator("body").innerText();
  const aSidebarLogo = await a.page.locator("img").first().getAttribute("src");
  check("A dashboard shows A's name", aSide.includes(A.clinicName));
  check("A dashboard has no Real Care / Dr. Makarand", !/Real Care|Makarand/i.test(aSide));
  const invA = await createInvoice(a.page, { customer: "Alpha Customer", item: "Alpha Vaccine", qty: 2, price: 500 });
  check("A invoice saved (own series 0001)", /INV\/2026-27-0001/.test(invA.invoiceNo), invA.toast);
  check("A invoice header shows A's name", invA.text.includes(A.clinicName));
  check("A invoice shows uploaded logo (data URI)", invA.logoSrc.startsWith("data:image"));
  check("A invoice total = 1,180 (2x500 + 18% GST)", /1,?180/.test(invA.text));
  check("A invoice has no Real Care / Makarand / petsdmart", !/Real Care|Makarand|petsdmart|M\.S\.V\.C/i.test(invA.text), invA.text.match(/Real Care|Makarand|petsdmart|M\.S\.V\.C/i)?.[0] || "");
  check("A invoice shows A's phone", invA.text.includes("91111 11111"));
  check("A invoice shows A's city", invA.text.includes("Pune"));
  await a.page.screenshot({ path: "_mt_A_invoice.png", fullPage: false });
  await a.page.keyboard.press("Escape");
  await a.page.waitForTimeout(1500);
  const aBill = await a.page.locator("body").innerText();
  check("A billing desk lists A's invoice + customer", aBill.includes("Alpha Customer") && aBill.includes("INV/2026-27-0001"));
  check("A billing heading shows A's name", aBill.includes(`Billing Desk — ${A.clinicName}`) || aBill.includes(A.clinicName));
  await a.ctx.close();

  console.log("\n=== 3. Clinic B: login, must NOT see A's data, own invoice ===");
  const b = await login(browser, B.adminEmail, B.password);
  check("Clinic B login", !b.failed);
  const bSide = await b.page.locator("body").innerText();
  const bSidebarLogo = await b.page.locator("img").first().getAttribute("src");
  check("B dashboard shows B's name, not A's", bSide.includes(B.clinicName) && !bSide.includes(A.clinicName));
  check("B sidebar logo differs from A's logo", Boolean(bSidebarLogo) && bSidebarLogo !== aSidebarLogo);
  await b.page.goto(`${BASE}/m/billing`, { waitUntil: "load", timeout: 90000 });
  await shell(b.page);
  await b.page.waitForTimeout(5000);
  const bBillBefore = await b.page.locator("body").innerText();
  check("B billing shows NO data of A (before creating anything)", !bBillBefore.includes("Alpha Customer") && !bBillBefore.includes("INV/2026-27-0001"));
  const invB = await createInvoice(b.page, { customer: "Beta Customer", item: "Beta Checkup", qty: 3, price: 300 });
  check("B invoice saved with its OWN series 0001", /INV\/2026-27-0001/.test(invB.invoiceNo), invB.toast);
  check("B invoice header shows B's name", invB.text.includes(B.clinicName) && !invB.text.includes(A.clinicName));
  check("B invoice shows B's uploaded logo, different from A's", invB.logoSrc.startsWith("data:image") && invB.logoSrc !== invA.logoSrc);
  check("B invoice total = 1,062 (3x300 + 18% GST)", /1,?062/.test(invB.text));
  check("B invoice has no Real Care / Makarand / petsdmart", !/Real Care|Makarand|petsdmart|M\.S\.V\.C/i.test(invB.text));
  check("B invoice shows B's phone and city", invB.text.includes("92222 22222") && invB.text.includes("Mumbai"));
  await b.page.screenshot({ path: "_mt_B_invoice.png", fullPage: false });
  await b.page.keyboard.press("Escape");
  await b.page.waitForTimeout(1500);
  const bBill = await b.page.locator("body").innerText();
  check("B billing lists only B's invoice", bBill.includes("Beta Customer") && !bBill.includes("Alpha Customer"));

  console.log("\n=== 4. Other modules for B: reports, identity, CRM ===");
  for (const [route, label] of [["reports", "Reports"], ["identity", "Identity/Staff"], ["crm", "Pet & Owner CRM"], ["accounting", "Accounting"], ["inventory", "Inventory"]]) {
    await b.page.goto(`${BASE}/m/${route}`, { waitUntil: "load", timeout: 90000 });
    await shell(b.page);
    await b.page.waitForTimeout(5000);
    const t = await b.page.locator("body").innerText();
    check(`B ${label}: loads, shows B, no A / Real Care data`, t.includes(B.clinicName) && !t.includes(A.clinicName) && !t.includes("Alpha Customer") && !/Real Care Small Animal|Makarand/i.test(t.replace(/Real Care Clinic/g, "")), /Makarand|Real Care Small Animal/i.test(t) ? "leak: " + t.match(/Makarand|Real Care Small Animal/i)[0] : "");
  }
  const idText = await (async () => { await b.page.goto(`${BASE}/m/identity`, { waitUntil: "load" }); await shell(b.page); await b.page.waitForTimeout(5000); return b.page.locator("body").innerText(); })();
  check("B staff directory contains only B's admin", idText.includes(B.adminEmail) && !idText.includes(A.adminEmail) && !idText.includes("makarand.dixit"));
  await b.ctx.close();

  console.log("\n=== 5. Clinic A again: still isolated and intact ===");
  const a2 = await login(browser, A.adminEmail, A.password);
  await a2.page.goto(`${BASE}/m/billing`, { waitUntil: "load", timeout: 90000 });
  await shell(a2.page);
  await a2.page.waitForTimeout(5000);
  const a2Bill = await a2.page.locator("body").innerText();
  check("A billing still shows only A's invoice", a2Bill.includes("Alpha Customer") && !a2Bill.includes("Beta Customer"));
  await a2.ctx.close();

  console.log("\n=== 6. Real Care regression ===");
  const rc = await login(browser, "makarand.dixit@gmail.com", "12345678");
  check("Real Care login", !rc.failed);
  await rc.page.goto(`${BASE}/m/billing`, { waitUntil: "load", timeout: 90000 });
  await shell(rc.page);
  await rc.page.waitForTimeout(5000);
  const rcBill = await rc.page.locator("body").innerText();
  check("Real Care billing shows Real Care heading", rcBill.includes("Billing Desk — Real Care") || rcBill.includes("Real Care Small Animal Clinic"));
  check("Real Care sees none of A/B's data", !rcBill.includes("Alpha Customer") && !rcBill.includes("Beta Customer") && !rcBill.includes(A.clinicName) && !rcBill.includes(B.clinicName));
  const rcHome = await (async () => { await rc.page.goto(`${BASE}/`, { waitUntil: "load" }); await shell(rc.page); await rc.page.waitForTimeout(3000); return rc.page.locator("body").innerText(); })();
  check("Real Care home shows Real Care + Dr. Makarand", /Real Care/.test(rcHome) && /Makarand/.test(rcHome));
  await rc.ctx.close();

  console.log("\n=== 7. Platform admin sees all tenants ===");
  const pa = await login(browser, "ayush.sahare@vit.edu", "ayush@123");
  await pa.page.goto(`${BASE}/m/tenants`, { waitUntil: "load", timeout: 90000 });
  await shell(pa.page);
  await pa.page.waitForTimeout(6000);
  const paText = await pa.page.locator("body").innerText();
  check("Platform admin lists Real Care + A + B", paText.includes("Real Care Small Animal Clinic") && paText.includes(A.clinicName) && paText.includes(B.clinicName));
  await pa.ctx.close();

  fs.rmSync(logoA, { force: true }); fs.rmSync(logoB, { force: true });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY: ${results.length - failed.length}/${results.length} passed ===`);
  failed.forEach((f) => console.log("  FAILED:", f.name));
  fs.writeFileSync("_mt_names.json", JSON.stringify({ A: A.clinicName, B: B.clinicName }));
  process.exit(failed.length ? 1 : 0);
};
run().catch((e) => { console.error("FATAL:", e); process.exit(2); });
