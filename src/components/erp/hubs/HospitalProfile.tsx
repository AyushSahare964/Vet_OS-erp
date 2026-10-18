import { useClinicBranding } from "@/lib/erp/useClinicBranding";

/** Read-only clinic profile (name, address, registration, branding) from the clinic's own configuration. */
export function HospitalProfile() {
  const c = useClinicBranding();
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
    </div>
  );
}
