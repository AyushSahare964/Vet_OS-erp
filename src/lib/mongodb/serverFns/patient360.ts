import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Vaccination } from "@/lib/mongodb/models/Vaccination";
import { DewormingRecord } from "@/lib/mongodb/models/DewormingRecord";
import { BloodTest } from "@/lib/mongodb/models/BloodTest";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const FILES_MODULE = "patient_files";
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const last10 = (p: unknown) =>
  String(p ?? "")
    .replace(/\D/g, "")
    .slice(-10);

/**
 * Read-only aggregate for the Patient 360° profile. Every section is loaded
 * independently so one failing collection never blanks the whole profile —
 * failures come back in `errors` keyed by section.
 */
export const getPatient360Fn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ petId: z.string().min(1) }).parse(raw))
  .handler(tenantScoped(async ({ data }) => {
    await connectDB();
    const ctx = getTenantContext();
    if (!ctx?.tenantId) {
      throw new Error("Unauthorized: Tenant context required");
    }

    const isOid = mongoose.Types.ObjectId.isValid(data.petId);
    let pet = (await Pet.findOne({
      $or: [
        { petId: data.petId },
        ...(isOid ? [{ _id: data.petId }] : []),
      ],
    }).lean()) as any;

    let ownerDoc: any = null;

    if (!pet) {
      // 1. Support OTC Walk-in / Retail Counter sales
      if (/OTC-WALKIN|RETAIL-CLIENT|WALKIN/i.test(data.petId)) {
        const visits = await ClinicalVisit.find({
          $or: [
            { petId: data.petId },
            { petId: "OTC-WALKIN" },
            { petName: { $regex: /walk-?in/i } },
            { ownerName: { $regex: /walk-?in/i } },
          ],
        })
          .sort({ date: -1, createdAt: -1 })
          .limit(500)
          .lean();

        pet = {
          petId: data.petId,
          name: "OTC Walk-in Sales",
          species: "Direct Counter",
          breed: "Walk-in Customer",
          gender: "N/A",
          age: "Retail",
          ownerName: "Direct Counter Client",
          ownerPhone: "Counter Desk",
          ownerId: "WALK-IN",
          status: "Active",
        };

        ownerDoc = {
          ownerId: "WALK-IN",
          name: "Direct Counter Client",
          phone: "Counter Desk",
          email: "",
          address: "Hospital Reception / Pharmacy Counter",
        };

        return toPlain<any>({
          pet,
          owner: ownerDoc,
          otherPets: [],
          visits,
          appointments: [],
          vaccinations: [],
          dewormings: [],
          bloodTests: [],
          files: [],
          isWalkIn: true,
        });
      }

      // 2. Support searching or clicking an Owner directly (by ownerId or phone)
      ownerDoc = (await Owner.findOne({
        $or: [
          { ownerId: data.petId },
          { phone: data.petId },
          ...(isOid ? [{ _id: data.petId }] : []),
        ],
      }).lean()) as any;

      if (ownerDoc) {
        const ownerPets = await Pet.find({ ownerId: ownerDoc.ownerId }).lean();
        if (ownerPets.length > 0) {
          pet = ownerPets[0];
        } else {
          pet = {
            petId: ownerDoc.ownerId,
            name: `${ownerDoc.name} (Client Profile)`,
            species: "Client Account",
            breed: "Registered Owner",
            gender: ownerDoc.gender || "N/A",
            age: "Client",
            ownerId: ownerDoc.ownerId,
            ownerName: ownerDoc.name,
            ownerPhone: ownerDoc.phone,
            status: ownerDoc.status || "Active",
          };
        }
      }

      // 3. Support searching or clicking an invoiceNo or visitId
      if (!pet) {
        const visitMatch = (await ClinicalVisit.findOne({
          $or: [
            { invoiceNo: data.petId },
            { visitId: data.petId },
          ],
        }).lean()) as any;

        if (visitMatch) {
          if (visitMatch.petId && !/OTC-WALKIN/i.test(visitMatch.petId)) {
            pet = (await Pet.findOne({ petId: visitMatch.petId }).lean()) as any;
          }
          if (!pet) {
            pet = {
              petId: visitMatch.petId || "OTC-WALKIN",
              name: visitMatch.petName || "Walk-in Client",
              species: visitMatch.species || "Direct Counter",
              breed: visitMatch.breed || "Retail Client",
              gender: "N/A",
              age: "Retail",
              ownerId: visitMatch.ownerId || "CLIENT",
              ownerName: visitMatch.ownerName || "Counter Client",
              ownerPhone: visitMatch.ownerPhone || "N/A",
              status: "Active",
            };
          }
        }
      }
    }

    if (!pet) throw new Error(`Patient or Client record "${data.petId}" not found in this clinic`);

    const sections = {
      owner: () => (ownerDoc ? Promise.resolve(ownerDoc) : Owner.findOne({ ownerId: pet.ownerId }).lean()),
      otherPets: () =>
        Pet.find({ ownerId: pet.ownerId, petId: { $ne: pet.petId } })
          .select("petId name species breed gender status photoUrl")
          .lean(),
      visits: () =>
        ClinicalVisit.find({
          $or: [
            { petId: pet.petId },
            ...(pet.ownerId ? [{ ownerId: pet.ownerId }] : []),
          ],
        })
          .sort({ date: -1, createdAt: -1 })
          .limit(500)
          .lean(),
      appointments: async () => {
        const owner = (await Owner.findOne({ ownerId: pet.ownerId }).select("phone").lean()) as any;
        const rows = await ErpRow.find({
          moduleId: "appointments",
          $or: [
            { "data.petId": pet.petId },
            { "data.pet": { $regex: `^${escapeRx(pet.name)}$`, $options: "i" } },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(300)
          .lean();
        // Rows matched only by name must also belong to this owner, so a
        // same-named pet of another client never leaks into this profile.
        return rows
          .map((r: any) => r.data || {})
          .filter(
            (a: any) =>
              a.petId === pet.petId ||
              (!a.petId &&
                (a.ownerId === pet.ownerId ||
                  (last10(a.ownerPhone || a.phone) !== "" &&
                    last10(a.ownerPhone || a.phone) === last10(owner?.phone)))),
          );
      },
      vaccinations: () =>
        Vaccination.find({ patientId: pet.petId }).sort({ dateGiven: -1 }).limit(200).lean(),
      dewormings: () =>
        DewormingRecord.find({ patientId: pet.petId }).sort({ dateGiven: -1 }).limit(200).lean(),
      bloodTests: () =>
        BloodTest.find({ patientId: pet.petId }).sort({ orderedDate: -1 }).limit(100).lean(),
      files: () =>
        ErpRow.find({ moduleId: FILES_MODULE, "data.petId": pet.petId })
          .select({ "data.dataUrl": 0 })
          .sort({ createdAt: -1 })
          .lean()
          .then((rows: any[]) => rows.map((r) => r.data)),
    };

    const keys = Object.keys(sections) as (keyof typeof sections)[];
    const settled = await Promise.allSettled(keys.map((k) => sections[k]()));
    const result: Record<string, unknown> = { pet };
    const errors: Record<string, string> = {};
    settled.forEach((s, i) => {
      const key = keys[i]!;
      if (s.status === "fulfilled") result[key] = s.value;
      else {
        console.error(`[patient360] ${key} failed for ${pet.petId}:`, s.reason);
        errors[key] = String((s.reason as Error)?.message || s.reason);
      }
    });
    return toPlain<any>({ ...result, errors });
  }));

// ─── Patient documents & photos ──────────────────────────────────────────────

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
/** ~3 MB of file after base64 — keeps each upload under serverless body limits. */
const MAX_DATA_URL_CHARS = 4_100_000;

const AddPatientFileInputZ = z
  .object({
    petId: z.string().min(1),
    kind: z.enum(["document", "photo"]),
    category: z.string().max(80).default("Other"),
    name: z.string().min(1).max(200),
    mime: z.enum(ALLOWED_MIME as [string, ...string[]]),
    size: z.number().int().min(1),
    description: z.string().max(1000).optional(),
    date: z.string().optional(),
    uploadedBy: z.string().max(120).optional(),
    dataUrl: z.string().max(MAX_DATA_URL_CHARS, "File too large (max 3 MB)"),
    /** Small JPEG preview for photos, returned with the list so the gallery needs no per-image fetch. */
    thumbUrl: z.string().startsWith("data:image/").max(200_000).optional(),
  })
  .refine(
    (d) => d.dataUrl.startsWith(`data:${d.mime};base64,`),
    "File content does not match its type",
  );

export const addPatientFileFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => AddPatientFileInputZ.parse(raw))
  .handler(tenantScoped(async ({ data }) => {
    await connectDB();
    // Every file must hang off a real patient — never stored unassociated.
    if (!(await Pet.exists({ petId: data.petId })))
      throw new Error(`Patient ${data.petId} not found`);
    const fileId = `PF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const record = {
      ...data,
      fileId,
      date: data.date || new Date().toISOString().slice(0, 10),
      uploadedAt: new Date().toISOString(),
    };
    await ErpRow.create({ moduleId: FILES_MODULE, data: record });
    const { dataUrl: _omit, ...meta } = record;
    return toPlain<any>(meta);
  }));

export const getPatientFileFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ fileId: z.string().min(1) }).parse(raw))
  .handler(tenantScoped(async ({ data }) => {
    await connectDB();
    const row = (await ErpRow.findOne({
      moduleId: FILES_MODULE,
      "data.fileId": data.fileId,
    }).lean()) as any;
    if (!row) throw new Error("File not found");
    return toPlain<any>(row.data);
  }));

export const deletePatientFileFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ fileId: z.string().min(1) }).parse(raw))
  .handler(tenantScoped(async ({ data }) => {
    await connectDB();
    await ErpRow.deleteOne({ moduleId: FILES_MODULE, "data.fileId": data.fileId });
    return { success: true };
  }));

