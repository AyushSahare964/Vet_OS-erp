import { useState, useEffect, lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { useErp } from "@/lib/erp/store";
import { ROLES, ROLE_ORDER } from "@/lib/erp/config";
import { cn } from "@/lib/utils";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { AdmitPatientPickerModal } from "@/components/erp/clinical/AdmitPatientPickerModal";
import { listVisitsFn, deleteVisitFn } from "@/lib/mongodb/serverFns/clinical";
import { toast } from "sonner";
import { ClinicHome } from "./ClinicHome";

/** The original home dashboard (moved unchanged from src/routes/index.tsx; only the Shell title is a prop). */
export function ClinicDashboard({ title = "Clinic Dashboard" }: { title?: string }) {
  const { role, roleId, currentUser } = useErp();
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role.person || "Dr. Rohit Sharma");

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showAdmitPickerModal, setShowAdmitPickerModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  // OPD Queue State
  const [visits, setVisits] = useState<any[]>([]);

  useEffect(() => {
    void loadVisits();
    // 30-second poll — frequent enough to stay fresh without hammering the DB
    const interval = setInterval(() => {
      void loadVisits();
    }, 30_000);
    return () => clearInterval(interval);
  }, [roleId]);

  const loadVisits = async () => {
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
      const data = await Promise.race([listVisitsFn(), timeout]);
      if (data !== null) setVisits(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartConsultation = (visit: any) => {
    setSelectedVisit({ ...visit, doctorName: visit.doctorName || activeDoctorName });
    setShowVisitModal(true);
  };

  const handleDeleteVisit = async (v: any) => {
    if (!window.confirm(`Are you sure you want to delete visit ${v.visitId} for ${v.petName || "patient"}?`)) {
      return;
    }
    try {
      await deleteVisitFn({ data: { visitId: v.visitId } });
      toast.success(`Removed visit ${v.visitId}`);
      setVisits((prev) => prev.filter((item) => item.visitId !== v.visitId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove visit");
    }
  };

  const handleOpenAdmitPatientPicker = () => {
    setShowAdmitPickerModal(true);
  };

  const handleAdmitPetDirectly = (pet: any) => {
    const existingActiveVisit = visits.find(
      (v) =>
        v.petId === pet.petId &&
        v.status !== "Paid" &&
        v.status !== "Settled" &&
        v.status !== "Completed"
    );
    if (existingActiveVisit) {
      handleStartConsultation(existingActiveVisit);
      return;
    }

    const newVisitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: pet.petId,
      petName: pet.name,
      species: pet.species,
      breed: pet.breed,
      ownerId: pet.owner?.ownerId || pet.ownerId,
      ownerName: pet.owner?.name || "Client",
      ownerPhone: pet.owner?.phone || "N/A",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: pet.weightKg || 25,
        tempC: 38.5,
        complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "OPD Consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };
    setSelectedVisit(newVisitDraft);
    setShowVisitModal(true);
  };

  return (
    <Shell title={title}>
      <div className="mx-auto max-w-[1680px] space-y-7">
        {/* One short dashboard for every role (blocks appear only for modules the role already has) */}
        <ClinicHome />

        {/* Admit Patient Appointment & Queue Selector Modal */}
        <AdmitPatientPickerModal
          open={showAdmitPickerModal}
          onClose={() => setShowAdmitPickerModal(false)}
          onSelectPatient={(visitDraft) => {
            setSelectedVisit(visitDraft);
            setShowVisitModal(true);
          }}
        />

        {/* Multi-Pet Owner CRM Modal */}
        <OwnerPetRegistrationModal
          open={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          onRegistered={() => {
            void loadVisits();
          }}
          onAdmitToOpd={(pet, owner) => {
            const newVisitDraft = {
              visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
              invoiceNo: `INV/2026-27/090${Math.floor(10 + Math.random() * 90)}`,
              prescriptionNo: `RX-090${Math.floor(10 + Math.random() * 90)}`,
              date: new Date().toISOString().slice(0, 10),
              branch: "Main Clinic",
              billType: "GST",
              petId: pet.petId,
              petName: pet.name,
              species: pet.species,
              breed: pet.breed,
              ownerId: owner?.ownerId || pet.ownerId,
              ownerName: owner?.name || "Client",
              ownerPhone: owner?.phone || "N/A",
              doctorName: activeDoctorName,
              vitals: {
                weightKg: pet.weightKg || 25,
                tempC: 38.5,
                complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "OPD Consultation",
              },
              status: "Admitted",
              items: [],
              subtotal: 0,
              totalAmount: 0,
              amountPaid: 0,
            };
            setSelectedVisit(newVisitDraft);
            setShowVisitModal(true);
          }}
        />


        {/* Connected Clinical Consultation & Billing Workspace Modal */}
        {selectedVisit && (
          <VisitWorkspaceModal
            open={showVisitModal}
            onClose={() => {
              setShowVisitModal(false);
              setSelectedVisit(null);
              void loadVisits();
            }}
            visit={selectedVisit}
            onVisitFinalized={(updatedVisit) => {
              if (updatedVisit) {
                setSelectedVisit(updatedVisit);
                setVisits((prev) => prev.map((v) => (v.visitId === updatedVisit.visitId ? updatedVisit : v)));
              }
              void loadVisits();
            }}
          />
        )}
      </div>
    </Shell>
  );
}
