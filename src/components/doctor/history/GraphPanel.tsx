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
  selectionOf: (key: string) => ChartSelection;
  onSelection: (key: string, s: ChartSelection) => void;
  onBigView: (key: string) => void;
  range: string;
  onRange: (r: string) => void;
}

/** Sticky "Graph report" panel: every graph (e.g. weight and temperature) stacked, one under the other. */
export function GraphPanel({ data, selectionOf, onSelection, onBigView, range, onRange }: GraphPanelProps) {
  return (
    <aside className="card g-panel" aria-label="Graph report">
      <div className="g-head">
        <h3>{data.title}</h3>
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
      <div className="g-charts g-stack">
        {data.metrics.map((m) => (
          <section key={m.key} className="g-stack-item" aria-label={m.name}>
            <h4 className="g-stack-title">
              {m.name}
              {m.hint && <small> · {m.hint}</small>}
            </h4>
            {m.points.length ? (
              <ChartCard
                wide
                metric={m}
                selection={selectionOf(m.key)}
                onSelection={(sel) => onSelection(m.key, sel)}
                onBigView={() => onBigView(m.key)}
              />
            ) : (
              <p className="g-empty">Nothing to chart for this period yet. It fills in as records are added.</p>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}
