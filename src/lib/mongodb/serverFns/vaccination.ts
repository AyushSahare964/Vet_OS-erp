import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Vaccination } from "@/lib/mongodb/models/Vaccination";
import { DewormingRecord } from "@/lib/mongodb/models/DewormingRecord";
import { Pet } from "@/lib/mongodb/models/Pet";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

export type Kind = "VACCINE" | "DEWORMING";
const SERVICE_KIND: Record<string, string> = { Vaccination: "VACCINE", Deworming: "DEWORMING", Grooming: "GROOMING" };
const VAC_RX = /vaccin|rabies|nobivac|dhpp|dapp|parvo|kennel\s*cough|tri-?cat|all-in-1|in\s*1\b/i;
const DEW_RX = /deworm|drontal|fenbendazole|praziquantel|albendazole|pyrantel|milbemycin/i;
const SERVICES = ["Vaccination", "Deworming", "Grooming"];
const DISMISS_MODULE = "vaccination_dismissed";
const HIDDEN_HISTORY_MODULE = "vaccination_history_hidden";
const DATE_EDIT_MODULE = "vaccination_date_edits";
const historyKey = (h: any) => `${h.petId}|${h.kind}|${h.date}|${String(h.name).toLowerCase()}`;
const iso = (d: unknown) => String(d ?? "").slice(0, 10);

/**
 * One read for the Vaccination & Deworming page:
 *  - followUps: follow-up dates registered in consultation (visit.prescriptionData.followUpEntries / next*Date),
 *    plus dates on the pet / vaccination records, minus anything already administered since
 *  - history: every vaccine / deworming actually given (records + billed visit items)
 *  - appointments: upcoming Vaccination / Deworming / Grooming bookings
 */
export const getVaccinationBoardFn = createServerFn({ method: "GET" }).handler(
  tenantScoped(async () => {
    await connectDB();
    const [visits, vacs, dews, pets, appts, dismissals, hiddenRows, editRows] = await Promise.all([
      ClinicalVisit.find({}).sort({ date: -1, createdAt: -1 }).limit(2000).lean() as Promise<any[]>,
      Vaccination.find({}).sort({ dateGiven: -1 }).limit(2000).lean() as Promise<any[]>,
      DewormingRecord.find({}).sort({ dateGiven: -1 }).limit(2000).lean() as Promise<any[]>,
      Pet.find({ $or: [{ nextVaccineDate: { $exists: true, $ne: "" } }, { nextDewormingDate: { $exists: true, $ne: "" } }] }).lean() as Promise<any[]>,
      ErpRow.find({ moduleId: "appointments", "data.type": { $in: SERVICES } }).sort({ createdAt: -1 }).limit(500).lean() as Promise<any[]>,
      ErpRow.find({ moduleId: DISMISS_MODULE }).lean() as Promise<any[]>,
      ErpRow.find({ moduleId: HIDDEN_HISTORY_MODULE }).lean() as Promise<any[]>,
      ErpRow.find({ moduleId: DATE_EDIT_MODULE }).lean() as Promise<any[]>,
    ]);
    // staff-corrected dates, keyed by the original (derived) date so a newer doctor-set date wins again
    const edits = new Map(editRows.map((r) => [String(r.data?.key), String(r.data?.to)]));
    const hidden = new Set(hiddenRows.map((r) => historyKey(r.data || {})));
    const dismissed = new Set(dismissals.map((r) => `${r.data?.petId}|${r.data?.kind}|${r.data?.due}`));

    const history: any[] = [];
    const due = new Map<string, any>();
    const addDue = (d: any) => {
      const key = `${d.petId}|${d.kind}`;
      if (d.petId && iso(d.due) && !due.has(key)) due.set(key, { ...d, due: iso(d.due) });
    };

    // visits are newest-first, so the first follow-up seen per pet+kind is the latest one the doctor set
    for (const v of visits) {
      const base = { petId: v.petId, petName: v.petName, ownerName: v.ownerName, ownerPhone: v.ownerPhone };
      const date = iso(v.date || v.createdAt);
      const fe = v.prescriptionData?.followUpEntries || {};
      const set = (kind: Kind, entry: any, legacy?: string) => {
        if (entry && entry.enabled === false) return;
        addDue({ ...base, kind, due: entry?.dueDate || legacy, setOn: date, source: "Consultation", by: v.doctorName, visitId: v.visitId, note: entry?.notes, diagnosis: v.diagnosis, species: v.species, breed: v.breed });
      };
      // follow-ups of a consultation that is still a draft (billing not completed) are not due yet
      const finalized = v.inventoryDeducted || /^(paid|settled|closed|completed|billed|partial|unpaid|full)/i.test(String(v.status || ""));
      if (finalized) {
        set("VACCINE", fe.VACCINE, v.nextVaccineDate);
        set("DEWORMING", fe.DEWORMING, v.nextDewormingDate);
      }

      const lines = [
        ...(v.items || []).map((i: any) => ({ name: i.name, vaccine: i.lineType === "Vaccine" })),
        ...(v.prescriptionData?.injectables || []).map((i: any) => ({ name: i.name, vaccine: false })),
        ...(v.prescriptionData?.prescribedMedicines || []).map((i: any) => ({ name: i.medicineName || i.name, vaccine: false })),
      ];
      for (const l of lines) {
        const name = String(l.name || "");
        const kind: Kind | null = l.vaccine || VAC_RX.test(name) ? "VACCINE" : DEW_RX.test(name) ? "DEWORMING" : null;
        if (kind && base.petId) history.push({ ...base, kind, name, date, by: v.doctorName, source: "Consultation" });
      }
    }
    for (const p of pets) {
      const base = { petId: p.petId, petName: p.name, ownerName: p.ownerName, ownerPhone: p.ownerPhone };
      addDue({ ...base, kind: "VACCINE", due: p.nextVaccineDate, setOn: "", source: "Patient record" });
      addDue({ ...base, kind: "DEWORMING", due: p.nextDewormingDate, setOn: "", source: "Patient record" });
    }
    for (const [list, kind] of [[vacs, "VACCINE"], [dews, "DEWORMING"]] as const) {
      for (const r of list) {
        const petId = r.patientId || r.petId;
        const name = r.vaccineType || r.medicineName || r.dewormingType || (kind === "VACCINE" ? "Vaccine" : "Deworming");
        history.push({ petId, petName: r.petName, kind, name, date: iso(r.dateGiven), by: r.createdBy, source: "Vaccination record" });
        addDue({ petId, petName: r.petName, kind, due: r.nextDueDate, setOn: iso(r.dateGiven), source: "Last dose record" });
      }
    }

    // names for rows that only came from records
    const nameOf = new Map<string, any>();
    [...due.values(), ...history].forEach((x) => x.petName && nameOf.set(x.petId, x));
    history.forEach((h) => Object.assign(h, { petName: h.petName || nameOf.get(h.petId)?.petName, ownerName: h.ownerName || nameOf.get(h.petId)?.ownerName }));

    // dedupe history, then close follow-ups already given after they were registered
    const seen = new Set<string>();
    const uniq = history.filter((h) => {
      const k = historyKey(h);
      return !seen.has(k) && seen.add(k);
    });
    const appointments = appts
      .map((a) => a.data || {})
      .filter((a) => !/cancel|no-show/i.test(String(a.status || "")))
      .map((a) => ({ token: a.token, petId: a.petId, pet: a.pet, owner: a.owner, ownerPhone: a.ownerPhone, type: a.type, date: iso(a.appointment_date || a.date), time: a.time, status: a.status, notes: a.complaint }));

    // a booking marked Completed is a dose / service that was done: it belongs in history
    for (const a of appointments.filter((x) => /completed/i.test(String(x.status)))) {
      uniq.push({ petId: a.petId, petName: a.pet, ownerName: a.owner, ownerPhone: a.ownerPhone, kind: SERVICE_KIND[a.type], name: a.notes || a.type, date: a.date, source: "Appointment", token: a.token });
    }
    for (const d of due.values()) {
      const to = edits.get(`${d.petId}|${d.kind}|${d.due}`);
      if (to) Object.assign(d, { origDue: d.due, due: to });
    }
    const followUps = [...due.values()].filter(
      (d) => !dismissed.has(`${d.petId}|${d.kind}|${d.due}`) && !uniq.some((h) => h.petId === d.petId && h.kind === d.kind && h.date > (d.setOn || "")),
    );

    return JSON.parse(JSON.stringify({ followUps, history: uniq
        .filter((h) => !hidden.has(historyKey(h)))
        .map((h) => { const to = edits.get(historyKey(h)); return to ? { ...h, origDate: h.date, date: to } : h; }), appointments })) as {
      followUps: any[];
      history: any[];
      appointments: any[];
    };
  }),
);

