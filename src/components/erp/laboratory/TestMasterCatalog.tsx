import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import {
  TestTube2,
  Search,
  Plus,
  X,
  Clock,
  CheckCircle2,
  Trash2,
  Pencil,
  BookOpen,
  Layers,
  ArrowRight,
  ListPlus,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  loadTestCatalog,
  addTestToCatalog,
  updateTestInCatalog,
  deleteTestFromCatalog,
  clearTestCatalog,
  COMMON_DEPARTMENTS,
  COMMON_SAMPLES,
  COMMON_TATS,
  COMMON_PARAM_DICTIONARY,
  type LabTestProfile,
} from "@/lib/erp/labTestCatalog";
import { TestLibraryDialog } from "./TestLibraryDialog";
import { LAB_TEST_LIBRARY, type LibraryPanel } from "@/lib/erp/labTestLibrary";
import { cn } from "@/lib/utils";

interface ParamDraft {
  name: string;
  unit: string;
  min: string;
  max: string;
}

const emptyParam = (): ParamDraft => ({ name: "", unit: "", min: "", max: "" });

/** "min - max" when both are given, otherwise "< max" / "> min" */
const toRefRange = (p: ParamDraft) =>
  p.min.trim() && p.max.trim()
    ? `${p.min.trim()} - ${p.max.trim()}`
    : p.max.trim()
    ? `< ${p.max.trim()}`
    : p.min.trim()
    ? `> ${p.min.trim()}`
    : "";

/** Reverse-parses a biological reference string into min & max values */
function parseRefRangeToMinMax(refRange: string): { min: string; max: string } {
  if (!refRange) return { min: "", max: "" };
  const r = refRange.trim();
  const rangeMatch = r.match(/([0-9.]+)\s*(?:-|–|—|to)\s*([0-9.]+)/i);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    return { min: rangeMatch[1], max: rangeMatch[2] };
  }
  const lessMatch = r.match(/^<(=)?\s*([0-9.]+)/);
  if (lessMatch && lessMatch[2]) {
    return { min: "", max: lessMatch[2] };
  }
  const greaterMatch = r.match(/^>(=)?\s*([0-9.]+)/);
  if (greaterMatch && greaterMatch[2]) {
    return { min: greaterMatch[2], max: "" };
  }
  return { min: "", max: r };
}

/** Identity of a test: same name with identical parameters (name, unit, range) is a duplicate. */
const profileSig = (name: string, ps: Array<{ name: string; unit: string; refRange: string }>) =>
  `${name.trim().toLowerCase()}|${ps.map((p) => `${p.name.trim()}~${p.unit.trim()}~${p.refRange.trim()}`.toLowerCase()).sort().join(";")}`;

/** The catalog profile a library panel becomes (price left at 0 = set when ordering). */
const libraryToProfile = (lib: LibraryPanel, code: string): LabTestProfile => ({
  code,
  name: `${lib.panel} - ${lib.species}`,
  panel: lib.panel,
  sample: lib.sample,
  dept: lib.dept,
  tat: "Same Day",
  price: 0,
  urgentAvailable: false,
  parameters: lib.groups.flatMap((g) =>
    g.parameters.map((p) => ({ name: p.name, unit: p.unit, refRange: toRefRange({ name: p.name, unit: p.unit, ...parseRefRangeToMinMax(p.refRange) }) })),
  ),
});

