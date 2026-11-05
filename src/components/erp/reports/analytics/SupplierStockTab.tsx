import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { listPurchaseBillsFn, type PurchaseBillRow } from "@/lib/mongodb/serverFns/purchaseBills";
import { addDaysToISO, formatDisplayDate, todayISO } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const inr2 = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899", "#64748b"];
const PERIODS: [string, string][] = [
  ["30", "Last 30 days"],
  ["90", "Last 3 months"],
  ["365", "Last year"],
  ["all", "All time"],
];

/** "2027-03" -> last day of that month (batches expire at month end); full dates pass through. */
const expiryDate = (v?: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  return m ? `${m[1]}-${m[2]}-${String(new Date(Number(m[1]), Number(m[2]), 0).getDate()).padStart(2, "0")}` : (v ?? "");
};

type Line = {
  date: string; supplier: string; supplierId: string; billNo: string; ref: string; item: string; key: string;
  batch: string; expiry: string; qty: number; free: number; unit: string; rate: number; mrp: number;
  disc: number; gst: number; total: number; returned: boolean;
};

const Card = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="erp-card p-4">
    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-extrabold">{value}</p>
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const Panel = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("erp-card overflow-hidden", className)}>
    <div className="border-b border-border px-4 py-3">
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={cn("whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground", right ? "text-right" : "text-left")}>{children}</th>
);
const Td = ({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) => (
  <td className={cn("whitespace-nowrap px-3 py-2 text-sm", right && "text-right tabular-nums", className)}>{children}</td>
);
const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <tr>
    <td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</td>
  </tr>
);

const STATUS_TONE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  UNPAID: "bg-red-100 text-red-700",
};

/**
 * Business Dashboard → Supplier Stock: everything received from suppliers (from the purchase bills),
 * with spend, outstanding, price movement and expiry analysis.
 */
