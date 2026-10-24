import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, RotateCcw, Search, BadgeCheck, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listTenantsFn } from "@/lib/mongodb/serverFns/platform";
import { SUBSCRIPTION_PLANS } from "@/lib/erp/features";
import { TenantDetailDialog, PLAN_LABEL } from "./TenantDetailDialog";

interface TenantRow {
  tenantId: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  planId: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  status: "ACTIVE" | "SUSPENDED";
  doctorVerified?: boolean;
  doctor?: { fullName: string; councilRegNo: string; regValidUpto: string };
  documents?: { name: string }[];
  createdAt: string;
}

type Filter = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED" | "UNVERIFIED";

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysLeft = (v?: string) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 864e5) : null);

const MATCHERS: Record<Filter, (t: TenantRow) => boolean> = {
  all: () => true,
  ACTIVE: (t) => t.status === "ACTIVE",
  TRIAL: (t) => t.subscriptionStatus === "TRIAL",
  SUSPENDED: (t) => t.status === "SUSPENDED",
  UNVERIFIED: (t) => !t.doctorVerified,
};

export function PlatformTenantsHub() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTenants((await listTenantsFn()) || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tenant list.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const mrr = tenants
    .filter((t) => t.status === "ACTIVE" && t.subscriptionStatus === "ACTIVE")
    .reduce((s, t) => s + (SUBSCRIPTION_PLANS[t.planId as keyof typeof SUBSCRIPTION_PLANS]?.monthlyPriceInr ?? 0), 0);

  const stats: { key: Filter; label: string; hint: string }[] = [
    { key: "all", label: "Total clinics", hint: "Every registered clinic" },
    { key: "ACTIVE", label: "Active", hint: "Can sign in" },
    { key: "TRIAL", label: "On trial", hint: "Free trial running" },
    { key: "SUSPENDED", label: "Suspended", hint: "Sign-in blocked" },
    { key: "UNVERIFIED", label: "Doctor unverified", hint: "Needs your review" },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (!MATCHERS[filter](t)) return false;
      if (!q) return true;
      return [t.name, t.city, t.state, t.email, t.phone, t.slug, t.doctor?.fullName, t.doctor?.councilRegNo].some((v) => v?.toLowerCase().includes(q));
    });
  }, [tenants, query, filter]);

  return (
    <Shell title="Platform & Tenant Administration">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {stats.map((s) => {
            const count = tenants.filter(MATCHERS[s.key]).length;
            const selected = filter === s.key;
            const warn = (s.key === "SUSPENDED" || s.key === "UNVERIFIED") && count > 0;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(s.key)}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left transition hover:border-primary/50 hover:shadow-sm",
                  selected ? "border-primary ring-2 ring-primary/20" : "border-slate-200",
                )}
              >
                <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                <p className={cn("mt-1 text-3xl font-bold", warn ? "text-amber-600" : "text-navy")}>{count}</p>
                <p className="text-[11px] text-muted-foreground">{s.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="erp-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-navy">Registered Clinics</h2>
              <span className="text-xs text-muted-foreground">
                {rows.length} of {tenants.length}
              </span>
              {mrr > 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">MRR ₹{mrr.toLocaleString("en-IN")}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clinic, city, doctor, email…" className="h-9 w-72 pl-8 text-xs" />
              </div>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                <RotateCcw className="mr-1.5 size-3.5" /> Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading clinics…</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No clinics registered yet. New clinics appear here as soon as they self-register at{" "}
              <span className="font-semibold text-navy">/register-clinic</span>.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No clinics match these filters.{" "}
              <button className="font-semibold text-primary underline" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Clinic</th>
                    <th className="px-4 py-2 text-left font-semibold">Doctor</th>
                    <th className="px-4 py-2 text-left font-semibold">Plan</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-left font-semibold">Documents</th>
                    <th className="px-4 py-2 text-right font-semibold">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((t) => {
                    const left = daysLeft(t.trialEndsAt);
                    const docCount = (t.documents?.length ?? 0) + (t.doctor ? 1 : 0); // + the council ID card from step 2
                    return (
                      <motion.tr key={t.tenantId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpenId(t.tenantId)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{t.name.replace(/^E2E MT /, "").charAt(0).toUpperCase()}</div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-navy">{t.name}</div>
                              <div className="truncate text-muted-foreground">{t.city}, {t.state} · {t.email}</div>
                              <div className="text-[11px] text-muted-foreground">Registered {fmtDate(t.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{t.doctor?.fullName ?? "—"}</div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {t.doctor?.councilRegNo}
                            {t.doctorVerified ? (
                              <BadgeCheck className="size-3.5 text-success" aria-label="Verified" />
                            ) : (
                              <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700">Unverified</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{PLAN_LABEL[t.planId] ?? t.planId}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={t.status === "ACTIVE" ? "default" : "destructive"}>{t.status}</Badge>
                            <Badge variant="outline">{t.subscriptionStatus}</Badge>
                          </div>
                          {t.subscriptionStatus === "TRIAL" && left !== null && (
                            <div className={cn("mt-1", left <= 3 ? "text-destructive" : "text-muted-foreground")}>{left >= 0 ? `${left} days left` : "Trial ended"}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <FileText className="size-3.5" /> {docCount} file{docCount === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(t.tenantId); }}>
                            View details <ChevronRight className="ml-1 size-3.5" />
                          </Button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TenantDetailDialog tenantId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />
    </Shell>
  );
}
