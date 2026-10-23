/**
 * StockMovements — Auditable Stock Adjustments & Transaction Ledger
 * Supports all product categories: Medicines, Pet Food, and Accessories
 */

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ShoppingCart,
  FileText,
  Filter,
  ClipboardCheck,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useInventory } from "./useInventoryStore";
import { reconcileStockFn } from "@/lib/mongodb/serverFns/inventory";
import {
  convertToBase,
  getAvailableUnits,
  stockDisplayLabel,
} from "@/lib/inventory/packagingUtils";

const REMOVAL_REASONS = [
  "Wastage",
  "Damage",
  "Internal Clinical Use",
  "Theft / Pilferage",
  "Expiry Write-off",
  "Count Error Correction",
  "Other",
];

// ─── Add Stock Panel ──────────────────────────────────────────────────────────
function AddStockPanel() {
  const { medicines, getBatches, addStock, getTotalQty } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active");

  const [itemCode, setItemCode] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [qty, setQty] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [poRef, setPoRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingBatches = useMemo(
    () => (itemCode ? getBatches(itemCode) : []),
    [itemCode, getBatches]
  );

  const selectedItem = activeMeds.find((m) => m.itemCode === itemCode);
  const hierarchy = selectedItem?.packagingHierarchy;

  const reset = () => {
    setItemCode("");
    setSelectedUnit("");
    setBatchNo("");
    setExpiryDate("");
    setPurchasePrice("");
    setQty("");
    setSupplierName("");
    setPoRef("");
  };

  const submit = async () => {
    if (!itemCode || !qty) {
      toast.error("Please select a product and specify quantity");
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const unitToUse = selectedUnit || hierarchy?.purchaseUnit || selectedItem?.unit || "unit";
    const baseQty = hierarchy ? convertToBase(numQty, unitToUse, hierarchy) : numQty;
    const effectiveBatchNo = batchNo.trim() || `GRN-${Date.now().toString().slice(-6)}`;
    const effectiveExpiry = expiryDate || "2030-12-31";

    setSubmitting(true);
    try {
      await addStock({
        itemCode,
        itemName: selectedItem?.name ?? "Item",
        batchNo: effectiveBatchNo,
        manufacturingDate: "",
        expiryDate: effectiveExpiry,
        purchasePricePerUnit: Number(purchasePrice) || selectedItem?.defaultPurchasePrice || 0,
        receivedDate: new Date().toISOString().slice(0, 10),
        receivedQty: baseQty,
        acceptedQty: baseQty,
        supplierName: supplierName.trim() || selectedItem?.defaultSupplierName || "Direct Supplier",
        purchaseOrderRef: poRef.trim() || `PO-${Date.now().toString().slice(-6)}`,
        actor: "Clinic Store In-Charge",
      });
      toast.success(`+${numQty} ${unitToUse} (${baseQty} ${hierarchy?.baseUnit || selectedItem?.unit || "units"}) added to stock`);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to record stock addition");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-card p-5 space-y-4 border border-border">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="size-5 text-emerald-600" />
        <div>
          <p className="font-bold text-sm text-foreground">Add Stock (Purchase / Goods Inward)</p>
          <p className="text-xs text-muted-foreground">Increases authoritative stock balance and records purchase in ledger</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Product Picker */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold">
            Product Item <span className="text-destructive">*</span>
          </Label>
          <Select value={itemCode} onValueChange={(v) => {
            setItemCode(v);
            const found = activeMeds.find((m) => m.itemCode === v);
            if (found) {
              setPurchasePrice(String(found.defaultPurchasePrice || ""));
              setSupplierName(found.defaultSupplierName || "");
            }
          }}>
            <SelectTrigger id="add-item">
              <SelectValue placeholder="Select medicine, injection, food, or accessory…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {activeMeds.map((m) => (
                <SelectItem key={m.itemCode} value={m.itemCode}>
                  [{m.productType || m.category}] {m.name} ({m.itemCode}) — {getTotalQty(m.itemCode)} in stock
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Batch / Lot Number */}
        <div className="space-y-1.5">
          <Label htmlFor="add-batch" className="text-xs font-semibold">
            Batch / Lot No.
          </Label>
          <Input
            id="add-batch"
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            placeholder={selectedItem?.productType === "MEDICINE" || selectedItem?.productType === "INJECTION" ? "e.g. BATCH-2026-01" : "Optional for non-Rx"}
          />
        </div>

        {/* Expiry Date */}
        <div className="space-y-1.5">
          <Label htmlFor="add-expiry" className="text-xs font-semibold">
            Expiry Date
          </Label>
          <Input
            id="add-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>

        {/* Quantity and Unit */}
        <div className="space-y-1.5">
          <Label htmlFor="add-qty" className="text-xs font-semibold">
            Quantity Inward <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="add-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="flex-1"
            />
            {hierarchy ? (
              <Select value={selectedUnit || hierarchy.purchaseUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-28 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableUnits(hierarchy).map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="px-2.5 py-1.5 rounded-md bg-muted text-xs font-mono text-muted-foreground flex items-center">
                {selectedItem?.unit || "Unit"}
              </div>
            )}
          </div>
          {hierarchy && Number(qty) > 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
              = {convertToBase(Number(qty), selectedUnit || hierarchy.purchaseUnit, hierarchy)} {hierarchy.baseUnit}s to stock
            </p>
          )}
        </div>

        {/* Purchase Rate */}
        <div className="space-y-1.5">
          <Label htmlFor="add-price" className="text-xs font-semibold">
            Purchase Rate (₹ per unit)
          </Label>
          <Input
            id="add-price"
            type="number"
            min={0}
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {/* Supplier */}
        <div className="space-y-1.5">
          <Label htmlFor="add-supplier" className="text-xs font-semibold">Supplier Name</Label>
          <Input
            id="add-supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="e.g. MedVet / PetNutri"
          />
        </div>

        {/* PO Reference */}
        <div className="space-y-1.5">
          <Label htmlFor="add-poref" className="text-xs font-semibold">PO / Invoice Reference</Label>
          <Input
            id="add-poref"
            value={poRef}
            onChange={(e) => setPoRef(e.target.value)}
            placeholder="e.g. PO-2026-081"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button variant="outline" size="sm" onClick={reset} disabled={submitting} className="text-xs">
          Clear
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
        >
          <ArrowUpCircle className="size-4 mr-1" />
          {submitting ? "Adding Stock..." : "Add Stock to Inventory"}
        </Button>
      </div>
    </div>
  );
}

// ─── Remove Stock Panel ───────────────────────────────────────────────────────
function RemoveStockPanel() {
  const { medicines, getBatches, getTotalQty, removeStock, refetchBatches } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active");

  const [itemCode, setItemCode] = useState("");
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Damage");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // The client's `batches` list is only ever populated on demand (e.g. by opening an
  // item's detail view) — it's empty for every item on a fresh page load. Without this,
  // "Specific Batch" would silently show no options and Auto-FIFO deduction (below)
  // would wrongly conclude the item has no batches at all.
  useEffect(() => {
    if (!itemCode) return;
    setBatchesLoading(true);
    void refetchBatches(itemCode).finally(() => setBatchesLoading(false));
  }, [itemCode, refetchBatches]);

  const batches = useMemo(
    () => (itemCode ? getBatches(itemCode).filter((b) => b.qty > 0) : []),
    [itemCode, getBatches]
  );

  const selectedItem = activeMeds.find((m) => m.itemCode === itemCode);
  const totalQty = itemCode ? getTotalQty(itemCode) : 0;
  const selectedBatch = batches.find((b) => b.id === batchId);

  const reset = () => {
    setItemCode("");
    setBatchId("");
    setQty("");
    setReason("Damage");
    setRemarks("");
  };

  const submit = async () => {
    if (!itemCode || !qty || !reason) {
      toast.error("Please select a product, quantity, and reason");
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (numQty > totalQty && !selectedItem?.allowNegativeStock) {
      toast.error(`Cannot remove more than available stock (${totalQty})`);
      return;
    }

    setSubmitting(true);
    try {
      // adjustStockFn deducts from exactly one real batch server-side — there is no
      // server-side "auto" mode. When "Specific Batch" is left on its "Auto-FIFO
      // deduction" placeholder, pick the earliest-expiring batch that alone covers the
      // requested quantity ourselves. Previously an empty batchId was sent through
      // as-is, which never matches a real batch and always failed server-side with
      // "Batch not found" — so auto-FIFO could never actually succeed. Refetch fresh
      // from the server rather than trusting the local `batches` memo, which is empty
      // on a fresh page load and can otherwise be stale.
      let effectiveBatchId = batchId;
      if (!effectiveBatchId) {
        const freshBatches = (await refetchBatches(itemCode)).filter((b) => b.qty > 0);
        const fifoBatch = [...freshBatches]
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
          .find((b) => b.qty >= numQty);
        if (!fifoBatch) {
          toast.error(
            freshBatches.length === 0
              ? "This item has no batches to adjust from."
              : `No single batch has ${numQty} ${selectedItem?.unit || "units"} available — pick a specific batch with enough stock, or reduce the quantity.`
          );
          return;
        }
        effectiveBatchId = fifoBatch.id;
      }

      const movementType =
        reason === "Expiry Write-off"
          ? "expiry_writeoff"
          : reason === "Damage" || reason === "Wastage"
          ? "damage_writeoff"
          : "adjustment_out";

      await removeStock({
        medicineId: itemCode,
        batchId: effectiveBatchId,
        qty: numQty,
        reason: `${reason}${remarks ? `: ${remarks}` : ""}`,
        actor: "Authorized Staff",
        movementType,
      });
      toast.success(`−${numQty} ${selectedItem?.unit || "units"} deducted from stock`);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to post stock deduction");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-card p-5 space-y-4 border border-border">
      <div className="flex items-center gap-2">
        <ArrowDownCircle className="size-5 text-rose-600" />
        <div>
          <p className="font-bold text-sm text-foreground">Stock Adjustment / Write-Off (Outward)</p>
          <p className="text-xs text-muted-foreground">Audited stock deduction for wastage, damage, or correction</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Product */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold">
            Product Item <span className="text-destructive">*</span>
          </Label>
          <Select value={itemCode} onValueChange={(v) => { setItemCode(v); setBatchId(""); }}>
            <SelectTrigger id="remove-item">
              <SelectValue placeholder="Select item to adjust…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {activeMeds.map((m) => {
                const qtyAvail = getTotalQty(m.itemCode);
                return (
                  <SelectItem key={m.itemCode} value={m.itemCode} disabled={qtyAvail === 0 && !m.allowNegativeStock}>
                    [{m.productType || m.category}] {m.name} — {qtyAvail} {m.unit}s available
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {itemCode && (
            <p className="text-[11px] text-muted-foreground">
              Total authoritative balance: <strong>{totalQty} {selectedItem?.unit}s</strong>
              {batchesLoading && " · loading batches…"}
            </p>
          )}
        </div>

        {/* Batch if available */}
        {batches.length > 0 && (
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Specific Batch (Optional)</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-FIFO deduction or select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchNo} — Exp: {b.expiryDate} (Qty: {b.qty})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label htmlFor="remove-qty" className="text-xs font-semibold">
            Quantity to Deduct <span className="text-destructive">*</span>
          </Label>
          <Input
            id="remove-qty"
            type="number"
            min={1}
            max={totalQty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Reason for Adjustment <span className="text-destructive">*</span>
          </Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              {REMOVAL_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Remarks */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="remove-remarks" className="text-xs font-semibold">Auditor Remarks</Label>
          <Input
            id="remove-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Broken vial during shift change"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t">
        <Button variant="outline" size="sm" onClick={reset} disabled={submitting} className="text-xs">
          Clear
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={submitting}
          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
        >
          <ArrowDownCircle className="size-4 mr-1" />
          {submitting ? "Posting Deduction..." : "Post Stock Deduction"}
        </Button>
      </div>
    </div>
  );
}

// ─── Stock Reconciliation Panel ──────────────────────────────────────────────
// Physical stock count: pick items, enter the counted quantity, review the change, then process.
interface ReconLine {
  itemCode: string;
  name: string;
  unit: string;
  available: number;
  physical: number;
}

function StockReconciliationPanel() {
  const { medicines, getTotalQty, refetchItems, refetchLedger, refetchBatches } = useInventory();
  const activeMeds = medicines.filter((m) => m.status === "Active");

  const [itemCode, setItemCode] = useState("");
  const [physical, setPhysical] = useState("");
  const [lines, setLines] = useState<ReconLine[]>([]);
  const [mode, setMode] = useState<"adjust" | "report">("adjust");
  const [submitting, setSubmitting] = useState(false);

  const selected = activeMeds.find((m) => m.itemCode === itemCode);
  const available = selected ? Math.max(0, getTotalQty(selected.itemCode)) : 0;

  const addLine = () => {
    if (!selected) {
      toast.error("Select an item first");
      return;
    }
    const n = Number(physical);
    if (physical.trim() === "" || !Number.isFinite(n) || n < 0) {
      toast.error("Enter the physical stock (0 or more)");
      return;
    }
    setLines((prev) => {
      const line: ReconLine = { itemCode: selected.itemCode, name: selected.name, unit: selected.unit || "", available, physical: n };
      const i = prev.findIndex((l) => l.itemCode === selected.itemCode);
      return i >= 0 ? prev.map((l, idx) => (idx === i ? line : l)) : [...prev, line];
    });
    setItemCode("");
    setPhysical("");
  };

  const updatePhysical = (code: string, v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setLines((prev) => prev.map((l) => (l.itemCode === code ? { ...l, physical: n } : l)));
  };

  const changed = lines.filter((l) => l.physical !== l.available);

  const process = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one item to reconcile");
      return;
    }
    if (mode === "report") {
      toast.info(`${changed.length} of ${lines.length} item(s) differ from the system stock. No stock was changed.`);
      return;
    }
    if (changed.length === 0) {
      toast.info("Physical stock matches the system for every item — nothing to adjust.");
      return;
    }
    if (!confirm(`Adjust system stock for ${changed.length} item(s) to the physical count?`)) return;
    setSubmitting(true);
    try {
      const res = await reconcileStockFn({
        data: { lines: lines.map((l) => ({ itemCode: l.itemCode, physicalStock: l.physical })), actor: "Authorized Staff" },
      });
      toast.success(`Stock reconciled (${res.referenceNo}) — ${changed.length} item(s) adjusted`);
      setLines([]);
      // getTotalQty prefers the cached batches, so refresh those too or the old balance keeps showing
      await Promise.all([refetchItems(), refetchLedger(), ...changed.map((l) => refetchBatches(l.itemCode))]);
    } catch (err: any) {
      toast.error(err.message || "Failed to reconcile stock");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-card p-5 space-y-4 border border-border">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-5 text-primary" />
        <div>
          <p className="font-bold text-sm text-foreground">Stock Reconciliation (Physical Count)</p>
          <p className="text-xs text-muted-foreground">Enter the counted quantity; system stock is corrected to match and every change is ledgered</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Item Name <span className="text-destructive">*</span></Label>
          <Select value={itemCode} onValueChange={setItemCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select item to reconcile…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {activeMeds.map((m) => (
                <SelectItem key={m.itemCode} value={m.itemCode}>
                  [{m.productType || m.category}] {m.name} ({m.itemCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Available Stock</Label>
          <Input value={selected ? String(available) : ""} readOnly disabled className="bg-muted" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Physical Stock <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={0}
            value={physical}
            onChange={(e) => setPhysical(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLine()}
            placeholder="0"
          />
        </div>
        <Button type="button" size="icon" onClick={addLine} title="Add to reconciliation" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="px-3 py-2 w-14">S. No.</th>
              <th className="px-3 py-2">Item Name</th>
              <th className="px-3 py-2 text-right">Avail. Stock</th>
              <th className="px-3 py-2 text-right w-32">Physical Stock</th>
              <th className="px-3 py-2 text-right">Change in Stock</th>
              <th className="px-3 py-2 text-right">Final Stock</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {lines.map((l, i) => {
              const diff = l.physical - l.available;
              return (
                <tr key={l.itemCode}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-foreground">{l.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.available}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      value={l.physical}
                      onChange={(e) => updatePhysical(l.itemCode, e.target.value)}
                      className="h-7 w-24 ml-auto text-right text-xs"
                    />
                  </td>
                  <td className={`px-3 py-2 text-right font-bold tabular-nums ${diff < 0 ? "text-rose-600" : diff > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{l.physical}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((x) => x.itemCode !== l.itemCode))}
                      className="text-muted-foreground hover:text-rose-600"
                      title="Remove"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No items added yet. Pick an item, enter the physical count and press +.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 pt-1 border-t">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Process Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "adjust" | "report")}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adjust">Adjust / Reconcile</SelectItem>
              <SelectItem value="report">Variance report only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLines([])} disabled={submitting || lines.length === 0} className="text-xs">
            Clear
          </Button>
          <Button size="sm" onClick={process} disabled={submitting || lines.length === 0} className="text-xs font-semibold">
            <ClipboardCheck className="size-4 mr-1" />
            {submitting ? "Processing…" : "Process Items"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Authoritative Transaction Ledger Table ──────────────────────────────────
function MovementsLog() {
  const { ledger, medicines } = useInventory();
  const [filterType, setFilterType] = useState("all");

  const filteredLedger = useMemo(() => {
    if (filterType === "all") return ledger;
    if (filterType === "in") return ledger.filter((l) => l.movementType.includes("in"));
    if (filterType === "out") return ledger.filter((l) => l.movementType === "sale_out");
    if (filterType === "adjust")
      return ledger.filter(
        (l) =>
          l.movementType.includes("adjustment") ||
          l.movementType.includes("writeoff") ||
          l.sourceType === "manual_adjustment"
      );
    return ledger;
  }, [ledger, filterType]);

  return (
    <div className="erp-card p-5 space-y-4 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-foreground">Auditable Inventory Transaction Ledger</h4>
          <p className="text-xs text-muted-foreground">
            Complete, immutable trail of all stock mutations (Purchases, Clinical Billing, & Adjustments)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All Transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movements</SelectItem>
              <SelectItem value="in">Purchases In</SelectItem>
              <SelectItem value="out">Sales Deductions</SelectItem>
              <SelectItem value="adjust">Manual Adjustments</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs font-mono">
            {filteredLedger.length} entries
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-3 py-2.5">Date & Time</th>
              <th className="px-3 py-2.5">Product Name</th>
              <th className="px-3 py-2.5">Batch / Lot</th>
              <th className="px-3 py-2.5">Movement Type</th>
              <th className="px-3 py-2.5">Qty Change</th>
              <th className="px-3 py-2.5">Balance After</th>
              <th className="px-3 py-2.5">Reference / Doc</th>
              <th className="px-3 py-2.5">Reason / Remarks</th>
              <th className="px-3 py-2.5">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredLedger.slice(0, 30).map((l) => {
              const isIn = l.movementType.includes("in");
              const med = medicines.find((m) => m.itemCode === l.medicineId || m.id === l.medicineId);
              const unitName = med?.packagingHierarchy?.baseUnit || med?.unit || "";
              return (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {l.createdAt}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    {l.medicineName}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {l.batchNo || "DIRECT"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                        isIn
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isIn ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {l.movementType.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2.5 font-bold tabular-nums ${
                      isIn
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {isIn ? "+" : "−"}{l.quantity} {unitName}
                  </td>
                  <td className="px-3 py-2.5 font-bold tabular-nums text-foreground">
                    {l.balanceAfter} {unitName}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {l.sourceRef}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-xs truncate">
                    {l.reason || "Standard transaction"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {l.actorName}
                  </td>
                </tr>
              );
            })}

            {filteredLedger.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  No stock transactions match the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StockMovements() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <AddStockPanel />
        <RemoveStockPanel />
      </div>
      <StockReconciliationPanel />
      <MovementsLog />
    </motion.div>
  );
}
