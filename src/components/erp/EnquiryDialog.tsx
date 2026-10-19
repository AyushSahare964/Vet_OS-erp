import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addRowFn, getRowsFn } from "@/lib/mongodb/serverFns/rows";
import { useErp } from "@/lib/erp/store";
import { formatDisplayDate, todayIST } from "@/lib/utils/dateUtils";

const MODULE = "enquiries"; // the app's existing generic row store (tenant-scoped); no new collection

/** Walk-in / phone enquiry: Name, Phone, Email, what they want. Saved in the generic row store, recent ones listed below. */
export function EnquiryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentUser } = useErp();
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [recent, setRecent] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getRowsFn({ data: { moduleId: MODULE } }).then((r) => setRecent((r ?? []).slice(0, 5))).catch(() => setRecent([]));
  }, []);
  useEffect(() => {
    if (open) {
      setForm({ name: "", phone: "", email: "", notes: "" });
      load();
    }
  }, [open, load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const complete = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, "").slice(-10))) {
      toast.error("Enter a 10-digit phone number");
      return;
    }
    setSaving(true);
    try {
      await addRowFn({ data: { moduleId: MODULE, row: { name: form.name.trim(), phone: form.phone.replace(/\D/g, "").slice(-10), email: form.email.trim(), notes: form.notes.trim(), date: todayIST(), takenBy: currentUser?.fullName ?? "", status: "Open" } } });
      toast.success("Enquiry saved");
      setForm({ name: "", phone: "", email: "", notes: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save the enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enquiry</DialogTitle>
          <DialogDescription>Note down a walk-in or phone enquiry.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={form.name} onChange={set("name")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phone *</Label>
            <Input value={form.phone} onChange={set("phone")} inputMode="numeric" maxLength={10} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">What they want</Label>
            <Textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="e.g. Vaccination price, boarding for 3 days" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => void complete()} disabled={saving} className="font-bold">
            {saving ? "Saving…" : "Complete Enquiry"}
          </Button>
        </div>
        <div className="border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent enquiries</p>
          <ul className="space-y-1 text-xs">
            {recent.map((r, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-md bg-muted/40 px-2.5 py-1.5">
                <span>
                  <strong>{r.name}</strong> · {r.phone}
                  {r.notes ? ` · ${r.notes}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatDisplayDate(r.date)}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-muted-foreground">No enquiries yet.</li>}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
