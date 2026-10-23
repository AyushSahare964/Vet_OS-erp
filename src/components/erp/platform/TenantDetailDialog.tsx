import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BadgeCheck, ShieldCheck, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTenantDetailFn,
  setTenantStatusFn,
  setTenantPlanFn,
  extendTenantTrialFn,
  verifyTenantDoctorFn,
} from "@/lib/mongodb/serverFns/platform";

export const PLAN_LABEL: Record<string, string> = {
  plan_starter: "Starter",
  plan_basic: "Basic",
  plan_professional: "Pro",
  plan_enterprise: "Max",
};

const FEATURE_LABEL: Record<string, string> = {
  crm: "Patient CRM", appointments: "Appointments", clinical: "Clinical records", billing: "Billing",
  inventory: "Inventory", laboratory: "Laboratory", pharmacy: "Pharmacy & retail", boarding: "Boarding",
  accounting: "Accounting", reports: "Reports", nutrition: "Nutrition",
};

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Section({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="break-words text-sm font-medium text-foreground">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Everything a clinic entered at registration, grouped as the registration steps were: clinic, doctor, branding, plan, admin. */
export function TenantDetailDialog({ tenantId, onClose, onChanged }: { tenantId: string | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (id: string) => {
    try {
      setD(await getTenantDetailFn({ data: { tenantId: id } }));
    } catch (e: any) {
      toast.error(e.message || "Could not load the clinic.");
      onClose();
    }
  };
  useEffect(() => {
    setD(null);
    if (tenantId) void load(tenantId);
  }, [tenantId]);

  const act = async (fn: () => Promise<{ success: boolean; message: string }>) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
      if (tenantId) await load(tenantId);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const t = d?.tenant;
  const cfg = d?.config;
  const doc = t?.doctor;
  const daysLeft = t?.trialEndsAt ? Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 864e5) : null;
  const regExpired = doc?.regValidUpto ? new Date(doc.regValidUpto).getTime() < Date.now() : false;

  return (
    <Dialog open={!!tenantId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {!t ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading clinic…</div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {t.name}
                <Badge variant={t.status === "ACTIVE" ? "default" : "destructive"}>{t.status}</Badge>
                <Badge variant="outline">{t.subscriptionStatus}</Badge>
              </DialogTitle>
              <DialogDescription>
                {t.city}, {t.state} · ID {t.slug} · registered {fmtDate(t.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="clinic">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="clinic">Clinic</TabsTrigger>
                <TabsTrigger value="doctor">Doctor</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="admin">Admin &amp; usage</TabsTrigger>
              </TabsList>

              <TabsContent value="clinic" className="pt-4">
                <Section
                  rows={[
                    ["Clinic name", t.name],
                    ["Legal name", t.legalName],
                    ["Clinic type", t.clinicType],
                    ["Phone", t.phone],
                    ["WhatsApp", t.whatsappNumber],
                    ["Contact email", t.email],
                    ["Website", t.website],
                    ["Address", t.address],
                    ["City", t.city],
                    ["State", `${t.state}${t.stateCode ? ` (GST code ${t.stateCode})` : ""}`],
                    ["PIN", t.pin],
                    ["GSTIN", t.gstin],
                    ["PAN", t.pan],
                    ["GST composition dealer", d.branch?.isComposition ? "Yes" : "No"],
                  ]}
                />
              </TabsContent>

              <TabsContent value="doctor" className="space-y-4 pt-4">
                <Section
                  rows={[
                    ["Doctor", doc?.fullName],
                    ["Qualification", doc?.qualification],
                    ["Council regn. no.", t.vetCouncilRegNo ?? doc?.councilRegNo],
                    ["Veterinary council", doc?.councilName],
                    [
                      "Registration valid upto",
                      <span key="v" className={regExpired ? "text-destructive" : undefined}>
                        {fmtDate(doc?.regValidUpto)}
                        {regExpired && " — expired"}
                      </span>,
                    ],
                    [
                      "Verification",
                      t.doctorVerified ? (
                        <span key="ver" className="inline-flex items-center gap-1 text-success">
                          <BadgeCheck className="size-4" /> Verified {fmtDate(t.doctorVerifiedAt)}
                        </span>
                      ) : (
                        "Not verified yet"
                      ),
                    ],
                  ]}
                />
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Council identity card</p>
                  {doc?.idCardDataUri ? (
                    <a href={doc.idCardDataUri} target="_blank" rel="noreferrer">
                      <img src={doc.idCardDataUri} alt="Council ID card" className="max-h-64 rounded-lg border border-border object-contain" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No ID card uploaded.</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={t.doctorVerified ? "outline" : "default"}
                  disabled={busy}
                  onClick={() => act(() => verifyTenantDoctorFn({ data: { tenantId: t.tenantId, verified: !t.doctorVerified } }))}
                >
                  <BadgeCheck className="mr-1.5 size-3.5" /> {t.doctorVerified ? "Remove verification" : "Mark doctor as verified"}
                </Button>
              </TabsContent>

              <TabsContent value="branding" className="space-y-4 pt-4">
                {cfg?.logoUrl && <img src={cfg.logoUrl} alt="Clinic logo" className="h-20 w-auto rounded border border-border object-contain p-1" />}
                <Section
                  rows={[
                    ["Tagline", cfg?.tagline],
                    [
                      "Brand colour",
                      cfg?.primaryColor ? (
                        <span key="c" className="inline-flex items-center gap-2">
                          <span className="size-4 rounded border border-border" style={{ background: cfg.primaryColor }} /> {cfg.primaryColor}
                        </span>
                      ) : null,
                    ],
                    ["Pet boarding", cfg ? (cfg.hasBoardingFacility ? "Offered" : "Not offered") : "—"],
                    ["Kennel capacity", cfg?.hasBoardingFacility ? String(cfg.kennelCapacity ?? "—") : "—"],
                    ["Swimming / hydrotherapy", cfg ? (cfg.hasSwimmingPool ? "Offered" : "Not offered") : "—"],
                  ]}
                />
              </TabsContent>

              <TabsContent value="plan" className="space-y-4 pt-4">
                <Section
                  rows={[
                    ["Plan", PLAN_LABEL[t.planId] ?? t.planId],
                    ["Subscription", t.subscriptionStatus],
                    [
                      "Trial ends",
                      t.trialEndsAt ? `${fmtDate(t.trialEndsAt)}${daysLeft !== null ? (daysLeft >= 0 ? ` (${daysLeft} days left)` : " (ended)") : ""}` : "—",
                    ],
                    ["Staff limit", t.features?.maxUsers === -1 ? "Unlimited" : t.features?.maxUsers],
                    ["Pet limit", t.features?.maxPets === -1 ? "Unlimited" : t.features?.maxPets],
                  ]}
                />
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(FEATURE_LABEL).map(([k, label]) => (
                    <Badge key={k} variant={t.features?.[k] ? "default" : "outline"} className={t.features?.[k] ? "" : "text-muted-foreground line-through"}>
                      {label}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Select value={t.planId} onValueChange={(v) => act(() => setTenantPlanFn({ data: { tenantId: t.tenantId, planId: v as any } }))} disabled={busy}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAN_LABEL).map(([id, label]) => (
                        <SelectItem key={id} value={id}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {[7, 14].map((n) => (
                    <Button key={n} size="sm" variant="outline" disabled={busy} onClick={() => act(() => extendTenantTrialFn({ data: { tenantId: t.tenantId, days: n } }))}>
                      Extend trial +{n} days
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4 pt-4">
                <Section
                  rows={[
                    ["Admin name", d.admin?.fullName],
                    ["Admin email", d.admin?.email],
                    ["Admin phone", d.admin?.phone],
                    ["Admin created", fmtDate(d.admin?.createdAt)],
                  ]}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([["Active staff", d.usage.staff], ["Pets", d.usage.pets], ["Owners", d.usage.owners], ["Visits", d.usage.visits]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
                      <p className="text-xl font-bold text-foreground">{v}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end border-t border-border pt-3">
              <Button
                size="sm"
                variant={t.status === "ACTIVE" ? "outline" : "default"}
                disabled={busy}
                onClick={() => act(() => setTenantStatusFn({ data: { tenantId: t.tenantId, status: t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } }))}
              >
                {t.status === "ACTIVE" ? (
                  <><ShieldOff className="mr-1.5 size-3.5" /> Suspend clinic</>
                ) : (
                  <><ShieldCheck className="mr-1.5 size-3.5" /> Activate clinic</>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
