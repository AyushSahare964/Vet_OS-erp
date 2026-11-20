import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  FlaskConical,
  Clock,
  Plus,
  X,
  AlertCircle,
  Check,
  Search,
  TestTube2,
  FileCheck,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { formatDisplayDate, calculateQuickDate } from "@/lib/utils/dateUtils";
import { cn } from "@/lib/utils";
import { loadTestCatalog, type LabTestProfile } from "@/lib/erp/labTestCatalog";
import type { FollowUpBloodTestItem } from "./FollowUpSection";

export interface LaboratoryState {
  enabled: boolean;
  dueDate: string; // YYYY-MM-DD
  quickOption?: string;
  bloodTests: FollowUpBloodTestItem[];
}

export interface LaboratoryOrderSectionProps {
  id?: string | undefined;
  visitDate: string; // YYYY-MM-DD
  laboratory: LaboratoryState;
  onChange: (updated: LaboratoryState) => void;
  onSave: () => Promise<void>;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  isLocked?: boolean | undefined;
  /** Patient species as stored on the pet (e.g. "Canine"); species-specific tests are filtered to it by default. */
  patientSpecies?: string | undefined;
}

const SPECIES_ALIASES: Record<string, string> = {
  canine: "Dog", dog: "Dog", feline: "Cat", cat: "Cat", bovine: "Cattle", cattle: "Cattle", cow: "Cattle", buffalo: "Cattle",
  equine: "Horse", horse: "Horse", caprine: "Goat", goat: "Goat", rat: "Rat", rodent: "Rat",
};
/** Library tests are named "Panel - Species"; anything without a species suffix applies to every animal. */
const testSpecies = (name?: string) => name?.match(/ - (Dog|Cat|Cattle|Horse|Goat|Rat)$/)?.[1];

