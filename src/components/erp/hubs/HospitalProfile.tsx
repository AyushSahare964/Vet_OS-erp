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
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["pin", "PIN code"],
  ["phone", "Phone"],
  ["email", "Email"],
] as const;
type Field = (typeof FIELDS)[number][0];

/** Clinic profile (name, address, registration, branding) from the clinic's own configuration; admin can edit contact details. */
export function HospitalProfile() {
  const c = useClinicBranding();
  const { roleId, clinicBranding } = useErp();
  const cfg = (clinicBranding ?? {}) as Partial<Record<Field, string>>;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>({ address: "", city: "", state: "", pin: "", phone: "", email: "" });

  const startEdit = () => {
    setForm({
      address: cfg.address ?? "",
      city: cfg.city ?? "",
      state: cfg.state ?? "",
      pin: cfg.pin ?? "",
      phone: cfg.phone ?? c.phone,
      email: cfg.email ?? c.email,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.pin.trim()) {
      toast.error("Address, city, state and PIN code are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateClinicConfigFn({
        data: Object.fromEntries(FIELDS.map(([k]) => [k, form[k].trim()])) as Record<Field, string>,
      });
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success("Hospital profile saved.");
      window.location.reload(); // branding is loaded once per session; reload so documents and invoices pick it up
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
          <Pencil className="size-3.5" /> Edit address &amp; contact
        </Button>
      )}
      {editing && (
        <div className="grid w-full gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {FIELDS.map(([k, label]) => (
            <div key={k} className={k === "address" ? "space-y-1 sm:col-span-2" : "space-y-1"}>
              <Label className="text-xs font-bold">{label}</Label>
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
