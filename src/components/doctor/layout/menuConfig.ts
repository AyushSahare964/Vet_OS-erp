// SINGLE SOURCE OF TRUTH for the left/right bars, the hub pages and the old-URL redirects.
// Change a label, icon, mapping or role here and the bars, hubs, route guard and links follow.
// No React imports here: src/lib/erp/config.ts imports this file (type-only import of RoleId back, so no cycle).
import type { RoleId } from "@/lib/erp/config";
import { ACCOUNT_REPORTS } from "@/components/erp/accounts/reports";
import { LEDGER_TYPES } from "@/components/erp/ledgers/ledgerTypes";

export type MenuSide = "left" | "right";

export interface HubTab {
  id: string;
  label: string;
  /** Role must hold at least one of these existing module ids (its own dashboard cards) to see the tab. */
  requires?: string[];
  /** The tab just opens this old module page (kept reachable inside the new structure). */
  legacy?: string;
  /** The tab links to a tab of another hub. */
  to?: { moduleId: string; tab?: string };
  /** Short line shown by the shared "Coming soon" component. */
  soon?: string;
}

/** A branch of the bar's flyout tree: opens a hub tab, optionally with child views (?sub=). */
export interface MenuBranch {
  id: string;
  label: string;
  icon: string;
  /** Hub tab it opens; the branch shows only if the role sees that tab. */
  tab: string;
  children?: { id: string; label: string }[];
}

export type MenuTarget =
  | { kind: "path"; path: "/clinic" }
  | { kind: "module"; moduleId: string; tab?: string }
  | { kind: "action"; action: "quick-actions" };

export interface MenuItem {
  id: string;
  side: MenuSide;
  /** Full name: aria-label, tooltip, hub title. */
  label: string;
  /** Compact text always shown under the icon. */
  short: string;
  icon: string;
  to: MenuTarget;
  /** Roles that may see the item. */
  roles: RoleId[];
  /** And only if the role already holds at least one of these module ids (never widens access). */
  requires?: string[];
  /** /m/<id> pages that count as "inside" this item (hub id, old ids, legacy tab pages). */
  match: string[];
  /** Path prefixes that also count (patient pages etc). */
  matchPaths?: string[];
  /** One-line subtitle for hub pages. */
  subtitle?: string;
  tabs?: HubTab[];
  /** When set, the bar button opens a branch-style flyout instead of going straight to the hub. */
  tree?: MenuBranch[];
}

const ALL: RoleId[] = ["doctor", "admin", "reception", "accounts", "platform"];
const CLINICAL: RoleId[] = ["doctor", "admin", "reception"];

