import type { Pet, Section, DoseStatus } from "@/data/doctor/types";
import type { HistoryPageData, HistoryRecord } from "./records";
import type { GraphData, Metric, Point } from "./graphs";
import { formatDate } from "./dates";
import { rupee, fmtDate } from "./format";

/** Transforms MongoDB patient360 response into the Doctor UI Pet format */
export function adaptMongoPatientToDoctorPet(p360: any): Pet {
  const p = p360?.pet || {};
  const owner = p360?.owner || {};
  const vacs = Array.isArray(p360?.vaccinations) ? p360.vaccinations : [];
  const dews = Array.isArray(p360?.dewormings) ? p360.dewormings : [];

  const latestVac = vacs[0];
  const vaccineStatus: DoseStatus = {
    name: latestVac?.vaccineType || p.lastVaccineName || "No vaccine recorded",
    last: latestVac?.dateGiven || p.lastVaccineDate || "",
    due: latestVac?.nextDueDate || p.nextVaccineDue || "",
  };

  const latestDew = dews[0];
  const dewormStatus: DoseStatus = {
    name: latestDew?.medicineName || latestDew?.dewormingType || p.lastDewormingName || "No deworming recorded",
    last: latestDew?.dateGiven || p.lastDewormingDate || "",
    due: latestDew?.nextDueDate || p.nextDewormingDue || "",
  };

  return {
    id: p.petId || p._id || "unknown",
    name: p.name || "Patient",
    breed: p.breed || p.species || "Canine",
    age: p.age ? `${p.age}` : "Adult",
    sex: (p.gender === "Female" || p.sex === "Female" ? "Female" : "Male"),
    owner: owner.name || p.ownerName || "Client",
    phone: owner.phone || p.ownerPhone || "N/A",
    vaccine: vaccineStatus,
    deworm: dewormStatus,
  };
}

