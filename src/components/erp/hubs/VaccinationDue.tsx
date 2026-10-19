import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

const todayIso = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const days = (iso: string) => Math.round((new Date(iso).getTime() - new Date(todayIso()).getTime()) / 86400000);
type Row = { pet: any; due: string; d: number };

function DueTable({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <div className="erp-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {rows.map(({ pet, due, d }) => (
            <tr key={pet.petId}>
              <td className="px-4 py-2.5 font-semibold">
                {pet.name} <span className="font-normal text-muted-foreground">· {pet.breed}</span>
              </td>
              <td className="px-4 py-2.5">
                {pet.owner?.name} <span className="text-muted-foreground">{pet.owner?.phone}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatDisplayDate(due) || due}</td>
              <td className="px-4 py-2.5">
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", d < 0 ? "bg-warning-soft text-warning" : "bg-primary/10 text-primary")}>
                  {d < 0 ? `Overdue ${-d}d` : d === 0 ? "Due today" : `Due in ${d}d`}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  to="/m/$moduleId"
                  params={{ moduleId: "crm-pets" }}
                  search={{ petId: pet.petId, petName: pet.name } as never}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open patient
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Vaccination and deworming due / overdue, from the patient records the CRM already loads (nextVaccineDate / nextDewormingDate). */
export function VaccinationDue() {
  const [pets, setPets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listPetsWithOwnersFn()
      .then((p) => setPets(p ?? []))
      .catch(() => setPets([]))
      .finally(() => setLoading(false));
  }, []);

  const lists = useMemo(() => {
    const build = (field: string): Row[] =>
      pets
        .filter((p) => p[field] && days(String(p[field]).slice(0, 10)) <= 30 && p.status !== "Deceased")
        .map((pet) => ({ pet, due: String(pet[field]).slice(0, 10), d: days(String(pet[field]).slice(0, 10)) }))
        .sort((a, b) => a.d - b.d);
    return { vac: build("nextVaccineDate"), dew: build("nextDewormingDate") };
  }, [pets]);

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading patient records…</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {lists.vac.filter((r) => r.d < 0).length} vaccinations and {lists.dew.filter((r) => r.d < 0).length} dewormings overdue · showing everything due in the next 30 days.
      </p>
      <DueTable title="Vaccination — overdue and due soon" rows={lists.vac} empty="No vaccinations due." />
      <DueTable title="Deworming — overdue and due soon" rows={lists.dew} empty="No dewormings due." />
    </div>
  );
}
