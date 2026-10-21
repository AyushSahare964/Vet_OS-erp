import { useMemo, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";
import { ShellEmbedContext } from "@/components/erp/shellEmbed";
import { ComingSoon } from "@/components/erp/ComingSoon";
import { getIcon } from "@/components/erp/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useErp } from "@/lib/erp/store";
import { baseModuleIds } from "@/lib/erp/config";
import { MENU, tabsFor, type MenuItem } from "@/components/doctor/layout/menuConfig";

import { InventoryHub } from "@/components/erp/inventory/InventoryHub";
import { AccountsHub } from "@/components/erp/accounts/AccountsHub";
import { LedgersHub } from "@/components/erp/ledgers/LedgersHub";
import { isLedgerType } from "@/components/erp/ledgers/ledgerTypes";
import { DiscountSchemesHub } from "@/components/erp/discounts/DiscountSchemesHub";
import { PatientBillingHub } from "@/components/erp/billing/PatientBillingHub";
import { BoardingSwimmingHub } from "@/components/erp/boarding/BoardingSwimmingHub";
import { FoodNutritionHub } from "@/components/erp/nutrition/FoodNutritionHub";
import { PharmacyRetailHub } from "@/components/erp/pharmacy/PharmacyRetailHub";
import { ClinicalReportsHub } from "@/components/erp/reports/ClinicalReportsHub";
import { IdentityAccessHub } from "@/components/erp/identity/IdentityAccessHub";
import { PlatformTenantsHub } from "@/components/erp/platform/PlatformTenantsHub";
import { ConsultationQueue } from "./ConsultationQueue";
import { VaccinationDue } from "./VaccinationDue";
import { RemindersList } from "./RemindersList";
import { PendingApprovals } from "./PendingApprovals";
import { DocumentationCenter } from "@/components/erp/documentation/DocumentationCenter";
import { HospitalProfile } from "./HospitalProfile";

type InvSub = "catalogue" | "injection" | "food" | "accessories" | "stock" | "movements" | "alerts";
const INV_SUBS = ["catalogue", "injection", "food", "accessories", "stock", "movements", "alerts"];

/** Hub for a /m/<id> route id (the "identity" route is the Staff hub, "pharmacy"/"billing" etc. are plain pages). */
export const hubItemFor = (moduleId: string): MenuItem | undefined =>
  MENU.find((m) => m.to.kind === "module" && m.to.moduleId === moduleId && (m.tabs || m.id === "vaccination" || m.id === "business"));

/** Certificates & Documents: printable forms and certificates, or the uploaded-documents register. */
function DocumentsTab({ sub, go }: { sub?: string | undefined; go: (sub: string) => void }) {
  const mode = sub === "uploads" ? "uploads" : "forms";
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold" role="group" aria-label="Documents view">
        {([["forms", "Forms & Certificates"], ["uploads", "Uploaded documents"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className={`rounded-md px-3 py-1.5 ${mode === id ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "forms" ? <DocumentationCenter /> : <ClinicalReportsHub initialMode="medical-records" initialTab="upload-documents" />}
    </div>
  );
}

function TabBody({ hubId, tab, sub, go, goSub }: { hubId: string; tab: string; sub?: string | undefined; go: (tab: string) => void; goSub: (moduleId: string, tab: string, sub: string) => void }) {
  switch (`${hubId}:${tab}`) {
    case "consultation:consultation": return <ConsultationQueue />;
    case "consultation:pharmacy": return <PharmacyRetailHub />;
    case "vaccination:main": return <VaccinationDue />;
    case "boarding:boarding": return <BoardingSwimmingHub key={sub} initialTab={sub === "swimming" ? "swimming" : "boarding"} />;
    case "boarding:food": return <FoodNutritionHub />;
    case "communication:documents": return <DocumentsTab sub={sub} go={(s) => goSub("communication", "documents", s)} />;
    case "communication:reports": return <ClinicalReportsHub initialMode="medical-records" initialTab="all-reports" />;
    case "communication:reminders": return <RemindersList />;
    case "business:main": return <ClinicalReportsHub initialMode="analytics" />;
    case "inventory:inventory": return <InventoryHub key={sub} initialTab={(INV_SUBS.includes(sub ?? "") ? sub : "catalogue") as InvSub} />;
    case "inventory:purchases": return <PatientBillingHub initialRegisterTab="purchases" />;
    case "inventory:suppliers": return <PatientBillingHub initialRegisterTab="suppliers" />;
    case "accounts:statements": return <AccountsHub report={sub} />;
    case "accounts:ledgers": return <LedgersHub ledger={isLedgerType(sub) ? sub : undefined} onClear={() => go("ledgers")} />;
    case "accounts:discounts": return <DiscountSchemesHub />;
    case "hospital:hospital": return <HospitalProfile />;
    case "hospital:tenants": return <PlatformTenantsHub />;
    case "identity:staff": return <IdentityAccessHub />;
    case "identity:approvals": return <PendingApprovals onOpenStaff={() => go("staff")} />;
    default: return null;
  }
}

/**
 * Generic hub page: Shell + header + tabs. The active tab lives in the URL (?tab=, and ?sub= for an inner view),
 * so links and the browser Back button work. Nested module pages render inside, without a second frame.
 */
export function HubPage({ item }: { item: MenuItem }): ReactNode {
  const { role } = useErp();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: string; sub?: string };
  const moduleId = item.to.kind === "module" ? item.to.moduleId : item.id;
  const held = useMemo(() => baseModuleIds(role), [role]);
  const tabs = useMemo(() => (item.tabs ? tabsFor(item, held) : [{ id: "main", label: item.label }]), [item, held]);

  // Old inventory links used ?tab=<inner view>; keep them working.
  let tab = search.tab;
  let sub = search.sub;
  if (moduleId === "inventory" && tab && INV_SUBS.includes(tab)) {
    sub = tab;
    tab = "inventory";
  }
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const Icon = getIcon(item.icon);

  const goSub = (m: string, t: string, sub2: string) => void navigate({ to: "/m/$moduleId", params: { moduleId: m }, search: { tab: t, sub: sub2 } as never });
  const go = (id: string) => {
    const t = tabs.find((x) => x.id === id);
    if (t?.to) {
      void navigate({ to: "/m/$moduleId", params: { moduleId: t.to.moduleId }, search: (t.to.tab ? { tab: t.to.tab } : {}) as never });
      return;
    }
    if (t?.legacy) {
      void navigate({ to: "/m/$moduleId", params: { moduleId: t.legacy } });
      return;
    }
    void navigate({ to: "/m/$moduleId", params: { moduleId }, search: { tab: id } as never });
  };

  return (
    <Shell title={item.label}>
      <div className="mx-auto max-w-[1680px] space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="page-title">{item.label}</h1>
            {item.subtitle && <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>}
          </div>
        </div>

        {item.tabs && tabs.length > 0 && (
          <Tabs value={active?.id ?? ""} onValueChange={go}>
            <TabsList className="h-auto flex-wrap justify-start">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs font-semibold">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <ShellEmbedContext.Provider value={true}>
          {active &&
            (active.soon ? (
              <ComingSoon title={active.label} line={active.soon} />
            ) : (
              <TabBody hubId={moduleId} tab={active.id} sub={sub} go={go} goSub={goSub} />
            ))}
        </ShellEmbedContext.Provider>
      </div>
    </Shell>
  );
}