/**
 * Admin-only: remove a follow-up from the Due & overdue list. The medical record is left untouched; the
 * follow-up only reappears if a doctor registers a different due date.
 */
export const dismissFollowUpFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ petId: z.string().min(1), kind: z.enum(["VACCINE", "DEWORMING"]), due: z.string().min(1) }).parse(raw),
  )
  .handler(
    tenantScoped(async ({ data }) => {
      if (getTenantContext()?.roleId !== "admin") throw new Error("Only an administrator can delete follow-ups");
      await connectDB();
      await ErpRow.create({ moduleId: DISMISS_MODULE, data });
      return true;
    }),
  );

/**
 * Admin-only: hide a history row (given from a consultation or vaccination record) from this page.
 * The medical record itself is left untouched.
 */
export const hideHistoryRowFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ petId: z.string().min(1), kind: z.string().min(1), date: z.string().min(1), name: z.string() }).parse(raw),
  )
  .handler(
    tenantScoped(async ({ data }) => {
      if (getTenantContext()?.roleId !== "admin") throw new Error("Only an administrator can delete history rows");
      await connectDB();
      await ErpRow.create({ moduleId: HIDDEN_HISTORY_MODULE, data });
      return true;
    }),
  );

/**
 * Correct the date of a follow-up (scope "due") or of a dose already given (scope "history") for one patient.
 * `from` is the original date (row.origDue / row.origDate when already edited). The source record is untouched;
 * the correction is stored on top and cleared by passing `to` equal to `from`.
 */
export const editVaccinationDateFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({
      scope: z.enum(["due", "history"]),
      petId: z.string().min(1),
      kind: z.string().min(1),
      name: z.string().optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(raw),
  )
  .handler(
    tenantScoped(async ({ data }) => {
      await connectDB();
      const key = data.scope === "due"
        ? `${data.petId}|${data.kind}|${data.from}`
        : historyKey({ petId: data.petId, kind: data.kind, date: data.from, name: data.name ?? "" });
      await ErpRow.deleteMany({ moduleId: DATE_EDIT_MODULE, "data.key": key });
      if (data.to !== data.from) await ErpRow.create({ moduleId: DATE_EDIT_MODULE, data: { key, to: data.to } });
      return true;
    }),
  );