export const MENU: MenuItem[] = [
  // ───────────── LEFT: "Treat and manage the patient" ─────────────
  { id: "dashboard", side: "left", label: "Dashboard", short: "Home", icon: "LayoutGrid", to: { kind: "path", path: "/clinic" }, roles: ALL, match: [], matchPaths: ["/clinic"] },
  { id: "appointments", side: "left", label: "Appointments & Live Queue", short: "Queue", icon: "CalendarClock", to: { kind: "module", moduleId: "appointments" }, roles: CLINICAL, requires: ["appointments"], match: ["appointments"] },
  { id: "crm", side: "left", label: "Patient CRM", short: "Patients", icon: "PawPrint", to: { kind: "module", moduleId: "crm-pets" }, roles: ["doctor", "admin", "reception", "accounts"], requires: ["crm-pets"], match: ["crm-pets"], matchPaths: ["/patient/", "/doctor/patient/"] },
  { id: "consultation", side: "left", label: "Consultation", short: "Consult", icon: "Stethoscope", to: { kind: "module", moduleId: "consultation" }, roles: CLINICAL, requires: ["appointments", "pharmacy"], match: ["consultation"], subtitle: "Start consultations, dispense and manage inpatients and surgery.",
    tabs: [
      { id: "consultation", label: "Consultation", requires: ["appointments"] },
      { id: "pharmacy", label: "Pharmacy", requires: ["pharmacy"] },
      { id: "ipd", label: "IPD / Hospitalization", requires: ["appointments", "pharmacy"], soon: "Inpatient admissions and ward rounds will live here." },
      { id: "surgery", label: "Surgery / OT / Anesthesia", requires: ["appointments", "pharmacy"], soon: "Operation theatre bookings and anaesthesia records will live here." },
    ] },
  { id: "vaccination", side: "left", label: "Vaccination & Deworming", short: "Vaccines", icon: "Syringe", to: { kind: "module", moduleId: "vaccination" }, roles: CLINICAL, requires: ["crm-pets", "clinical-records"], match: ["vaccination"], subtitle: "Who is due or overdue, from the patient records and reminders." },
  { id: "lab", side: "left", label: "Lab & Diagnostics", short: "Lab", icon: "FlaskConical", to: { kind: "module", moduleId: "laboratory" }, roles: CLINICAL, requires: ["laboratory"], match: ["laboratory"] },
  { id: "boarding", side: "left", label: "Boarding, Swimming & Food", short: "Boarding", icon: "Home", to: { kind: "module", moduleId: "boarding" }, roles: CLINICAL, requires: ["boarding", "nutrition"], match: ["boarding", "nutrition"], subtitle: "Kennels, hydrotherapy and feeding plans.",
    tabs: [
      { id: "boarding", label: "Boarding & Swimming", requires: ["boarding"] },
      { id: "food", label: "Food & Nutrition", requires: ["nutrition"] },
    ] },
  { id: "communication", side: "left", label: "Documentation", short: "Docs", icon: "MessageSquare", to: { kind: "module", moduleId: "communication" }, roles: CLINICAL, requires: ["clinical-records", "reports"], match: ["communication", "clinical-records"], subtitle: "Consents, certificates, reminders and messages for pet parents.",
    tabs: [
      { id: "documents", label: "Certificates & Documents", requires: ["clinical-records", "reports"] },
      { id: "reminders", label: "Follow-up & Reminders", requires: ["crm-pets", "appointments"] },
      { id: "messages", label: "Client Messages", requires: ["crm-pets", "appointments"], soon: "WhatsApp / SMS conversations with clients will live here." },
      { id: "reports", label: "Clinical Reports", requires: ["clinical-records", "reports"] },
    ] },

  // ───────────── RIGHT: "Run and manage the hospital" ─────────────
  { id: "business", side: "right", label: "Business Dashboard", short: "Business", icon: "BarChart3", to: { kind: "module", moduleId: "business" }, roles: ["admin"], requires: ["reports"], match: ["business"], subtitle: "Revenue, outstanding and stock at a glance." },
  { id: "quick", side: "right", label: "Quick Action", short: "Quick", icon: "Zap", to: { kind: "action", action: "quick-actions" }, roles: ["doctor", "admin", "reception", "accounts"], match: [] },
  { id: "billing", side: "right", label: "Billing & Invoicing", short: "Billing", icon: "Receipt", to: { kind: "module", moduleId: "billing" }, roles: ["doctor", "admin", "reception", "accounts"], requires: ["billing"], match: ["billing"] },
  { id: "inventory", side: "right", label: "Inventory, Purchases & Suppliers", short: "Stock", icon: "Package", to: { kind: "module", moduleId: "inventory" }, roles: ["doctor", "admin", "reception", "accounts"], requires: ["inventory"], match: ["inventory"], subtitle: "Items, batches, purchase bills and suppliers.",
    tabs: [
      { id: "inventory", label: "Inventory", requires: ["inventory"] },
      { id: "purchases", label: "Purchases", requires: ["billing"] },
      { id: "suppliers", label: "Suppliers", requires: ["billing"] },
    ] },
  { id: "shop", side: "right", label: "Pet Shop & Product Sales", short: "Shop", icon: "ShoppingBag", to: { kind: "module", moduleId: "pharmacy" }, roles: ["doctor", "admin"], requires: ["pharmacy"], match: ["pharmacy"] },
  { id: "accounts", side: "right", label: "Accounting & Reports", short: "Accounts", icon: "BookOpen", to: { kind: "module", moduleId: "accounts" }, roles: ALL, requires: ["accounts", "ledgers", "reports", "clinical-records", "discount-schemes", "reports-finance", "reports-platform", "payroll"], match: ["accounts", "ledgers", "discount-schemes", "reports", "reports-finance", "reports-platform", "payroll"], subtitle: "Account statements, ledgers and discount schemes.",
    tree: [
      { id: "statements", label: "Account Statements", icon: "Landmark", tab: "statements", children: ACCOUNT_REPORTS.map((r) => ({ id: r.id, label: r.label })) },
      { id: "ledgers", label: "Ledgers", icon: "BookOpen", tab: "ledgers", children: LEDGER_TYPES.map((t) => ({ id: t.id, label: t.label })) },
      { id: "discounts", label: "Discount Schemes", icon: "BadgePercent", tab: "discounts" },
    ],
    tabs: [
      { id: "statements", label: "Account Statements", requires: ["accounts"] },
      { id: "ledgers", label: "Ledgers", requires: ["ledgers"] },
      { id: "discounts", label: "Discount Schemes", requires: ["discount-schemes"] },
      { id: "finance", label: "Finance Reports", requires: ["reports-finance"], legacy: "reports-finance" },
      { id: "payroll", label: "Payroll", requires: ["payroll"], legacy: "payroll" },
    ] },
  { id: "hospital", side: "right", label: "Hospital, Branch & Settings", short: "Hospital", icon: "Building2", to: { kind: "module", moduleId: "hospital" }, roles: ["admin", "platform"], requires: ["identity", "tenants"], match: ["hospital", "tenants", "subscriptions", "integrations-global"], subtitle: "Clinic profile, branches and platform settings.",
    tabs: [
      { id: "hospital", label: "Hospital & Branch", requires: ["identity", "tenants"] },
      { id: "tenants", label: "Tenants", requires: ["tenants"] },
      { id: "plans", label: "Plans", requires: ["subscriptions"], legacy: "subscriptions" },
      { id: "apps", label: "Integrations", requires: ["integrations-global"], legacy: "integrations-global" },
      { id: "settings", label: "Settings & Integrations", requires: ["identity", "tenants"], soon: "Clinic settings and third-party integrations will live here." },
    ] },
  { id: "staff", side: "right", label: "Staff, Access & Audit", short: "Staff", icon: "ShieldCheck", to: { kind: "module", moduleId: "identity" }, roles: ["admin", "platform"], requires: ["identity", "identity-global"], match: ["identity", "identity-global", "audit"], subtitle: "Who can use the system, and what they did.",
    tabs: [
      { id: "staff", label: "Staff & Access", requires: ["identity", "identity-global"] },
      { id: "documentation", label: "Documentation", requires: ["identity"], to: { moduleId: "communication", tab: "documents" } },
      { id: "approvals", label: "Approvals & Audit", requires: ["identity", "identity-global"] },
      { id: "audit", label: "Audit Log", requires: ["audit"], legacy: "audit" },
    ] },
];

