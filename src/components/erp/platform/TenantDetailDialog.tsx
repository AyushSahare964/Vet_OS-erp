import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, CheckCircle2, Download, ExternalLink, FileText, ShieldCheck, ShieldOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPlanTimeline } from "@/lib/erp/planTimeline";
import { PlanCountdown } from "./PlanCountdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTenantDetailFn,
  setTenantStatusFn,
  setTenantPlanFn,
  verifyTenantDoctorFn,
} from "@/lib/mongodb/serverFns/platform";

export const PLAN_LABEL: Record<string, string> = {
  plan_starter: "Starter",
  plan_basic: "Basic",
  plan_professional: "Pro",
  plan_enterprise: "Max",
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

/** Browsers block navigating to data: URLs, so open an uploaded file through a temporary blob URL instead. */
async function openFile(dataUri: string) {
  const blob = await (await fetch(dataUri)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const extOf = (dataUri: string) => (dataUri.startsWith("data:application/pdf") ? "pdf" : dataUri.startsWith("data:image/png") ? "png" : "jpg");

function FileCard({ title, subtitle, dataUri }: { title: string; subtitle?: string | undefined; dataUri: string }) {
  const isImage = dataUri.startsWith("data:image/");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <button type="button" onClick={() => void openFile(dataUri)} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted" aria-label={`View ${title}`}>
        {isImage ? <img src={dataUri} alt={title} className="size-full object-cover" /> : <FileText className="size-8 text-muted-foreground" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void openFile(dataUri)}>
            <ExternalLink className="mr-1.5 size-3.5" /> View
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={dataUri} download={`${title.replace(/[^\w-]+/g, "_")}.${extOf(dataUri)}`}>
              <Download className="mr-1.5 size-3.5" /> Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 text-amber-600" />}
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/** One clinic at a glance (Overview), then its documents, details, plan and admin account. */
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
  const docs: { name: string; dataUri: string; uploadedAt?: string }[] = t?.documents ?? [];
  const daysLeft = t ? getPlanTimeline(t).daysLeft : null;
  const regExpired = doc?.regValidUpto ? new Date(doc.regValidUpto).getTime() < Date.now() : false;
  const fileCount = docs.length + (doc?.idCardDataUri ? 1 : 0);

  const verifyButton = t && (
    <Button
      size="sm"
      variant={t.doctorVerified ? "outline" : "default"}
      disabled={busy}
      onClick={() => act(() => verifyTenantDoctorFn({ data: { tenantId: t.tenantId, verified: !t.doctorVerified } }))}
    >
      <BadgeCheck className="mr-1.5 size-3.5" /> {t.doctorVerified ? "Remove verification" : "Mark doctor as verified"}
    </Button>
  );

  return (
    <Dialog open={!!tenantId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {!t ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading clinic…</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3 pr-8">
                {cfg?.logoUrl ? (
                  <img src={cfg.logoUrl} alt="Clinic logo" className="size-14 shrink-0 rounded-xl border border-border bg-white object-contain p-1" />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">{t.name.charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {t.name}
                    <Badge variant={t.status === "ACTIVE" ? "default" : "destructive"}>{t.status}</Badge>
                    <Badge variant="outline">{t.subscriptionStatus}</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    {t.city}, {t.state} · ID {t.slug} · registered {fmtDate(t.createdAt)}
                  </DialogDescription>
                </div>
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
            </DialogHeader>

            <Tabs defaultValue="overview">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="doctor">Doctor &amp; documents</TabsTrigger>
                <TabsTrigger value="clinic">Clinic &amp; branding</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="admin">Admin &amp; usage</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Check ok={!!t.doctorVerified} label={t.doctorVerified ? "Doctor verified" : "Doctor not verified"} detail={t.doctorVerified ? `On ${fmtDate(t.doctorVerifiedAt)}` : "Check the council ID card in Documents"} />
                  <Check ok={!regExpired} label={regExpired ? "Council registration expired" : "Council registration valid"} detail={`Valid upto ${fmtDate(doc?.regValidUpto)}`} />
                  <Check
                    ok={t.subscriptionStatus !== "TRIAL" || (daysLeft ?? 0) > 3}
                    label={t.subscriptionStatus === "TRIAL" ? "Free trial" : `Subscription ${t.subscriptionStatus.toLowerCase()}`}
                    detail={t.subscriptionStatus === "TRIAL" && daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days left` : "Trial ended") : `${PLAN_LABEL[t.planId] ?? t.planId} plan`}
                  />
                </div>
                <Section
                  rows={[
                    ["Admin", `${d.admin?.fullName ?? "—"}`],
                    ["Admin email", d.admin?.email],
                    ["Clinic contact", `${t.phone ?? ""}${t.email ? ` · ${t.email}` : ""}`],
                    ["Doctor", doc ? `${doc.fullName} (${t.vetCouncilRegNo ?? doc.councilRegNo})` : "—"],
                    ["Plan", `${PLAN_LABEL[t.planId] ?? t.planId} · all modules included`],
                    ["Documents on file", `${fileCount} file${fileCount === 1 ? "" : "s"}`],
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
                {verifyButton}

                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Documents uploaded at registration</p>
                  {doc?.idCardDataUri ? (
                    <FileCard title="Council identity card" subtitle={doc.councilName} dataUri={doc.idCardDataUri} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No council ID card on file.</p>
                  )}
                  {docs.map((x, i) => (
                    <FileCard key={i} title={x.name} subtitle={x.uploadedAt ? `Uploaded ${fmtDate(x.uploadedAt)}` : undefined} dataUri={x.dataUri} />
                  ))}
                  {docs.length === 0 && <p className="text-sm text-muted-foreground">No other documents (licence, GST certificate…) were uploaded.</p>}
                </div>
              </TabsContent>

              <TabsContent value="clinic" className="space-y-4 pt-4">
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
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Branding</p>
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
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-4 pt-4">
                <PlanCountdown tenant={t} />
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
                <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Every plan includes every module. Plans differ only in staff and pet limits.</p>
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
