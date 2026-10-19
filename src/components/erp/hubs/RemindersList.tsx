import { useEffect, useState } from "react";
import { StatusPill } from "@/components/erp/StatusPill";
import { listRemindersFn, type BillingReminderRow } from "@/lib/mongodb/serverFns/reminders";

/** Follow-up and payment reminders the clinic already tracks (read-only list). */
export function RemindersList() {
  const [rows, setRows] = useState<BillingReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listRemindersFn()
      .then((r) => setRows(r ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="erp-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Patient</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.reminderId}>
              <td className="whitespace-nowrap px-4 py-2.5">{r.scheduledDate}</td>
              <td className="px-4 py-2.5 font-semibold">{r.petName}</td>
              <td className="px-4 py-2.5">
                {r.ownerName} <span className="text-muted-foreground">{r.ownerPhone}</span>
              </td>
              <td className="px-4 py-2.5">{r.reminderType}</td>
              <td className="px-4 py-2.5">{r.channel}</td>
              <td className="px-4 py-2.5">
                <StatusPill value={r.status} />
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                No reminders yet.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Loading reminders…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