/** Quick Actions: the right bar's flyout and the Clinic Dashboard's Quick Actions both read this list. */
export interface QuickAction {
  id:
    | "invoice" | "expense" | "payment" | "quotation" | "client" | "appointment" | "consultation"
    | "paymentOut" | "reminder" | "advisedMedicine" | "enquiry" | "purchaseOrder" | "purchaseBill" | "labOrder" | "documentation";
  label: string;
  icon: string;
  /** Role must hold one of these modules. */
  requires: string[];
  /** Only these roles (default: every role that holds a required module). */
  roles?: RoleId[];
  /** Shown as a button on the Clinic Dashboard, with this label. */
  dash?: string;
  /** Keyboard shortcut handled on the Billing page, shown beside the item there. */
  shortcut?: string;
}
export const QUICK_ACTIONS: QuickAction[] = [
  { id: "client", shortcut: "Alt+C", label: "Add New Pet", dash: "Add New Pet", icon: "UserPlus", requires: ["crm-pets"] },
  { id: "consultation", label: "Start Consultation", dash: "Start Consult", icon: "Stethoscope", requires: ["appointments"], roles: ["doctor", "admin"] },
  { id: "advisedMedicine", label: "Doctor-Advised Medicine", dash: "Doctor-Advised Medicine", icon: "Pill", requires: ["appointments"], roles: ["reception"] },
  { id: "appointment", label: "Book Appointment", dash: "Book Appointment", icon: "CalendarPlus", requires: ["appointments"] },
  { id: "invoice", shortcut: "F2", label: "New Invoice", dash: "Create Invoice", icon: "Receipt", requires: ["billing"] },
  { id: "expense", shortcut: "Alt+E", label: "Add Expense", icon: "Wallet", requires: ["billing"] },
  { id: "payment", shortcut: "Alt+I", label: "Payment In", icon: "ArrowDownToLine", requires: ["billing"] },
  { id: "paymentOut", label: "Payment Out", icon: "ArrowDownToLine", requires: ["billing"], roles: ["admin", "accounts", "reception"] },
  { id: "quotation", shortcut: "Alt+Q", label: "New Quotation", icon: "FileText", requires: ["billing"] },
  { id: "enquiry", label: "Enquiry", dash: "Enquiry", icon: "MessageSquare", requires: ["crm-pets", "appointments"] },
  { id: "purchaseOrder", shortcut: "Alt+O", label: "Purchase Order", dash: "Purchase Order", icon: "ShoppingBag", requires: ["billing"], roles: ["admin", "accounts", "reception"] },
  { id: "purchaseBill", shortcut: "Alt+P", label: "Add Purchase / GRN", dash: "Add Purchase / GRN", icon: "Package", requires: ["billing"], roles: ["admin", "accounts", "reception"] },
  { id: "labOrder", label: "New Lab Order", dash: "New Lab Order", icon: "FlaskConical", requires: ["laboratory"] },
  { id: "documentation", label: "Documentation", dash: "Documentation", icon: "FileText", requires: ["clinical-records", "reports"] },
  { id: "reminder", shortcut: "Alt+R", label: "Add Reminder", dash: "Add Reminder", icon: "Bell", requires: ["billing"] },
];

