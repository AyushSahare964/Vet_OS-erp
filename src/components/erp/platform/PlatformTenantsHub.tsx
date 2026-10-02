import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, RotateCcw, ShieldOff, ShieldCheck, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listTenantsFn, setTenantStatusFn } from "@/lib/mongodb/serverFns/platform";

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
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

const PLAN_LABEL: Record<string, string> = {
  plan_basic: "Basic",
  plan_professional: "Professional",
  plan_enterprise: "Enterprise",
};

export function PlatformTenantsHub() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listTenantsFn();
      setTenants(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tenant list.");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (tenant: TenantRow) => {
    const nextStatus = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setBusySlug(tenant.slug);
    try {
      const res = await setTenantStatusFn({ data: { tenantId: tenant.tenantId, status: nextStatus } });
      if (res.success) {
        toast.success(res.message);
        await load();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to update tenant status.");
    } finally {
      setBusySlug(null);
    }
  };

  const active = tenants.filter((t) => t.status === "ACTIVE").length;
  const trial = tenants.filter((t) => t.subscriptionStatus === "TRIAL").length;
  const suspended = tenants.filter((t) => t.status === "SUSPENDED").length;

  return (
    <Shell title="Platform & Tenant Administration">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard kpi={{ label: "Total tenants", value: String(tenants.length) }} />
          <KpiCard kpi={{ label: "Active", value: String(active), trendTone: "up" }} />
          <KpiCard kpi={{ label: "On trial", value: String(trial), trendTone: "flat" }} />
          <KpiCard kpi={{ label: "Suspended", value: String(suspended), trendTone: suspended > 0 ? "down" : "flat" }} />
        </div>

        <div className="erp-card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <h2 className="text-sm font-bold text-navy">Registered Clinics</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RotateCcw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading tenants…</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No clinics registered yet. New clinics appear here as soon as they self-register at{" "}
              <span className="font-semibold text-navy">/register-clinic</span>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Clinic</th>
                    <th className="text-left font-semibold px-4 py-2">Contact</th>
                    <th className="text-left font-semibold px-4 py-2">Plan</th>
                    <th className="text-left font-semibold px-4 py-2">Subscription</th>
                    <th className="text-left font-semibold px-4 py-2">Status</th>
                    <th className="text-right font-semibold px-4 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.map((t) => (
                    <motion.tr key={t.tenantId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-navy">{t.name}</div>
                        <div className="text-muted-foreground">{t.city}, {t.state} · {t.slug}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-muted-foreground"><Mail className="size-3" /> {t.email}</div>
                        <div className="flex items-center gap-1 text-muted-foreground"><Phone className="size-3" /> {t.phone}</div>
                      </td>
                      <td className="px-4 py-2.5">{PLAN_LABEL[t.planId] ?? t.planId}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={t.subscriptionStatus === "ACTIVE" ? "default" : "outline"}>{t.subscriptionStatus}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={t.status === "ACTIVE" ? "default" : "destructive"}>{t.status}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={t.status === "ACTIVE" ? "outline" : "default"}
                          disabled={busySlug === t.slug}
                          onClick={() => void toggleStatus(t)}
                        >
                          {t.status === "ACTIVE" ? (
                            <><ShieldOff className="size-3.5 mr-1.5" /> Suspend</>
                          ) : (
                            <><ShieldCheck className="size-3.5 mr-1.5" /> Activate</>
                          )}
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
