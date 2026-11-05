import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { createAppointmentFn } from "@/lib/mongodb/serverFns/appointments";
import { getVaccinationBoardFn } from "@/lib/mongodb/serverFns/vaccination";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

const todayIso = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const days = (iso: string) => Math.round((new Date(iso).getTime() - new Date(todayIso()).getTime()) / 86400000);
const SERVICE = { VACCINE: "Vaccination", DEWORMING: "Deworming" } as const;
const SERVICES = ["Vaccination", "Deworming", "Grooming"] as const;
const KIND_LABEL = { VACCINE: "Vaccine", DEWORMING: "Deworming" } as const;
type Kind = keyof typeof SERVICE;
type Booking = { petId?: string; service: (typeof SERVICES)[number]; date?: string };

const to12h = (hhmm: string) => {
  const [h = "10", m = "00"] = hhmm.split(":");
  const hr = Number(h);
  return `${String(hr % 12 || 12).padStart(2, "0")}:${m} ${hr < 12 ? "AM" : "PM"}`;
};

const HISTORY_RANGES = [
  { v: "7", label: "Last week" },
  { v: "30", label: "Last month" },
  { v: "365", label: "Last year" },
  { v: "all", label: "All time" },
];
const DUE_RANGES = [
  { v: "7", label: "Next 7 days" },
  { v: "30", label: "Next 30 days" },
  { v: "90", label: "Next 90 days" },
  { v: "all", label: "Everything" },
];

const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold" />
);
const Chip = ({ tone, children }: { tone: "late" | "soon" | "ok" | "info"; children: React.ReactNode }) => (
  <span
    className={cn(
      "whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-bold",
      tone === "late" && "bg-red-100 text-red-700",
      tone === "soon" && "bg-warning-soft text-warning",
      tone === "ok" && "bg-emerald-100 text-emerald-700",
      tone === "info" && "bg-primary/10 text-primary",
    )}
  >
    {children}
  </span>
);