/** Old / alternative /m/<id> URLs → the new home. Every old URL keeps working through these. */
export const MODULE_ALIASES: Record<string, { moduleId: string; tab?: string; sub?: string }> = {
  "identity-global": { moduleId: "identity" },
  users: { moduleId: "identity" },
  staff: { moduleId: "identity" },
  "access-control": { moduleId: "identity" },
  roles: { moduleId: "identity" },
  tenants: { moduleId: "hospital", tab: "tenants" },
  "platform-tenants": { moduleId: "hospital", tab: "tenants" },
  lab: { moduleId: "laboratory" },
  lab_orders: { moduleId: "laboratory" },
  diagnostics: { moduleId: "laboratory" },
  swimming: { moduleId: "boarding", tab: "boarding", sub: "swimming" },
  swimming_sessions: { moduleId: "boarding", tab: "boarding", sub: "swimming" },
  hydrotherapy: { moduleId: "boarding", tab: "boarding", sub: "swimming" },
  "boarding-swimming": { moduleId: "boarding", tab: "boarding" },
  boarding_bookings: { moduleId: "boarding", tab: "boarding" },
  nutrition: { moduleId: "boarding", tab: "food" },
  food: { moduleId: "boarding", tab: "food" },
  feeding: { moduleId: "boarding", tab: "food" },
  nutrition_plans: { moduleId: "boarding", tab: "food" },
  ledgers: { moduleId: "accounts", tab: "ledgers" },
  "discount-schemes": { moduleId: "accounts", tab: "discounts" },
  reports: { moduleId: "business" },
  "reports-platform": { moduleId: "business" },
  "clinical-records": { moduleId: "communication", tab: "documents" },
  documents: { moduleId: "communication", tab: "documents" },
  "clinical-reports": { moduleId: "communication", tab: "reports" },
  "medical-records": { moduleId: "communication", tab: "reports" },
  records: { moduleId: "communication", tab: "reports" },
  medicines: { moduleId: "inventory", tab: "inventory", sub: "catalogue" },
  injections: { moduleId: "inventory", tab: "inventory", sub: "injection" },
  "food-inventory": { moduleId: "inventory", tab: "inventory", sub: "food" },
  accessories: { moduleId: "inventory", tab: "inventory", sub: "accessories" },
  stock: { moduleId: "inventory", tab: "inventory", sub: "stock" },
  purchases: { moduleId: "inventory", tab: "purchases" },
  suppliers: { moduleId: "inventory", tab: "suppliers" },
  expenses: { moduleId: "billing" },
  crm: { moduleId: "crm-pets" },
  sales: { moduleId: "billing" },
  invoices: { moduleId: "billing" },
  "opd-queue": { moduleId: "appointments" },
  queue: { moduleId: "appointments" },
  opd: { moduleId: "appointments" },
};

