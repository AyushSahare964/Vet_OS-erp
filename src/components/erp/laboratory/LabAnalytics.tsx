import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LAB_VOLUME_DATA = [
  { name: "Mon", cbc: 0, biochem: 0, serology: 0 },
  { name: "Tue", cbc: 0, biochem: 0, serology: 0 },
  { name: "Wed", cbc: 0, biochem: 0, serology: 0 },
  { name: "Thu", cbc: 0, biochem: 0, serology: 0 },
  { name: "Fri", cbc: 0, biochem: 0, serology: 0 },
  { name: "Sat", cbc: 0, biochem: 0, serology: 0 },
  { name: "Sun", cbc: 0, biochem: 0, serology: 0 },
];

interface Analyzer { name: string; status: string; lastQC: string; reagentLevel: string; nextCalib: string }

// No instrument integration yet — nothing is listed until real analyzers are connected.
const ANALYZER_STATUS: Analyzer[] = [];

export function LabAnalytics() {
  return (
    <div className="space-y-6">
      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Volume Chart */}
        <div className="erp-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WEEKLY TEST VOLUMES</h4>
              <p className="text-[11px] text-muted-foreground">Breakdown of Hematology, Biochemistry &amp; Serology tests</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
              0 tests this week
            </Badge>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={LAB_VOLUME_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="cbc" name="CBC Hematology" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="biochem" name="Biochemistry" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="serology" name="Serology" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Equipment & Quality Control (QC) Panel */}
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ANALYZER CALIBRATION &amp; QC STATUS</h4>
              <p className="text-[11px] text-muted-foreground">Automated veterinary diagnostic instruments</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {ANALYZER_STATUS.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No analyzers connected.</p>
            )}
            {ANALYZER_STATUS.map((inst) => (
              <div key={inst.name} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span>{inst.name}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">Last QC: {inst.lastQC} · Next Calibration: {inst.nextCalib}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    {inst.status}
                  </Badge>
                  {inst.reagentLevel !== "—" && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Reagent: {inst.reagentLevel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
