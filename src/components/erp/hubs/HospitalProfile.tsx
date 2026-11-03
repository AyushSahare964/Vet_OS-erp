import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErp } from "@/lib/erp/store";
import { useClinicBranding } from "@/lib/erp/useClinicBranding";
import { STATE_CODES } from "@/lib/finance/stateCodes";
import { validateGstin, validatePin } from "@/lib/finance/validators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateClinicConfigFn } from "@/lib/mongodb/serverFns/clinicConfig";
import { SignatureCapture } from "@/components/erp/documentation/SignatureCapture";
import { listDoctorSignaturesFn, setDoctorSignatureFn, type DoctorSignatureRow } from "@/lib/mongodb/serverFns/doctorSignatures";
import { setDoctorSignatures } from "@/lib/erp/hospitalSignature";

/** One row per doctor: their own signature, used on that doctor's prescriptions and bills. Admin edits all; a doctor edits their own. */
function DoctorSignatures({ isAdmin, myId }: { isAdmin: boolean; myId?: string | undefined }) {
  const [rows, setRows] = useState<DoctorSignatureRow[]>([]);
  const load = async () => {
    const r = await listDoctorSignaturesFn();
    setRows(r);
    setDoctorSignatures(r); // prescriptions and bills read from this
  };
  useEffect(() => { void load().catch(() => {}); }, []);
  const save = async (id: string, url: string) => {
    try {
      await setDoctorSignatureFn({ data: { userId: id, signatureUrl: url } });
      await load();
      toast.success(url ? "Signature saved." : "Signature removed.");
    } catch (e: any) {
      toast.error(e.message || "Could not save the signature.");
    }
  };
  if (rows.length === 0) return null;
  return (
    <div className="w-full space-y-2 border-t border-border pt-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Doctor signatures</p>
      <p className="text-xs text-muted-foreground">Each doctor's signature appears on that doctor's own prescriptions and bills.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-14 w-32 shrink-0 items-center justify-center rounded border border-dashed border-border bg-white">
              {r.signatureUrl ? <img src={r.signatureUrl} alt={`${r.name} signature`} className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-muted-foreground">No signature</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.designation}</p>
              {(isAdmin || r.id === myId) && (
                <div className="mt-1 flex items-center">
                  <SignatureCapture label="Add signature" hasSignature={!!r.signatureUrl} onChange={(u) => save(r.id, u)} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FIELDS = [
  ["clinicName", "Hospital name"],
  ["tagline", "Tagline"],
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["pin", "PIN code"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["website", "Website"],
  ["gstin", "GSTIN"],
  ["doctorName", "Head doctor"],
  ["doctorQualifications", "Head doctor qualifications"],
  ["doctorLicenseNumber", "Registration no."],
] as const;
/** Optional fields may be cleared; the rest are required. */
const OPTIONAL = new Set<Field>(["tagline", "website", "gstin", "doctorName", "doctorQualifications", "doctorLicenseNumber"]);
type Field = (typeof FIELDS)[number][0];

const PLACEHOLDERS: Partial<Record<Field, string>> = {
  clinicName: "Hospital name", address: "Street / building", city: "City", pin: "6-digit PIN code",
  phone: "Phone number", email: "name@clinic.com", website: "www.yourclinic.com", gstin: "15-character GSTIN",
};
/** Keep PIN digit-only, phone to digits/+/spaces, GSTIN upper-case. */
const clean = (k: Field, v: string) =>
  k === "pin" ? v.replace(/\D/g, "").slice(0, 6) : k === "phone" ? v.replace(/[^\d+\s-]/g, "") : k === "gstin" ? v.toUpperCase() : v;

/** Clinic profile (name, address, registration, branding) from the clinic's own configuration; admin can edit contact details. */
export function HospitalProfile() {
  const c = useClinicBranding();
  const { roleId, clinicBranding, refreshClinicBranding, currentUser } = useErp();
  const cfg = (clinicBranding ?? {}) as Partial<Record<Field, string>>;
  const blank = Object.fromEntries(FIELDS.map(([k]) => [k, ""])) as Record<Field, string>;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>(blank);

  const startEdit = () => {
    setForm({ ...blank, ...Object.fromEntries(FIELDS.map(([k]) => [k, cfg[k] ?? ""])), clinicName: cfg.clinicName ?? c.fullName });
    setEditing(true);
  };

  const save = async () => {
    const missing = FIELDS.filter(([k, label]) => !OPTIONAL.has(k) && !form[k].trim()).map(([, label]) => label);
    if (missing.length) {
      toast.error(`Required: ${missing.join(", ")}.`);
      return;
    }
    const pinErr = validatePin(form.pin, true);
    if (pinErr) return void toast.error(pinErr + ".");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return void toast.error("Enter a valid email address.");
    const digits = form.phone.replace(/\D/g, "").length;
    if (digits < 10 || digits > 13) return void toast.error("Enter a valid phone number.");
    const gstErr = validateGstin(form.gstin);
    if (gstErr) return void toast.error(gstErr + ".");
    setSaving(true);
    try {
      const res = await updateClinicConfigFn({
        data: Object.fromEntries(FIELDS.map(([k]) => [k, form[k].trim()])) as Record<Field, string>,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      await refreshClinicBranding(); // documents, invoices and headers read the refreshed branding
      toast.success("Hospital profile saved.");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save the hospital profile.");
    } finally {
      setSaving(false);
    }
  };

  const saveSignature = async (url: string) => {
    try {
      const res = await updateClinicConfigFn({ data: { signatureUrl: url } });
      if (!res.success) return void toast.error(res.message);
      await refreshClinicBranding();
      toast.success(url ? "Signature saved. It is now used on prescriptions, invoices and purchase documents." : "Signature removed.");
    } catch (e: any) {
      toast.error(e.message || "Could not save the signature.");
    }
  };

  const rows: [string, string][] = [
    ["Hospital", c.fullName],
    ["Tagline", c.tagline],
    ["Address", [c.addressLine1, c.addressLine2].filter(Boolean).join(", ")],
    ["Phone", c.phone],
    ["Email", c.email],
    ["Website", c.website],
    ["GSTIN", c.gstin],
    ["Registration no.", c.regNo],
    ["Head doctor", [c.doctorName, c.doctorQualifications].filter(Boolean).join(" · ")],
  ];
  return (
    <div className="erp-card flex flex-wrap items-start gap-6 p-6">
      {c.logoPath && (
        <img src={c.logoPath} alt="" className="h-20 w-auto object-contain" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
      )}
      <dl className="grid min-w-[280px] flex-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium text-foreground">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {roleId === "admin" && !editing && (
        <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
          <Pencil className="size-3.5" /> Edit hospital details
        </Button>
      )}
      <div className="w-full space-y-2 border-t border-border pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Signature</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-56 items-center justify-center rounded-lg border border-dashed border-border bg-white">
            {c.signatureUrl ? (
              <img src={c.signatureUrl} alt="Hospital signature" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No signature added</span>
            )}
          </div>
          {roleId === "admin" && (
            <div className="flex items-center gap-1.5">
              <SignatureCapture label="Add signature" hasSignature={!!c.signatureUrl} onChange={saveSignature} />
            </div>
          )}
          <p className="max-w-sm text-xs text-muted-foreground">
            The hospital's authorised signature: used on invoices and purchase orders / bills. Draw it or upload a photo (rotate and crop it).
          </p>
        </div>
      </div>
      <DoctorSignatures isAdmin={roleId === "admin"} myId={currentUser?.id} />
      {editing && (
        <div className="grid w-full gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === "address" || k === "tagline" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
              <Label className="text-xs font-bold">{label}{!OPTIONAL.has(k) && " *"}</Label>
              {k === "state" ? (
                <Select value={form.state} onValueChange={(v) => setForm((f) => ({ ...f, state: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {STATE_CODES.map((st) => <SelectItem key={st.code} value={st.name}>{st.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: clean(k, e.target.value) }))}
                  inputMode={k === "pin" || k === "phone" ? "numeric" : undefined}
                  maxLength={k === "pin" ? 6 : k === "gstin" ? 15 : undefined}
                  placeholder={PLACEHOLDERS[k]}
                  className="h-9 text-sm"
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
