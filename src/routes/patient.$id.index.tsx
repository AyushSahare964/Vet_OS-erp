import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PatientPage } from "@/components/doctor/patient/PatientPage";
import { Placeholder } from "@/components/doctor/shared/Placeholder";
import { getPatient360Fn } from "@/lib/mongodb/serverFns/patient360";
import { adaptMongoPatientToDoctorPet } from "@/lib/doctor/realPatientAdapter";
import type { Pet } from "@/data/doctor/types";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/patient/$id/")({
  component: PatientRoute,
});

function PatientRoute() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<Pet | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPatient360Fn({ data: { petId: id } })
      .then((p360) => {
        if (!active) return;
        if (p360?.pet) {
          setPet(adaptMongoPatientToDoctorPet(p360));
        } else {
          setPet(null);
        }
      })
      .catch((err) => {
        console.warn("[PatientRoute] Database lookup error:", err);
        if (active) {
          setPet(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground animate-pulse">
            Loading patient profile…
          </p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <Placeholder
        title="Patient not found"
        note={`No patient record found for ID "${id}" in this clinic.`}
      />
    );
  }

  return <PatientPage pet={pet} />;
}