/** Where a module id really lives now, plus the extra search params that open the right tab. */
export function resolveModule(moduleId: string, search?: Record<string, unknown>): { moduleId: string; search: Record<string, unknown> } {
  const a = MODULE_ALIASES[moduleId];
  if (!a) return { moduleId, search: search ?? {} };
  return { moduleId: a.moduleId, search: { ...(search ?? {}), ...(a.tab ? { tab: a.tab } : {}), ...(a.sub ? { sub: a.sub } : {}) } };
}

const holds = (held: ReadonlySet<string>, need?: string[]) => !need || need.length === 0 || need.some((m) => held.has(m));

/** Tabs of a hub the role may see. */
export function tabsFor(item: MenuItem, held: ReadonlySet<string>): HubTab[] {
  return (item.tabs ?? []).filter((t) => holds(held, t.requires));
}

/** Menu items a role sees. `held` = the role's own module ids (its dashboard cards), so access never widens. */
export function menuFor(roleId: RoleId, held: ReadonlySet<string>): { left: MenuItem[]; right: MenuItem[] } {
  const visible = MENU.filter((m) => {
    if (!m.roles.includes(roleId) || !holds(held, m.requires)) return false;
    if (m.id === "quick") return quickActionsFor(roleId, held).length > 0;
    if (m.tabs) return tabsFor(m, held).length > 0;
    return true;
  });
  const shown = visible.map((m) => {
    if (!m.tree) return m;
    const tabs = tabsFor(m, held);
    return { ...m, tree: m.tree.filter((b) => tabs.some((t) => t.id === b.tab)) };
  });
  return { left: shown.filter((m) => m.side === "left"), right: shown.filter((m) => m.side === "right") };
}

/** Quick actions a role may use (it must hold a required module, and match the action's role list if it has one). */
export const quickActionsFor = (roleId: RoleId, held: ReadonlySet<string>) =>
  QUICK_ACTIONS.filter((a) => (!a.roles || a.roles.includes(roleId)) && a.requires.some((r) => held.has(r)));

/** Module ids the new hub pages add to a role's list (used by roleModules() so the Shell guard admits the hubs). */
export function hubModuleIds(roleId: RoleId, held: ReadonlySet<string>): string[] {
  const { left, right } = menuFor(roleId, held);
  return [...left, ...right].flatMap((m) => (m.to.kind === "module" ? [m.to.moduleId] : [])).filter((id) => !held.has(id));
}

/** The item a /m/<id> or other path belongs to (for highlighting). */
export function itemForPath(items: MenuItem[], pathname: string): MenuItem | undefined {
  if (pathname.startsWith("/m/")) {
    const id = pathname.slice(3).split("/")[0] ?? "";
    return items.find((m) => m.match.includes(id) || (m.to.kind === "module" && m.to.moduleId === id));
  }
  return items.find((m) => (m.matchPaths ?? []).some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p)));
}
