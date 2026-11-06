/**
 * ConsumablesCatalogue - gloves, gauze, syringes, sutures and other clinic consumables.
 * Simple list backed by the unified Inventory Product Master (productType CONSUMABLE).
 */

import { useState, useMemo } from "react";
import { Plus, Package, RefreshCw, Search, Edit, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useInventory, type Medicine } from "./useInventoryStore";
import { ProductMasterWizardDialog } from "./ProductMasterWizardDialog";
import { ItemDetailView } from "./item-detail/ItemDetailView";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

export function ConsumablesCatalogue() {
  const { consumablesList, batches, getTotalQty, getStockStatus, refetchItems, loadingItems, deleteItem } = useInventory();
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medicine | undefined>(undefined);
  const [detailItem, setDetailItem] = useState<Medicine | null>(null);

  const low = consumablesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Low").length;
  const out = consumablesList.filter((m) => m.status === "Active" && getStockStatus(m.itemCode) === "Out of Stock").length;

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return consumablesList.filter((m) => {
      const matchQ = !q || [m.name, m.itemCode, m.brand, m.subGroup].some((v) => String(v || "").toLowerCase().includes(q));
      const st = getStockStatus(m.itemCode);
      return matchQ && (stockFilter === "all" || (stockFilter === "low" && st === "Low") || (stockFilter === "out" && st === "Out of Stock"));
    });
  }, [consumablesList, query, stockFilter, getStockStatus]);

  const remove = async (m: Medicine) => {
    if (!window.confirm(`Delete "${m.name}" (${m.itemCode}) from the catalogue? This cannot be undone.`)) return;
    try {
      await deleteItem(m.itemCode);
      toast.success(`${m.name} deleted`);
    } catch {
      toast.error("Could not delete this item. Please try again.");
    }
  };

  const chip = (id: typeof stockFilter, label: string) => (
    <button
      type="button"
      onClick={() => setStockFilter(id)}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${stockFilter === id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
    >
      {label}
    </button>
  );

  if (detailItem) {
    const detailBatches = batches.filter((b) => b.medicineId === detailItem.itemCode || b.itemCode === detailItem.itemCode);
    return (
      <ItemDetailView medicine={detailItem} batches={detailBatches} stockQty={getTotalQty(detailItem.itemCode)} onBack={() => setDetailItem(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Package className="size-4" /></span>
          <div>
            <h3 className="text-sm font-bold text-foreground">Consumables Catalogue</h3>
            <p className="text-xs text-muted-foreground">Gloves, gauze, syringes, sutures and other items used in the clinic</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetchItems().then(() => toast.success("Consumables synced"))}
            className="rounded-lg border border-border p-2 hover:bg-muted/40"
            title="Refresh"
          >
            <RefreshCw className={`size-3.5 ${loadingItems ? "animate-spin" : ""}`} />
          </button>
          <Button size="sm" onClick={() => { setEditingItem(undefined); setAddOpen(true); }}>
            <Plus className="size-3.5 mr-1" /> Add Consumable
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand, category..." className="h-9 pl-9 text-sm" />
        </div>
        {chip("all", `All (${consumablesList.length})`)}
        {chip("low", `Low stock (${low})`)}
        {chip("out", `Out of stock (${out})`)}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">In stock</th>
              <th className="px-3 py-3 text-right">Buy</th>
              <th className="px-3 py-3 text-right">Sell</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {consumablesList.length === 0 ? "No consumables yet. Click Add Consumable to add gloves, gauze, syringes, sutures..." : "No consumables match your search."}
              </td></tr>
            ) : visible.map((m) => {
              const st = getStockStatus(m.itemCode);
              const size = (m as any).consumableDetails?.size;
              return (
                <tr key={m.itemCode} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{m.name}{size ? ` · ${size}` : ""}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{m.itemCode}{m.brand ? ` · ${m.brand}` : ""}</div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{m.subGroup || "-"}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">{getTotalQty(m.itemCode)} <span className="text-[10px] font-normal text-muted-foreground">{m.unit}</span></td>
                  <td className="px-3 py-3 text-right font-mono">{money(m.defaultPurchasePrice)}</td>
                  <td className="px-3 py-3 text-right font-mono">{money(m.defaultSalePrice)}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={st === "Out of Stock" ? "border-rose-300 text-rose-600" : st === "Low" ? "border-amber-300 text-amber-600" : "border-emerald-300 text-emerald-600"}>
                      {st === "Out of Stock" ? "Out of stock" : st === "Low" ? "Low" : "In stock"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => { setEditingItem(m); setAddOpen(true); }}><Edit className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View ledger and batches" onClick={() => setDetailItem(m)}><Eye className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => void remove(m)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ProductMasterWizardDialog
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditingItem(undefined); }}
        editing={editingItem}
        defaultProductType="CONSUMABLE"
      />
    </div>
  );
}
