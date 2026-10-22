import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, RotateCcw, Eye, Mail, Phone, Search, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  createdAt: string;
}

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const daysLeft = (v?: string) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / 864e5) : null);

export function PlatformTenantsHub() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const active = tenants.filter((t) => t.status === "ACTIVE").length;
  const trial = tenants.filter((t) => t.subscriptionStatus === "TRIAL").length;
  const suspended = tenants.filter((t) => t.status === "SUSPENDED").length;
  const trialEnding = tenants.filter((t) => t.subscriptionStatus === "TRIAL" && (daysLeft(t.trialEndsAt) ?? 99) <= 3).length;
  const unverified = tenants.filter((t) => !t.doctorVerified).length;
  const mrr = tenants
    .filter((t) => t.status === "ACTIVE" && t.subscriptionStatus === "ACTIVE")
    .reduce((s, t) => s + (SUBSCRIPTION_PLANS[t.planId as keyof typeof SUBSCRIPTION_PLANS]?.monthlyPriceInr ?? 0), 0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (planFilter !== "all" && t.planId !== planFilter) return false;
      if (statusFilter === "ACTIVE" || statusFilter === "SUSPENDED") {
        if (t.status !== statusFilter) return false;
      } else if (statusFilter === "TRIAL") {
        if (t.subscriptionStatus !== "TRIAL") return false;
      } else if (statusFilter === "UNVERIFIED") {
        if (t.doctorVerified) return false;
      }
      if (!q) return true;
      return [t.name, t.city, t.state, t.email, t.phone, t.slug, t.doctor?.fullName, t.doctor?.councilRegNo].some((v) => v?.toLowerCase().includes(q));
    });
  }, [tenants, query, planFilter, statusFilter]);

  return (
    <Shell title="Platform & Tenant Administration">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard kpi={{ label: "Total clinics", value: String(tenants.length) }} />
          <KpiCard kpi={{ label: "Active", value: String(active), trendTone: "up" }} />
          <KpiCard
            kpi={{
              label: "On trial",
              value: String(trial),
              ...(trialEnding ? { trend: `${trialEnding} ending in 3 days` } : {}),
              trendTone: trialEnding ? "down" : "flat",
            }}
          />
          <KpiCard kpi={{ label: "Suspended", value: String(suspended), trendTone: suspended > 0 ? "down" : "flat" }} />
          <KpiCard kpi={{ label: "Doctors unverified", value: String(unverified), trendTone: unverified > 0 ? "down" : "up" }} />
          <KpiCard kpi={{ label: "MRR (paid)", value: `₹${mrr.toLocaleString("en-IN")}` }} />
        </div>

        <div className="erp-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-navy">Registered Clinics</h2>
              <span className="text-xs text-muted-foreground">
                {rows.length} of {tenants.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clinic, city, doctor, email…" className="h-8 w-60 pl-8 text-xs" />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {Object.entries(PLAN_LABEL).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="TRIAL">On trial</SelectItem>
                  <SelectItem value="UNVERIFIED">Doctor unverified</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="p-8 text-center text-sm text-muted-foreground">No clinics match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Clinic</th>
                    <th className="px-4 py-2 text-left font-semibold">Contact</th>
                    <th className="px-4 py-2 text-left font-semibold">Doctor</th>
                    <th className="px-4 py-2 text-left font-semibold">Plan</th>
                    <th className="px-4 py-2 text-left font-semibold">Subscription</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((t) => {
                    const left = daysLeft(t.trialEndsAt);
                    return (
                      <motion.tr key={t.tenantId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setOpenId(t.tenantId)}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-navy">{t.name}</div>
                          <div className="text-muted-foreground">{t.city}, {t.state} · {t.slug}</div>
                          <div className="text-muted-foreground">Registered {fmtDate(t.createdAt)}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-muted-foreground"><Mail className="size-3" /> {t.email}</div>
                          <div className="flex items-center gap-1 text-muted-foreground"><Phone className="size-3" /> {t.phone}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{t.doctor?.fullName ?? "—"}</div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {t.doctor?.councilRegNo}
                            {t.doctorVerified && <BadgeCheck className="size-3.5 text-success" aria-label="Verified" />}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">{PLAN_LABEL[t.planId] ?? t.planId}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={t.subscriptionStatus === "ACTIVE" ? "default" : "outline"}>{t.subscriptionStatus}</Badge>
                          {t.subscriptionStatus === "TRIAL" && left !== null && (
                            <div className={left <= 3 ? "text-destructive" : "text-muted-foreground"}>{left >= 0 ? `${left} days left` : "Trial ended"}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={t.status === "ACTIVE" ? "default" : "destructive"}>{t.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpenId(t.tenantId); }}>
                            <Eye className="mr-1.5 size-3.5" /> View details
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