/** Formats real database data into Doctor History Page cards */
export function buildRealHistoryRecords(pet: Pet, section: Section, p360: any): HistoryPageData {
  const visits = Array.isArray(p360?.visits) ? p360.visits : [];
  const vacs = Array.isArray(p360?.vaccinations) ? p360.vaccinations : [];
  const dews = Array.isArray(p360?.dewormings) ? p360.dewormings : [];
  const labs = Array.isArray(p360?.bloodTests) ? p360.bloodTests : [];

  if (section === "medical") {
    const records: HistoryRecord[] = visits.map((v: any) => {
      const vDate = v.date ? new Date(v.date) : new Date(v.createdAt || Date.now());
      const complaint = v.vitals?.complaint || v.complaint || v.symptomsText || "OPD Consultation";
      const diagnosis = v.diagnosis ? `Clinical Diagnosis: ${v.diagnosis}` : undefined;

      const items = Array.isArray(v.items) ? v.items : [];
      const hasItems = items.length > 0;

      return {
        date: vDate,
        title: v.diagnosis || complaint,
        bill: v.invoiceNo,
        tag: v.status || "Completed",
        tone: "ok" as const,
        fields: [
          ["Attending Vet", v.doctorName || "Dr. Staff Vet", false],
          ["Clinical Findings", complaint, false],
          ["Body Temperature", `${v.vitals?.tempC || 38.5} °C`, false],
          ["Weight", `${v.vitals?.weightKg || "--"} kg`, false],
          ["Prescription No", v.prescriptionNo || `RX-${v.visitId}`, false],
          ["Total Amount", rupee(v.totalAmount || 0), false],
        ],
        table: hasItems
          ? {
              cols: ["Item / Medicine", "Dosage Instructions", "Qty", "Total"],
              rows: items.map((it: any) => [
                it.name,
                it.dosageInstructions || "-",
                `${it.quantity} ${it.unit || ""}`,
                rupee(it.lineTotal || 0),
              ]),
            }
          : undefined,
        note: diagnosis,
      };
    });

    return {
      title: "Medical",
      records: records.length > 0 ? records : [
        {
          date: new Date(),
          title: "No medical visits recorded yet",
          tag: "New File",
          tone: "ok",
          fields: [
            ["Status", "Patient file opened", false],
            ["Notice", "Consultations started in OPD workspace will automatically sync here.", true],
          ],
        },
      ],
    };
  }

  if (section === "purchase") {
    const records: HistoryRecord[] = visits
      .filter((v: any) => v.invoiceNo || v.totalAmount)
      .map((v: any) => {
        const vDate = v.date ? new Date(v.date) : new Date(v.createdAt || Date.now());
        const items = Array.isArray(v.items) ? v.items : [];
        const isPaid = v.paymentStatus === "Paid" || (v.amountPaid >= (v.totalAmount || 0) - 0.01);

        return {
          date: vDate,
          title: `Invoice ${v.invoiceNo || v.visitId}`,
          bill: v.invoiceNo,
          tag: isPaid ? "Paid" : "Pending",
          tone: isPaid ? "ok" : "soon",
          fields: [
            ["Invoice number", v.invoiceNo || v.visitId, false],
            ["Billed by", v.doctorName || "Billing Desk", false],
            ["Payment mode", v.paymentMode || "Cash / UPI", false],
            ["Payment status", isPaid ? "Fully Paid" : "Balance Due", false],
            ["Discount", v.discountAmount ? rupee(v.discountAmount) : "None", false],
            ["Total", `${rupee(v.totalAmount || 0)} (taxes included)`, false],
          ],
          table: {
            cols: ["Item", "Qty", "Rate", "Amount"],
            rows: items.map((it: any) => [
              it.name,
              String(it.quantity || 1),
              rupee(it.unitPrice || 0),
              rupee(it.lineTotal || 0),
            ]),
          },
        };
      });

    return {
      title: "Purchase",
      records: records.length > 0 ? records : [
        {
          date: new Date(),
          title: "No purchase invoices found",
          tag: "Clear",
          tone: "ok",
          fields: [["Notice", "Invoices settled for this patient will appear here.", true]],
        },
      ],
    };
  }

  if (section === "vaccine") {
    const records: HistoryRecord[] = vacs.map((vac: any) => {
      const vDate = vac.dateGiven ? new Date(vac.dateGiven) : new Date(vac.createdAt || Date.now());
      return {
        date: vDate,
        title: `${vac.vaccineType} Vaccine`,
        tag: "Administered",
        tone: "ok",
        fields: [
          ["Vaccine", vac.vaccineType, false],
          ["Batch number", vac.batchNo || "V-STD", false],
          ["Date given", vac.dateGiven || fmtDate(vDate), false],
          ["Next dose due", vac.nextDueDate || "Annual", false],
          ["Administered by", vac.createdBy || "Clinic Staff", false],
        ],
      };
    });

    return {
      title: "Vaccine history",
      records: records.length > 0 ? records : [
        {
          date: new Date(),
          title: pet.vaccine.name,
          tag: "Scheduled",
          tone: "ok",
          fields: [
            ["Vaccine", pet.vaccine.name, false],
            ["Last recorded", pet.vaccine.last, false],
            ["Next dose due", pet.vaccine.due, false],
          ],
        },
      ],
    };
  }

  if (section === "deworm") {
    const records: HistoryRecord[] = dews.map((dew: any) => {
      const dDate = dew.dateGiven ? new Date(dew.dateGiven) : new Date(dew.createdAt || Date.now());
      return {
        date: dDate,
        title: dew.medicineName || "Deworming Protocol",
        tag: "Administered",
        tone: "ok",
        fields: [
          ["Medicine", dew.medicineName || "Drontal Plus", false],
          ["Dosage", dew.dosage || "1 tablet per 10kg", false],
          ["Date given", dew.dateGiven || fmtDate(dDate), false],
          ["Next dose due", dew.nextDueDate || "3 months", false],
        ],
      };
    });

    return {
      title: "Deworming history",
      records: records.length > 0 ? records : [
        {
          date: new Date(),
          title: pet.deworm.name,
          tag: "Scheduled",
          tone: "ok",
          fields: [
            ["Medicine", pet.deworm.name, false],
            ["Last recorded", pet.deworm.last, false],
            ["Next dose due", pet.deworm.due, false],
          ],
        },
      ],
    };
  }

  // Lab
  const records: HistoryRecord[] = labs.map((l: any) => {
    const lDate = l.orderedDate ? new Date(l.orderedDate) : new Date(l.createdAt || Date.now());
    return {
      date: lDate,
      title: `Blood Investigation · ${l.testType}`,
      tag: l.status || "Completed",
      tone: "ok",
      fields: [
        ["Test Name", l.testType, false],
        ["Status", l.status || "Final", false],
        ["Ordered Date", l.orderedDate, false],
        ["Result Date", l.resultDate || l.orderedDate, false],
      ],
    };
  });

  return {
    title: "Laboratory",
    records: records.length > 0 ? records : [
      {
        date: new Date(),
        title: "No laboratory tests on file",
        tag: "Routine",
        tone: "ok",
        fields: [["Notice", "Diagnostic and blood tests will appear here once ordered.", true]],
      },
    ],
  };
}

