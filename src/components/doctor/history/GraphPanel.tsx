import { Fragment, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { GraphData } from "@/lib/doctor/graphs";
import { ChartCard, type ChartSelection } from "./ChartCard";

export const RANGES: [string, string][] = [
  ["7", "Last week"],
  ["30", "Last month"],
  ["365", "Last year"],
  ["all", "All time"],
];

interface GraphPanelProps {
  data: GraphData;
  metricKey: string;
  onMetric: (key: string) => void;
  selection: ChartSelection;
  onSelection: (s: ChartSelection) => void;
  onBigView: () => void;
  range: string;
  onRange: (r: string) => void;
}

/** Sticky "Graph report" panel: single-select picker (one graph at a time) and the chosen chart. */
export function GraphPanel({
  data,
  metricKey,
  onMetric,
  selection,
  onSelection,
  onBigView,
  range,
  onRange,
}: GraphPanelProps) {
  const [open, setOpen] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  const m = data.metrics.find((x) => x.key === metricKey) ?? data.metrics[0]!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!pickRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <aside className="card g-panel" aria-label="Graph report">
      <div className="g-head">
        <h3>{data.title}</h3>
      </div>
      <div className="g-pick" ref={pickRef}>
        <button
          className="g-btn"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span>
            {m.name}
            {m.hint && <small> · {m.hint}</small>}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        {open && (
          <div className="g-menu" role="listbox" aria-label="Choose a graph">
            {data.metrics.map((x) => (
              <Fragment key={x.key}>
                <button
                  type="button"
                  role="option"
                  className="g-opt"
                  aria-selected={x.key === m.key}
                  onClick={() => {
                    onMetric(x.key);
                    setOpen(false);
                  }}
                >
                  <span className="chk">{x.key === m.key && <Check aria-hidden="true" />}</span>
                  {x.name}
                  <small>{x.hint ?? x.unit}</small>
                </button>
                {x.special && <div className="g-sep" />}
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 2px" }} role="group" aria-label="Period">
        {RANGES.map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={range === v}
            onClick={() => onRange(v)}
            style={{
              padding: "4px 11px",
              borderRadius: 999,
              border: "1px solid var(--line, #d5dde6)",
              font: "600 12px var(--font-display, inherit)",
              cursor: "pointer",
              background: range === v ? "var(--brand-deep, #0a4174)" : "transparent",
              color: range === v ? "#fff" : "inherit",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="g-charts">
        {m.points.length ? (
          <ChartCard
            metric={m}
            selection={selection}
            onSelection={onSelection}
            onBigView={onBigView}
          />
        ) : (
          <p className="g-empty">
            Nothing to chart for this period. The graph fills in automatically as records for this section are added.
          </p>
        )}
      </div>
    </aside>
  );
}