export function TestMasterCatalog() {
  const [catalog, setCatalog] = useState<LabTestProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingTest, setSavingTest] = useState(false);

  // Editing state: holds the profile currently being edited
  const [editingTest, setEditingTest] = useState<LabTestProfile | null>(null);

  // Form draft fields
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSample, setNewSample] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newTat, setNewTat] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const priceRef = useRef<HTMLInputElement>(null);
  const [priceMissing, setPriceMissing] = useState(false);
  const focusPrice = () => setTimeout(() => { priceRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); priceRef.current?.focus(); }, 250);
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
  const departments = Array.from(new Set(catalog.map((t) => t.dept).filter(Boolean)));

  const resetForm = () => {
    setEditingTest(null);
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

  // Pre-fill form when editing an existing test profile
  const handleStartEdit = (t: LabTestProfile) => {
    setEditingTest(t);
    setNewCode(t.code || "");
    setNewName(t.name || "");
    setNewSample(t.sample || "");
    setNewDept(t.dept || "");
    setNewTat(t.tat || "");
    setNewPrice(String(t.price ?? ""));
    setNewUrgent(Boolean(t.urgentAvailable));
    setNewPanel(t.panel || "");
    setNewParams(
      (t.parameters || []).map((p) => {
        const { min, max } = parseRefRangeToMinMax(p.refRange);
        return {
          name: p.name,
          unit: p.unit || "",
          min,
          max,
        };
      })
    );
    setShowAddForm(true);
  };

  // Fill the form from a library panel; the price is left for the clinic to set
  const [showLibrary, setShowLibrary] = useState(false);
  const addedLibraryIds = useMemo(() => {
    const have = new Set(catalog.map((c) => profileSig(c.name, c.parameters ?? [])));
    return new Set(LAB_TEST_LIBRARY.filter((l) => have.has(profileSig(`${l.panel} - ${l.species}`, libraryToProfile(l, "").parameters ?? []))).map((l) => l.id));
  }, [catalog]);
  const handleAddManyFromLibrary = async (panels: LibraryPanel[]) => {
    const used = new Set(catalog.map((c) => c.code));
    try {
      for (const lib of panels) {
        let code = "";
        do {
          code = `TST-${lib.panel.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "")}${Math.floor(100 + Math.random() * 900)}`;
        } while (used.has(code));
        used.add(code);
        await addTestToCatalog(libraryToProfile(lib, code));
      }
      toast.success(`${panels.length} test panel${panels.length > 1 ? "s" : ""} added. Set prices when ordering or edit a profile.`);
    } catch (e) {
      console.error(e);
      toast.error("Could not add all selected panels");
    }
    void refresh();
  };
  const handleUseLibraryPanel = (lib: LibraryPanel) => {
    const params = lib.groups.flatMap((g) => g.parameters);
    setNewName(`${lib.panel} - ${lib.species}`);
    setNewPanel(lib.panel);
    setNewDept(lib.dept);
    setNewSample(lib.sample);
    setNewTat((t) => t || "Same Day");
    setNewParams(params.map((p) => ({ name: p.name, unit: p.unit, ...parseRefRangeToMinMax(p.refRange) })));
    setShowLibrary(false);
    toast.success(`Loaded "${lib.panel}" (${lib.species}) with ${params.length} parameters.`);
    toast.info("Price is optional. Leave it empty to enter it when ordering the test.");
    focusPrice();
  };

  // Auto-suggest unit and biological reference range when typing parameter name
  const handleParamNameChange = (idx: number, name: string) => {
    const lower = name.toLowerCase().trim();
    const suggestion = Object.entries(COMMON_PARAM_DICTIONARY).find(([key]) =>
      lower.includes(key) || key.includes(lower)
    )?.[1];

    setNewParams((prev) =>
      prev.map((x, j) => {
        if (j !== idx) return x;
        return {
          ...x,
          name,
          unit: x.unit || suggestion?.unit || "",
          min: x.min || suggestion?.min || "",
          max: x.max || suggestion?.max || "",
        };
      })
    );
  };

  const handleSaveTest = async () => {
    if (!newName.trim() || !newSample.trim()) {
      toast.error("Test name and sample type are required");
      return;
    }
    if (newPrice.trim() && !(Number(newPrice) >= 0)) {
      setPriceMissing(true);
      toast.error("Price must be a number, or leave it empty to set it when ordering");
      focusPrice();
      return;
    }
    const filled = newParams.filter((p) => p.name.trim());
    if (filled.some((p) => !toRefRange(p))) {
      toast.error("Give every parameter a minimum and/or maximum value (its threshold)");
      return;
    }
    // Same name with identical parameters (name, unit, range) is a duplicate; different parameters are allowed
    const sig = profileSig;
    const mySig = sig(newName, filled.map((p) => ({ name: p.name, unit: p.unit, refRange: toRefRange(p) })));
    const dup = catalog.find((c) => c.code !== editingTest?.code && sig(c.name, c.parameters ?? []) === mySig);
    if (dup) {
      toast.error(`"${dup.name}" with the same parameters already exists (${dup.code}). Change the name or a parameter to add another.`);
      return;
    }
    setSavingTest(true);
    try {
      const code =
        newCode.trim() ||
        editingTest?.code ||
        `TST-${newName.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "")}${Math.floor(10 + Math.random() * 90)}`;

      const test: LabTestProfile = {
        code,
        name: newName.trim(),
        sample: newSample.trim(),
        dept: newDept.trim() || "General",
        tat: newTat.trim() || "—",
        price: Number(newPrice) || 0, // optional: 0 = priced manually when the test is ordered
        urgentAvailable: newUrgent,
        ...(newPanel.trim() ? { panel: newPanel.trim() } : {}),
        parameters: filled.map((p) => ({
          name: p.name.trim(),
          unit: p.unit.trim(),
          refRange: toRefRange(p),
        })),
      };

      if (editingTest) {
        const idx = catalog.findIndex((c) => c.code === editingTest.code);
        await updateTestInCatalog(editingTest.code, test, idx >= 0 ? idx : undefined);
        toast.success(`Updated "${test.name}" and its parameters in catalog!`);
      } else {
        await addTestToCatalog(test);
        toast.success(`Test profile "${test.name}" added to catalog`);
      }

      resetForm();
      setShowAddForm(false);
      void refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not save test profile");
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

  const grouped = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          (a.panel ? 0 : 1) - (b.panel ? 0 : 1) || (a.panel || "").localeCompare(b.panel || "")
      ),
    [filtered]
  );

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
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} of {catalog.length} test profiles
          </span>
          {catalog.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              className="text-xs font-bold h-9 gap-1 text-destructive"
            >
              <Trash2 className="size-3.5" /> Delete all
            </Button>
          )}
          <Button
            size="sm"
            variant={showAddForm ? "outline" : "default"}
            onClick={() => {
              if (showAddForm) {
                resetForm();
                setShowAddForm(false);
              } else {
                resetForm();
                setShowAddForm(true);
              }
            }}
            className="text-xs font-bold h-9 gap-1"
          >
            {showAddForm ? (
              <>
                <X className="size-3.5" /> Cancel
              </>
            ) : (
              <>
                <Plus className="size-3.5" /> + New Test Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Add / Edit Diagnostic Test Profile Form ── */}
      {showAddForm && (
        <div className="p-4.5 rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-sm space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-primary/20 pb-2.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              {editingTest ? (
                <>
                  <Pencil className="size-4 text-primary" />
                  <span>
                    Edit Diagnostic Test Profile: <strong className="text-primary">{editingTest.name}</strong> ({editingTest.code})
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-4 text-primary" />
                  <span>New Diagnostic Test Profile</span>
                </>
              )}
            </p>
            {editingTest && (
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-background text-primary border-primary/30">
                Editing Mode
              </Badge>
            )}
          </div>

          {/* Test library: ready-made species panels with default parameters */}
          {!editingTest && (
            <button
              type="button"
              onClick={() => setShowLibrary(true)}
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-left transition-all hover:border-primary hover:bg-primary/10"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <BookOpen className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block text-xs font-bold text-foreground">Browse Veterinary Test Library</span>
                <span className="block text-[11px] text-muted-foreground">
                  Search ready-made panels by species (Dog, Cat, Cattle, Horse, Goat, Rat) and preview their default parameters before adding.
                </span>
              </span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          <TestLibraryDialog open={showLibrary} onClose={() => setShowLibrary(false)} onUse={handleUseLibraryPanel} addedIds={addedLibraryIds} onAddMany={handleAddManyFromLibrary} />


          {/* Core Test Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Panel / Profile Group</Label>
              <Input
                list="lab-panels"
                value={newPanel}
                onChange={(e) => setNewPanel(e.target.value)}
                placeholder="e.g. Liver Function Panel, CBC Routine"
                className="h-8 text-xs bg-background"
              />
              <datalist id="lab-panels">
                {panels.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Complete Blood Count (CBC)"
                className="h-8 text-xs bg-background font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Test Code (optional)</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Auto-generated if left blank"
                className="h-8 text-xs bg-background font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Department</Label>
              <Input
                list="lab-depts"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="e.g. Hematology, Clinical Biochemistry"
                className="h-8 text-xs bg-background"
              />
              <datalist id="lab-depts">
                {COMMON_DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Sample / Specimen *</Label>
              <Input
                list="lab-samples"
                value={newSample}
                onChange={(e) => setNewSample(e.target.value)}
                placeholder="e.g. Whole Blood (EDTA), Serum"
                className="h-8 text-xs bg-background"
              />
              <datalist id="lab-samples">
                {COMMON_SAMPLES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Turnaround Time (TAT)</Label>
              <Input
                list="lab-tats"
                value={newTat}
                onChange={(e) => setNewTat(e.target.value)}
                placeholder="e.g. 1 hr, 2 hrs, Same Day"
                className="h-8 text-xs bg-background"
              />
              <datalist id="lab-tats">
                {COMMON_TATS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className={cn("text-[11px] font-semibold text-muted-foreground", priceMissing && "text-destructive")}>Price (₹) <span className="font-normal opacity-70">(optional)</span></Label>
              <Input
                type="number"
                min="0"
                ref={priceRef}
                value={newPrice}
                onChange={(e) => { setNewPrice(e.target.value); setPriceMissing(false); }}
                placeholder="Leave empty to enter at order time"
                className={cn("h-8 text-xs bg-background font-mono font-bold text-foreground", priceMissing && "border-destructive ring-2 ring-destructive/30")}
              />
            </div>
          </div>

          {/* Parameters & Thresholds Section */}
          <div className="space-y-2 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  <span>Test Parameters &amp; Biological Thresholds ({newParams.length})</span>
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Parameters appear automatically when filling test results and doctor consultation reports.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs font-semibold gap-1 bg-background"
                onClick={() => setNewParams((p) => [...p, emptyParam()])}
              >
                <Plus className="size-3" /> Add Parameter
              </Button>
            </div>

            {newParams.length > 0 && (
              <div className="bg-background rounded-xl border border-border p-2.5 space-y-2">
                <div className="grid grid-cols-[1fr_90px_90px_90px_32px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Parameter Name</span>
                  <span>Unit</span>
                  <span>Min Ref</span>
                  <span>Max Ref</span>
                  <span></span>
                </div>

                {newParams.map((p, i) => {
                  const set = (k: keyof ParamDraft, v: string) =>
                    setNewParams((prev) => prev.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

                  return (
                    <div key={i} className="grid grid-cols-[1fr_90px_90px_90px_32px] gap-2 items-center">
                      <Input
                        value={p.name}
                        onChange={(e) => handleParamNameChange(i, e.target.value)}
                        placeholder="Parameter (e.g. ALT / SGPT)"
                        className="h-8 text-xs bg-card"
                      />
                      <Input
                        value={p.unit}
                        onChange={(e) => set("unit", e.target.value)}
                        placeholder="Unit (U/L)"
                        className="h-8 text-xs bg-card font-mono"
                      />
                      <Input
                        value={p.min}
                        onChange={(e) => set("min", e.target.value)}
                        placeholder="Min (10)"
                        inputMode="decimal"
                        className="h-8 text-xs bg-card font-mono"
                      />
                      <Input
                        value={p.max}
                        onChange={(e) => set("max", e.target.value)}
                        placeholder="Max (100)"
                        inputMode="decimal"
                        className="h-8 text-xs bg-card font-mono"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setNewParams((prev) => prev.filter((_, j) => j !== i))}
                        title="Remove parameter"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Urgent checkbox & action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={newUrgent}
                onChange={(e) => setNewUrgent(e.target.checked)}
                className="size-3.5 rounded accent-primary"
              />
              Available for Urgent / STAT orders
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTest}
                disabled={savingTest}
                className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                <CheckCircle2 className="size-3.5" />
                {savingTest ? "Saving..." : editingTest ? "Save Changes to Test Profile" : "Save Test Profile"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid of Diagnostic Test Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {grouped.map((t, i) => (
          <Fragment key={t.code}>
            {(i === 0 || (grouped[i - 1]?.panel || "") !== (t.panel || "")) && (
              <h3 className="col-span-full border-b border-border pb-1 pt-2 text-xs font-black uppercase tracking-wider text-primary flex items-center justify-between">
                <span>{t.panel || "Tests without a panel"}</span>
                <span className="text-[10px] font-normal text-muted-foreground font-mono">
                  {catalog.filter((c) => (c.panel || "") === (t.panel || "")).length} test(s)
                </span>
              </h3>
            )}
            <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    {t.code}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30">
                      {t.dept}
                    </Badge>
                    {t.urgentAvailable && (
                      <Badge variant="outline" className="text-[9px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/30">
                        STAT
                      </Badge>
                    )}
                  </div>
                </div>

                <h4 className="text-xs font-bold text-foreground leading-snug">{t.name}</h4>

                {t.parameters && t.parameters.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                      <span>{t.parameters.length} parameter{t.parameters.length > 1 ? "s" : ""}:</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground bg-muted/30 p-1.5 rounded-lg border border-border/60 line-clamp-2">
                      {t.parameters.map((p) => p.name).join(", ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">No quantitative parameters specified.</p>
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
                <span className="font-mono font-bold text-sm text-foreground">{Number(t.price) > 0 ? `₹${Number(t.price).toLocaleString("en-IN")}` : <span className="text-xs font-normal text-muted-foreground">Price set at order</span>}</span>
              </div>

              {/* Action Buttons: Edit Parameters/Price & Delete */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartEdit(t)}
                  className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10 flex-1"
                >
                  <Pencil className="size-3" /> Edit Profile &amp; Parameters
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteTest(t)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Delete Test Profile"
                >
                  <Trash2 className="size-3.5" />
                </Button>
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
