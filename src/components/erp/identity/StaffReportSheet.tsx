import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getStaffReportFn, type StaffReport, type StaffReportPreset, type StaffReportRow } from "@/lib/mongodb/serverFns/staffReports";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";

const PRESETS: { id: StaffReportPreset; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "last30", label: "Last 30 Days" },
  { id: "fy", label: "This FY" },
];
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Label, formatter and the roles each metric belongs to. */
const METRICS: { key: string; label: string; money?: boolean; role: string }[] = [
  { key: "visitsCompleted", label: "Visits completed", role: "doctor" },
  { key: "revenue", label: "Revenue (invoices)", money: true, role: "doctor" },
  { key: "labOrders", label: "Lab orders raised", role: "doctor" },
  { key: "apptsCompleted", label: "Appointments completed", role: "doctor" },
  { key: "noShows", label: "No-shows", role: "doctor" },
  { key: "invoicesCreated", label: "Invoices created", role: "reception" },
  { key: "invoiceValue", label: "Invoice value", money: true, role: "reception" },
  { key: "amountCollected", label: "Amount collected", money: true, role: "reception" },
];

function useReport(open: boolean, preset: StaffReportPreset) {
  const [report, setReport] = useState<StaffReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    setError("");
    getStaffReportFn({ data: { preset } })
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e?.message || "Could not load the report."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, preset]);
  return { report, loading, error };
}

function PresetBar({ value, onChange }: { value: StaffReportPreset; onChange: (p: StaffReportPreset) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
      {PRESETS.map((p) => (
        <Button key={p.id} size="sm" variant={value === p.id ? "default" : "outline"} onClick={() => onChange(p.id)} className="h-8 text-xs font-semibold">
          {p.label}
        </Button>
      ))}
    </div>
  );
}

function Range({ report }: { report: StaffReport | null }) {
  return report ? (
    <p className="text-xs text-muted-foreground">
      {formatDisplayDate(report.from)} – {formatDisplayDate(report.to)}
    </p>
  ) : null;
}

function Body({ loading, error, children }: { loading: boolean; error: string; children: React.ReactNode }) {
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading report…</p>;
  if (error) return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  return <>{children}</>;
}

/** One person's report. */
export function StaffReportSheet({ staff, onClose }: { staff: { id: string; fullName: string } | null; onClose: () => void }) {
  const [preset, setPreset] = useState<StaffReportPreset>("month");
  const { report, loading, error } = useReport(!!staff, preset);
  const row = report?.rows.find((r) => r.id === staff?.id);
  const metrics = METRICS.filter((m) => row && m.role === row.roleId);
  const allZero = metrics.length > 0 && metrics.every((m) => !row?.metrics[m.key]);

  return (
    <Sheet open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{staff?.fullName} — Report</SheetTitle>
          <SheetDescription>{row?.roleName ?? "Staff activity"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <PresetBar value={preset} onChange={setPreset} />
          <Range report={report} />
          <Body loading={loading} error={error}>
            {metrics.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No activity metrics are tracked for this role yet.
              </p>
            ) : allZero ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No activity recorded for {staff?.fullName} in this period.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                {metrics.map((m) => (
                  <div key={m.key} className="rounded-xl border border-border bg-muted/20 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                    <dd className="mt-1 text-xl font-extrabold text-foreground">{m.money ? inr(row!.metrics[m.key] ?? 0) : (row!.metrics[m.key] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {report?.skipped.map((s) => (
              <p key={s} className="text-[11px] text-muted-foreground">
                Not shown: {s}
              </p>
            ))}
          </Body>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** All-staff comparison: bar chart + one table row per person. */
export function AllStaffReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [preset, setPreset] = useState<StaffReportPreset>("month");
  const [mode, setMode] = useState<"money" | "work">("money");
  const { report, loading, error } = useReport(open, preset);
  const rows: StaffReportRow[] = report?.rows ?? [];
  const active = rows.filter((r) => r.money > 0 || r.work > 0);
  const chart = rows.filter((r) => r.roleId === "doctor" || r.roleId === "reception").map((r) => ({ name: r.fullName.replace(/^Dr\.?\s+/i, ""), value: mode === "money" ? r.money : r.work }));
  const cell = (r: StaffReportRow, k: string, money = false) => (k in r.metrics ? (money ? inr(r.metrics[k]!) : r.metrics[k]) : "—");

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>All Staff Report</SheetTitle>
          <SheetDescription>Doctors and receptionists, compared on the work the system can link to them.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PresetBar value={preset} onChange={setPreset} />
            <Range report={report} />
          </div>
          <Body loading={loading} error={error}>
            {active.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No staff activity recorded in this period.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex gap-1.5" role="group" aria-label="Chart metric">
                    {([["money", "Money (₹)"], ["work", "Work items"]] as const).map(([id, label]) => (
                      <Button key={id} size="sm" variant={mode === id ? "default" : "outline"} onClick={() => setMode(id)} className="h-7 text-xs">
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {mode === "money" ? "Doctors: invoice revenue. Receptionists: amount collected." : "Doctors: visits completed. Receptionists: invoices created."}
                  </p>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(v: number) => (mode === "money" ? `₹${v.toLocaleString("en-IN")}` : String(v))} width={70} />
                        <Tooltip formatter={(v) => (mode === "money" ? inr(Number(v)) : String(v))} />
                        <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={56} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-left font-bold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2 text-right">Visits</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Labs</th>
                        <th className="px-3 py-2 text-right">Appts done</th>
                        <th className="px-3 py-2 text-right">No-shows</th>
                        <th className="px-3 py-2 text-right">Invoices</th>
                        <th className="px-3 py-2 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((r) => (
                        <tr key={r.id} className={cn(r.roleId !== "doctor" && r.roleId !== "reception" && "text-muted-foreground")}>
                          <td className="px-3 py-2 font-semibold">{r.fullName}</td>
                          <td className={cn("px-3 py-2")}>{r.roleName}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "visitsCompleted")}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "revenue", true)}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "labOrders")}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "apptsCompleted")}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "noShows")}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "invoicesCreated")}</td>
                          <td className="px-3 py-2 text-right">{cell(r, "amountCollected", true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report?.skipped.map((s) => (
                  <p key={s} className="text-[11px] text-muted-foreground">
                    Not shown: {s}
                  </p>
                ))}
              </>
            )}
          </Body>
        </div>
      </SheetContent>
    </Sheet>
  );
}
