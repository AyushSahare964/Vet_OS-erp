import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  CheckCircle2,
  X,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Archetype Definitions for Reference ───────────────────────────────────────

export interface PackagingArchetype {
  id: string;
  name: string;
  category: string;
  purchaseUnit: string;
  defaultInterUnits: number;
  hasIntermediate: boolean;
  intermediateUnit: string;
  defaultBasePerInter: number;
  baseUnit: string;
  purchaseImage: string;
  middleImage?: string;
  baseImage: string;
  description: string;
}

export const ARCHETYPES: PackagingArchetype[] = [
  {
    id: "medicine",
    name: "Solid Medicine (Box → Strip → Tablet)",
    category: "Medicine",
    purchaseUnit: "Box",
    hasIntermediate: true,
    intermediateUnit: "Strip",
    defaultInterUnits: 10,
    baseUnit: "Tablet",
    defaultBasePerInter: 10,
    purchaseImage: "/packaging/box_medicine.jpg",
    middleImage: "/packaging/strip_tablets.jpg",
    baseImage: "/packaging/tablet_blue.jpg",
    description: "Standard blister-packed tablets, capsules, and pills.",
  },
  {
    id: "vaccine",
    name: "Vaccine / Injectable (Box → Vial → Dose)",
    category: "Vaccine",
    purchaseUnit: "Box",
    hasIntermediate: true,
    intermediateUnit: "Vial",
    defaultInterUnits: 10,
    baseUnit: "Dose",
    defaultBasePerInter: 10,
    purchaseImage: "/packaging/box_vaccine.jpg",
    middleImage: "/packaging/vial_vaccine.jpg",
    baseImage: "/packaging/syringe_dose.jpg",
    description: "Multi-dose and single-dose veterinary injectables.",
  },
  {
    id: "syrup",
    name: "Oral Liquid / Syrup (Box → Bottle → ml)",
    category: "Liquid / Syrup",
    purchaseUnit: "Box",
    hasIntermediate: true,
    intermediateUnit: "Bottle",
    defaultInterUnits: 1,
    baseUnit: "ml",
    defaultBasePerInter: 100,
    purchaseImage: "/packaging/box_medicine.jpg",
    middleImage: "/packaging/bottle_syrup.jpg",
    baseImage: "/packaging/cup_ml.jpg",
    description: "Liquid syrups, oral suspensions, and tonics.",
  },
  {
    id: "dry_food",
    name: "Pet Food - Dry Kibble (Sack → Bag → Gm)",
    category: "Animal Food",
    purchaseUnit: "Sack",
    hasIntermediate: true,
    intermediateUnit: "Bag",
    defaultInterUnits: 4,
    baseUnit: "Gm",
    defaultBasePerInter: 1000,
    purchaseImage: "/packaging/bag_petfood.jpg",
    middleImage: "/packaging/bag_petfood.jpg",
    baseImage: "/packaging/kibble_scoop.jpg",
    description: "Bulk dry kibble sacks divided into retail bags & gram scoops.",
  },
  {
    id: "wet_food",
    name: "Pet Food - Wet Cans (Tray → Can → Gm)",
    category: "Animal Food",
    purchaseUnit: "Tray",
    hasIntermediate: true,
    intermediateUnit: "Can",
    defaultInterUnits: 12,
    baseUnit: "Gm",
    defaultBasePerInter: 400,
    purchaseImage: "/packaging/box_medicine.jpg",
    middleImage: "/packaging/can_petfood.jpg",
    baseImage: "/packaging/kibble_scoop.jpg",
    description: "Canned wet food and pate tins in supplier trays.",
  },
  {
    id: "ointment",
    name: "Ointment / Topical (Box → Tube → Gm)",
    category: "Ointment",
    purchaseUnit: "Box",
    hasIntermediate: true,
    intermediateUnit: "Tube",
    defaultInterUnits: 1,
    baseUnit: "Gm",
    defaultBasePerInter: 50,
    purchaseImage: "/packaging/box_medicine.jpg",
    middleImage: "/packaging/tube_ointment.jpg",
    baseImage: "/packaging/tube_ointment.jpg",
    description: "Topical creams, ointments, eye drops, and gels.",
  },
];

