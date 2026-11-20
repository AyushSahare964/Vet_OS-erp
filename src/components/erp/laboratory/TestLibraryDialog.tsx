import { useMemo, useState } from "react";
import { BookOpen, Check, CheckCircle2, Loader2, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LAB_TEST_LIBRARY, type LibraryPanel } from "@/lib/erp/labTestLibrary";
import { cn } from "@/lib/utils";

const SPECIES = ["All", ...Array.from(new Set(LAB_TEST_LIBRARY.map((p) => p.species)))];
const paramCount = (p: LibraryPanel) => p.groups.reduce((n, g) => n + g.parameters.length, 0);

/**
 * Searchable library of ready-made species panels. Click a panel to preview its default parameters, tick several
 * to add them to the catalog in one go; panels already in the catalog are marked and cannot be added twice.
 */
export function TestLibraryDialog({
  open,
  onClose,
  onUse,
  addedIds,
  onAddMany,
}: {
  open: boolean;
  onClose: () => void;
  /** Load one panel into the New Test form to edit before saving. */
  onUse: (panel: LibraryPanel) => void;
  /** Library panels already in the catalog (same name and parameters). */
  addedIds: Set<string>;
  /** Add the given panels to the catalog in one go. */
  onAddMany: (panels: LibraryPanel[]) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState("All");
  const [selectedId, setSelectedId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return LAB_TEST_LIBRARY.filter(
      (p) =>
        (species === "All" || p.species === species) &&
        (!needle ||
          [p.panel, p.species, p.dept, p.sample, ...p.groups.flatMap((g) => [g.name, ...g.parameters.map((x) => x.name)])]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    ).sort((a, b) => a.panel.localeCompare(b.panel) || a.species.localeCompare(b.species));
  }, [q, species]);

  const selected = list.find((p) => p.id === selectedId);
  const pickable = list.filter((p) => !addedIds.has(p.id));
  const checkedList = LAB_TEST_LIBRARY.filter((p) => checked.has(p.id) && !addedIds.has(p.id));
  const allShownChecked = pickable.length > 0 && pickable.every((p) => checked.has(p.id));

  const toggle = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAllShown = () =>
    setChecked((prev) => {
      const n = new Set(prev);
      pickable.forEach((p) => (allShownChecked ? n.delete(p.id) : n.add(p.id)));
      return n;
    });
  const addSelected = async () => {
    setAdding(true);
    try {
      await onAddMany(checkedList);
      setChecked(new Set());
    } finally {
      setAdding(false);
    }
  };

  const AddedBadge = ({ className }: { className?: string }) => (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700", className)}>
      <CheckCircle2 className="size-3" /> Already added
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-5 py-3 pr-12">
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <BookOpen className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-sm font-bold">Veterinary Test Library</DialogTitle>
            <p className="text-[11px] text-muted-foreground">
              {LAB_TEST_LIBRARY.length} ready-made panels with default parameters, units and reference ranges
            </p>
          </div>
        </div>

        <div className="space-y-2 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by panel, species, department or parameter (e.g. creatinine, dog, LFT)…"
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SPECIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpecies(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-bold transition-colors",
                  species === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid h-[48vh] grid-cols-1 md:grid-cols-[340px_1fr]">
          <div className="flex min-h-0 flex-col border-r border-border">
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-bold">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={allShownChecked}
                disabled={pickable.length === 0}
                onChange={toggleAllShown}
              />
              Select all shown ({pickable.length})
              <span className="ml-auto font-normal text-muted-foreground">{addedIds.size} already added</span>
            </label>
            <div className="flex-1 overflow-y-auto p-2">
              {list.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No panels match your search.</p>}
              {list.map((p) => {
                const added = addedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(p.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(p.id)}
                    className={cn(
                      "mb-1 flex w-full cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                      selected?.id === p.id ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:bg-muted/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                      checked={checked.has(p.id) && !added}
                      disabled={added}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(p.id)}
                      aria-label={`Select ${p.panel} ${p.species}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold leading-tight">{p.panel}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{p.species}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {p.dept} · {p.groups.length} test{p.groups.length > 1 ? "s" : ""} · {paramCount(p)} parameters
                      </p>
                      {added && <AddedBadge className="mt-1" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col" key={selected?.id ?? "none"}>
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 animate-in fade-in duration-200">
                  <div className="mr-auto">
                    <h3 className="text-sm font-bold">{selected.panel}</h3>
                    <p className="text-[11px] text-muted-foreground">{selected.species} · {selected.dept} · {selected.sample}</p>
                  </div>
                  {addedIds.has(selected.id) && <AddedBadge className="px-2 text-[11px]" />}
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={addedIds.has(selected.id)} onClick={() => onUse(selected)}>
                    <Check className="size-4" /> Edit before adding
                  </Button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 animate-in fade-in duration-200">
                  {selected.groups.map((g) => (
                    <div key={g.name} className="overflow-hidden rounded-lg border border-border">
                      <div className="bg-muted/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {g.name} <span className="font-mono opacity-70">({g.parameters.length})</span>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[10px] uppercase text-muted-foreground">
                            <th className="px-3 py-1 font-semibold">Parameter</th>
                            <th className="px-3 py-1 font-semibold">Normal range</th>
                            <th className="px-3 py-1 font-semibold">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.parameters.map((x) => (
                            <tr key={x.name} className="border-t border-border/60">
                              <td className="px-3 py-1.5 font-medium">{x.name}</td>
                              <td className="px-3 py-1.5 font-mono">{x.refRange}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{x.unit || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="m-auto max-w-xs space-y-1 p-6 text-center text-muted-foreground">
                <BookOpen className="mx-auto size-8 opacity-40" />
                <p className="text-xs font-semibold">No panel selected</p>
                <p className="text-[11px]">Click a panel to preview its parameters, or tick several and add them all in one go.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-5 py-3">
          <p className="mr-auto text-xs text-muted-foreground">
            {checkedList.length > 0
              ? `${checkedList.length} panel${checkedList.length > 1 ? "s" : ""} selected (${checkedList.reduce((n, p) => n + paramCount(p), 0)} parameters). Prices can be set later.`
              : "Tick panels on the left to add several at once."}
          </p>
          {checkedList.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
              Clear
            </Button>
          )}
          <Button size="sm" className="gap-1.5" disabled={checkedList.length === 0 || adding} onClick={addSelected}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add {checkedList.length > 0 ? `${checkedList.length} selected` : "selected"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
