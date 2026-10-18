import { useEffect, useMemo, useState } from "react";
import { FileSignature, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { getPatient360Fn } from "@/lib/mongodb/serverFns/patient360";
import { vaccinationHistory } from "@/lib/erp/patient360";
import { useClinicBranding } from "@/lib/erp/useClinicBranding";
import { useErp } from "@/lib/erp/store";
import { formatDisplayDate, todayIST } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";
import { DOC_TEMPLATES, type DocTemplate } from "./templates";

const PRINT_CSS = `@media print{body *{visibility:hidden!important}#doc-print,#doc-print *{visibility:visible!important}#doc-print{position:absolute;left:0;top:0;width:100%;box-shadow:none!important;border:0!important}}`;

/**
 * Forms, consents and certificates, filled from the selected patient, owner, doctor and clinic.
 * Print / Save as PDF only (a signed copy is not stored). Wording is a draft for the doctor to review.
 */
export function DocumentationCenter() {
  const clinic = useClinicBranding();
  const { currentUser } = useErp();
  const [pets, setPets] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [pet, setPet] = useState<any | null>(null);
  const [doctor, setDoctor] = useState("");
  const [tpl, setTpl] = useState<DocTemplate>(DOC_TEMPLATES[0]!);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [vaccines, setVaccines] = useState<any[]>([]);

  useEffect(() => {
    listPetsWithOwnersFn().then((p) => setPets(p ?? [])).catch(() => setPets([]));
    listApprovedDoctorsFn()
      .then((d) => {
        setDoctors(d ?? []);
        setDoctor((cur) => cur || (currentUser?.roleId === "doctor" ? currentUser.fullName : d?.[0]?.name) || "");
      })
      .catch(() => setDoctors([]));
  }, [currentUser?.fullName, currentUser?.roleId]);

  // Vaccine history for the certificate comes from the patient's own records
  useEffect(() => {
    setVaccines([]);
    if (!pet?.petId || !tpl.vaccineTable) return;
    getPatient360Fn({ data: { petId: pet.petId } })
      .then((d: any) => setVaccines(vaccinationHistory(d?.visits ?? [], d?.vaccinations ?? [])))
      .catch(() => setVaccines([]));
  }, [pet?.petId, tpl.vaccineTable]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pets.filter((p) => [p.name, p.petId, p.owner?.name, p.owner?.phone].some((x) => String(x ?? "").toLowerCase().includes(q))).slice(0, 6);
  }, [pets, query]);

  const sex = pet?.gender ?? "";
  const context: Record<string, string> = {
    pet: pet?.name ?? "________",
    species: pet?.species ?? "________",
    breed: pet?.breed ?? "________",
    sex,
    owner: pet?.owner?.name ?? "________",
    doctor: doctor || "________",
    clinic: clinic.fullName,
    date: formatDisplayDate(todayIST()),
    ...vals,
  };
  const fill = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (context[k] ? context[k]! : "________"));

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <style>{PRINT_CSS}</style>

      <div className="space-y-4">
        <div className="erp-card space-y-2 p-4">
          <Label className="text-xs font-bold">1. Patient</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pet, owner or phone" className="pl-8" />
          </div>
          {matches.map((p) => (
            <button
              key={p.petId}
              type="button"
              onClick={() => {
                setPet(p);
                setQuery("");
              }}
              className="block w-full rounded-lg border border-border px-3 py-1.5 text-left text-xs hover:bg-muted"
            >
              <strong>{p.name}</strong> · {p.breed} · {p.owner?.name} {p.owner?.phone}
            </button>
          ))}
          {pet && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs">
              <strong>{pet.name}</strong> ({pet.petId}) · {pet.species}, {pet.breed}
              <br />
              Owner: {pet.owner?.name} · {pet.owner?.phone}
            </p>
          )}
          <Label className="pt-1 text-xs font-bold">2. Doctor</Label>
          <Select value={doctor} onValueChange={setDoctor}>
            <SelectTrigger aria-label="Doctor">
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="erp-card space-y-1 p-3">
          <Label className="px-1 text-xs font-bold">3. Form</Label>
          {DOC_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTpl(t)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold", tpl.id === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <FileSignature className="size-3.5 shrink-0" aria-hidden="true" /> {t.title}
            </button>
          ))}
        </div>

        {tpl.fields && (
          <div className="erp-card space-y-2 p-4">
            <Label className="text-xs font-bold">4. Details for this form</Label>
            {tpl.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea rows={2} value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                ) : (
                  <Input type={f.type ?? "text"} value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Draft wording: the doctor should review each form before it is used.</p>
          <Button onClick={() => window.print()} disabled={!pet} className="gap-1.5">
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        </div>

        <article id="doc-print" className="erp-card mx-auto w-full max-w-[820px] space-y-4 bg-white p-8 text-[13px] leading-relaxed text-gray-900">
          <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
            <div>
              <h1 className="text-lg font-extrabold">{clinic.fullName}</h1>
              <p className="text-[11px] text-gray-600">{[clinic.addressLine1, clinic.addressLine2].filter(Boolean).join(", ")}</p>
              <p className="text-[11px] text-gray-600">{[clinic.phone, clinic.email].filter(Boolean).join(" · ")}</p>
              <p className="text-[11px] text-gray-600">{[clinic.regNo && `Reg. ${clinic.regNo}`, clinic.gstin && `GSTIN ${clinic.gstin}`].filter(Boolean).join(" · ")}</p>
            </div>
            {clinic.logoPath && <img src={clinic.logoPath} alt="" className="h-14 w-auto object-contain" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />}
          </header>

          <h2 className="text-center text-base font-extrabold uppercase tracking-wide">{tpl.title}</h2>

          <table className="w-full border border-gray-300 text-[12px]">
            <tbody>
              <tr>
                <td className="border border-gray-300 p-1.5"><b>Patient:</b> {pet?.name ?? "________"} ({pet?.petId ?? "—"})</td>
                <td className="border border-gray-300 p-1.5"><b>Species / breed:</b> {pet ? `${pet.species}, ${pet.breed}` : "________"}</td>
                <td className="border border-gray-300 p-1.5"><b>Sex / age:</b> {sex || "—"}{pet?.dob ? ` · DOB ${formatDisplayDate(pet.dob)}` : ""}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1.5"><b>Owner:</b> {pet?.owner?.name ?? "________"}</td>
                <td className="border border-gray-300 p-1.5"><b>Phone:</b> {pet?.owner?.phone ?? "________"}</td>
                <td className="border border-gray-300 p-1.5"><b>Date:</b> {formatDisplayDate(todayIST())}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1.5" colSpan={2}><b>Address:</b> {pet?.owner?.address ?? "________"}{pet?.owner?.city ? `, ${pet.owner.city}` : ""}</td>
                <td className="border border-gray-300 p-1.5"><b>Microchip:</b> {pet?.microchipNo || "—"}{pet?.weightKg ? ` · ${pet.weightKg} kg` : ""}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-2.5">
            {tpl.body.map((p, i) => (
              <p key={i}>{fill(p)}</p>
            ))}
          </div>

          {tpl.vaccineTable && (
            <table className="w-full border border-gray-300 text-[12px]">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border border-gray-300 p-1.5">Vaccine</th>
                  <th className="border border-gray-300 p-1.5">Date given</th>
                  <th className="border border-gray-300 p-1.5">Batch</th>
                  <th className="border border-gray-300 p-1.5">Next due</th>
                  <th className="border border-gray-300 p-1.5">Doctor</th>
                </tr>
              </thead>
              <tbody>
                {vaccines.map((v, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 p-1.5">{v.name}</td>
                    <td className="border border-gray-300 p-1.5">{formatDisplayDate(v.date)}</td>
                    <td className="border border-gray-300 p-1.5">{v.batchNo || "—"}</td>
                    <td className="border border-gray-300 p-1.5">{v.nextDue ? formatDisplayDate(v.nextDue) : "—"}</td>
                    <td className="border border-gray-300 p-1.5">{v.doctor || "—"}</td>
                  </tr>
                ))}
                {vaccines.length === 0 && (
                  <tr>
                    <td className="border border-gray-300 p-3 text-center text-gray-500" colSpan={5}>
                      {pet ? "No vaccination records found for this patient." : "Select a patient to fill the vaccine history."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="grid gap-8 pt-10" style={{ gridTemplateColumns: `repeat(${tpl.signatures.length}, minmax(0, 1fr))` }}>
            {tpl.signatures.map((s) => (
              <div key={s} className="text-center">
                <div className="border-t border-gray-700 pt-1 text-[11px] font-semibold">{s === "Attending veterinarian" ? `${s}: ${doctor || ""}` : s}</div>
                <div className="text-[10px] text-gray-500">Name, signature and date</div>
              </div>
            ))}
          </div>

          <footer className="border-t pt-2 text-center text-[10px] text-gray-500">Draft wording for doctor review · generated by VetechIQ</footer>
        </article>
      </div>
    </div>
  );
}