// "1 Tablet", "2 Tablets", "13 ml" — no "1 Tablets"; measure units never get an "s".
const qty = (n: number, unit: string) =>
  `${n} ${n === 1 || /^(ml|ltr|gm|kg|mg|cc)$/i.test(unit) || /s$/i.test(unit) ? unit : unit + "s"}`;

// ─── Dynamic Image Matcher for Any Unit Input ─────────────────────────────────

  export function resolvePackagingImage(
    unitName: string,
    tier: "purchase" | "middle" | "base",
    productType: string = "MEDICINE"
  ): string {
    const u = (unitName || "").toLowerCase().trim();
    const pt = (productType || "").toLowerCase().trim();

    // Tier 1: Outer / Purchase Unit
    if (tier === "purchase") {
      if (u.includes("sack") || u.includes("bag")) {
        return "/packaging/bag_petfood.jpg";
      }
      // A loose unit bought directly (single tablet, kg, ml...) shows its own picture.
      if (/^(tablet|capsule|pill|bolus|pellet|dose|syringe|drop|ml|ltr|gm|kg|mg)s?$/.test(u)) {
        return resolvePackagingImage(unitName, "base", productType);
      }
      // The outer unit may itself be a bottle/vial/tube/can: show that, not a box.
      if (/bottle|syrup|jar|flask|vial|ampoule|tube|ointment|cream|gel|can\b|tin\b|strip|blister|pouch|sachet/.test(u)) {
        return resolvePackagingImage(unitName, "middle", productType);
      }
      if (pt.includes("vaccine") || pt.includes("injection")) {
        return "/packaging/box_vaccine.jpg";
      }
      return "/packaging/box_medicine.jpg";
    }

    // Tier 2: Middle / Intermediate Unit
    if (tier === "middle") {
      if (u.includes("vial") || u.includes("ampoule")) {
        return "/packaging/vial_vaccine.jpg";
      }
      if (u.includes("strip") || u.includes("blister")) {
        return "/packaging/strip_tablets.jpg";
      }
      if (u.includes("bottle") || u.includes("syrup") || u.includes("jar") || u.includes("flask")) {
        return "/packaging/bottle_syrup.jpg";
      }
      if (u.includes("can") || u.includes("tin")) {
        return "/packaging/can_petfood.jpg";
      }
      if (u.includes("tube") || u.includes("ointment") || u.includes("cream") || u.includes("gel")) {
        return "/packaging/tube_ointment.jpg";
      }
      if (u.includes("bag") || u.includes("pouch") || u.includes("sachet") || u.includes("sack")) {
        return "/packaging/bag_petfood.jpg";
      }
      return "/packaging/strip_tablets.jpg";
    }

      // Tier 3: Base / Atomic Unit
      if (
        u.includes("dose") ||
        u.includes("syringe") ||
        u.includes("shot") ||
        u.includes("needle") ||
        pt.includes("vaccine") ||
        pt.includes("injection")
      ) {
        return "/packaging/syringe_dose.jpg";
      }
        if (
          u.includes("ml") ||
          u.includes("drop") ||
          u.includes("liquid") ||
          u.includes("fluid") ||
          u.includes("spoon") ||
          u.includes("cc") ||
          u.includes("ltr")
        ) {
          return "/packaging/cup_ml.jpg";
        }
          if (
            u.includes("gm") ||
            u.includes("kg") ||
            u.includes("scoop") ||
            u.includes("kibble") ||
            u.includes("gram") ||
            pt.includes("food") ||
            pt.includes("diet")
          ) {
            return "/packaging/kibble_scoop.jpg";
          }
          if (
            u.includes("tube") ||
            u.includes("ointment") ||
            u.includes("cream") ||
            u.includes("gel") ||
            u.includes("application")
          ) {
            return "/packaging/tube_ointment.jpg";
          }
          if (
            u.includes("tablet") ||
            u.includes("capsule") ||
            u.includes("pill") ||
            u.includes("bolus") ||
            u.includes("pellet") ||
            u.includes("chew")
          ) {
            return "/packaging/tablet_blue.jpg";
          }

          // Fallbacks by product type
          if (pt.includes("injection") || pt.includes("vaccine")) {
            return "/packaging/syringe_dose.jpg";
          }
          return "/packaging/tablet_blue.jpg";
        }

        // ─── Modal Props ──────────────────────────────────────────────────────────────

        export interface PackagingVisualizerModalProps {
          open: boolean;
          onClose: () => void;
          itemName?: string | undefined;
          productType?: string | undefined;
          purchaseUnit: string;
          baseUnit: string;
          hasIntermediate: boolean;
          intermediateUnit?: string | undefined;
          intermediateUnitsPerPurchase?: number | string | undefined;
          baseUnitsPerIntermediate?: number | string | undefined;
          baseUnitsPerPurchase: number;
          purchasePrice?: string | number | undefined;
          mrp?: string | number | undefined;
          salePrice?: string | number | undefined;
          onApplyArchetype?: ((config: {
            purchaseUnit: string;
            hasIntermediate: boolean;
            intermediateUnit?: string | undefined;
            intermediateUnitsPerPurchase?: number | undefined;
            baseUnitsPerIntermediate?: number | undefined;
            baseUnit: string;
          }) => void) | undefined;
        }

        // ─── Main Component: Focused Packaging Hierarchy Visualizer ──────────────────

        export function PackagingVisualizerModal({
          open,
          onClose,
          itemName,
          productType = "MEDICINE",
          purchaseUnit,
          baseUnit,
          hasIntermediate,
          intermediateUnit = "",
          intermediateUnitsPerPurchase = 1,
          baseUnitsPerIntermediate = 1,
          baseUnitsPerPurchase,
          onApplyArchetype,
        }: PackagingVisualizerModalProps) {
          // Selected archetype filter: defaults to "custom" (the exact active hierarchy from form)
          const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>("custom");

          // Determine current active units based on selected archetype or user inputs
          const currentArchetype = useMemo(() => {
            if (selectedArchetypeId === "custom") return null;
            return ARCHETYPES.find((a) => a.id === selectedArchetypeId) || null;
          }, [selectedArchetypeId]);

          const pUnit = currentArchetype ? currentArchetype.purchaseUnit : purchaseUnit?.trim() || "Box";
          const bUnit = currentArchetype ? currentArchetype.baseUnit : baseUnit?.trim() || "Tablet";
          const iUnit = currentArchetype ? currentArchetype.intermediateUnit : intermediateUnit?.trim() || "Strip";
          const withIntermediate = currentArchetype ? currentArchetype.hasIntermediate : hasIntermediate;

          const numInter = currentArchetype
            ? currentArchetype.defaultInterUnits
            : Math.max(1, Number(intermediateUnitsPerPurchase) || 1);

          const numBasePerInter = currentArchetype
            ? currentArchetype.defaultBasePerInter
            : Math.max(1, Number(baseUnitsPerIntermediate) || 1);

          const totalBase = currentArchetype
            ? withIntermediate
              ? numInter * numBasePerInter
              : numInter
            : Math.max(
              1,
              baseUnitsPerPurchase || (withIntermediate ? numInter * numBasePerInter : numInter)
            );

          // Images for each level
          const purchaseImg = currentArchetype
            ? currentArchetype.purchaseImage
            : resolvePackagingImage(pUnit, "purchase", productType);

          const middleImg = currentArchetype
            ? currentArchetype.middleImage || "/packaging/strip_tablets.jpg"
            : resolvePackagingImage(iUnit, "middle", productType);

          const baseImg = currentArchetype
            ? currentArchetype.baseImage
            : resolvePackagingImage(bUnit, "base", productType);

          // Bought and counted in the same unit (e.g. a single Tablet): one level, not two.
          const sameUnit = !withIntermediate && pUnit.toLowerCase() === bUnit.toLowerCase();

          const equationString = sameUnit
            ? `Bought & counted in ${bUnit}`
            : withIntermediate
              ? `1 ${pUnit} = ${qty(numInter, iUnit)} = ${qty(totalBase, bUnit)}`
              : `1 ${pUnit} = ${qty(totalBase, bUnit)}`;

          return (
            <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
                <DialogContent className="max-w-4xl w-[94vw] h-[540px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl rounded-2xl select-none">
                  {/* ── Dialog Header ── */}
                  <div className="flex items-center justify-between px-6 py-3 bg-slate-50/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                          <Package className="size-4" />
                        </div>
                        <div>
                          <DialogTitle className="text-xs md:text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-wider uppercase leading-none">
                            Packaging Hierarchy Visualization
                          </DialogTitle>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {itemName ? `"${itemName}"` : "New Inventory Item"} • Realistic Physical Packaging View
                          </div>
                        </div>
                      </div>

                        <div className="flex items-center gap-3">
                          {/* Quick Archetype Switcher to preview and adapt other packaging bases */}
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shadow-2xs">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Packaging Base:
                            </span>
                            <select
                              value={selectedArchetypeId}
                              onChange={(e) => setSelectedArchetypeId(e.target.value)}
                              className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-transparent border-none outline-none cursor-pointer pr-1"
                            >
                              <option value="custom">
                                {itemName ? `${itemName.slice(0, 18)} (Current)` : "Configured Hierarchy"}
                              </option>
                              {ARCHETYPES.map((arch) => (
                                <option key={arch.id} value={arch.id}>
                                  {arch.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={onClose}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Close"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>

                          {/* ── Sub-header: Dynamic Equation Badge ── */}
                          <div className="px-6 py-2 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/70 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900/40 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                Conversion Ratio:
                              </span>
                              <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 px-3 py-0.5 rounded-full shadow-2xs">
                                {equationString}
                              </span>
                            </div>

                            {selectedArchetypeId !== "custom" && onApplyArchetype && currentArchetype && (
                              <button
                                type="button"
                                onClick={() => {
                                  onApplyArchetype({
                                    purchaseUnit: currentArchetype.purchaseUnit,
                                    hasIntermediate: currentArchetype.hasIntermediate,
                                    intermediateUnit: currentArchetype.intermediateUnit,
                                    intermediateUnitsPerPurchase: currentArchetype.defaultInterUnits,
                                    baseUnitsPerIntermediate: currentArchetype.defaultBasePerInter,
                                    baseUnit: currentArchetype.baseUnit,
                                  });
                                  setSelectedArchetypeId("custom");
                                }}
                                className="h-6 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1"
                              >
                                <Sparkles className="size-3" />
                                <span>Apply this Base Structure to Item</span>
                              </button>
                            )}
                          </div>

                          {/* ── Main Stage: Single Window Packaging Hierarchy (Zero Scrolling) ── */}
                          <div className="flex-1 px-6 py-4 flex items-center justify-center overflow-hidden">
                            <div className="w-full max-w-3xl flex items-center justify-center gap-3 md:gap-5">
                              {!sameUnit && (<>
                              {/* ── CARD 1: Outer Purchase Unit ── */}
                              <div className="flex-1 max-w-[270px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between h-[300px] transition-all hover:border-blue-300 dark:hover:border-blue-800">
                                <div>
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                                      Level 1 (Outer)
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                      Purchase Unit
                                    </span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    1 {pUnit}{" "}
                                    <span className="font-medium text-xs text-slate-400 dark:text-slate-500">
                                      ({withIntermediate ? qty(numInter, iUnit) : qty(totalBase, bUnit)})
                                    </span>
                                  </div>
                                </div>

                                {/* Real studio photograph */}
                                <div className="w-full flex-1 flex items-center justify-center overflow-hidden my-2">
                                  <img
                                    src={purchaseImg}
                                    alt={`1 ${pUnit}`}
                                    className="max-h-[140px] w-auto object-contain rounded-lg select-none transition-transform duration-200 hover:scale-105"
                                    loading="eager"
                                  />
                                </div>

                            {/* Sub-info */}
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
                              <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                Holds {qty(totalBase, bUnit)} total
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Supplier Invoices &amp; Goods Receipt
                              </div>
                            </div>
                          </div>

            {/* ── ARROW 1 ── */ }
                                < div className = "flex flex-col items-center justify-center shrink-0" >
              <div className="size-9 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 shadow-2xs">
                <ArrowRight className="size-4" />
              </div>
              <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 mt-1 text-center max-w-[80px] leading-tight">
                {withIntermediate ? qty(numInter, iUnit) : qty(totalBase, bUnit)}
              </span>
            </div>
            </>)}

                          {/* ── CARD 2: Middle Unit (if has intermediate) ── */}
                          {withIntermediate && (
                            <>
                              <div className="flex-1 max-w-[270px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between h-[300px] transition-all hover:border-sky-300 dark:hover:border-sky-800">
                                <div>
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                    <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider">
                                      Level 2 (Middle)
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                      Dispensing Pack
                                    </span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                    1 {iUnit}{" "}
                                    <span className="font-medium text-xs text-slate-400 dark:text-slate-500">
                                      ({qty(numBasePerInter, bUnit)})
                                    </span>
                                  </div>
                                </div>

                                {/* Real studio photograph */}
                                <div className="w-full flex-1 flex items-center justify-center overflow-hidden my-2">
                                  <img
                                    src={middleImg}
                                    alt={`1 ${iUnit}`}
                                    className="max-h-[140px] w-auto object-contain rounded-lg select-none transition-transform duration-200 hover:scale-105"
                                    loading="eager"
                                  />
                                </div>

                                {/* Sub-info */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
                                  <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                                    Holds {qty(numBasePerInter, bUnit)} each
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Retail Pack Dispensing
                                  </div>
                                </div>
                              </div>

                              {/* ── ARROW 2 ── */}
                              <div className="flex flex-col items-center justify-center shrink-0">
                                <div className="size-9 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 shadow-2xs">
                                  <ArrowRight className="size-4" />
                                </div>
                                <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 mt-1 text-center max-w-[80px] leading-tight">
                                  {qty(numBasePerInter, bUnit)}
                                </span>
                              </div>
                            </>
                          )}

                          {/* ── CARD 3: Single (Base) Unit ── */}
                          <div className="flex-1 max-w-[270px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs flex flex-col justify-between h-[300px] transition-all hover:border-emerald-300 dark:hover:border-emerald-800">
                            <div>
                              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                  Level {withIntermediate ? "3" : sameUnit ? "1" : "2"} (Base)
                                </span>
                                <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                  Atomic Unit
                                </span>
                              </div>
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                1 {bUnit}{" "}
                                <span className="font-medium text-xs text-slate-400 dark:text-slate-500">
                                  (base unit)
                                </span>
                              </div>
                            </div>

                            {/* Real studio photograph */}
                            <div className="w-full flex-1 flex items-center justify-center overflow-hidden my-2">
                              <img
                                src={baseImg}
                                alt={`1 ${bUnit}`}
                                className="max-h-[140px] w-auto object-contain rounded-lg select-none transition-transform duration-200 hover:scale-105"
                                loading="eager"
                              />
                            </div>

                            {/* Sub-info */}
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
                              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                Smallest Inventory Unit
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Doctor Prescriptions &amp; Count
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Dialog Footer (Inventory Rule & Done) ── */}
                      <div className="px-6 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                            <span>
                              {sameUnit ? (
                                <>Stock is bought, audited and dispensed in <strong>{bUnit}</strong> — no conversion.</>
                              ) : (
                                <>Stock is audited strictly in <strong>{bUnit}</strong>. Receiving 1 {pUnit} automatically registers <strong>{qty(totalBase, bUnit)}</strong> into ledger.</>
                              )}
                            </span>
                        </div>

                        <button
                          type="button"
                          onClick={onClose}
                          className="h-8 px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  );
}
