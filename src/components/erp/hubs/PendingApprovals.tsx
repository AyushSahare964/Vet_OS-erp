import { useEffect, useState } from "react";
import { listStaffMembersFn } from "@/lib/mongodb/serverFns/auth";
import { ComingSoon } from "@/components/erp/ComingSoon";

/** Staff registrations waiting for approval (read-only; approve or reject from Staff & Access) + audit trail placeholder. */
export function PendingApprovals({ onOpenStaff }: { onOpenStaff: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    listStaffMembersFn()
      .then((s: any[]) => setRows((s ?? []).filter((x) => x.approvalStatus === "pending")))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className="space-y-5">
      <div className="erp-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">Pending staff approvals ({rows.length})</h3>
          <button type="button" onClick={onOpenStaff} className="text-xs font-semibold text-primary hover:underline">
            Review in Staff &amp; Access
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
              <tr key={s.id ?? s.email}>
                <td className="px-4 py-2.5 font-semibold">{s.fullName}</td>
                <td className="px-4 py-2.5">{s.roleName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.email}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted-foreground">No staff registrations are waiting.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ComingSoon title="Audit trail" line="A searchable log of who changed what will live here." />
    </div>
  );
}
