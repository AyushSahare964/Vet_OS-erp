import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Stethoscope, RefreshCw, Pill } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/erp/StatusPill";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { listAppointmentsFn, updateAppointmentStatusFn } from "@/lib/mongodb/serverFns/appointments";
import { listVisitsFn } from "@/lib/mongodb/serverFns/clinical";
import { useErp } from "@/lib/erp/store";
import { vetNameOf } from "@/lib/clinical/attendingVet";

const todayIso = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const FINAL = ["completed", "cancelled", "no-show", "no show"];

/** Today's queue with "Start Consultation", which opens the existing VisitWorkspaceModal (same as the Clinic Dashboard). */
export function ConsultationQueue() {
  const { roleId, currentUser, role } = useErp();
  // Starting a consultation is a doctor/admin action; reception sees the queue and links to Appointments.
  const canStart = roleId === "doctor" || roleId === "admin";
  const doctorName = vetNameOf(currentUser);
  const [appts, setAppts] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState<any | null>(null);
  // Receptionist "Doctor-Advised Medicine": pick which doctor was contacted, then a limited form opens
  const [advisedFor, setAdvisedFor] = useState<any | null>(null);
  const [advisedDoctor, setAdvisedDoctor] = useState("");
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [advisedMode, setAdvisedMode] = useState(false);
  useEffect(() => {
    if (roleId === "reception") listApprovedDoctorsFn().then((d) => setDoctors(d ?? [])).catch(() => setDoctors([]));
  }, [roleId]);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, v] = await Promise.all([listAppointmentsFn().catch(() => []), listVisitsFn().catch(() => [])]);
    setAppts(a ?? []);
    setVisits(v ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const today = todayIso();
  const queue = appts
    .filter((a) => String(a.appointment_date || a.date || "").slice(0, 10) === today && !FINAL.includes(String(a.status || "").toLowerCase()))
    .sort((x, y) => String(x.time || "").localeCompare(String(y.time || "")));

  const start = (a: any, advisedBy?: string) => {
    const existing = visits.find(
      (v) =>
        (a.token && String(v.appointmentToken) === String(a.token)) ||
        (v.petId === a.petId && v.date === today && ["Admitted", "In Consultation", "Diagnosed"].includes(v.status)),
    );
    const base = existing ?? {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: today,
      branch: "Main Clinic",
      billType: "GST",
      petId: a.petId,
      petName: a.pet,
      species: a.species,
      breed: a.breed,
      ownerId: a.ownerId,
      ownerName: a.owner || "Client",
      ownerPhone: a.ownerPhone || "N/A",
      appointmentToken: a.token ? String(a.token) : undefined,
      vitals: { weightKg: a.vitals?.weightKg, tempC: a.vitals?.tempC, complaint: a.complaint || "OPD Consultation" },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };
    // The doctor has started: only now does the appointment count as "In consultation" on the dashboards.
    if (a.token) {
      setAppts((prev) => prev.map((x) => (x.token === a.token ? { ...x, status: "In consultation" } : x)));
      void updateAppointmentStatusFn({ data: { token: a.token, status: "In consultation" } });
    }
    setAdvisedMode(!!advisedBy);
    setVisit({
      ...base,
      doctorName: advisedBy || base.doctorName || a.doctor || doctorName,
      ...(advisedBy ? { clinicalNotes: `Doctor contacted: ${advisedBy}. Medicine dispensed on his order.` } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Today's queue</h2>
          <p className="text-xs text-muted-foreground">
            {queue.length} patient{queue.length === 1 ? "" : "s"} waiting or in consultation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <div className="erp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {queue.map((a) => (
              <tr key={String(a.token)}>
                <td className="whitespace-nowrap px-4 py-3">{a.time || a.slot || "—"}</td>
                <td className="px-4 py-3 font-semibold">
                  {a.pet} <span className="font-normal text-muted-foreground">· {a.breed || a.species}</span>
                </td>
                <td className="px-4 py-3">{a.owner}</td>
                <td className="px-4 py-3">{a.doctor}</td>
                <td className="px-4 py-3">
                  <StatusPill value={String(a.status || "Waiting")} />
                </td>
                <td className="px-4 py-3 text-right">
                  {roleId === "reception" ? (
                    <Button size="sm" variant="outline" onClick={() => { setAdvisedDoctor(""); setAdvisedFor(a); }} className="gap-1.5">
                      <Pill className="size-4" /> Doctor-Advised Medicine
                    </Button>
                  ) : canStart ? (
                    <Button size="sm" onClick={() => start(a)} className="gap-1.5">
                      <Stethoscope className="size-4" /> Start Consultation
                    </Button>
                  ) : (
                    <Link to="/m/$moduleId" params={{ moduleId: "appointments" }} className="text-xs font-semibold text-primary hover:underline">
                      Open in Appointments
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!loading && queue.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No patients in today's queue.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Loading queue…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!advisedFor} onOpenChange={(o) => !o && setAdvisedFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Doctor-Advised Medicine</DialogTitle>
            <DialogDescription>
              {advisedFor?.pet}: choose the doctor you contacted. The note "Doctor contacted: &lt;name&gt;. Medicine dispensed on his order." is saved on the visit and bill.
            </DialogDescription>
          </DialogHeader>
          <Select value={advisedDoctor} onValueChange={setAdvisedDoctor}>
            <SelectTrigger aria-label="Doctor contacted">
              <SelectValue placeholder="Which doctor was contacted? (required)" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!advisedDoctor}
            onClick={() => {
              const a = advisedFor;
              setAdvisedFor(null);
              start(a, advisedDoctor);
            }}
          >
            Open form
          </Button>
        </DialogContent>
      </Dialog>

      {visit && (
        <VisitWorkspaceModal
          advisedMode={advisedMode}
          initialTab="consultation"
          open
          onClose={() => {
            setVisit(null);
            setAdvisedMode(false);
            void load();
          }}
          visit={visit}
          onVisitFinalized={(v) => v && setVisit(v)}
        />
      )}
    </div>
  );
}
