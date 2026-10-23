import { useEffect, useMemo, useState } from "react";
import { FileSignature, Printer, Save, Search, RotateCcw } from "lucide-react";
import { toast } from "sonner";
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
import { saveDocRecordFn } from "@/lib/mongodb/serverFns/documentation";
import { DOC_TEMPLATES, type DocTemplate } from "./templates";
import { DocumentSheet, PRINT_CSS, type SheetData } from "./DocumentSheet";

/**
 * Forms, consents and certificates, filled from the selected patient, owner, doctor and clinic.
 * Every header cell and paragraph can be edited in place; Save stores the filled document under "Saved documents".
 * Wording is a draft for the doctor to review.
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
  // Manual edits made directly on the document; cleared when the patient / template changes
  const [hdrEdits, setHdrEdits] = useState<Record<string, string>>({});
  const [paraEdits, setParaEdits] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setHdrEdits({}), [pet?.petId]);
  useEffect(() => setParaEdits({}), [tpl.id]);

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

  const header: Record<string, string> = {
    patient: pet ? `${pet.name} (${pet.petId})` : "",
    species: pet ? `${pet.species}, ${pet.breed}` : "",
    sexAge: `${sex}${pet?.dob ? ` · DOB ${formatDisplayDate(pet.dob)}` : ""}`,
    owner: pet?.owner?.name ?? "",
    phone: pet?.owner?.phone ?? "",
    date: formatDisplayDate(todayIST()),
    address: `${pet?.owner?.address ?? ""}${pet?.owner?.city ? `, ${pet.owner.city}` : ""}`,
    microchip: `${pet?.microchipNo || ""}${pet?.weightKg ? ` · ${pet.weightKg} kg` : ""}`,
    ...hdrEdits,
  };
  const sheet: SheetData = {
    title: tpl.title,
    header,
    paragraphs: tpl.body.map((p, i) => paraEdits[i] ?? fill(p)),
    vaccines: vaccines.map((v) => ({
      name: String(v.name ?? ""),
      date: formatDisplayDate(v.date),
      batchNo: String(v.batchNo ?? ""),
      nextDue: v.nextDue ? formatDisplayDate(v.nextDue) : "",
      doctor: String(v.doctor ?? ""),
    })),
    vaccineTable: !!tpl.vaccineTable,
    signatures: tpl.signatures,
    doctor,
  };
  const edited = Object.keys(hdrEdits).length > 0 || Object.keys(paraEdits).length > 0;

  const save = async () => {
    if (!pet) return;
    setSaving(true);
    try {
      const res = await saveDocRecordFn({
        data: {
          templateId: tpl.id,
          title: tpl.title,
          petId: String(pet.petId ?? ""),
          petName: String(pet.name ?? ""),
          ownerName: header["owner"] ?? "",
          doctor,
          header,
          paragraphs: sheet.paragraphs,
          vaccines: sheet.vaccines,
          vaccineTable: sheet.vaccineTable,
          signatures: sheet.signatures,
        },
      });
      toast.success(`Saved as ${res.docNo} — find it under Saved documents.`);
    } catch (e: any) {
      toast.error(e.message || "Could not save the document.");
    } finally {
      setSaving(false);
    }
  };

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
          <p className="text-xs text-muted-foreground">
            Click any field or paragraph on the form to edit it, then Save. Draft wording: the doctor should review each form before it is used.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {edited && (
              <Button variant="ghost" size="sm" onClick={() => { setHdrEdits({}); setParaEdits({}); }} className="gap-1.5 text-xs">
                <RotateCcw className="size-3.5" /> Reset edits
              </Button>
            )}
            <Button onClick={save} disabled={!pet || saving} className="gap-1.5">
              <Save className="size-4" /> {saving ? "Saving…" : "Save document"}
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!pet} className="gap-1.5">
              <Printer className="size-4" /> Print / PDF
            </Button>
          </div>
        </div>

        <DocumentSheet
          clinic={clinic}
          data={sheet}
          onHeader={(k, v) => setHdrEdits((e) => ({ ...e, [k]: v }))}
          onParagraph={(i, v) => setParaEdits((e) => ({ ...e, [i]: v }))}
          emptyVaccineMessage={pet ? "No vaccination records found for this patient." : "Select a patient to fill the vaccine history."}
        />
      </div>
    </div>
  );
}
