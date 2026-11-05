import { createServerFn } from "@tanstack/react-start";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Vaccination } from "@/lib/mongodb/models/Vaccination";
import { DewormingRecord } from "@/lib/mongodb/models/DewormingRecord";
import { Pet } from "@/lib/mongodb/models/Pet";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

export type Kind = "VACCINE" | "DEWORMING";
const VAC_RX = /vaccin|rabies|nobivac|dhpp|dapp|parvo|kennel\s*cough|tri-?cat|all-in-1|in\s*1\b/i;
const DEW_RX = /deworm|drontal|fenbendazole|praziquantel|albendazole|pyrantel|milbemycin/i;
const SERVICES = ["Vaccination", "Deworming", "Grooming"];
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
    const [visits, vacs, dews, pets, appts] = await Promise.all([
      ClinicalVisit.find({}).sort({ date: -1, createdAt: -1 }).limit(2000).lean() as Promise<any[]>,
      Vaccination.find({}).sort({ dateGiven: -1 }).limit(2000).lean() as Promise<any[]>,
      DewormingRecord.find({}).sort({ dateGiven: -1 }).limit(2000).lean() as Promise<any[]>,
      Pet.find({ $or: [{ nextVaccineDate: { $exists: true, $ne: "" } }, { nextDewormingDate: { $exists: true, $ne: "" } }] }).lean() as Promise<any[]>,
      ErpRow.find({ moduleId: "appointments", "data.type": { $in: SERVICES } }).sort({ createdAt: -1 }).limit(500).lean() as Promise<any[]>,
    ]);

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
        addDue({ ...base, kind, due: entry?.dueDate || legacy, setOn: date, source: "Consultation", by: v.doctorName, visitId: v.visitId });
      };
      set("VACCINE", fe.VACCINE, v.nextVaccineDate);
      set("DEWORMING", fe.DEWORMING, v.nextDewormingDate);

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
      const k = `${h.petId}|${h.kind}|${h.date}|${String(h.name).toLowerCase()}`;
      return !seen.has(k) && seen.add(k);
    });
    const followUps = [...due.values()].filter(
      (d) => !uniq.some((h) => h.petId === d.petId && h.kind === d.kind && h.date > (d.setOn || "")),
    );

    const appointments = appts
      .map((a) => a.data || {})
      .filter((a) => !/cancel|completed|no-show/i.test(String(a.status || "")))
      .map((a) => ({ token: a.token, petId: a.petId, pet: a.pet, owner: a.owner, type: a.type, date: iso(a.appointment_date || a.date), time: a.time, status: a.status }));

    return JSON.parse(JSON.stringify({ followUps, history: uniq, appointments })) as {
      followUps: any[];
      history: any[];
      appointments: any[];
    };
  }),
);