function Table({ cols, children, empty }: { cols: string[]; children: React.ReactNode[]; empty: string }) {
  return (
    <div className="erp-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-4 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {children}
          {children.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const PetCell = ({ id, name, owner }: { id?: string; name?: string; owner?: string }) => (
  <td className="px-4 py-2.5">
    <span className="font-semibold">{name || id}</span>
    {owner && <span className="block text-xs text-muted-foreground">{owner}</span>}
  </td>
);

function BookDialog({ init, pets, onClose, onBooked }: { init: Booking; pets: any[]; onClose: () => void; onBooked: () => void }) {
  const [petId, setPetId] = useState(init.petId ?? "");
  const [service, setService] = useState(init.service);
  const [date, setDate] = useState(init.date && init.date >= todayIso() ? init.date : todayIso());
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const pet = pets.find((p) => p.petId === petId);

  const submit = async () => {
    if (!pet) {
      toast.error("Choose a patient");
      return;
    }
    setSaving(true);
    try {
      const token = `A-${Math.floor(100 + Math.random() * 900)}`;
      await createAppointmentFn({
        data: {
          token, date, appointment_date: date, time: to12h(time), slot: to12h(time),
          pet: pet.name, petId: pet.petId, species: pet.species, breed: pet.breed,
          owner: pet.owner?.name, ownerPhone: pet.owner?.phone, ownerId: pet.ownerId,
          doctor: "", type: service, priority: "Normal", status: "Waiting",
          complaint: `${service}${notes.trim() ? ` · ${notes.trim()}` : ""}`,
          appointment_category: null,
        },
      });
      toast.success(`${service} booked for ${pet.name} on ${formatDisplayDate(date) || date} (token ${token})`);
      onBooked();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not book the appointment");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl bg-card p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">Book {service.toLowerCase()} appointment</h3>
        <label className="block text-xs font-semibold">
          Patient
          <select className={field} value={petId} onChange={(e) => setPetId(e.target.value)}>
            <option value="">Select patient…</option>
            {pets.map((p) => (
              <option key={p.petId} value={p.petId}>{p.name} · {p.owner?.name} ({p.petId})</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold">
          Service
          <select className={field} value={service} onChange={(e) => setService(e.target.value as Booking["service"])}>
            {SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold">
            Date
            <input type="date" className={field} min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold">
            Time
            <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="block text-xs font-semibold">
          Notes (optional)
          <input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Anti-rabies booster, full groom" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="rounded-md px-3 py-1.5 text-sm font-semibold" onClick={onClose}>Cancel</button>
          <button type="button" disabled={saving || !date || !time} onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? "Booking…" : "Book appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Vaccination & deworming board. Follow-up dates registered by the doctor during consultation (and anything on the
 * patient record) show up under "Due", booked visits under "Booked", and every dose already given under "History".
 */
export function VaccinationDue() {
  const [board, setBoard] = useState<Awaited<ReturnType<typeof getVaccinationBoardFn>> | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [tab, setTab] = useState<"due" | "booked" | "history">("due");
  const [dueRange, setDueRange] = useState("30");
  const [histRange, setHistRange] = useState("30");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [book, setBook] = useState<Booking | null>(null);

  const load = useCallback(() => {
    getVaccinationBoardFn().then(setBoard).catch(() => setBoard({ followUps: [], history: [], appointments: [] }));
  }, []);
  useEffect(() => {
    load();
    listPetsWithOwnersFn().then((p) => setPets(p ?? [])).catch(() => setPets([]));
  }, [load]);

  const today = todayIso();
  const upcoming = useMemo(() => (board?.appointments ?? []).filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)), [board, today]);
  const bookingFor = (petId: string, k: Kind) => upcoming.find((a) => a.petId === petId && a.type === SERVICE[k]);

  const dueRows = useMemo(() => {
    const max = dueRange === "all" ? Infinity : Number(dueRange);
    return (board?.followUps ?? [])
      .map((f) => ({ ...f, d: days(f.due) }))
      .filter((f) => f.d <= max && (kind === "all" || f.kind === kind))
      .sort((a, b) => a.d - b.d);
  }, [board, dueRange, kind]);

  const histRows = useMemo(() => {
    const max = histRange === "all" ? Infinity : Number(histRange);
    return (board?.history ?? [])
      .filter((h) => h.date && -days(h.date) <= max && (kind === "all" || h.kind === kind))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [board, histRange, kind]);

  if (!board) return <p className="py-10 text-center text-sm text-muted-foreground">Loading vaccination records…</p>;

  const overdue = (board.followUps ?? []).filter((f) => days(f.due) < 0).length;
  const dueWeek = (board.followUps ?? []).filter((f) => { const d = days(f.due); return d >= 0 && d <= 7; }).length;
  const tabBtn = (id: typeof tab, label: string, n: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn("rounded-full px-3 py-1.5 text-xs font-bold", tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
    >
      {label} ({n})
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabBtn("due", "Due & overdue", board.followUps.length)}
        {tabBtn("booked", "Booked", upcoming.length)}
        {tabBtn("history", "History", board.history.length)}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Type">
            <option value="all">Vaccines + Deworming</option>
            <option value="VACCINE">Vaccines</option>
            <option value="DEWORMING">Deworming</option>
          </Select>
          {tab === "due" && (
            <Select value={dueRange} onChange={(e) => setDueRange(e.target.value)} aria-label="Due window">
              {DUE_RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </Select>
          )}
          {tab === "history" && (
            <Select value={histRange} onChange={(e) => setHistRange(e.target.value)} aria-label="History range">
              {HISTORY_RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </Select>
          )}
          <button type="button" onClick={() => setBook({ service: "Vaccination" })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            + Book appointment
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {overdue} overdue · {dueWeek} due in the next 7 days · follow-ups set by doctors during consultation appear here automatically.
      </p>

      {tab === "due" && (
        <Table cols={["Patient", "Type", "Due date", "Status", "Set by", ""]} empty="Nothing due in this window.">
          {dueRows.map((f) => {
            const b = bookingFor(f.petId, f.kind);
            return (
              <tr key={`${f.petId}|${f.kind}`}>
                <PetCell id={f.petId} name={f.petName} owner={[f.ownerName, f.ownerPhone].filter(Boolean).join(" · ")} />
                <td className="px-4 py-2.5">{KIND_LABEL[f.kind as Kind]}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{formatDisplayDate(f.due) || f.due}</td>
                <td className="px-4 py-2.5">
                  <Chip tone={f.d < 0 ? "late" : f.d <= 7 ? "soon" : "info"}>
                    {f.d < 0 ? `Overdue ${-f.d}d` : f.d === 0 ? "Due today" : `Due in ${f.d}d`}
                  </Chip>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.source}{f.by ? ` · ${f.by}` : ""}</td>
                <td className="space-x-3 whitespace-nowrap px-4 py-2.5 text-right">
                  {b ? (
                    <Chip tone="ok">Booked {formatDisplayDate(b.date) || b.date}</Chip>
                  ) : (
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setBook({ petId: f.petId, service: SERVICE[f.kind as Kind], date: f.due })}>
                      Book
                    </button>
                  )}
                  <Link to="/patient/$id" params={{ id: f.petId }} className="text-xs font-semibold text-primary hover:underline">
                    Open patient
                  </Link>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === "booked" && (
        <Table cols={["Patient", "Service", "Date", "Time", "Status", "Token"]} empty="No upcoming vaccination, deworming or grooming bookings.">
          {upcoming.map((a, i) => (
            <tr key={`${a.token}-${i}`}>
              <PetCell id={a.petId} name={a.pet} owner={a.owner} />
              <td className="px-4 py-2.5">{a.type}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{formatDisplayDate(a.date) || a.date}</td>
              <td className="px-4 py-2.5">{a.time || "—"}</td>
              <td className="px-4 py-2.5"><Chip tone="info">{a.status || "Waiting"}</Chip></td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.token}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "history" && (
        <Table cols={["Date given", "Patient", "Type", "Product", "Given by", "When"]} empty="No vaccines or dewormings recorded in this period.">
          {histRows.map((h, i) => {
            const ago = -days(h.date);
            return (
              <tr key={`${h.petId}-${h.date}-${i}`}>
                <td className="whitespace-nowrap px-4 py-2.5">{formatDisplayDate(h.date) || h.date}</td>
                <PetCell id={h.petId} name={h.petName} owner={h.ownerName} />
                <td className="px-4 py-2.5">{KIND_LABEL[h.kind as Kind]}</td>
                <td className="px-4 py-2.5">{h.name}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{h.by || h.source}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{ago <= 0 ? "Today" : ago === 1 ? "Yesterday" : `${ago} days ago`}</td>
              </tr>
            );
          })}
        </Table>
      )}

      {book && <BookDialog init={book} pets={pets} onClose={() => setBook(null)} onBooked={load} />}
    </div>
  );
}