export function LaboratoryOrderSection({
  id = "sec-laboratory",
  visitDate,
  laboratory,
  onChange,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  isLocked = false,
  patientSpecies,
}: LaboratoryOrderSectionProps) {
  const mySpecies = SPECIES_ALIASES[(patientSpecies || "").toLowerCase().trim()];
  const [allSpecies, setAllSpecies] = useState(false);
  const [testSearch, setTestSearch] = useState("");
  const [testDropdownOpen, setTestDropdownOpen] = useState(false);
  const [catalog, setCatalog] = useState<LabTestProfile[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState("All");
  const [viewingTestResults, setViewingTestResults] = useState<FollowUpBloodTestItem | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const baseDate = visitDate || new Date().toISOString().slice(0, 10);

  // Load diagnostic test catalog from MongoDB
  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      setCatalogLoading(true);
      try {
        const rows = await loadTestCatalog();
        if (active) setCatalog(rows || []);
      } catch (e) {
        console.warn("[LaboratoryOrderSection] Could not load test catalog:", e);
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    void fetchCatalog();
    return () => {
      active = false;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setTestDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleEnabled = (enabled: boolean) => {
    if (isLocked) return;
    onChange({
      ...laboratory,
      enabled,
      dueDate: laboratory.dueDate || baseDate,
    });
  };

  const handleSelectQuickDate = (code: string) => {
    if (isLocked) return;
    const computedDate = calculateQuickDate(baseDate, code);
    onChange({
      ...laboratory,
      dueDate: computedDate,
      quickOption: code,
    });
  };

  // Add a test from the catalog into the prescription orders
  const handleAddCatalogTest = (test: LabTestProfile) => {
    if (isLocked) return;
    if (laboratory.bloodTests.some((t) => (t.testName || "").toLowerCase() === test.name.toLowerCase())) {
      setTestSearch("");
      setTestDropdownOpen(false);
      return;
    }

    const newItem: FollowUpBloodTestItem = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      labTestId: test.code,
      testName: test.name,
      category: test.dept || "General",
      panel: test.panel,
      price: Number(test.price) || 0,
      sample: test.sample,
      tat: test.tat,
      parameters: (test.parameters || []).map((p) => ({
        name: p.name,
        unit: p.unit,
        refRange: p.refRange,
      })),
      status: "Ordered",
    };

    onChange({
      ...laboratory,
      enabled: true,
      bloodTests: [...laboratory.bloodTests, newItem],
    });

    setTestSearch("");
    setTestDropdownOpen(false);
  };

  // Add custom typed test
  const handleAddCustomTest = (customName: string) => {
    if (isLocked) return;
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (laboratory.bloodTests.some((t) => (t.testName || "").toLowerCase() === trimmed.toLowerCase())) {
      setTestSearch("");
      setTestDropdownOpen(false);
      return;
    }

    const newItem: FollowUpBloodTestItem = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      testName: trimmed,
      price: 450,
      sample: "Whole Blood EDTA",
      status: "Ordered",
    };

    onChange({
      ...laboratory,
      enabled: true,
      bloodTests: [...laboratory.bloodTests, newItem],
    });

    setTestSearch("");
    setTestDropdownOpen(false);
  };

  const handleRemoveBloodTest = (id: string) => {
    if (isLocked) return;
    onChange({
      ...laboratory,
      bloodTests: laboratory.bloodTests.filter((t) => t.id !== id),
    });
  };

  // Filter catalog tests
  const departments = useMemo(() => {
    const list = Array.from(new Set(catalog.map((t) => t.dept).filter(Boolean)));
    return ["All", ...list];
  }, [catalog]);

  const filteredCatalogTests = useMemo(() => {
    const q = testSearch.toLowerCase().trim();
    return catalog.filter((t) => {
      const matchQ =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.panel?.toLowerCase().includes(q) ||
        t.sample?.toLowerCase().includes(q) ||
        (t.parameters && t.parameters.some((p) => p.name?.toLowerCase().includes(q)));

      const matchD = selectedDept === "All" || t.dept === selectedDept;
      const sp = testSpecies(t.name);
      const matchS = allSpecies || !mySpecies || !sp || sp === mySpecies;
      return matchQ && matchD && matchS;
    });
  }, [catalog, testSearch, selectedDept, allSpecies, mySpecies]);

  const totalEstimatedCost = useMemo(() => {
    return laboratory.bloodTests.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  }, [laboratory.bloodTests]);

  return (
    <SectionCard
      id={id}
      title="7. Laboratory & Diagnostics Orders"
      subtitle="Order blood tests, biochemistry panels & pathology investigations synced with Laboratory module"
      icon={<FlaskConical className="size-4 text-purple-600" />}
      onSave={onSave}
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      saveLabel="Save Lab Tests ✓"
      isLocked={isLocked}
    >
      <div className="space-y-4 text-xs">
        {/* Step 1: Prompt First Ask Yes or No */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0">
              <FlaskConical className="size-4" />
            </span>
            <div>
              <Label className="text-xs font-bold text-foreground block">
                Order Laboratory Tests / Diagnostics for this Patient?
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Send blood tests, hematology, biochemistry, or cytology orders to the clinic laboratory
              </p>
            </div>
          </div>

          {/* YES / NO Segmented Controls */}
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border shadow-2xs shrink-0">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(true)}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                laboratory.enabled
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Check className="size-3" /> Yes
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(false)}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                !laboratory.enabled
                  ? "bg-muted text-foreground font-bold border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <X className="size-3" /> No
            </button>
          </div>
        </div>

        {/* Step 2: If YES -> Show Laboratory Schedule, Orders & Real Catalog Picker */}
        {laboratory.enabled ? (
          <div className="p-4 rounded-xl border border-border/80 bg-card space-y-4 animate-in fade-in-50 duration-200">
            {/* Header with Scheduled Date Badge */}
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs">
                  <Clock className="size-3.5" />
                </span>
                <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                  Laboratory Test Schedule
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-primary">
                Scheduled: {formatDisplayDate(laboratory.dueDate) || "Today"}
              </span>
            </div>

            {/* Quick Date Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                Schedule Date:
              </span>
              {["TODAY", "7D", "1M"].map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectQuickDate(code)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer",
                    laboratory.quickOption === code
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-muted/60 text-foreground border-border hover:bg-muted"
                  )}
                >
                  {code === "TODAY" ? "Today" : code === "7D" ? "7 days" : "1 month"}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <Input
                  type="date"
                  disabled={isLocked}
                  value={laboratory.dueDate || ""}
                  onChange={(e) =>
                    onChange({
                      ...laboratory,
                      dueDate: e.target.value,
                      quickOption: "CUSTOM",
                    })
                  }
                  className="h-8 text-xs font-mono w-36 bg-background"
                />
              </div>
            </div>

            {/* Active Selected Tests List */}
            {laboratory.bloodTests.length > 0 ? (
              <div className="space-y-2.5 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FlaskConical className="size-3 text-primary" />
                    <span>Selected Laboratory Orders ({laboratory.bloodTests.length})</span>
                  </span>
                  {totalEstimatedCost > 0 && (
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                      Est. Total: ₹{totalEstimatedCost.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {laboratory.bloodTests.map((t) => {
                    const isReported = t.status === "Reported" || t.status === "Completed";
                    return (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl border border-border/80 bg-muted/15 flex items-start justify-between gap-2 shadow-2xs hover:border-primary/40 transition-all"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-foreground text-xs">{t.testName}</span>
                            <label className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-primary" title="Edit price">
                              ₹
                              <Input
                                type="number"
                                min={0}
                                disabled={isLocked || isReported}
                                value={t.price ? t.price : ""}
                                placeholder="Price"
                                onChange={(e) =>
                                  onChange({
                                    ...laboratory,
                                    bloodTests: laboratory.bloodTests.map((x) =>
                                      x.id === t.id ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x
                                    ),
                                  })
                                }
                                className="h-6 w-20 px-1.5 text-[11px] font-mono font-bold bg-background"
                              />
                            </label>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                            {t.sample && (
                              <span className="inline-flex items-center gap-1 bg-card px-1.5 py-0.5 rounded border border-border/60">
                                <TestTube2 className="size-2.5 text-primary" /> {t.sample}
                              </span>
                            )}
                            {t.parameters && t.parameters.length > 0 && (
                              <span className="inline-flex items-center gap-1 bg-card px-1.5 py-0.5 rounded border border-border/60">
                                <Layers className="size-2.5 text-sky-600" /> {t.parameters.length} params
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] py-0.5 px-2 font-mono font-bold",
                              isReported
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : t.status === "Sample Collected"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : t.status === "Processing"
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                            )}
                          >
                            {t.status || "Ordered"}
                          </Badge>

                          {isReported && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingTestResults(t)}
                              className="h-6 px-2 text-[10px] font-bold text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                              title="View reported test parameters and observed values"
                            >
                              <FileCheck className="size-3" /> View Results
                            </Button>
                          )}

                          {!isLocked && t.status === "Ordered" && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBloodTest(t.id)}
                              className="hover:text-destructive hover:bg-destructive/10 rounded p-1 transition-colors cursor-pointer text-muted-foreground"
                              title="Remove test"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border/80 bg-muted/10 text-center text-muted-foreground text-xs">
                No laboratory tests added yet. Search or select from common diagnostic tests below.
              </div>
            )}

            {/* Diagnostic Test Catalog Search & Picker */}
            {!isLocked && (
              <div className="space-y-2 pt-2 border-t border-border/60" ref={searchContainerRef}>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Search className="size-3 text-primary" />
                    <span>Search Diagnostic Catalog &amp; Panels:</span>
                  </Label>
                  {mySpecies && (
                    <div className="flex items-center gap-1">
                      {[{ v: false, label: `${mySpecies} tests` }, { v: true, label: "All species" }].map((o) => (
                        <button
                          key={o.label}
                          type="button"
                          onClick={() => setAllSpecies(o.v)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap",
                            allSpecies === o.v ? "bg-emerald-600 text-white border-emerald-600" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {departments.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-sm">
                      {departments.map((dept) => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDept(dept)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap",
                            selectedDept === dept
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={testSearch}
                    onChange={(e) => {
                      setTestSearch(e.target.value);
                      setTestDropdownOpen(true);
                    }}
                    onFocus={() => setTestDropdownOpen(true)}
                    placeholder="Search diagnostic test by name, panel, specimen, or parameter..."
                    className="h-9 text-xs pl-8 bg-background"
                  />
                  {testSearch && (
                    <button
                      type="button"
                      onClick={() => setTestSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu of Matching Catalog Tests */}
                {testDropdownOpen && (
                  <div className="mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/60 animate-in fade-in slide-in-from-top-1 duration-200">
                    {filteredCatalogTests.length > 0 ? (
                      filteredCatalogTests.map((test) => {
                        const isAlreadyOrdered = laboratory.bloodTests.some(
                          (t) => (t.testName || "").toLowerCase() === test.name.toLowerCase()
                        );
                        return (
                          <div
                            key={test.code}
                            onClick={() => !isAlreadyOrdered && handleAddCatalogTest(test)}
                            className={cn(
                              "group flex items-center justify-between gap-3 px-3 py-1.5 text-xs transition-colors",
                              isAlreadyOrdered ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-primary/5"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-semibold text-foreground">{test.name}</span>
                                {test.urgentAvailable && <span className="text-[9px] font-bold text-amber-600">STAT</span>}
                              </div>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {[test.dept, test.sample, test.tat, test.parameters?.length ? `${test.parameters.length} params` : ""].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {Number(test.price) > 0 ? `₹${Number(test.price).toLocaleString("en-IN")}` : "—"}
                              </span>
                              {isAlreadyOrdered ? (
                                <Check className="size-4 text-emerald-600" aria-label="Added" />
                              ) : (
                                <span className="inline-flex size-6 items-center justify-center rounded-md border border-border text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                                  <Plus className="size-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No catalog tests match &ldquo;{testSearch}&rdquo;.
                      </div>
                    )}

                    {/* Option to add custom test */}
                    {testSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => handleAddCustomTest(testSearch.trim())}
                        className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-primary/5 flex items-center justify-between font-semibold cursor-pointer"
                      >
                        <span>+ Add Custom Unlisted Test &ldquo;{testSearch.trim()}&rdquo;</span>
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* When NO is selected */
          <div className="p-4 rounded-xl border border-dashed border-border/70 bg-muted/10 text-center space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              No laboratory tests or diagnostics requested for this patient visit.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLocked}
              onClick={() => handleToggleEnabled(true)}
              className="h-7 text-xs font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
            >
              + Order Lab Tests
            </Button>
          </div>
        )}
      </div>

      {/* ── Dialog to View Reported Lab Results in Consultation ── */}
      {viewingTestResults && (
        <Dialog open={Boolean(viewingTestResults)} onOpenChange={(v) => !v && setViewingTestResults(null)}>
          <DialogContent className="max-w-2xl border-border bg-card shadow-2xl p-0 gap-0">
            <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
                  <FileCheck className="size-4" />
                </span>
                <div>
                  <DialogTitle className="text-sm font-bold text-foreground">
                    Laboratory Results: {viewingTestResults.testName}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Specimen: {viewingTestResults.sample || "Whole Blood"} · Status: {viewingTestResults.status || "Reported"}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                Diagnostic Report
              </Badge>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {viewingTestResults.results && viewingTestResults.results.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-2">Parameter</th>
                        <th className="px-3 py-2">Observed Result</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Ref Interval</th>
                        <th className="px-3 py-2">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewingTestResults.results.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold text-foreground">{r.name}</td>
                          <td className="px-3 py-2 font-mono font-bold text-foreground">{r.value || "—"}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{r.unit || "—"}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{r.refRange || "—"}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold",
                                r.flag === "High"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                                  : r.flag === "Low"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40"
                                  : r.flag === "Critical"
                                  ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40"
                                  : r.flag === "Normal"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {r.flag || "Normal"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : viewingTestResults.parameters && viewingTestResults.parameters.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground font-medium">
                    Parameters assigned for this investigation ({viewingTestResults.parameters.length}):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {viewingTestResults.parameters.map((p, i) => (
                      <div key={i} className="p-2 rounded-lg border border-border bg-muted/20 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{p.name}</span>
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {p.refRange ? `${p.refRange} ${p.unit}` : p.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic text-center py-4">
                  No individual parameter values recorded yet. Laboratory investigation is pending or sample in transit.
                </p>
              )}

              {viewingTestResults.impression && (
                <div className="p-3 rounded-xl border border-border bg-primary/5 space-y-1">
                  <span className="font-bold text-foreground text-[11px] flex items-center gap-1">
                    <Sparkles className="size-3 text-primary" /> Pathologist Impression:
                  </span>
                  <p className="text-xs text-foreground leading-relaxed">{viewingTestResults.impression}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/20 border-t border-border flex justify-end">
              <Button type="button" size="sm" onClick={() => setViewingTestResults(null)} className="h-7 text-xs">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </SectionCard>
  );
}
