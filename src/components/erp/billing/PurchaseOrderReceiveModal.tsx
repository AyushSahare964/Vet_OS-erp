import { useEffect, useState } from "react";
import { PackageCheck, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysBetweenISO, formatDisplayDate, todayIST } from "@/lib/utils/dateUtils";
import type { ClinicPurchaseOrderRecord } from "./PurchaseOrderModal";

interface Row {
  checked: boolean;
  received: number;
  damaged: number;
}

/** Days from PO date to goods-receipt date, for "Delivery time: N days". */
export const deliveryDays = (po: Pick<ClinicPurchaseOrderRecord, "poDate" | "grnDate">) =>
  po.poDate && po.grnDate ? Math.max(0, daysBetweenISO(po.poDate.slice(0, 10), po.grnDate.slice(0, 10))) : null;

/** Writes optional receipt fields onto the stored PO. The order's own data is never changed or removed. */
export function patchPurchaseOrder(poId: string, patch: Partial<ClinicPurchaseOrderRecord>) {
  try {
    const raw = localStorage.getItem("clinic_purchase_orders");
    const list: ClinicPurchaseOrderRecord[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem("clinic_purchase_orders", JSON.stringify(list.map((p) => (p.id === poId ? { ...p, ...patch } : p))));
  } catch {
    /* storage unavailable: the bill still saves */
  }
}

export interface ReceivedLine {
  productName: string;
  itemCode?: string | undefined;
  quantity: number;
  unit: string;
  gstPct: number;
  hsnCode?: string | undefined;
  purchasePrice: number;
}

/**
 * Receive / check the items of a Purchase Order (GRN): tick each line that arrived, enter received and damaged
 * quantities, then convert the checked lines to a Purchase Bill.
 */
export function PurchaseOrderReceiveModal({
  open,
  po,
  onClose,
  onConvert,
}: {
  open: boolean;
  po: ClinicPurchaseOrderRecord | null;
  onClose: () => void;
  onConvert: (po: ClinicPurchaseOrderRecord, lines: ReceivedLine[], grnDate: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [grnDate, setGrnDate] = useState(todayIST());

  useEffect(() => {
    if (!open || !po) return;
    setGrnDate(po.grnDate ?? todayIST());
    setRows(
      Object.fromEntries(
        po.items.map((it) => {
          const prev = po.receipts?.[it.id];
          return [it.id, { checked: prev?.checked ?? false, received: prev?.receivedQty ?? it.quantity, damaged: prev?.damagedQty ?? 0 }];
        }),
      ),
    );
  }, [open, po]);

  if (!po) return null;
  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));
  const checkedItems = po.items.filter((it) => rows[it.id]?.checked);
  const usable = (id: string) => Math.max(0, (rows[id]?.received ?? 0) - (rows[id]?.damaged ?? 0));
  const days = deliveryDays({ poDate: po.poDate, grnDate });

  const convert = () => {
    const receipts = Object.fromEntries(
      po.items.map((it) => [it.id, { checked: !!rows[it.id]?.checked, receivedQty: rows[it.id]?.received ?? 0, damagedQty: rows[it.id]?.damaged ?? 0 }]),
    );
    patchPurchaseOrder(po.id, { receipts, grnDate });
    onConvert(
      { ...po, receipts, grnDate },
      checkedItems
        .filter((it) => usable(it.id) > 0)
        .map((it) => ({ productName: it.productName, itemCode: it.itemCode, quantity: usable(it.id), unit: it.uom, gstPct: it.gstPct, hsnCode: it.hsnCode, purchasePrice: it.unitPrice })),
      grnDate,
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5 text-primary" /> Receive / Check items · PO {po.poNumber}
          </DialogTitle>
          <DialogDescription>
            {po.supplierName}
            {po.mrName ? ` · MR ${po.mrName}` : ""}
            {po.companyName ? ` · ${po.companyName}` : ""} · PO date {formatDisplayDate(po.poDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 font-semibold">
            Received on
            <Input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} className="h-8 w-40 font-mono" />
          </label>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
            Delivery time: {days ?? "—"} {days === 1 ? "day" : "days"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Checked</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Ordered</th>
                <th className="px-3 py-2 text-right">Received qty</th>
                <th className="px-3 py-2 text-right">Damaged qty</th>
                <th className="px-3 py-2 text-right">Usable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {po.items.map((it) => {
                const r = rows[it.id];
                if (!r) return null;
                return (
                  <tr key={it.id} className={r.checked ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={r.checked} onChange={(e) => set(it.id, { checked: e.target.checked })} className="size-4" aria-label={`Checked: ${it.productName}`} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {it.productName}
                      <span className="block text-[11px] text-muted-foreground">{it.uom}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min="0" value={r.received} onChange={(e) => set(it.id, { received: Math.max(0, parseFloat(e.target.value) || 0) })} className="ml-auto h-8 w-24 text-right font-mono" />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min="0" value={r.damaged || ""} onChange={(e) => set(it.id, { damaged: Math.max(0, parseFloat(e.target.value) || 0) })} className="ml-auto h-8 w-24 text-right font-mono" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{usable(it.id)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {checkedItems.length} of {po.items.length} lines checked. The purchase order itself is kept as it is.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={convert} disabled={checkedItems.length === 0} className="gap-1.5">
              <FileText className="size-4" /> Convert to Purchase Bill
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
