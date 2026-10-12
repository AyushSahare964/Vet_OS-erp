import { useState, useEffect } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { SECTIONS, type Section, type Pet } from "@/data/doctor/types";
import { HistoryPage } from "@/components/doctor/history/HistoryPage";
import { Placeholder } from "@/components/doctor/shared/Placeholder";
import { getPatient360Fn } from "@/lib/mongodb/serverFns/patient360";
import { adaptMongoPatientToDoctorPet } from "@/lib/doctor/realPatientAdapter";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/patient/$id/$section")({
  beforeLoad: ({ params }) => {
    if (!SECTIONS.includes(params.section as Section)) throw notFound();
  },
  component: HistoryRoute,
});

function HistoryRoute() {
  const { id, section } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState<Pet | null>(null);
  const [p360, setP360] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getPatient360Fn({ data: { petId: id } })
      .then((data) => {
        if (!active) return;
        if (data?.pet) {
          setP360(data);
          setPet(adaptMongoPatientToDoctorPet(data));
        } else {
          setPet(null);
          setP360(null);
        }
      })
      .catch((err) => {
        console.warn("[HistoryRoute] Database lookup error:", err);
        if (active) {
          setPet(null);
          setP360(null);
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
            Loading {section} records…
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

  return (
    <HistoryPage
      key={`${id}/${section}`}
      pet={pet}
      section={section as Section}
      p360={p360}
    />
  );
}
