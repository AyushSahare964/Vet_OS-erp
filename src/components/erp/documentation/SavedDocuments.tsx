import { useEffect, useMemo, useState } from "react";
import { Eye, Printer, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDocRecordsFn, deleteDocRecordFn, type DocRecordRow } from "@/lib/mongodb/serverFns/documentation";
import { useClinicBranding } from "@/lib/erp/useClinicBranding";
import { useErp } from "@/lib/erp/store";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { DOC_TEMPLATES } from "./templates";
import { DocumentSheet, PRINT_CSS } from "./DocumentSheet";

/** Register of every form, consent and certificate that was filled in and saved. */
export function SavedDocuments() {
  const clinic = useClinicBranding();
  const isAdmin = useErp().roleId === "admin";
  const [rows, setRows] = useState<DocRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<DocRecordRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listDocRecordsFn());
    } catch (e: any) {
      toast.error(e.message || "Could not load saved documents.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.templateId !== type) return false;
      if (!q) return true;
      return [r.docNo, r.title, r.petName, r.petId, r.ownerName, r.doctor, r.savedBy].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, type]);

  const remove = async (r: DocRecordRow) => {
    if (!confirm(`Delete ${r.docNo} (${r.title} for ${r.petName})?`)) return;
    try {
      await deleteDocRecordFn({ data: { id: r.id } });
      setRows((p) => p.filter((x) => x.id !== r.id));
      toast.success(`${r.docNo} deleted.`);
    } catch (e: any) {
      toast.error(e.message || "Could not delete.");
    }
  };

  return (
    <div className="erp-card overflow-hidden p-0">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 p-3.5">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search doc no., patient, owner, doctor…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-60 text-xs" aria-label="Document type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All documents</SelectItem>
            {DOC_TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="h-8 gap-1.5 text-xs">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
        <span className="text-xs text-muted-foreground">{shown.length} of {rows.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Doc no.</th>
              <th className="px-4 py-3">Saved on</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Saved by</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 font-mono font-bold">{r.docNo}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDisplayDate(r.savedAt.slice(0, 10))}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{r.title}</td>
                <td className="px-4 py-3">{r.petName} <span className="text-muted-foreground">({r.petId})</span></td>
                <td className="px-4 py-3">{r.ownerName || "—"}</td>
                <td className="px-4 py-3">{r.doctor || "—"}</td>
                <td className="px-4 py-3">{r.savedBy}</td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(r)} className="h-7 gap-1 px-2 text-xs">
                    <Eye className="size-3.5" /> View
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => void remove(r)} title="Delete" className="h-7 w-7 p-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  {loading ? "Loading saved documents…" : rows.length === 0 ? "No documents saved yet. Fill a form under Forms & Certificates and press Save document." : "No documents match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          {open && (
            <>
              <div className="flex items-center justify-between gap-3 print:hidden">
                <div>
                  <DialogTitle className="text-sm">{open.docNo} · {open.title}</DialogTitle>
                  <DialogDescription className="text-xs">Saved by {open.savedBy} on {formatDisplayDate(open.savedAt.slice(0, 10))}</DialogDescription>
                </div>
                <Button size="sm" onClick={() => window.print()} className="mr-6 gap-1.5">
                  <Printer className="size-4" /> Print / PDF
                </Button>
              </div>
              <DocumentSheet
                clinic={clinic}
                data={{
                  title: open.title,
                  header: open.header,
                  paragraphs: open.paragraphs,
                  vaccines: open.vaccines,
                  vaccineTable: open.vaccineTable,
                  signatures: open.signatures,
                  doctor: open.doctor,
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
