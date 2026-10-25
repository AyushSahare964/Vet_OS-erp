import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listVisitsFn } from "@/lib/mongodb/serverFns/clinical";
import { listAppointmentsFn, updateAppointmentStatusFn } from "@/lib/mongodb/serverFns/appointments";
import { useErp } from "@/lib/erp/store";
import { todayIST } from "@/lib/utils/dateUtils";

/**
 * Start Consult: find an existing pet (name, owner, phone) or "Add New Pet", then go straight on to the
 * consultation form for that pet (the same VisitWorkspaceModal the queue uses).
 */
export function StartConsultPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser, role } = useErp();
  const [pets, setPets] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [visit, setVisit] = useState<any | null>(null);
  const [appts, setAppts] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    listPetsWithOwnersFn().then((p) => setPets(p ?? [])).catch(() => setPets([]));
    listAppointmentsFn().then((a) => setAppts(a ?? [])).catch(() => setAppts([]));
  }, [open]);

  // Today's open appointments, so their pets are listed first (token + time shown on the row).
  const todayAppts = useMemo(() => {
    const today = todayIST();
    return appts
      .filter((a) => String(a.appointment_date || a.date || "").slice(0, 10) === today && !["completed", "cancelled", "no-show", "no show"].includes(String(a.status || "").toLowerCase()))
      .sort((x, y) => String(x.time || x.slot || "").localeCompare(String(y.time || y.slot || "")));
  }, [appts]);
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
  // By pet id when the appointment has one; otherwise pet name AND owner name (many pets share a name like "Sheru").
  const isSame = (a: any, p: any) => (a.petId ? a.petId === p.petId : norm(a.pet) === norm(p.name) && norm(a.owner) === norm(p.owner?.name));
  const apptOf = (p: any) => todayAppts.find((a) => isSame(a, p));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const found = q ? pets.filter((p) => [p.name, p.petId, p.owner?.name, p.owner?.phone].some((x) => String(x ?? "").toLowerCase().includes(q))) : pets;
    const rank = (p: any) => {
      const i = todayAppts.findIndex((a) => isSame(a, p));
      return i < 0 ? Infinity : i;
    };
    return [...found].sort((a, b) => rank(a) - rank(b)).slice(0, Math.max(8, todayAppts.length));
  }, [pets, query, todayAppts]);

  const begin = async (pet: any) => {
    const today = todayIST();
    const visits = await listVisitsFn().catch(() => [] as any[]);
    const existing = (visits ?? []).find((v: any) => v.petId === pet.petId && v.date === today && ["Admitted", "In Consultation", "Diagnosed"].includes(v.status));
    const doctorName = currentUser?.fullName || role.person;
    const appt = apptOf(pet);
    if (appt?.token) void updateAppointmentStatusFn({ data: { token: appt.token, status: "In consultation" } });
    setVisit(
      existing ?? {
        visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
        prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
        date: today,
        branch: "Main Clinic",
        billType: "GST",
        petId: pet.petId,
        petName: pet.name,
        species: pet.species,
        breed: pet.breed,
        ownerId: pet.owner?.ownerId || pet.ownerId,
        ownerName: pet.owner?.name || "Client",
        ownerPhone: pet.owner?.phone || "N/A",
        doctorName,
        ...(appt?.token ? { appointmentToken: String(appt.token) } : {}),
        vitals: { weightKg: pet.weightKg || undefined, tempC: undefined, complaint: pet.allergies?.length ? `History: ${pet.allergies.join(", ")}` : "OPD Consultation" },
        status: "Admitted",
        items: [],
        subtotal: 0,
        totalAmount: 0,
        amountPaid: 0,
      },
    );
  };

  return (
    <>
      <Dialog open={open && !addOpen && !visit} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" /> Start Consultation
            </DialogTitle>
            <DialogDescription>Find the pet (name, owner or phone), or add a new pet first.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pet, owner or phone" className="pl-9" />
            </div>
            <Button type="button" onClick={() => setAddOpen(true)} className="shrink-0 gap-1.5 font-bold">
              <Plus className="size-4" /> Add New Pet
            </Button>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {matches.map((p) => (
              <button
                key={p.petId}
                type="button"
                onClick={() => void begin(p)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary/50 hover:bg-primary/5"
              >
                <span>
                  <strong>{p.name}</strong> <span className="text-muted-foreground">· {p.breed || p.species}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.owner?.name} · {p.owner?.phone}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                  {apptOf(p) && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Today {apptOf(p).time || apptOf(p).slot || ""}
                    </span>
                  )}
                  Start →
                </span>
              </button>
            ))}
            {matches.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching pet. Use Add New Pet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <OwnerPetRegistrationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        registrationSource="Reception"
        onRegistered={(res) => {
          const newPet = res.pets[res.pets.length - 1];
          setAddOpen(false);
          if (newPet) void begin({ ...newPet, owner: res.owner });
        }}
      />

      {visit && (
        <VisitWorkspaceModal
          open
          onClose={() => {
            setVisit(null);
            onClose();
          }}
          visit={visit}
          onVisitFinalized={(v) => v && setVisit(v)}
        />
      )}
    </>
  );
}
