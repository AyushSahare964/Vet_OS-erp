import { formatDisplayDate } from "@/lib/utils/dateUtils";

/**
 * Values for a form's "details" fields, taken from one of the patient's own visits (diagnosis, bill, prescription).
 * Keys match the DocField keys in templates.ts; a field the visit has nothing for is simply left out.
 */
const money = (n: unknown) => Number(n ?? 0).toLocaleString("en-IN");
const join = (xs: unknown[]) => xs.map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");

export function visitLabel(v: any): string {
  return `${formatDisplayDate(v.date)} · ${v.diagnosis || v.vitals?.complaint || v.prescriptionData?.symptomsText || "Consultation"}`;
}

export function autoFromVisit(v: any | undefined): Record<string, string> {
  if (!v) return {};
  const rx = v.prescriptionData ?? {};
  const items: any[] = v.items ?? [];
  const diagnosis = String(v.diagnosis || rx.symptomsText || v.vitals?.complaint || "").trim();
  const procedures = items.filter((i) => i.lineType === "Procedure" || i.lineType === "Diagnostic").map((i) => i.name);
  const meds = [...(rx.prescribedMedicines ?? []), ...(rx.immediateMedicines ?? [])].map((m: any) => m.medicineName);
  const injections = (rx.injectables ?? []).map((m: any) => m.name);
  const treated = join(items.filter((i) => i.lineType !== "Consultation").map((i) => i.name));
  const total = Number(v.totalAmount ?? 0);
  const out: Record<string, string> = {
    visitDate: v.date ?? "",
    examDate: v.date ?? "",
    admitDate: v.date ?? "",
    diagnosis,
    condition: diagnosis,
    reason: diagnosis,
    findings: join([...(rx.clinicalFindings ?? []), rx.clinicalFindingsOther, v.clinicalNotes]),
    procedure: join(procedures),
    plan: join([...meds, ...injections]),
    recommended: join([...meds, ...injections, ...procedures]),
    treatment: treated,
    treatmentCharges: treated ? `${treated}. Total charges: Rs ${money(total)}` : "",
    cost: total ? String(total) : "",
    advance: v.amountPaid ? String(v.amountPaid) : "",
  };
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x));
}
