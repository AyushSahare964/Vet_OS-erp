import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarClock,
  FlaskConical,
  Minus,
  PawPrint,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/erp/config";

/** Icon chosen from the card label when a page passes none (first match wins). */
const LABEL_ICONS: [RegExp, LucideIcon][] = [
  [/alert|low|expir/i, AlertTriangle],
  [/\bdue\b|outstanding/i, Wallet],
  [/pet|patient/i, PawPrint],
  [/owner|client/i, Users],
  [/appointment|queue/i, CalendarClock],
  [/billed|revenue|sale|invoice|collected/i, Receipt],
  [/stock|inventory|units/i, Boxes],
  [/lab/i, FlaskConical],
];
export const kpiIconFor = (label: string): LucideIcon =>
  LABEL_ICONS.find(([re]) => re.test(label))?.[1] ?? BarChart3;

/** Module a card opens when the page gives no `module` (first match wins; order matters). */
const LABEL_MODULES: [RegExp, string][] = [
  [/queue|appointment|no-show|wait/i, "appointments"],
  [/vaccin/i, "vaccination"],
  [/lab/i, "laboratory"],
  [/kennel|occupan|boarding|water temp/i, "boarding"],
  [/diet/i, "nutrition"],
  [/rx sales|pharmacy/i, "pharmacy"],
  [/stock|sku|reorder|medicine|expir|batch|units/i, "inventory"],
  [/invoice|bill|collect|outstanding|unpaid|due|revenue|payment|ticket|spend|refund/i, "billing"],
  [/ledger|reconcil/i, "accounts"],
  [/report/i, "reports"],
  [/pet|patient|client|owner|registered/i, "crm-pets"],
  [/staff/i, "identity"],
];
export const kpiModuleFor = (label: string): string | undefined =>
  LABEL_MODULES.find(([re]) => re.test(label))?.[1];

/** onSelect: when given, clicking the card runs it (e.g. filter the list below) instead of navigating; active highlights it. */
export function KpiCard({ kpi, index = 0, icon, onSelect, active }: { kpi: Kpi; index?: number; icon?: LucideIcon; onSelect?: () => void; active?: boolean }) {
  const Icon = icon ?? kpiIconFor(kpi.label);
  // Big number: full size by default; steps down only if a long value would be cut off in a narrow card.
  const valueRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      el.removeAttribute("data-fitted");
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && size > 28) {
        size -= 2;
        el.style.fontSize = `${size}px`;
        el.setAttribute("data-fitted", "true");
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [kpi.value]);
  const tone = kpi.trendTone ?? "flat";
  const TrendIcon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
  const [open, setOpen] = useState(false);
  const rows = kpi.detail?.rows ?? [];
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Open the module that owns the figure; on that module's own page scroll to its records table
  // (records popup if the page has none).
  const target = kpi.module ?? kpiModuleFor(kpi.label);
  const activate = () => {
    if (onSelect) return onSelect();
    if (target && pathname !== `/m/${target}`) return void navigate({ to: "/m/$moduleId", params: { moduleId: target } });
    const table = document.querySelector("main table, table");
    if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
    else setOpen(true);
  };

  return (
    <>
    <motion.div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && activate()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn("erp-kpi erp-kpi-row cursor-pointer", active && "ring-2 ring-primary")}
      aria-pressed={onSelect ? !!active : undefined}
    >
      <span className="erp-kpi-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="erp-kpi-body">
      <p className="erp-kpi-label">{kpi.label}</p>
      <motion.p
        key={kpi.value}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        ref={valueRef}
        className="erp-kpi-value"
      >
        {kpi.value}
      </motion.p>
      {kpi.trend && (
        <p
          className={cn(
            "erp-kpi-note flex items-center gap-1",
            tone === "up" && "text-success",
            tone === "down" && "text-destructive",
            tone === "flat" && "text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3.5" />
          {kpi.trend}
        </p>
      )}
      </div>
    </motion.div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kpi.label}: {kpi.value}</DialogTitle>
          <DialogDescription>{kpi.trend}</DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No records behind this figure right now.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                {kpi.detail!.columns.map((c) => <th key={c} className="px-2 py-2">{c}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}>{r.map((cell, j) => <td key={j} className="px-2 py-2">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
