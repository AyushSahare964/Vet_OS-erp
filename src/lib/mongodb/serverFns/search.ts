import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { Vaccination } from "@/lib/mongodb/models/Vaccination";
import { BloodTest } from "@/lib/mongodb/models/BloodTest";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { User } from "@/lib/mongodb/models/User";

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface MasterSearchResultItem {
  key: string;
  petId: string;
  section?: "medical" | "lab" | "purchase" | "vaccine" | "deworm" | undefined;
  toModule?: string | undefined;
  icon: "paw" | "clock" | "medical" | "lab" | "purchase" | "vaccine" | "deworm" | "pharmacy";
  title: string;
  sub: string;
  tag: string;
}

export interface MasterSearchResultGroup {
  heading: string;
  items: MasterSearchResultItem[];
}

export const searchMasterFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({
      q: z.string().default(""),
    }).parse(raw)
  )
  .handler(
    tenantScoped(async ({ data }): Promise<MasterSearchResultGroup[]> => {
      await connectDB();
      const ctx = getTenantContext();
      if (!ctx?.tenantId) {
        return [];
      }
      const rawQ = (data?.q ?? "").trim();

      // ─── If query is empty: Return recent real patients from this tenant ───
      if (!rawQ) {
        // Find recent clinical visits or pets in this tenant
        const recentVisits = await ClinicalVisit.find({})
          .sort({ date: -1, createdAt: -1 })
          .limit(8)
          .lean();

        const seenPetIds = new Set<string>();
        const recentItems: MasterSearchResultItem[] = [];

        for (const v of recentVisits) {
          if (!v.petId || seenPetIds.has(v.petId)) continue;
          seenPetIds.add(v.petId);
          recentItems.push({
            key: `recent-${v.petId}`,
            petId: v.petId,
            icon: "clock",
            title: v.petName || "Patient",
            sub: `${v.breed || v.species || "Pet"} · Owner ${v.ownerName || "Client"} (${v.ownerPhone || ""})`,
            tag: v.species || "Pet",
          });
          if (recentItems.length >= 4) break;
        }

        // If no visits yet, fetch recently registered pets
        if (recentItems.length < 3) {
          const recentPets = await Pet.find({})
            .sort({ createdAt: -1 })
            .limit(4)
            .lean();
          const ownerIds = recentPets.map((p) => p.ownerId).filter(Boolean);
          const owners = await Owner.find({ ownerId: { $in: ownerIds } }).lean();
          const ownerMap = new Map(owners.map((o) => [o.ownerId, o]));

          for (const p of recentPets) {
            if (seenPetIds.has(p.petId)) continue;
            seenPetIds.add(p.petId);
            const owner = ownerMap.get(p.ownerId);
            recentItems.push({
              key: `recent-pet-${p.petId}`,
              petId: p.petId,
              icon: "clock",
              title: p.name,
              sub: `${p.breed || p.species || "Pet"} · Owner ${owner?.name || "Client"}`,
              tag: p.species || "Pet",
            });
            if (recentItems.length >= 4) break;
          }
        }

        return recentItems.length > 0
          ? [{ heading: "Recent searches", items: recentItems }]
          : [];
      }

      // ─── Non-empty query: Fast multi-collection parallel search ───────────
      const safePattern = escapeRx(rawQ);
      const rx = new RegExp(safePattern, "i");

      const [
        pets,
        owners,
        visits,
        invoices,
        items,
        vaccinations,
        bloodTests,
      ] = await Promise.all([
        // 1. Patients / Pets
        Pet.find({
          $or: [
            { name: rx },
            { petId: rx },
            { breed: rx },
            { species: rx },
            { microchipNo: rx },
          ],
        })
          .limit(6)
          .lean(),

        // 2. Owners / Clients
        Owner.find({
          $or: [
            { name: rx },
            { phone: rx },
            { email: rx },
            { ownerId: rx },
          ],
        })
          .limit(4)
          .lean(),

        // 3. Clinical Medical Visits
        ClinicalVisit.find({
          $or: [
            { visitId: rx },
            { diagnosis: rx },
            { symptomsText: rx },
            { "vitals.complaint": rx },
          ],
        })
          .sort({ date: -1 })
          .limit(5)
          .lean(),

        // 4. Invoices / Bills
        ClinicalVisit.find({
          $or: [
            { invoiceNo: rx },
            { prescriptionNo: rx },
          ],
        })
          .sort({ date: -1 })
          .limit(5)
          .lean(),

        // 5. Pharmacy Medicines / Inventory Items
        InventoryItem.find({
          $or: [
            { name: rx },
            { itemCode: rx },
            { genericName: rx },
          ],
        })
          .limit(4)
          .lean(),

        // 6. Vaccinations
        Vaccination.find({
          $or: [
            { vaccineType: rx },
            { vaccinationId: rx },
          ],
        })
          .limit(3)
          .lean(),

        // 7. Blood Tests / Lab Reports
        BloodTest.find({
          $or: [
            { testType: rx },
            { testId: rx },
          ],
        })
          .limit(3)
          .lean(),
      ]);

      const groups: MasterSearchResultGroup[] = [];

      // ── Groups 1: Pets & Patients ──
      const ownerIdsForPets = pets.map((p) => p.ownerId).filter(Boolean);
      const petOwners = await Owner.find({ ownerId: { $in: ownerIdsForPets } }).lean();
      const petOwnerMap = new Map(petOwners.map((o) => [o.ownerId, o]));

      const petResults: MasterSearchResultItem[] = pets.map((p) => {
        const owner = petOwnerMap.get(p.ownerId);
        const parts = [p.breed || p.species];
        if (p.age) parts.push(p.age);
        if (owner?.name) parts.push(`Owner ${owner.name}`);
        if (owner?.phone) parts.push(owner.phone);

        return {
          key: `pet-${p.petId}`,
          petId: p.petId,
          icon: "paw",
          title: p.name,
          sub: parts.filter(Boolean).join(" · "),
          tag: p.species || "Pet",
        };
      });

      // Also append Owners if found
      if (owners.length > 0) {
        const ownerIds = owners.map((o) => o.ownerId);
        const ownerPets = await Pet.find({ ownerId: { $in: ownerIds } }).lean();
        const ownerPetsMap = new Map<string, any[]>();
        for (const op of ownerPets) {
          const list = ownerPetsMap.get(op.ownerId) || [];
          list.push(op);
          ownerPetsMap.set(op.ownerId, list);
        }

        for (const o of owners) {
          const linkedPets = ownerPetsMap.get(o.ownerId) || [];
          const firstPet = linkedPets[0];
          petResults.push({
            key: `owner-${o.ownerId}`,
            petId: firstPet?.petId || o.ownerId,
            icon: "paw",
            title: o.name,
            sub: `Client (${o.phone || "No phone"}) · Pets: ${
              linkedPets.map((p) => p.name).join(", ") || "None registered"
            }`,
            tag: "Owner",
          });
        }
      }

      // 1b. Support OTC Walk-in / Counter search
      if (/otc|walk|counter|retail/i.test(rawQ)) {
        petResults.push({
          key: "otc-walkin-client",
          petId: "OTC-WALKIN",
          icon: "paw",
          title: "OTC Walk-in Sales",
          sub: "Direct over-the-counter sales & client invoices",
          tag: "Walk-in",
        });
      }

      if (petResults.length > 0) {
        groups.push({
          heading: "Pets and owners",
          items: petResults.slice(0, 6),
        });
      }

      // ── Group 2: Medical & Consultations ──
      if (visits.length > 0) {
        groups.push({
          heading: "Medical & Clinical Consultations",
          items: visits.map((v) => ({
            key: `visit-${v.visitId}`,
            petId: v.petId,
            section: "medical",
            icon: "medical",
            title: `${v.petName || "Patient"} · ${
              v.diagnosis || v.vitals?.complaint || "OPD Consultation"
            }`,
            sub: `${/^dr\.?\s/i.test(String(v.doctorName || "")) ? v.doctorName : `Dr. ${v.doctorName || "Attending Vet"}`} · ${v.date || ""}`,
            tag: "Medical",
          })),
        });
      }

      // ── Group 3: Invoices & Purchases ──
      if (invoices.length > 0) {
        groups.push({
          heading: "Invoices & Purchases",
          items: invoices.map((inv) => ({
            key: `inv-${inv.invoiceNo}`,
            petId: inv.petId,
            section: "purchase",
            icon: "purchase",
            title: `${inv.petName || "Patient"} · Invoice ${inv.invoiceNo}`,
            sub: `₹${(inv.totalAmount || 0).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })} · ${inv.paymentStatus || inv.status || "Billed"} · ${inv.date || ""}`,
            tag: "Purchase",
          })),
        });
      }

      // ── Group 4: Laboratory & Blood Tests ──
      if (bloodTests.length > 0) {
        groups.push({
          heading: "Laboratory Diagnostics",
          items: bloodTests.map((b) => ({
            key: `lab-${b.testId}`,
            petId: b.patientId,
            section: "lab",
            icon: "lab",
            title: `Lab Test · ${b.testType}`,
            sub: `Ordered ${b.orderedDate} · Status: ${b.status}`,
            tag: "Laboratory",
          })),
        });
      }

      // ── Group 5: Vaccinations ──
      if (vaccinations.length > 0) {
        groups.push({
          heading: "Vaccination Records",
          items: vaccinations.map((vac) => ({
            key: `vac-${vac.vaccinationId}`,
            petId: vac.patientId,
            section: "vaccine",
            icon: "vaccine",
            title: `${vac.vaccineType} Vaccine`,
            sub: `Given: ${vac.dateGiven} · Due: ${vac.nextDueDate}`,
            tag: "Vaccine",
          })),
        });
      }

      // ── Group 6: Pharmacy & Medicines ──
      if (items.length > 0) {
        groups.push({
          heading: "Pharmacy & Inventory",
          items: items.map((it) => ({
            key: `item-${it.itemCode}`,
            petId: "",
            toModule: "inventory",
            icon: "pharmacy",
            title: it.name,
            sub: `${it.itemCode} · Stock: ${it.currentStock ?? 0} ${
              it.unit || "units"
            } · ₹${it.salePrice || it.mrp || 0}`,
            tag: "Pharmacy",
          })),
        });
      }

      // ── Group 7+: everything else the clinic keeps (all tenant-scoped like the groups above) ──
      const [salesDocs, purchaseBills, suppliers, appts, labOrders, files, staff] = await Promise.all([
        SalesDocModel.find({ docType: { $in: ["INVOICE", "CREDIT_NOTE", "QUOTATION"] }, $or: [{ docNumber: rx }, { partyName: rx }, { animalName: rx }] }).sort({ docDate: -1 }).limit(4).lean(),
        PurchaseBillModel.find({ $or: [{ internalRef: rx }, { billNumber: rx }, { supplierName: rx }] }).sort({ billDate: -1 }).limit(4).lean(),
        SupplierModel.find({ $or: [{ name: rx }, { contactPerson: rx }, { mobileNo: rx }, { city: rx }] }).limit(3).lean(),
        ErpRow.find({ moduleId: "appointments", $or: [{ "data.pet": rx }, { "data.owner": rx }, { "data.ownerPhone": rx }, { "data.doctor": rx }, { "data.token": rx }] }).sort({ createdAt: -1 }).limit(4).lean(),
        ErpRow.find({ moduleId: "lab_orders", $or: [{ "data.orderId": rx }, { "data.pet": rx }, { "data.testName": rx }, { "data.owner": rx }] }).sort({ createdAt: -1 }).limit(4).lean(),
        ErpRow.find({ moduleId: "patient_files", $or: [{ "data.name": rx }, { "data.category": rx }, { "data.description": rx }] }).select("-data.dataUrl -data.thumbUrl").limit(3).lean(),
        // staff names are an Admin-only lookup (same rule as the Staff page)
        ctx.roleId === "admin"
          ? User.find({ isSystemAccount: { $ne: true }, $or: [{ fullName: rx }, { email: rx }, { roleName: rx }, { phone: rx }] }).limit(3).lean()
          : Promise.resolve([] as any[]),
      ]);
      const more = (heading: string, list: MasterSearchResultItem[]) => list.length > 0 && groups.push({ heading, items: list });
      const inr2 = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;
      more("Billing documents", salesDocs.map((d: any) => ({
        key: `sd-${d.docNumber || d._id}`, petId: "", toModule: "billing", icon: "purchase",
        title: `${d.docType === "QUOTATION" ? "Quotation" : d.docType === "CREDIT_NOTE" ? "Credit note" : "Invoice"} ${d.docNumber}`,
        sub: `${d.partyName || "Client"}${d.animalName ? ` · ${d.animalName}` : ""} · ${inr2(d.grandTotal)} · ${d.paymentStatus || ""} · ${d.docDate || ""}`, tag: "Billing",
      })));
      more("Purchase bills", purchaseBills.map((b: any) => ({
        key: `pb-${b._id}`, petId: "", toModule: "purchases", icon: "purchase",
        title: `Purchase bill ${b.billNumber}`, sub: `${b.supplierName} · ${inr2(b.grandTotal)} · ${b.status} · ${b.billDate || ""}`, tag: "Purchase",
      })));
      more("Suppliers", suppliers.map((x: any) => ({
        key: `sup-${x._id}`, petId: "", toModule: "suppliers", icon: "pharmacy",
        title: x.name, sub: [x.contactPerson, x.mobileNo, x.city].filter(Boolean).join(" · "), tag: "Supplier",
      })));
      more("Appointments", appts.map((r: any) => ({
        key: `ap-${r._id}`, petId: "", toModule: "appointments", icon: "clock",
        title: `${r.data?.pet || "Patient"} · ${r.data?.type || "Appointment"}`,
        sub: `${r.data?.appointment_date || r.data?.date || ""} ${r.data?.time || ""} · ${r.data?.doctor || ""} · ${r.data?.status || ""}`, tag: "Appointment",
      })));
      more("Lab orders", labOrders.map((r: any) => ({
        key: `lo-${r._id}`, petId: "", toModule: "laboratory", icon: "lab",
        title: `${r.data?.testName || r.data?.test || "Lab order"} · ${r.data?.pet || ""}`,
        sub: `${r.data?.orderId || ""} · ${r.data?.status || ""} · ${r.data?.date || ""}`, tag: "Laboratory",
      })));
      more("Documents", files.map((r: any) => ({
        key: `doc-${r.data?.fileId || r._id}`, petId: String(r.data?.petId || ""), icon: "medical",
        title: String(r.data?.name || "Document"), sub: `${r.data?.category || ""} · ${r.data?.date || ""}`, tag: "Document",
      })));
      more("Staff", staff.map((u: any) => ({
        key: `staff-${u._id}`, petId: "", toModule: "identity", icon: "paw",
        title: u.fullName, sub: `${u.roleName || u.roleId} · ${u.email}`, tag: "Staff",
      })));

      return groups;
    })
  );

export interface DoctorHomeStats {
  totalPatients: number;
  totalVisits: number;
  totalClients: number;
  totalVaccinations: number;
}

export const getDoctorHomeStatsFn = createServerFn({ method: "GET" })
  .handler(
    tenantScoped(async (): Promise<DoctorHomeStats> => {
      await connectDB();
      const ctx = getTenantContext();
      if (!ctx?.tenantId) {
        return {
          totalPatients: 0,
          totalVisits: 0,
          totalClients: 0,
          totalVaccinations: 0,
        };
      }

      const [totalPatients, totalVisits, totalClients, totalVaccinations] = await Promise.all([
        Pet.countDocuments({}),
        ClinicalVisit.countDocuments({}),
        Owner.countDocuments({}),
        Vaccination.countDocuments({}),
      ]);

      return {
        totalPatients,
        totalVisits,
        totalClients,
        totalVaccinations,
      };
    })
  );
