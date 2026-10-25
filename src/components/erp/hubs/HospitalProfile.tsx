import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useErp } from "@/lib/erp/store";
import { useClinicBranding } from "@/lib/erp/useClinicBranding";
import { updateClinicConfigFn } from "@/lib/mongodb/serverFns/clinicConfig";

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

/** Clinic profile (name, address, registration, branding) from the clinic's own configuration; admin can edit contact details. */
export function HospitalProfile() {
  const c = useClinicBranding();
  const { roleId, clinicBranding, refreshClinicBranding } = useErp();
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
    if (!/^d{6}$/.test(form.pin.trim())) return void toast.error("PIN code must be 6 digits.");
    if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(form.email.trim())) return void toast.error("Enter a valid email address.");
    const digits = form.phone.replace(/D/g, "").length;
    if (digits < 10 || digits > 13) return void toast.error("Enter a valid phone number.");
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
      {editing && (
        <div className="grid w-full gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === "address" || k === "tagline" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
              <Label className="text-xs font-bold">{label}{!OPTIONAL.has(k) && " *"}</Label>
              <Input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="h-9 text-sm" />
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