export function SupplierStockTab() {
  const [bills, setBills] = useState<PurchaseBillRow[] | null>(null);
  const [period, setPeriod] = useState("365");
  const [supplier, setSupplier] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"bills" | "items">("bills");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setBills(null);
    const today = todayISO();
    listPurchaseBillsFn({ data: { from: period === "all" ? "2000-01-01" : addDaysToISO(today, -Number(period)), to: today } })
      .then(setBills)
      .catch(() => {
        toast.error("Could not load supplier purchases");
        setBills([]);
      });
  }, [period]);

  const suppliers = useMemo(
    () => [...new Map((bills ?? []).map((b) => [b.supplierId, b.supplierName])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [bills],
  );

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (bills ?? []).filter(
        (b) =>
          (supplier === "all" || b.supplierId === supplier) &&
          (!needle ||
            [b.supplierName, b.billNumber, b.internalRef, b.poNumber, ...b.items.map((i) => `${i.description} ${i.batchNo ?? ""}`)]
              .join(" ")
              .toLowerCase()
              .includes(needle)),
      ),
    [bills, supplier, needle],
  );

  const A = useMemo(() => {
    const purchases = shown.filter((b) => b.docType !== "DEBIT_NOTE");
    const returns = shown.filter((b) => b.docType === "DEBIT_NOTE");
    const sum = (rows: PurchaseBillRow[], f: (b: PurchaseBillRow) => number) => rows.reduce((s, b) => s + f(b), 0);

    const lines: Line[] = shown.flatMap((b) =>
      b.items
        .filter((i) => i.itemType === "INVENTORY")
        .map((i) => ({
          date: b.billDate, supplier: b.supplierName, supplierId: b.supplierId, billNo: b.billNumber, ref: b.internalRef,
          item: i.description, key: i.inventoryItemId || i.description.toLowerCase(), batch: i.batchNo ?? "", expiry: expiryDate(i.expiryDate),
          qty: i.qty, free: i.freeQty ?? 0, unit: i.unit ?? "", rate: i.purchaseRate, mrp: i.mrp ?? 0, disc: i.discountPct,
          gst: i.gstPct, total: i.lineTotal, returned: b.docType === "DEBIT_NOTE",
        })),
    );
    const received = lines.filter((l) => !l.returned);

    // per supplier
    const bySup = new Map<string, { name: string; bills: number; items: Set<string>; units: number; total: number; paid: number; last: string }>();
    for (const b of purchases) {
      const s = bySup.get(b.supplierId) ?? { name: b.supplierName, bills: 0, items: new Set<string>(), units: 0, total: 0, paid: 0, last: "" };
      s.bills++;
      s.total += b.grandTotal;
      s.paid += b.amountPaid;
      if (b.billDate > s.last) s.last = b.billDate;
      b.items.filter((i) => i.itemType === "INVENTORY").forEach((i) => {
        s.items.add(i.inventoryItemId || i.description.toLowerCase());
        s.units += i.qty + (i.freeQty ?? 0);
      });
      bySup.set(b.supplierId, s);
    }
    const supplierRows = [...bySup.values()].sort((a, b) => b.total - a.total);

    // monthly spend
    const byMonth = new Map<string, number>();
    purchases.forEach((b) => byMonth.set(b.billDate.slice(0, 7), (byMonth.get(b.billDate.slice(0, 7)) ?? 0) + b.grandTotal));
    const monthly = [...byMonth.entries()].sort().map(([m, v]) => ({ month: m, spend: Math.round(v) }));

    // top items by spend
    const byItem = new Map<string, { item: string; qty: number; spend: number; suppliers: Set<string> }>();
    received.forEach((l) => {
      const it = byItem.get(l.key) ?? { item: l.item, qty: 0, spend: 0, suppliers: new Set<string>() };
      it.qty += l.qty + l.free;
      it.spend += l.total;
      it.suppliers.add(l.supplier);
      byItem.set(l.key, it);
    });
    const topItems = [...byItem.values()].sort((a, b) => b.spend - a.spend).slice(0, 10);

    // price movement: latest vs previous purchase rate of the same item from the same supplier
    const series = new Map<string, Line[]>();
    received.forEach((l) => series.set(`${l.supplierId}|${l.key}`, [...(series.get(`${l.supplierId}|${l.key}`) ?? []), l]));
    const price = [...series.values()]
      .filter((s) => s.length > 1)
      .map((s) => s.sort((a, b) => a.date.localeCompare(b.date)))
      .map((s) => {
        const prev = s[s.length - 2]!, last = s[s.length - 1]!;
        return { item: last.item, supplier: last.supplier, prev: prev.rate, last: last.rate, date: last.date, pct: prev.rate ? ((last.rate - prev.rate) / prev.rate) * 100 : 0 };
      })
      .filter((p) => Math.abs(p.pct) > 0.01)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 10);

    // batches received that expire soon / already expired
    const today = todayISO();
    const soon = addDaysToISO(today, 90);
    const expiring = received
      .filter((l) => l.expiry && l.expiry <= soon)
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
      .slice(0, 10);

    const total = sum(purchases, (b) => b.grandTotal);
    const paid = sum(purchases, (b) => b.amountPaid);
    return {
      purchases, returns, lines, received, supplierRows, monthly, topItems, price, expiring, total, paid,
      outstanding: Math.max(0, total - paid),
      returned: sum(returns, (b) => b.grandTotal),
      units: received.reduce((s, l) => s + l.qty + l.free, 0),
      gst: sum(purchases, (b) => b.cgstTotal + b.sgstTotal + b.igstTotal),
    };
  }, [shown]);

  const exportCsv = () => {
    const head = ["Date", "Supplier", "Bill No", "Internal Ref", "Item", "Batch", "Expiry", "Qty", "Free Qty", "Unit", "Rate", "MRP", "Disc %", "GST %", "Line Total", "Type"];
    const rows = A.lines.map((l) => [l.date, l.supplier, l.billNo, l.ref, l.item, l.batch, l.expiry, l.qty, l.free, l.unit, l.rate, l.mrp, l.disc, l.gst, l.total, l.returned ? "Return" : "Purchase"]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob([[head, ...rows].map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `supplier_stock_${todayISO()}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  if (!bills) return <p className="py-10 text-center text-sm text-muted-foreground">Loading supplier purchases…</p>;

  const sel = "rounded-md border border-border bg-background px-2 py-1.5 text-xs font-semibold";
  return (
    <div className="space-y-5">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className={sel} value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Supplier">
          <option value="all">All suppliers</option>
          {suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supplier, bill no, item, batch…"
            className="w-72 rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs"
          />
        </div>
        <button type="button" onClick={exportCsv} disabled={!A.lines.length} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-50">
          <Download className="size-3.5" aria-hidden="true" /> Export items CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Total purchased" value={inr(A.total)} sub={`${A.purchases.length} bills · GST ${inr(A.gst)}`} />
        <Card label="Outstanding to suppliers" value={inr(A.outstanding)} sub={`${inr(A.paid)} paid so far`} />
        <Card label="Units received" value={A.units.toLocaleString("en-IN")} sub={`${new Set(A.received.map((l) => l.key)).size} different items`} />
        <Card label="Active suppliers" value={String(A.supplierRows.length)} sub={A.returned ? `${inr(A.returned)} returned (debit notes)` : "No returns"} />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Purchases by month" className="lg:col-span-2">
          {A.monthly.length ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={A.monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="spend" name="Purchased" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No purchases in this period.</p>
          )}
        </Panel>
        <Panel title="Paid vs outstanding">
          {A.total > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={[{ name: "Paid", value: A.paid }, { name: "Outstanding", value: A.outstanding }]} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2} label={(e) => e.name}>
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show.</p>
          )}
        </Panel>
      </div>

      {/* suppliers */}
      <Panel title="Supplier-wise summary">
        <div className="-m-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Supplier</Th><Th right>Bills</Th><Th right>Items</Th><Th right>Units</Th><Th right>Total</Th><Th right>Share</Th><Th right>Paid</Th><Th right>Outstanding</Th><Th>Last delivery</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {A.supplierRows.map((s, i) => (
                <tr key={s.name}>
                  <Td className="font-semibold"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{s.name}</Td>
                  <Td right>{s.bills}</Td><Td right>{s.items.size}</Td><Td right>{s.units.toLocaleString("en-IN")}</Td>
                  <Td right>{inr(s.total)}</Td><Td right>{A.total ? `${Math.round((s.total / A.total) * 100)}%` : "-"}</Td>
                  <Td right>{inr(s.paid)}</Td>
                  <Td right className={s.total - s.paid > 0.5 ? "font-bold text-red-600" : ""}>{inr(Math.max(0, s.total - s.paid))}</Td>
                  <Td>{formatDisplayDate(s.last)}</Td>
                </tr>
              ))}
              {!A.supplierRows.length && <Empty cols={9} text="No supplier purchases in this period." />}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* analysis */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top items by spend">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border"><Th>Item</Th><Th right>Units</Th><Th right>Spend</Th><Th>Suppliers</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {A.topItems.map((t) => (
                  <tr key={t.item}><Td className="font-semibold">{t.item}</Td><Td right>{t.qty}</Td><Td right>{inr(t.spend)}</Td><Td>{[...t.suppliers].join(", ")}</Td></tr>
                ))}
                {!A.topItems.length && <Empty cols={4} text="No stock received." />}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Price changes (latest vs previous purchase)">
          <div className="-m-4 overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-border"><Th>Item</Th><Th>Supplier</Th><Th right>Previous</Th><Th right>Latest</Th><Th right>Change</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {A.price.map((p, i) => (
                  <tr key={i}>
                    <Td className="font-semibold">{p.item}</Td><Td>{p.supplier}</Td><Td right>{inr2(p.prev)}</Td><Td right>{inr2(p.last)}</Td>
                    <Td right className={cn("font-bold", p.pct > 0 ? "text-red-600" : "text-emerald-600")}>{p.pct > 0 ? "▲" : "▼"} {Math.abs(p.pct).toFixed(1)}%</Td>
                  </tr>
                ))}
                {!A.price.length && <Empty cols={5} text="No item was bought twice from the same supplier at a different rate." />}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Received batches expiring within 90 days (or already expired)">
        <div className="-m-4 overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border"><Th>Item</Th><Th>Batch</Th><Th>Supplier</Th><Th>Received</Th><Th right>Qty</Th><Th>Expiry</Th></tr></thead>
            <tbody className="divide-y divide-border">
              {A.expiring.map((l, i) => (
                <tr key={i}>
                  <Td className="font-semibold">{l.item}</Td><Td>{l.batch || "-"}</Td><Td>{l.supplier}</Td><Td>{formatDisplayDate(l.date)}</Td>
                  <Td right>{l.qty + l.free} {l.unit}</Td>
                  <Td className={l.expiry < todayISO() ? "font-bold text-red-600" : "font-bold text-amber-600"}>{formatDisplayDate(l.expiry)}{l.expiry < todayISO() ? " · expired" : ""}</Td>
                </tr>
              ))}
              {!A.expiring.length && <Empty cols={6} text="No received batch is near expiry." />}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* detail registers */}
      <div className="flex items-center gap-2">
        {(["bills", "items"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-full px-3 py-1.5 text-xs font-bold", view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {v === "bills" ? `Bills received (${shown.length})` : `Every item received (${A.lines.length})`}
          </button>
        ))}
      </div>

      {view === "bills" ? (
        <div className="erp-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Date</Th><Th>Supplier</Th><Th>Bill no</Th><Th>Ref</Th><Th right>Items</Th><Th right>Taxable</Th><Th right>GST</Th><Th right>Total</Th><Th right>Paid</Th><Th>Status</Th><Th>Due</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((b) => (
                <Fragment key={b._id}>
                  <tr className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(open === b._id ? null : b._id)}>
                    <Td>{formatDisplayDate(b.billDate)}</Td>
                    <Td className="font-semibold">{b.supplierName}</Td>
                    <Td>{b.billNumber}{b.docType === "DEBIT_NOTE" && <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-bold text-red-700">RETURN</span>}</Td>
                    <Td className="text-xs text-muted-foreground">{b.internalRef}</Td>
                    <Td right>{b.items.length}</Td><Td right>{inr(b.taxableTotal)}</Td><Td right>{inr(b.cgstTotal + b.sgstTotal + b.igstTotal)}</Td>
                    <Td right className="font-bold">{inr(b.grandTotal)}</Td><Td right>{inr(b.amountPaid)}</Td>
                    <Td><span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", STATUS_TONE[b.status])}>{b.status}</span></Td>
                    <Td>{b.dueDate ? formatDisplayDate(b.dueDate) : "-"}</Td>
                  </tr>
                  {open === b._id && (
                    <tr>
                      <td colSpan={11} className="bg-muted/30 px-4 py-3">
                        <p className="mb-2 text-xs text-muted-foreground">
                          {b.poNumber ? `PO ${b.poNumber} · ` : ""}{b.supplierBillDate ? `Supplier bill dated ${formatDisplayDate(b.supplierBillDate)} · ` : ""}
                          {b.taxType === "INTER" ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"} · Discount {inr(b.discountTotal)}
                          {b.shippingAmount ? ` · Freight ${inr(b.shippingAmount)}` : ""}{b.otherCharges ? ` · Other charges ${inr(b.otherCharges)}` : ""}
                          {b.remarks ? ` · ${b.remarks}` : ""}
                        </p>
                        <table className="w-full">
                          <thead><tr><Th>#</Th><Th>Item</Th><Th>Batch</Th><Th>Expiry</Th><Th right>Qty</Th><Th right>Free</Th><Th right>Rate</Th><Th right>MRP</Th><Th right>Disc %</Th><Th right>GST %</Th><Th right>Total</Th></tr></thead>
                          <tbody className="divide-y divide-border">
                            {b.items.map((i) => (
                              <tr key={i.lineNo}>
                                <Td>{i.lineNo}</Td><Td className="font-semibold">{i.description}</Td><Td>{i.batchNo || "-"}</Td><Td>{i.expiryDate ? formatDisplayDate(expiryDate(i.expiryDate)) : "-"}</Td>
                                <Td right>{i.qty} {i.unit}</Td><Td right>{i.freeQty || 0}</Td><Td right>{inr2(i.purchaseRate)}</Td><Td right>{i.mrp ? inr2(i.mrp) : "-"}</Td>
                                <Td right>{i.discountPct}</Td><Td right>{i.gstPct}</Td><Td right>{inr2(i.lineTotal)}</Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!shown.length && <Empty cols={11} text="No supplier bills found for these filters." />}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="erp-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Received</Th><Th>Supplier</Th><Th>Bill no</Th><Th>Item</Th><Th>Batch</Th><Th>Expiry</Th><Th right>Qty</Th><Th right>Free</Th><Th right>Rate</Th><Th right>MRP</Th><Th right>Disc %</Th><Th right>GST %</Th><Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {A.lines.map((l, i) => (
                <tr key={i} className={l.returned ? "bg-red-50/60" : undefined}>
                  <Td>{formatDisplayDate(l.date)}</Td><Td>{l.supplier}</Td><Td>{l.billNo}{l.returned ? " (return)" : ""}</Td>
                  <Td className="font-semibold">{l.item}</Td><Td>{l.batch || "-"}</Td><Td>{l.expiry ? formatDisplayDate(l.expiry) : "-"}</Td>
                  <Td right>{l.qty} {l.unit}</Td><Td right>{l.free}</Td><Td right>{inr2(l.rate)}</Td><Td right>{l.mrp ? inr2(l.mrp) : "-"}</Td>
                  <Td right>{l.disc}</Td><Td right>{l.gst}</Td><Td right className="font-bold">{inr2(l.total)}</Td>
                </tr>
              ))}
              {!A.lines.length && <Empty cols={13} text="No stock items found for these filters." />}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