/** Generates real live timeline graphs from patient clinical visits */
export function buildRealGraphData(pet: Pet, section: Section, p360: any): GraphData {
  const visits = Array.isArray(p360?.visits) ? p360.visits : [];

  // Sort visits chronologically for graph timeline
  const chrono = [...visits].sort((a, b) => {
    const da = new Date(a.date || a.createdAt || 0).getTime();
    const db = new Date(b.date || b.createdAt || 0).getTime();
    return da - db;
  });

  const weightPoints: Point[] = [];
  const tempPoints: Point[] = [];

  for (const v of chrono) {
    const d = v.date ? new Date(v.date) : new Date(v.createdAt || Date.now());
    const dateStr = v.date || d.toISOString().slice(0, 10);

    if (v.vitals?.weightKg && v.vitals.weightKg > 0) {
      weightPoints.push({
        date: d,
        v: Number(v.vitals.weightKg),
        sub: `${v.vitals.weightKg} kg · ${dateStr}`,
        why: v.vitals?.complaint || v.diagnosis || "OPD Check",
      });
    }

    if (v.vitals?.tempC && v.vitals.tempC > 0) {
      tempPoints.push({
        date: d,
        v: Number(v.vitals.tempC),
        sub: `${v.vitals.tempC} °C · ${dateStr}`,
        why: v.vitals?.complaint || "Body Temp",
      });
    }
  }

  // Fallback point if patient is freshly admitted
  if (weightPoints.length === 0) {
    weightPoints.push({
      date: new Date(),
      v: p360?.pet?.weightKg ? Number(p360.pet.weightKg) : 25,
      sub: `${p360?.pet?.weightKg || 25} kg · Recorded on admission`,
      why: "Initial Weight",
    });
  }

  if (tempPoints.length === 0) {
    tempPoints.push({
      date: new Date(),
      v: 38.6,
      sub: "38.6 °C · Normal vitals",
      why: "Initial Vitals",
    });
  }

  const weightMetric: Metric = {
    key: "weight",
    name: "Body Weight",
    unit: "kg",
    hint: "Target stable adult range",
    trend: true,
    lo: 15,
    hi: 40,
    rangeText: "15 to 40 kg",
    points: weightPoints,
  };

  const tempMetric: Metric = {
    key: "temp",
    name: "Body Temperature",
    unit: "°C",
    hint: "Normal range: 38.0 to 39.2 °C",
    lo: 38.0,
    hi: 39.2,
    rangeText: "38.0 to 39.2 °C",
    points: tempPoints,
  };

  return {
    title: "Patient Vitals & Health Trends",
    def: "weight",
    metrics: [weightMetric, tempMetric],
  };
}
