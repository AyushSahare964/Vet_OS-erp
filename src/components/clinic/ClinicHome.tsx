import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, FlaskConical, Hourglass, PackageX, Wallet } from "lucide-react";
import { getIcon } from "@/components/erp/icon";
import { WelcomeBanner } from "@/components/erp/dashboards/WelcomeBanner";
import { listBoardingBookingsFn } from "@/lib/mongodb/serverFns/facilities";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { getRowsFn } from "@/lib/mongodb/serverFns/rows";
import { getStockStatus } from "@/lib/inventory/stockStatus";
import { useErp } from "@/lib/erp/store";
import { baseModuleIds } from "@/lib/erp/config";
import { quickActionsFor } from "@/components/doctor/layout/menuConfig";
import { openQuickAction } from "@/components/doctor/layout/quickActions";
import { listAppointmentsFn } from "@/lib/mongodb/serverFns/appointments";
import { listVisitsFn, getUpcomingFollowUpsFn } from "@/lib/mongodb/serverFns/clinical";
import { listLabOrdersFn } from "@/lib/mongodb/serverFns/laboratory";
import { getNotificationsFn } from "@/lib/mongodb/serverFns/notifications";
import { listRemindersFn } from "@/lib/mongodb/serverFns/reminders";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { listPurchaseBillsFn } from "@/lib/mongodb/serverFns/purchaseBills";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listBranchesFn, type BranchRow } from "@/lib/mongodb/serverFns/branches";
import { listTenantsFn } from "@/lib/mongodb/serverFns/platform";
import { TenantDetailDialog } from "@/components/erp/platform/TenantDetailDialog";
import { addDaysToISO, daysBetweenISO, fiscalYearRange, formatDisplayDate, formatRangeLabel, todayIST } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
const FINAL = ["completed", "cancelled", "no-show", "no show"];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Platform admin only: the registered clinics at a glance. Automated-test clinics (E2E ...) are left out. */
function PlatformClinics() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = () =>
    void safe(listTenantsFn(), [] as any[]).then((t) => setRows((t ?? []).filter((c: any) => !/^E2E/i.test(c.name || "") && !/@vetos\.test$/i.test(c.email || ""))));
  useEffect(load, []);
  return (
    <Section title="Tenants" {...(rows ? { hint: `${rows.length} registered clinic${rows.length === 1 ? "" : "s"}` } : {})}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {rows === null ? (
          <p className="p-4 text-xs text-muted-foreground">Loading clinics…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No clinics registered yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Clinic</th>
                <th className="px-4 py-2 font-semibold">Plan</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.tenantId} onClick={() => setOpenId(c.tenantId)} className="cursor-pointer transition-colors hover:bg-muted/40" title="Open clinic details">
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-semibold text-foreground">{c.name}</div>
                    <div className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ")} · {c.email}</div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{String(c.planId || "").replace("plan_", "")}</td>
                  <td className="px-4 py-2.5">
                    {c.status} · {c.subscriptionStatus}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDisplayDate(String(c.createdAt || "").slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <GoLink moduleId="hospital" tab="tenants">Manage all tenants</GoLink>
      <TenantDetailDialog tenantId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </Section>
  );
}

function Tile({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: string | undefined; icon?: ReactNode | undefined; tone?: "warn" | "bad" | "ok" | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={cn("mt-1 text-2xl font-extrabold", tone === "bad" && "text-destructive", tone === "warn" && "text-warning", tone === "ok" && "text-success")}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function GoLink({ moduleId, tab, sub, children }: { moduleId: string; tab?: string; sub?: string; children: ReactNode }) {
  const search = { ...(tab ? { tab } : {}), ...(sub ? { sub } : {}) };
  return (
    <Link
      to="/m/$moduleId"
      params={{ moduleId }}
      search={search as never}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      {children} <ArrowRight className="size-3" aria-hidden="true" />
    </Link>
  );
}

/** Clinic Dashboard (/clinic): one short page for every role; each block shows only what the role already has. */
export function ClinicHome() {
  const { role, roleId, currentUser } = useErp();
  const held = useMemo(() => baseModuleIds(role), [role]);
  const has = (...m: string[]) => m.some((x) => held.has(x));
  const today = todayIST();
  const isAdmin = roleId === "admin";

  const [appts, setAppts] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [boarding, setBoarding] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [hrms, setHrms] = useState<any[]>([]);
  // Follow-up due: quick buttons plus a from / to day range
  const [range, setRange] = useState({ from: todayIST(), to: addDaysToISO(todayIST(), 7) });
  const [mixPeriod, setMixPeriod] = useState<"month" | "last30" | "fy">("month");
  const frontDesk = roleId === "admin" || roleId === "reception";
  const [branches, setBranches] = useState<BranchRow[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const [a, v, l, n, r, i, p, pt, f, b] = await Promise.all([
        has("appointments") ? safe(listAppointmentsFn(), []) : [],
        has("appointments", "crm-pets") ? safe(listVisitsFn(), []) : [],
        has("laboratory") ? safe(listLabOrdersFn(), []) : [],
        has("inventory", "billing", "appointments") ? safe(getNotificationsFn(), []) : [],
        has("billing") ? safe(listRemindersFn(), []) : [],
        has("billing") ? safe(listInvoicesFn({ data: { query: "" } }), []) : [],
        isAdmin && has("billing") ? safe(listPurchaseBillsFn({ data: { from: "2020-01-01", to: "2030-12-31" } }), []) : [],
        has("crm-pets") ? safe(listPetsWithOwnersFn(), []) : [],
        [],
        safe(listBranchesFn(), []),
      ]);
      if (!live) return;
      setAppts(a as any[]); setVisits(v as any[]); setLabs(l as any[]); setAlerts(n as any[]); setReminders(r as any[]);
      setInvoices(i as any[]); setPurchases(p as any[]); setPets(pt as any[]); setBranches(b as BranchRow[]);
    };
    void load();
    // Poll so a booking made at the front desk shows up here without a manual refresh; skip while the tab is hidden.
    const refresh = () => document.visibilityState === "visible" && void load();
    const timer = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  // Follow-ups for the chosen range (the server function takes "days ahead", so ask far enough for the end date)
  useEffect(() => {
    if (!has("appointments")) return;
    const ahead = Math.min(120, Math.max(7, daysBetweenISO(today, range.to) + 1));
    let live = true;
    void safe(getUpcomingFollowUpsFn({ data: { daysAhead: ahead } }), [] as any[]).then((f) => live && setFollowUps(f));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.to, roleId]);

  // Admin-only snapshot data
  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    void (async () => {
      const [b, it, h] = await Promise.all([safe(listBoardingBookingsFn(), []), safe(getItemsFn({ data: { status: "Active" } }), []), safe(getRowsFn({ data: { moduleId: "hrms" } }), [])]);
      if (!live) return;
      setBoarding(b as any[]); setItems(it as any[]); setHrms(h as any[]);
    })();
    return () => {
      live = false;
    };
  }, [isAdmin]);

  const todayAppts = appts.filter((x) => String(x.appointment_date || x.date || "").slice(0, 10) === today);
  const status = (x: any) => String(x.status || "").toLowerCase();
  const arrived = todayAppts.filter((x) => status(x) === "waiting").length;
  const active = todayAppts.filter((x) => status(x) === "in consultation").length;
  const toReview = visits.filter((v) => v.date === today && ["Admitted", "In Consultation", "Diagnosed"].includes(v.status)).length;
  const nextUp = todayAppts.filter((x) => !FINAL.includes(status(x))).sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))).slice(0, 4);

  const fu = (days: number) => followUps.filter((f) => String(f.nextVisitDate) <= addDaysToISO(today, days)).length;
  const fuTomorrow = followUps.filter((f) => String(f.nextVisitDate) === addDaysToISO(today, 1)).length;

  const critical = visits.filter((v) => ["E", "C"].includes(String(v.prescriptionData?.symptomTriage))).length;
  const pendingLabs = labs.filter((o) => !["reported", "completed", "cancelled"].includes(String(o.status || "").toLowerCase())).length;
  const stockAlerts = alerts.filter((n) => n.category === "stock").length;
  const overdueReminders = reminders.filter((r) => String(r.status).toLowerCase() === "pending" && String(r.scheduledDate) < today).length;
  const overdueVacc = pets.filter((p) => (p.nextVaccineDate && String(p.nextVaccineDate).slice(0, 10) < today) || (p.nextDewormingDate && String(p.nextDewormingDate).slice(0, 10) < today)).length;
  const overdue = overdueReminders + overdueVacc;

  const monthFrom = `${today.slice(0, 8)}01`;
  const monthInv = invoices.filter((i) => String(i.date || "").slice(0, 10) >= monthFrom && String(i.date || "").slice(0, 10) <= today);
  const sales = monthInv.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const collected = monthInv.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const unpaid = invoices.filter((i) => (i.balanceDue ?? 0) > 0.005);
  const unpaidAmt = unpaid.reduce((s, i) => s + (i.balanceDue || 0), 0);
  const supDue = purchases.filter((b) => ["UNPAID", "PARTIAL"].includes(b.status));
  const supDueAmt = supDue.reduce((s, b) => s + ((b.grandTotal || 0) - (b.amountPaid || 0)), 0);

  // Follow-up list: follow-up visits + vaccines + dewormings due inside the range, earliest first
  const dueList = [
    ...followUps.map((f) => ({ pet: f.petName, owner: f.ownerName, phone: f.ownerPhone, item: "Follow-up visit", date: String(f.nextVisitDate).slice(0, 10) })),
    ...pets.flatMap((p) => [
      p.nextVaccineDate ? { pet: p.name, owner: p.owner?.name, phone: p.owner?.phone, item: "Vaccination", date: String(p.nextVaccineDate).slice(0, 10) } : null,
      p.nextDewormingDate ? { pet: p.name, owner: p.owner?.name, phone: p.owner?.phone, item: "Deworming", date: String(p.nextDewormingDate).slice(0, 10) } : null,
    ]),
  ]
    .filter((d): d is NonNullable<typeof d> => !!d && d.date >= range.from && d.date <= range.to)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Vaccine / deworming alert counts (existing pet records)
  const soon = addDaysToISO(today, 14);
  const dueCount = (field: "nextVaccineDate" | "nextDewormingDate") => {
    const ds = pets.map((p) => (p[field] ? String(p[field]).slice(0, 10) : "")).filter(Boolean);
    return { overdue: ds.filter((d) => d < today).length, soon: ds.filter((d) => d >= today && d <= soon).length };
  };
  const vacc = dueCount("nextVaccineDate");
  const dew = dueCount("nextDewormingDate");

  // Hospital snapshot (today only; no made-up numbers)
  const todayInv = invoices.filter((i) => String(i.date || "").slice(0, 10) === today);
  const revToday = todayInv.reduce((s2, i) => s2 + (i.totalAmount || 0), 0);
  const checkedIn = boarding.filter((b) => String(b.status).toLowerCase() === "checked-in" && String(b.checkIn) <= today && String(b.checkOut || today) >= today).length;
  const lowItems = items.filter((i) => getStockStatus(i.currentStock ?? 0, i.reorderLevel ?? 0) !== "OK").length;
  const onShift = hrms.filter((r: any) => ["present", "late"].includes(String(r.status).toLowerCase())).length;

  // Revenue mix from the real lines of the invoices in the chosen period
  const mixFrom = mixPeriod === "month" ? `${today.slice(0, 8)}01` : mixPeriod === "last30" ? addDaysToISO(today, -29) : fiscalYearRange(today).from;
  const mix: Record<string, number> = { Consultation: 0, "Pharmacy / Retail": 0, Lab: 0, Boarding: 0, Swimming: 0, Other: 0 };
  for (const inv of invoices) {
    const d = String(inv.date || "").slice(0, 10);
    if (d < mixFrom || d > today) continue;
    for (const l of inv.items ?? []) {
      const name = String(l.name || "");
      const t = String(l.lineType || "");
      const key = /board|kennel/i.test(name) ? "Boarding" : /swim|hydro/i.test(name) ? "Swimming" : t === "Consultation" ? "Consultation" : ["Pharmacy", "Food", "Accessory", "Vaccine"].includes(t) ? "Pharmacy / Retail" : t === "Diagnostic" ? "Lab" : "Other";
      mix[key] = (mix[key] ?? 0) + (Number(l.lineTotal) || 0);
    }
  }
  const mixMax = Math.max(1, ...Object.values(mix));

  const quick = quickActionsFor(role.id, held).filter((a) => a.dash);
  const ops = [
    { label: "Treatment", icon: "Stethoscope", moduleId: "consultation", tab: "consultation", need: ["appointments", "pharmacy"] },
    { label: "Laboratory", icon: "FlaskConical", moduleId: "laboratory", need: ["laboratory"] },
    { label: "Boarding", icon: "Home", moduleId: "boarding", tab: "boarding", need: ["boarding"] },
    { label: "Pet Shop", icon: "ShoppingBag", moduleId: "pharmacy", need: ["pharmacy"] },
    { label: "Pharmacy", icon: "Pill", moduleId: "consultation", tab: "pharmacy", need: ["pharmacy"] },
    { label: "Hydrotherapy", icon: "Waves", moduleId: "boarding", tab: "boarding", sub: "swimming", need: ["boarding"] },
    { label: "IPD / ICU", icon: "Building2", moduleId: "consultation", tab: "ipd", need: ["appointments", "pharmacy"], soon: true },
  ].filter((o) => has(...o.need));

  const branchLabel = branches.length === 1 ? branches[0]!.name : currentUser?.branch || currentUser?.clinicName || role.scope;
  const [branch, setBranch] = useState("");

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
      <WelcomeBanner
        stats={[
          ...(has("appointments") ? [{ label: "Appointments", value: todayAppts.length, moduleId: "appointments" }, { label: "Waiting", value: arrived, moduleId: "appointments" }] : []),
          ...(isAdmin && has("billing") ? [{ label: "Unpaid", value: unpaid.length, moduleId: "billing" }] : []),
        ]}
        extra={
          branches.length > 1 ? (
            <select aria-label="Branch" value={branch || branches[0]!.code} onChange={(e) => setBranch(e.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm font-semibold">
              {branches.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground" title="Branch">
              {branchLabel}
            </span>
          )
        }
      />

      {roleId === "platform" && <PlatformClinics />}

      {/* A) Quick Actions */}
      {quick.length > 0 && (
        <Section title="Quick Actions">
          <div className="flex flex-wrap gap-2">
            {quick.map((a) => {
              const Icon = getIcon(a.icon);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openQuickAction(a.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]"
                >
                  <Icon className="size-4 text-primary" aria-hidden="true" /> {a.dash}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* B) Today's Clinical Operations */}
      {has("appointments") && (
        <Section title="Today's Clinical Operations" hint={formatDisplayDate(today)}>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="erp-card space-y-3 p-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Live Clinic Pulse</h3>
                <GoLink moduleId="appointments">Open appointments</GoLink>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Tile label="Today's appointments" value={todayAppts.length} />
                <Tile label="Arrived patients" value={arrived} sub="Waiting now" tone={arrived > 0 ? "warn" : undefined} />
                <Tile label="Active consultations" value={active} />
                <Tile label="Patients to review" value={toReview} sub="Not yet billed" />
              </div>
              <ul className="divide-y divide-border/60 text-sm" aria-label="Next appointments">
                {nextUp.map((a) => (
                  <li key={String(a.token)} className="flex items-center justify-between gap-3 py-1.5">
                    <span>
                      <strong>{a.time || a.slot}</strong> · {a.pet} <span className="text-muted-foreground">({a.owner})</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.doctor} · {a.status}
                    </span>
                  </li>
                ))}
                {nextUp.length === 0 && <li className="py-2 text-xs text-muted-foreground">No more appointments today.</li>}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="erp-card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Follow-ups due</h3>
                  <GoLink moduleId="appointments">Open</GoLink>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([["Tomorrow", fuTomorrow], ["3 days", fu(3)], ["5 days", fu(5)], ["7 days", fu(7)]] as const).map(([l, n]) => (
                    <div key={l} className="rounded-lg bg-muted/40 py-2">
                      <div className="text-lg font-extrabold">{n}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground">{l}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">3, 5 and 7 days count everything due up to that day.</p>
              </div>
              {has("billing") && (
                <div className="erp-card space-y-2 p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Dues &amp; Reminders</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Unpaid invoices: <strong>{unpaid.length}</strong> · {inr(unpaidAmt)}
                    </span>
                    <GoLink moduleId="billing">Billing</GoLink>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Pending reminders: <strong>{reminders.filter((r) => String(r.status).toLowerCase() === "pending").length}</strong>
                    </span>
                    <GoLink moduleId="communication" tab="reminders">Reminders</GoLink>
                  </div>
                </div>
              )}
            </div>
          </div>
          {frontDesk && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="erp-card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Patient queue today</h3>
                  <GoLink moduleId="appointments">Open full queue</GoLink>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left font-bold uppercase text-muted-foreground">
                      <th className="py-1">Token</th><th>Pet</th><th>Owner</th><th>Doctor</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {todayAppts.filter((a) => !FINAL.includes(status(a))).sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))).slice(0, 6).map((a) => (
                      <tr key={String(a.token)}>
                        <td className="py-1.5 font-mono font-bold">{a.token}</td>
                        <td>{a.pet}</td>
                        <td>{a.owner}</td>
                        <td>{a.doctor}</td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                    {todayAppts.filter((a) => !FINAL.includes(status(a))).length === 0 && (
                      <tr><td colSpan={5} className="py-3 text-center text-muted-foreground">Queue is clear.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="erp-card space-y-2 p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Follow-up due: pick a range</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">From <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-7 rounded border border-input bg-background px-1.5 font-mono" /></label>
                  <label className="flex items-center gap-1">To <input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-7 rounded border border-input bg-background px-1.5 font-mono" /></label>
                  {([["Tomorrow", 1], ["3 days", 3], ["5 days", 5], ["7 days", 7]] as const).map(([l, n]) => (
                    <button key={l} type="button" onClick={() => setRange(l === "Tomorrow" ? { from: addDaysToISO(today, 1), to: addDaysToISO(today, 1) } : { from: today, to: addDaysToISO(today, n) })} className="rounded-full border border-border px-2 py-0.5 font-semibold hover:bg-muted">{l}</button>
                  ))}
                </div>
                <ul className="max-h-48 divide-y divide-border/60 overflow-y-auto text-xs" aria-label="Pets due in the range">
                  {dueList.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <span><strong>{d.pet}</strong> · {d.owner} <span className="text-muted-foreground">{d.phone}</span></span>
                      <span className="shrink-0 text-muted-foreground">{d.item} · {formatDisplayDate(d.date)}</span>
                    </li>
                  ))}
                  {dueList.length === 0 && <li className="py-3 text-center text-muted-foreground">Nothing due in this range.</li>}
                </ul>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* C) Attention */}
      {has("appointments", "laboratory", "inventory", "crm-pets") && (
        <Section title="Attention">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {has("appointments") && (
              <div className="space-y-1.5">
                <Tile label="Critical clinical alerts" value={critical} icon={<AlertTriangle className="size-4 text-destructive" />} tone={critical > 0 ? "bad" : undefined} sub="Emergency / critical triage" />
                <GoLink moduleId="consultation" tab="consultation">View queue</GoLink>
              </div>
            )}
            {has("laboratory") && (
              <div className="space-y-1.5">
                <Tile label="Pending lab work" value={pendingLabs} icon={<FlaskConical className="size-4 text-primary" />} tone={pendingLabs > 0 ? "warn" : undefined} sub="Ordered or in process" />
                <GoLink moduleId="laboratory">Open lab</GoLink>
              </div>
            )}
            {has("inventory") && (
              <div className="space-y-1.5">
                <Tile label="Stock alerts" value={stockAlerts} icon={<PackageX className="size-4 text-warning" />} tone={stockAlerts > 0 ? "warn" : undefined} sub="Low, out of stock, expiring" />
                <GoLink moduleId="inventory" tab="alerts">Open alerts</GoLink>
              </div>
            )}
            {(roleId === "admin" || roleId === "doctor") && has("crm-pets") && (
              <div className="space-y-1.5">
                <Tile label="Vaccine & deworming alerts" value={vacc.overdue + dew.overdue} tone={vacc.overdue + dew.overdue > 0 ? "warn" : undefined} sub={`Overdue: ${vacc.overdue} vaccine, ${dew.overdue} deworm · Due soon: ${vacc.soon + dew.soon}`} />
                <GoLink moduleId="vaccination">Open vaccination list</GoLink>
              </div>
            )}
            {has("crm-pets", "billing") && (
              <div className="space-y-1.5">
                <Tile label="Overdue tasks" value={overdue} icon={<Hourglass className="size-4 text-warning" />} tone={overdue > 0 ? "warn" : undefined} sub="Reminders, vaccines, deworming" />
                {has("crm-pets") ? <GoLink moduleId="vaccination">Open due list</GoLink> : <GoLink moduleId="billing">Open billing</GoLink>}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* D) Hospital Operations (buttons to the existing hubs) */}
      {ops.length > 0 && (
        <Section title="Hospital Operations">
          <div className="flex flex-wrap gap-2">
            {ops.map((o) => {
              const Icon = getIcon(o.icon);
              return (
                <Link
                  key={o.label}
                  to="/m/$moduleId"
                  params={{ moduleId: o.moduleId }}
                  search={{ ...(o.tab ? { tab: o.tab } : {}), ...(o.sub ? { sub: o.sub } : {}) } as never}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <Icon className="size-4 text-primary" aria-hidden="true" /> {o.label}
                  {o.soon && <span className="rounded-full bg-muted px-1.5 text-[9px] font-bold uppercase text-muted-foreground">Soon</span>}
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* Hospital Snapshot + Revenue Mix (Admin only) */}
      {isAdmin && (
        <>
          <Section title="Hospital Snapshot" hint={`Today · ${formatDisplayDate(today)}`}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile label="Today's appointments" value={todayAppts.length} />
              <Tile label="Revenue today" value={inr(revToday)} sub={`${todayInv.length} invoice${todayInv.length === 1 ? "" : "s"} today`} />
              <Tile label="Boarding occupancy" value={checkedIn} sub="Pets checked in today · kennel capacity not set" />
              <Tile label="Low-stock items" value={lowItems} tone={lowItems > 0 ? "warn" : undefined} sub="Low or out of stock" />
              <Tile label="Staff on shift" value={hrms.length > 0 ? onShift : "Not set"} sub={hrms.length > 0 ? "Present or late today" : "No shift data recorded"} />
            </div>
          </Section>

          <Section title="Revenue Mix" hint="From invoice lines in the period">
            <div className="erp-card space-y-2 p-4">
              <div className="flex gap-1.5" role="group" aria-label="Revenue period">
                {([["month", "This Month"], ["last30", "Last 30 Days"], ["fy", "This FY"]] as const).map(([id, l]) => (
                  <button key={id} type="button" onClick={() => setMixPeriod(id)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", mixPeriod === id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{l}</button>
                ))}
                <span className="ml-auto text-[11px] text-muted-foreground">{formatRangeLabel(mixFrom, today)}</span>
              </div>
              {Object.entries(mix).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 text-xs">
                  <span className="w-32 text-muted-foreground">{k}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((v / mixMax) * 100)}%` }} /></div>
                  <span className="w-24 text-right font-mono font-semibold">{inr(v)}</span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* E) Business Snapshot (Admin only) */}
      {isAdmin && has("billing") && (
        <Section title="Business Snapshot" hint={`This month: ${formatRangeLabel(monthFrom, today)}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Net sales" value={inr(sales)} sub="This month" />
            <Tile label="Collection" value={inr(collected)} sub="This month" tone="ok" />
            <Tile label="Unpaid client invoices" value={inr(unpaidAmt)} sub={`${unpaid.length} invoice${unpaid.length === 1 ? "" : "s"} · all dates`} tone={unpaidAmt > 0 ? "warn" : undefined} />
            <Tile label="Unpaid supplier payments" value={inr(supDueAmt)} sub={`${supDue.length} bill${supDue.length === 1 ? "" : "s"} · all dates`} tone={supDueAmt > 0 ? "warn" : undefined} />
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Expenses</span>
                <Wallet className="size-4 text-primary" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => openQuickAction("expense")}
                className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Record Expense
              </button>
            </div>
          </div>
          <GoLink moduleId="business">Open Business Dashboard</GoLink>
        </Section>
      )}

      {!quick.length && !has("appointments", "laboratory", "inventory", "crm-pets", "billing") && (
        <p className="erp-card p-6 text-sm text-muted-foreground">Use the bars on both sides to open Hospital, Staff and Reports.</p>
      )}
    </div>
  );
}
