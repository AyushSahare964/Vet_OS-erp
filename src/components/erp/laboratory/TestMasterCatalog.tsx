import { Fragment, useState, useEffect, useMemo } from "react";
import {
  TestTube2,
  Search,
  Plus,
  X,
  Clock,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { loadTestCatalog, addTestToCatalog, deleteTestFromCatalog, clearTestCatalog, type LabTestProfile } from "@/lib/erp/labTestCatalog";

interface ParamDraft { name: string; unit: string; min: string; max: string }
const emptyParam = (): ParamDraft => ({ name: "", unit: "", min: "", max: "" });
/** "min - max" when both are given, otherwise "< max" / "> min" */
const toRefRange = (p: ParamDraft) =>
  p.min.trim() && p.max.trim() ? `${p.min.trim()} - ${p.max.trim()}` : p.max.trim() ? `< ${p.max.trim()}` : p.min.trim() ? `> ${p.min.trim()}` : "";

export function TestMasterCatalog() {
  const [catalog, setCatalog] = useState<LabTestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingTest, setSavingTest] = useState(false);

  // New test draft fields
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSample, setNewSample] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newTat, setNewTat] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newUrgent, setNewUrgent] = useState(false);
  const [newPanel, setNewPanel] = useState("");
  const [newParams, setNewParams] = useState<ParamDraft[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await loadTestCatalog();
      setCatalog(rows);
    } catch (e) {
      console.error(e);
      toast.error("Could not load diagnostic test catalog");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return catalog.filter((t) => {
      const matchQ =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.panel?.toLowerCase().includes(q) ||
        t.sample?.toLowerCase().includes(q);

      const matchD = deptFilter === "all" || t.dept === deptFilter;
      return matchQ && matchD;
    });
  }, [catalog, query, deptFilter]);

  const panels = Array.from(new Set(catalog.map((t) => t.panel).filter(Boolean))) as string[];
  // Tests sit inside their panel: panels first (A-Z), tests without a panel last
  const grouped = useMemo(
    () =>
      [...filtered].sort((a, b) => (a.panel ? 0 : 1) - (b.panel ? 0 : 1) || (a.panel || "").localeCompare(b.panel || "")),
    [filtered]
  );
  const departments = Array.from(new Set(catalog.map((t) => t.dept).filter(Boolean)));

  const resetForm = () => {
    setNewCode("");
    setNewName("");
    setNewSample("");
    setNewDept("");
    setNewTat("");
    setNewPrice("");
    setNewUrgent(false);
    setNewPanel("");
    setNewParams([]);
  };

  const handleAddTest = async () => {
    if (!newName.trim() || !newSample.trim() || !newPrice.trim()) {
      toast.error("Test name, sample type, and price are required");
      return;
    }
    const filled = newParams.filter((p) => p.name.trim());
    if (filled.some((p) => !toRefRange(p))) {
      toast.error("Give every parameter a minimum and/or maximum value (its threshold)");
      return;
    }
    setSavingTest(true);
    try {
      const code =
        newCode.trim() ||
        `TST-${newName.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "")}${Math.floor(10 + Math.random() * 90)}`;
      const test: LabTestProfile = {
        code,
        name: newName.trim(),
        sample: newSample.trim(),
        dept: newDept.trim() || "General",
        tat: newTat.trim() || "—",
        price: Number(newPrice),
        urgentAvailable: newUrgent,
        ...(newPanel.trim() ? { panel: newPanel.trim() } : {}),
        parameters: filled.map((p) => ({ name: p.name.trim(), unit: p.unit.trim(), refRange: toRefRange(p) })),
      };
      await addTestToCatalog(test);
      toast.success(`Test profile "${test.name}" added to catalog`);
      resetForm();
      setShowAddForm(false);
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not save new test profile");
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = async (t: LabTestProfile) => {
    if (!window.confirm(`Remove "${t.name}" from the diagnostic test catalog?`)) return;
    const idx = catalog.findIndex((c) => c.code === t.code);
    if (idx === -1) return;
    try {
      await deleteTestFromCatalog(idx);
      toast.success(`${t.name} removed from catalog`);
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not delete test profile");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Delete all ${catalog.length} test profiles from the catalog? This cannot be undone.`)) return;
    try {
      await clearTestCatalog();
      toast.success("Test catalog cleared");
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not clear the test catalog");
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search diagnostic test by name, panel code, sample type..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[180px] text-xs h-9">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} of {catalog.length} test profiles
          </span>
          {catalog.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleClearAll} className="text-xs font-bold h-9 gap-1 text-destructive">
              <Trash2 className="size-3.5" /> Delete all
            </Button>
          )}
          <Button
            size="sm"
            variant={showAddForm ? "outline" : "default"}
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs font-bold h-9 gap-1"
          >
            {showAddForm ? (
              <><X className="size-3.5" /> Cancel</>
            ) : (
              <><Plus className="size-3.5" /> + New Test Profile</>
            )}
          </Button>
        </div>
      </div>

      {/* Add New Test Profile Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 space-y-3">
          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Plus className="size-3.5 text-primary" /> New Diagnostic Test Profile
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Panel</Label>
              <Input
                list="lab-panels"
                value={newPanel}
                onChange={(e) => setNewPanel(e.target.value)}
                placeholder="e.g. Liver Function Panel"
                className="h-8 text-xs bg-card"
              />
              <datalist id="lab-panels">{panels.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fecal Occult Blood Test"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Code (optional)</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Auto-generated if left blank"
                className="h-8 text-xs bg-card font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Department</Label>
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="e.g. Hematology"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Sample / Specimen *</Label>
              <Input
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                placeholder="e.g. Serum (SST Yellow)"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Turnaround Time (TAT)</Label>
              <Input
                value={newTat}
                onChange={(e) => setNewTat(e.target.value)}
                placeholder="e.g. 2 hrs"
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Price (₹) *</Label>
              <Input
                type="number"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="e.g. 750"
                className="h-8 text-xs bg-card font-mono"
              />
            </div>
          </div>
          {/* Parameters this test must report, each with its normal range (threshold) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-muted-foreground">
                Parameters &amp; thresholds ({newParams.length})
              </Label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-semibold gap-1"
                onClick={() => setNewParams((p) => [...p, emptyParam()])}>
                <Plus className="size-3" /> Add Parameter
              </Button>
            </div>
            {newParams.map((p, i) => {
              const set = (k: keyof ParamDraft, v: string) =>
                setNewParams((prev) => prev.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <div key={i} className="grid grid-cols-[1fr_90px_90px_90px_32px] gap-2 items-center">
                  <Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Parameter (e.g. ALT / SGPT)" className="h-8 text-xs bg-card" />
                  <Input value={p.unit} onChange={(e) => set("unit", e.target.value)} placeholder="Unit" className="h-8 text-xs bg-card font-mono" />
                  <Input value={p.min} onChange={(e) => set("min", e.target.value)} placeholder="Min" inputMode="decimal" className="h-8 text-xs bg-card font-mono" />
                  <Input value={p.max} onChange={(e) => set("max", e.target.value)} placeholder="Max" inputMode="decimal" className="h-8 text-xs bg-card font-mono" />
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setNewParams((prev) => prev.filter((_, j) => j !== i))} title="Remove parameter">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={newUrgent}
              onChange={(e) => setNewUrgent(e.target.checked)}
              className="size-3.5 rounded accent-primary"
            />
            Available for Urgent / STAT orders
          </label>
          <Button size="sm" onClick={handleAddTest} disabled={savingTest} className="h-8 text-xs font-bold gap-1.5">
            <CheckCircle2 className="size-3.5" /> {savingTest ? "Saving..." : "Save Test Profile"}
          </Button>
        </div>
      )}

      {/* Grid of Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {grouped.map((t, i) => (
          <Fragment key={t.code}>
          {(i === 0 || (grouped[i - 1]?.panel || "") !== (t.panel || "")) && (
            <h3 className="col-span-full border-b border-border pb-1 pt-2 text-xs font-black uppercase tracking-wider text-primary">
              {t.panel || "Tests without a panel"}
            </h3>
          )}
          <div
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {t.code}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                    {t.dept}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteTest(t)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete Test Profile"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <h4 className="text-xs font-bold text-foreground leading-snug">{t.name}</h4>
              {t.parameters && t.parameters.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{t.parameters.length} parameter{t.parameters.length > 1 ? "s" : ""}: {t.parameters.map((p) => p.name).join(", ")}</p>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <TestTube2 className="size-3 text-primary" /> Specimen: <strong className="text-foreground">{t.sample}</strong>
              </p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                <span>TAT: {t.tat}</span>
              </div>
              <span className="font-mono font-bold text-sm text-foreground">₹{Number(t.price).toLocaleString("en-IN")}</span>
            </div>
          </div>
          </Fragment>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground italic">
            No diagnostic test profiles match your search.
          </div>
        )}
      </div>
    </div>
  );
}
