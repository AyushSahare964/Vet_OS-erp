import { useState, useEffect, useMemo, type ReactNode } from "react";
import { X, PackagePlus, Save, Pill, Syringe, Bone, Tag, Package, Plus, Trash2, type LucideIcon, Layers, IndianRupee, Calendar, PackageCheck, Sparkles, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { addItemFn, updateItemFn, peekItemCodeFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { PackagingVisualizerModal } from "@/components/erp/inventory/PackagingVisualizerModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProductType = InventoryItemRow["productType"];

interface NewItemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (created: InventoryItemRow) => void;
  initialName?: string | undefined;
  defaultType?: ProductType | undefined;
  supplierId?: string | undefined;
  supplierName?: string | undefined;
  /** Edit mode: prefill from this item and save changes instead of creating. */
  editing?: InventoryItemRow | undefined;
}

const GST_RATES = [
  { label: "0% (Exempt / Nil)", value: "0" },
  { label: "5%", value: "5" },
  { label: "12%", value: "12" },
  { label: "18%", value: "18" },
  { label: "28%", value: "28" },
];
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Drops", "Ointment", "Cream", "Powder"];
const UNIT_SUGGESTIONS = [
  "Tablet", "Capsule", "Strip", "Blister", "Box", "Carton", "Case", "Vial", "Ampoule", "Bottle", "Tube", "Sachet", "Pouch",
  "Pack", "Packet", "Bag", "Sack", "Jar", "Can", "Tin", "Tray", "Roll", "Set", "Kit", "Dozen", "Pair", "Piece", "Unit",
  "Syringe", "Dose", "Pellet", "Drop", "ml", "Ltr", "Gm", "Kg", "Mg",
];
// Real-world packaging: what a given container can physically hold (next level down).
const TABLET_LIKE = ["Tablet", "Capsule", "Piece"];
const CONTAINS: Record<string, string[]> = {
  box: ["Strip", "Blister", "Bottle", "Vial", "Ampoule", "Tube", "Sachet", "Pouch", "Jar", "Can", "Tin", "Bag", "Syringe", "Tablet", "Capsule", "Dose", "Piece", "Unit"],
  strip: TABLET_LIKE, blister: TABLET_LIKE,
  bottle: ["ml", "Ltr", "Tablet", "Capsule", "Drop", "Dose", "Gm", "Piece"],
  jar: ["Gm", "Kg", "ml", "Tablet", "Capsule", "Piece"],
  vial: ["Dose", "ml", "Piece"], ampoule: ["Dose", "ml", "Piece"],
  tube: ["Gm", "ml", "Piece"],
  sachet: ["Gm", "ml", "Dose", "Piece"], pouch: ["Gm", "Kg", "ml", "Dose", "Piece"],
  bag: ["Gm", "Kg", "Piece"], sack: ["Bag", "Gm", "Kg"],
  can: ["Gm", "Kg", "ml", "Piece"], tin: ["Gm", "Kg", "ml", "Piece"],
  tray: ["Can", "Tin", "Pouch", "Bottle", "Strip", "Piece"],
  roll: ["Piece", "Unit"], set: ["Piece", "Unit"], kit: ["Piece", "Unit"], dozen: ["Piece", "Unit"], pair: ["Piece", "Unit"],
};
for (const k of ["carton", "case", "pack", "packet"]) CONTAINS[k] = CONTAINS["box"] ?? [];
// Units that only make sense as the smallest (base) unit — never a purchase/middle unit.
const BASE_ONLY = new Set(["tablet", "capsule", "dose", "pellet", "drop", "ml", "ltr", "gm", "kg", "mg", "syringe"]);
// Containers first, then loose units (you can buy a single Tablet / Kg directly).
const CONTAINER_OPTIONS = UNIT_SUGGESTIONS.filter((u) => !BASE_ONLY.has(u.toLowerCase()));
const PURCHASE_OPTIONS = [...CONTAINER_OPTIONS, ...UNIT_SUGGESTIONS.filter((u) => BASE_ONLY.has(u.toLowerCase()))];
const unitsBelow = (unit: string, containersOnly = false) => {
  // A loose unit bought directly is its own base unit.
  if (BASE_ONLY.has(unit.trim().toLowerCase())) return containersOnly ? [] : [unit.trim()];
  const list = CONTAINS[unit.trim().toLowerCase()];
  if (!list) return containersOnly ? CONTAINER_OPTIONS : UNIT_SUGGESTIONS; // custom/unknown unit: don't restrict
  return containersOnly ? list.filter((u) => !BASE_ONLY.has(u.toLowerCase())) : list;
};
const SUB_GROUPS = [
  "Antibiotics",
  "Antifungal",
  "Antiparasitic / Dewormer",
  "NSAID",
  "Antisteroids",
  "Antihistamine",
  "Liver Supplement",
  "Kidney Supplement",
  "Gut Support",
  "Multivitamin",
  "Calcium Supplement",
  "Supplement",
  "Medicated Shampoo",
  "Shampoo",
  "Prescription Food",
];
const ACCESSORY_GROUPS = ["Collar / Leash / Harness", "Bowl / Feeder", "Bed / Mattress", "Toy", "Clothing", "Carrier / Crate", "Grooming Tools", "Hygiene / Litter"];
const CONSUMABLE_GROUPS = [
  "Cotton & Gauze", "Gloves", "Syringes & Needles", "Sutures", "Bandages & Dressings", "Swabs & Ear Buds",
  "IV Sets & Cannulas", "Catheters & Tubes", "Cleaning & Disinfection", "Disposable Sheets & Masks", "Lab Consumables",
];
const INJECTION_GROUPS = ["Antibiotic", "Vaccine", "NSAID / Analgesic", "Steroid", "Antiemetic", "Vitamin / Mineral", "Anaesthetic / Sedative", "Hormone", "Antiparasitic", "Fluid / Electrolyte", "Emergency / Critical Care"];
const INJ_PURCHASE = ["Box", "Carton", "Pack", "Vial", "Ampoule", "Bottle", "Syringe"];
const INJ_MIDDLE = ["Pack", "Tray", "Strip", "Carton"];
const INJ_BASE = ["Vial", "Ampoule", "Syringe", "Bottle", "Dose", "ml"];
const INJ_ROUTES = ["IM", "IV", "SC", "IP", "ID", "IV Infusion", "Intra-articular"];
const COLOURS = ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Brown", "Grey", "Orange", "Purple", "Multi"];
const SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "Free Size"];
const r2 = (n: number) => Math.round(n * 100) / 100;

/** One size / colour combination of an accessory; saved as its own inventory item (own stock and prices). */
interface Variant { color: string; size: string; purchase: string; sale: string; mrp: string; reorder: string; qty: string }
const emptyVariant = (): Variant => ({ color: "", size: "", purchase: "", sale: "", mrp: "", reorder: "", qty: "" });

const CATEGORIES: { type: ProductType; label: string; category: string; Icon: LucideIcon; activeClass: string }[] = [
  { type: "MEDICINE", label: "Medicine", category: "Medicine", Icon: Pill, activeClass: "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-500/20" },
  { type: "INJECTION", label: "Injection", category: "Injection", Icon: Syringe, activeClass: "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-600 shadow-xs ring-1 ring-rose-500/20" },
  { type: "FOOD", label: "Animal Food", category: "Animal Food", Icon: Bone, activeClass: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-600 shadow-xs ring-1 ring-amber-500/20" },
  { type: "ACCESSORY", label: "Accessories", category: "Animal Accessories", Icon: Tag, activeClass: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-600 shadow-xs ring-1 ring-blue-500/20" },
  { type: "CONSUMABLE", label: "Consumables", category: "Consumable", Icon: Package, activeClass: "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-600 shadow-xs ring-1 ring-violet-500/20" },
];

/** Auto HSN + GST suggestion */
export function suggestHsn(type: ProductType, text: string): { hsn: string; gst: number } {
  const t = text.toLowerCase();
  if (type === "INJECTION") return /vaccine|serum|rabies|dhpp/.test(t) ? { hsn: "3002", gst: 5 } : { hsn: "3004", gst: 12 };
  if (type === "MEDICINE") {
    if (/vaccine/.test(t)) return { hsn: "3002", gst: 5 };
    if (/vitamin|mineral|supplement|calcium/.test(t)) return { hsn: "2936", gst: 12 };
    if (/shampoo|soap/.test(t)) return { hsn: "3305", gst: 18 };
    return { hsn: "3004", gst: 12 };
  }
  if (type === "CONSUMABLE") {
    if (/glove/.test(t)) return { hsn: "4015", gst: 18 };
    if (/syringe|needle|cannula|catheter|iv set|infusion/.test(t)) return { hsn: "9018", gst: 12 };
    if (/suture|vicryl|catgut|silk|prolene|nylon thread/.test(t)) return { hsn: "3006", gst: 12 };
    if (/ear ?bud|cotton bud/.test(t)) return { hsn: "5601", gst: 12 };
    return { hsn: "3005", gst: 12 }; // cotton, gauze, swab, bandage, dressing, plaster
  }
  if (type === "FOOD") return /treat|biscuit|chew/.test(t) ? { hsn: "2309", gst: 18 } : { hsn: "2309", gst: 5 };
  if (/bowl|feeder/.test(t)) return { hsn: "3924", gst: 18 };
  if (/bed|mattress|cushion/.test(t)) return { hsn: "9404", gst: 18 };
  if (/toy|ball/.test(t)) return { hsn: "9503", gst: 12 };
  return { hsn: "4201", gst: 18 };
}

interface Pkg { baseUnit: string; interUnit: string; basePerInter: string; purchaseUnit: string; perPurchase: string; hasInter: boolean }

const emptyPkg = (): Pkg => ({
  baseUnit: "",
  interUnit: "",
  basePerInter: "",
  purchaseUnit: "",
  perPurchase: "",
  hasInter: false,
});

/** Free-text input with a searchable dropdown that allows typing custom values */
function Combo({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const isExactMatch = options.some((o) => o.toLowerCase() === q);
  const showCustomOption = q.length > 0 && !isExactMatch;

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Input
          value={value}
          placeholder={placeholder}
          className={cn(className, "pr-7")}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((prev) => !prev)}
          title="Toggle options"
          className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {open && (list.length > 0 || showCustomOption) && (
        <ul className="absolute left-0 top-full z-[80] mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-xl text-xs">
          {showCustomOption && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(value.trim());
                setOpen(false);
              }}
              className="cursor-pointer px-2.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 font-semibold border-b border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors"
            >
              <span>Use &ldquo;{value.trim()}&rdquo;</span>
              <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded font-normal">custom</span>
            </li>
          )}
          {list.map((o) => (
            <li
              key={o}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o);
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors",
                o.toLowerCase() === q && "bg-blue-50/60 dark:bg-slate-800/60 font-semibold text-blue-700 dark:text-blue-300"
              )}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs relative flex flex-col", className)}>
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-t-lg flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-slate-500" />}
          {title}
        </span>
      </div>
      <div className="p-3 space-y-2.5 flex-1">{children}</div>
    </div>
  );
}

function FormField({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-0.5 leading-tight">
        <span>{label}</span>
        {required && <span className="text-rose-500 font-bold">*</span>}
      </Label>
      {children}
    </div>
  );
}

const inputCls = "h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-md focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-400";
const triggerCls = inputCls;

function MoneyInput({ value, onChange, placeholder = "0" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden shadow-2xs">
      <span className="flex h-8 items-center justify-center px-2.5 bg-slate-100/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 text-xs font-semibold border-r border-slate-200 dark:border-slate-700 select-none">₹</span>
      <Input
        type="number"
        min="0"
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 border-0 rounded-none bg-transparent font-mono text-xs font-medium focus-visible:ring-0 shadow-none px-2.5 placeholder:text-slate-400"
      />
    </div>
  );
}

export function NewItemModal({ open, onClose, onSuccess, initialName, defaultType = "MEDICINE", supplierId, supplierName, editing }: NewItemModalProps) {
  const [type, setType] = useState<ProductType>("MEDICINE");
  const [itemCode, setItemCode] = useState("");
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [brand, setBrand] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [subGroup, setSubGroup] = useState("");

  // Category specifics — default empty
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [route, setRoute] = useState("");
  const [vialSize, setVialSize] = useState("");
  const [coldChain, setColdChain] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [species, setSpecies] = useState("");
  const [lifeStage, setLifeStage] = useState("");
  const [accessoryType, setAccessoryType] = useState("");
  const [petSize, setPetSize] = useState("");
  const [material, setMaterial] = useState("");
  // Consumable specifics (cotton, gloves, syringes, sutures...)
  const [cSize, setCSize] = useState("");
  const [sterile, setSterile] = useState("");
  const [singleUse, setSingleUse] = useState("");
  // Accessory variants (size / colour grid)
  const [variants, setVariants] = useState<Variant[]>([]);
  const [vd, setVd] = useState<Variant>(emptyVariant);

  // Packaging hierarchy — default empty
  const [pkg, setPkg] = useState<Pkg>(emptyPkg);

  // Stock — defaults to 0
  const [reorderLevel, setReorderLevel] = useState("0");
  const [batchTracking, setBatchTracking] = useState(true);
  const [storageLocation, setStorageLocation] = useState("");

  // Opening stock & batch/expiry — default 0 / empty
  const [currentStock, setCurrentStock] = useState("0");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");

  // Pricing — default empty (0 in db)
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [gst, setGst] = useState("0");
  const [hsn, setHsn] = useState("");
  const [saving, setSaving] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);

  const isRx = type === "MEDICINE" || type === "INJECTION";
  const isAcc = type === "ACCESSORY";
  const setP = (patch: Partial<Pkg>) => setPkg((p) => ({ ...p, ...patch }));

  // Reset to empty / 0 on open
  useEffect(() => {
    if (!open) return;
    setType(defaultType || "MEDICINE");
    setName(initialName || "");
    setGenericName(""); setBrand(""); setManufacturer(""); setSubGroup(""); setStrength("");
    setDosageForm(""); setRoute(""); setSchedule(""); setSpecies(""); setLifeStage("");
    setAccessoryType(""); setPetSize(""); setStorageLocation("");
    setMaterial(""); setCSize(""); setSterile(""); setSingleUse(""); setVariants([]); setVd(emptyVariant());
    setPkg(emptyPkg()); setVialSize(""); setColdChain(false);
    setPurchasePrice(""); setMrp(""); setSalePrice("");
    setCurrentStock("0"); setReorderLevel("0");
    setBatchNo(""); setExpiryDate(""); setManufacturingDate("");
    setHsn(""); setGst("0");

    if (editing) {
      const e = editing as any;
      const md = e.medicineDetails ?? e.injectionDetails ?? {};
      const ph = e.packagingHierarchy;
      const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
      setType(e.productType);
      setItemCode(e.itemCode);
      setName(s(e.name)); setGenericName(s(e.genericName)); setBrand(s(e.brand)); setManufacturer(s(e.manufacturer));
      setSubGroup(e.productType === "ACCESSORY" ? "" : s(e.subGroup));
      setVialSize(s(e.injectionDetails?.vialSize)); setColdChain(e.injectionDetails?.coldChainRequired ?? false);
      setStrength(s(md.strength)); setDosageForm(s(md.dosageForm)); setRoute(s(md.route)); setSchedule(s(md.schedule));
      setSpecies(s(e.foodDetails?.targetSpecies)); setLifeStage(s(e.foodDetails?.lifeStage));
      setAccessoryType(s(e.accessoryDetails?.accessoryType ?? e.subGroup)); setMaterial(s(e.accessoryDetails?.material ?? e.consumableDetails?.material));
      setCSize(s(e.consumableDetails?.size)); setSterile(s(e.consumableDetails?.sterile)); setSingleUse(s(e.consumableDetails?.singleUse));
      setPkg(ph ? {
        baseUnit: s(ph.baseUnit), purchaseUnit: s(ph.purchaseUnit), hasInter: !!ph.hasIntermediateUnit,
        interUnit: s(ph.intermediateUnit), basePerInter: s(ph.baseUnitsPerIntermediate),
        perPurchase: s(ph.hasIntermediateUnit ? ph.intermediateUnitsPerPurchase : ph.baseUnitsPerPurchase),
      } : { baseUnit: s(e.unit), purchaseUnit: s(e.purchaseUom || e.unit), perPurchase: "1", interUnit: "", basePerInter: "", hasInter: false });
      setReorderLevel(s(e.reorderLevel ?? 0)); setBatchTracking(!!e.batchTracking); setStorageLocation(s(e.storageLocation));
      setCurrentStock(s(e.currentStock ?? 0)); setBatchNo(s(e.batchNo)); setExpiryDate(s(e.expiryDate)); setManufacturingDate(s(e.manufacturingDate));
      setPurchasePrice(s(e.defaultPurchasePrice || "")); setMrp(s(e.mrp || "")); setSalePrice(s(e.defaultSalePrice || ""));
      setGst(s(e.gstRate ?? 0)); setHsn(s(e.hsnCode));
      if (e.productType === "ACCESSORY") {
        setVariants([{
          color: s(e.accessoryDetails?.color), size: s(e.accessoryDetails?.petSize),
          purchase: s(e.defaultPurchasePrice || ""), sale: s(e.defaultSalePrice || ""), mrp: s(e.mrp || ""),
          reorder: s(e.reorderLevel ?? 0), qty: s(e.currentStock ?? 0),
        }]);
      }
    }
  }, [open, initialName, defaultType, editing]);

  // Accessories are counted in pieces: no packaging questions
  useEffect(() => {
    if (open && type === "ACCESSORY") setPkg({ baseUnit: "Piece", interUnit: "", basePerInter: "", purchaseUnit: "Piece", perPurchase: "1", hasInter: false });
  }, [open, type]);

  // Peek the auto item ID for the chosen category
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    peekItemCodeFn({ data: { type } }).then((c) => !cancelled && setItemCode(c || "")).catch(() => {});
    return () => { cancelled = true; };
  }, [open, type, editing]);

  // Category switch (locked when editing: the category is fixed for ledger consistency)
  const switchType = (t: ProductType) => {
    if (editing) return;
    setType(t);
    setPkg(emptyPkg()); setVialSize(""); setColdChain(false);
    setDosageForm("");
    setRoute("");
    setSchedule("");
    setSpecies("");
    setLifeStage("");
    setAccessoryType("");
    setPetSize("");
    setMaterial(""); setCSize(""); setSterile(""); setSingleUse(""); setSubGroup("");
    setBatchTracking(t === "MEDICINE" || t === "INJECTION" || t === "CONSUMABLE");
  };

  const handleAutoSuggestHsn = () => {
    const s = suggestHsn(type, `${name} ${subGroup} ${genericName}`);
    setHsn(s.hsn);
    setGst(String(s.gst));
    toast.info(`Suggested HSN: ${s.hsn}, GST: ${s.gst}%`);
  };

  // Units contained in one purchase unit
  const baseUnitsPerPurchase = pkg.hasInter
    ? (Number(pkg.perPurchase) || 1) * (Number(pkg.basePerInter) || 1)
    : Number(pkg.perPurchase) || 1;

  const hierarchyFormula = useMemo(() => {
    if (!pkg.baseUnit.trim() || !pkg.purchaseUnit.trim()) return null;
    const pUnit = pkg.purchaseUnit.trim();
    const bUnit = pkg.baseUnit.trim();
    const formatU = (qty: number, u: string) => {
      if (qty === 1 || u.toLowerCase().endsWith("s") || ["ml", "gm", "kg", "mg", "ltr"].includes(u.toLowerCase())) {
        return `${qty} ${u}`;
      }
      return `${qty} ${u}s`;
    };

    if (pkg.hasInter && pkg.interUnit.trim()) {
      const iUnit = pkg.interUnit.trim();
      const interCount = Number(pkg.perPurchase) || 1;
      return `1 ${pUnit} → ${formatU(interCount, iUnit)} → ${formatU(baseUnitsPerPurchase, bUnit)}`;
    }
    return `1 ${pUnit} → ${formatU(baseUnitsPerPurchase, bUnit)}`;
  }, [pkg, baseUnitsPerPurchase]);

  const perBase = useMemo(() => (p: string) => (Number(p) > 0 ? r2(Number(p) / baseUnitsPerPurchase) : 0), [baseUnitsPerPurchase]);

  const addVariant = () => {
    if (!(Number(vd.sale) > 0 || Number(vd.mrp) > 0)) { toast.error("Enter the selling price."); return; }
    const key = (v: Variant) => [v.color, v.size].map((x) => x.trim().toLowerCase()).join("|");
    if (variants.some((v) => key(v) === key(vd))) { toast.error("That colour and size is already in the list."); return; }
    setVariants((p) => [...p, vd]);
    setVd((p) => ({ ...emptyVariant(), color: p.color })); // keep the colour to add the next size quickly
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Item Name is required."); return; }
    if (editing && type === "ACCESSORY" && variants.length !== 1) { toast.error("An accessory item has exactly one colour / size row."); return; }
    if (type === "ACCESSORY" && variants.length === 0) { toast.error("Add at least one row to the price list (colour / size, price and stock)."); return; }
    if (!pkg.baseUnit.trim() || !pkg.purchaseUnit.trim()) { toast.error("Base unit and purchase unit are required."); return; }
    if (pkg.hasInter && !pkg.interUnit.trim()) { toast.error("Enter the middle unit (e.g. Strip) or untick it."); return; }

    const cat = CATEGORIES.find((c) => c.type === type)!;
    const sale = Number(salePrice) || Number(mrp) || 0;
    const details = { storageCondition: type === "INJECTION" && coldChain ? "Cold Chain (2-8°C)" : "Room Temperature (15-25°C)" };

    setSaving(true);
    try {
      const mk = (o: Record<string, any> = {}) => ({
          productType: type,
          category: cat.category,
          name: name.trim(),
          genericName: genericName.trim(),
          brand: brand.trim(),
          manufacturer: manufacturer.trim(),
          subGroup: (type === "ACCESSORY" ? accessoryType : subGroup).trim(),
          description: "",
          unit: pkg.baseUnit.trim(),
          purchaseUom: pkg.purchaseUnit.trim(),
          salesUom: pkg.baseUnit.trim(),
          packagingHierarchy: {
            baseUnit: pkg.baseUnit.trim(),
            purchaseUnit: pkg.purchaseUnit.trim(),
            baseUnitsPerPurchase,
            hasIntermediateUnit: pkg.hasInter,
            intermediateUnit: pkg.hasInter ? pkg.interUnit.trim() : undefined,
            intermediateUnitsPerPurchase: pkg.hasInter ? Number(pkg.perPurchase) || 1 : undefined,
            baseUnitsPerIntermediate: pkg.hasInter ? Number(pkg.basePerInter) || 1 : undefined,
          },
          valuationMethod: isRx || type === "CONSUMABLE" ? "FEFO" : "FIFO",
          reorderLevel: Number(reorderLevel) || 0,
          minStockLevel: Number(reorderLevel) || 0,
          batchTracking,
          storageLocation: storageLocation.trim(),
          defaultPurchasePrice: Number(purchasePrice) || 0,
          defaultSalePrice: sale,
          mrp: Number(mrp) || sale,
          valuationRate: Number(purchasePrice) || 0,
          gstRate: Number(gst) || 0,
          hsnCode: hsn.trim(),
          taxCategory: "Standard",
          defaultSupplierId: supplierId || "",
          defaultSupplierName: supplierName || "",
          leadTimeDays: 0,
          costCenter: isRx ? "Pharmacy" : type === "CONSUMABLE" ? "Clinic Consumables" : "Retail Store",
          currentStock: Number(currentStock) || 0,
          batchNo: batchNo.trim(),
          expiryDate: expiryDate.trim(),
          manufacturingDate: manufacturingDate.trim(),
          medicineDetails: type === "MEDICINE" ? { strength, dosageForm, route, schedule, ...details } : undefined,
          injectionDetails: type === "INJECTION" ? { strength, route, schedule, vialSize: vialSize.trim(), coldChainRequired: coldChain, ...details } : undefined,
          foodDetails: type === "FOOD" ? { targetSpecies: species, lifeStage } : undefined,
          accessoryDetails: type === "ACCESSORY" ? { accessoryType, material } : undefined,
          consumableDetails: type === "CONSUMABLE" ? { size: cSize, material, sterile, singleUse } : undefined,
          ...o,
        } as any);

      // Edit: update this item in place (stock is managed through the ledger, so not touched here)
      if (editing) {
        const v = type === "ACCESSORY" ? variants[0]! : null;
        const vs = v ? Number(v.sale) || Number(v.mrp) || 0 : 0;
        const payload = mk(v ? {
          accessoryDetails: { accessoryType, petSize: v.size.trim(), material, color: v.color.trim() },
          defaultPurchasePrice: Number(v.purchase) || 0, valuationRate: Number(v.purchase) || 0,
          defaultSalePrice: vs, mrp: Number(v.mrp) || vs,
          reorderLevel: Number(v.reorder) || 0, minStockLevel: Number(v.reorder) || 0,
        } : {});
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { productType: _t, currentStock: _s, defaultSupplierId: _i, defaultSupplierName: _n, ...patch } = payload;
        const updated = await updateItemFn({ data: { itemCode: editing.itemCode, patch } });
        toast.success(`${updated.name} updated (${updated.itemCode}).`);
        onSuccess?.(updated);
        onClose();
        return;
      }

      // Accessory with a variant grid: one inventory item per size / colour, each with its own price and stock
      if (type === "ACCESSORY" && variants.length > 0) {
        const made: InventoryItemRow[] = [];
        try {
          for (const v of variants) {
            const sale = Number(v.sale) || Number(v.mrp) || 0;
            made.push(await addItemFn({
              data: mk({
                name: [name.trim(), [v.color.trim(), v.size.trim()].filter(Boolean).join(" / ")].filter(Boolean).join(" - "),
                hasVariants: true,
                accessoryDetails: { accessoryType, petSize: v.size.trim(), material, color: v.color.trim() },
                defaultPurchasePrice: Number(v.purchase) || 0,
                valuationRate: Number(v.purchase) || 0,
                defaultSalePrice: sale,
                mrp: Number(v.mrp) || sale,
                reorderLevel: Number(v.reorder) || 0,
                minStockLevel: Number(v.reorder) || 0,
                currentStock: Number(v.qty) || 0,
              }),
            }));
          }
        } catch (err) {
          if (made.length) toast.error(`Only ${made.length} of ${variants.length} variants were saved before an error.`);
          throw err;
        }
        toast.success(`${made.length} variants of ${name.trim()} added (${made[0]!.itemCode} - ${made[made.length - 1]!.itemCode}).`);
        onSuccess?.(made[0]!);
        onClose();
        return;
      }

      const created = await addItemFn({ data: mk() });
      toast.success(`${created.name} added (${created.itemCode}).`);
      onSuccess?.(created);
      onClose();
    } catch (err: any) {
      console.error("[NewItemModal] Save error:", err);
      toast.error(err.message || "Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const sel = (
    v: string,
    on: (v: string) => void,
    opts: { label: string; value: string }[] | string[],
    placeholder = "Select..."
  ) => {
    const list = opts.map((o) => (typeof o === "string" ? { label: o, value: o } : o));
    return (
      <Select value={v} onValueChange={on}>
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {list.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-6xl w-[96vw] max-h-[96vh] overflow-y-auto p-0 gap-0 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-xl"
        aria-describedby="new-item-desc"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <PackagePlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                {editing ? `Edit Item Information` : "New Item Information"}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-900">
                  Item Master
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">Item Code:</span>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{itemCode || "AUTO"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p id="new-item-desc" className="sr-only">Add a medicine, injection, animal food, accessory or consumable item with packaging, pricing and stock.</p>

        {/* Content Container */}
        <div className="p-4 space-y-3">
          {/* Category Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {CATEGORIES.map(({ type: t, label, Icon, activeClass }) => (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                disabled={!!editing && type !== t}
                title={editing ? "Category is locked for ledger consistency" : undefined}
                className={cn(
                  editing && type !== t && "opacity-40 cursor-not-allowed",
                  "flex items-center justify-center gap-2 rounded-lg border py-2 px-3 text-xs font-semibold transition-all",
                  type === t
                    ? activeClass
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 3-Column Ergonomic Form Grid */}
          <div className={cn("grid grid-cols-1 gap-3.5 items-start", isAcc ? "md:grid-cols-2" : "md:grid-cols-3")}>

            {/* ─── COLUMN 1: Item Details ─── */}
            <SectionCard title="Item Details" icon={Pill}>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Item Name" required className="col-span-2">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amoxicillin 250mg"
                    className={cn(inputCls, "font-medium")}
                  />
                </FormField>
                {!isAcc && <FormField label={isRx ? "Generic Name" : "Description"} className="col-span-2">
                  <Input
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder={type === "INJECTION" ? "e.g. Ceftriaxone Sodium" : isRx ? "e.g. Amoxicillin Trihydrate" : "e.g. High protein food"}
                    className={inputCls}
                  />
                </FormField>}
                <FormField label="Brand" className={isAcc ? "col-span-2" : ""}>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Moxikind"
                    className={inputCls}
                  />
                </FormField>
                {!isAcc && <FormField label="Manufacturer">
                  <Input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Mankind Pharma"
                    className={inputCls}
                  />
                </FormField>}
                {!isAcc && <FormField label="Sub Group" className="col-span-2">
                  <Combo
                    value={subGroup}
                    onChange={setSubGroup}
                    options={type === "CONSUMABLE" ? CONSUMABLE_GROUPS : type === "INJECTION" ? INJECTION_GROUPS : SUB_GROUPS}
                    className={inputCls}
                    placeholder={type === "INJECTION" ? "e.g. Antibiotic, Vaccine" : isRx ? "e.g. Antibiotics" : type === "CONSUMABLE" ? "e.g. Cotton & Gauze" : "e.g. Dog Food"}
                  />
                </FormField>}

                {type === "MEDICINE" && (
                  <>
                    <FormField label="Strength">
                      <Input
                        value={strength}
                        onChange={(e) => setStrength(e.target.value)}
                        placeholder="e.g. 250mg"
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Dosage Form">
                      <Combo
                        value={dosageForm}
                        onChange={setDosageForm}
                        options={DOSAGE_FORMS}
                        className={inputCls}
                        placeholder="e.g. Tablet, Syrup, Ointment"
                      />
                    </FormField>
                    <FormField label="Schedule" className="col-span-2">
                      {sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"], "Select schedule...")}
                    </FormField>
                  </>
                )}

                {type === "INJECTION" && (
                  <>
                    <FormField label="Strength">
                      <Input
                        value={strength}
                        onChange={(e) => setStrength(e.target.value)}
                        placeholder="e.g. 20mg/ml"
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Route">
                      {sel(route, setRoute, INJ_ROUTES, "Select route...")}
                    </FormField>
                    <FormField label="Vial / Ampoule Size">
                      <Input value={vialSize} onChange={(e) => setVialSize(e.target.value)} placeholder="e.g. 10 ml" className={inputCls} />
                    </FormField>
                    <FormField label="Schedule">
                      {sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"], "Select schedule...")}
                    </FormField>
                    <div className="col-span-2 flex items-center gap-2 pt-0.5">
                      <input type="checkbox" id="coldChain" checked={coldChain} onChange={(e) => setColdChain(e.target.checked)} className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 size-3.5 cursor-pointer" />
                      <label htmlFor="coldChain" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">Cold chain item (store at 2-8°C)</label>
                    </div>
                  </>
                )}

                {type === "FOOD" && (
                  <>
                    <FormField label="Target Species">
                      {sel(species, setSpecies, ["Dog", "Cat", "Bird", "Rabbit", "Other"], "Select species...")}
                    </FormField>
                    <FormField label="Life Stage">
                      {sel(lifeStage, setLifeStage, ["Puppy / Kitten", "Adult", "Senior", "All"], "Select life stage...")}
                    </FormField>
                  </>
                )}

                {type === "ACCESSORY" && (
                  <>
                    <FormField label="Accessory Type" className="col-span-2">
                      <Combo value={accessoryType} onChange={setAccessoryType} options={ACCESSORY_GROUPS} className={inputCls} placeholder="e.g. Collar, Bowl, Bed" />
                    </FormField>
                    <FormField label="Material (optional)" className="col-span-2">
                      <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Nylon, Leather, Cotton" className={inputCls} />
                    </FormField>
                  </>
                )}

                {type === "CONSUMABLE" && (
                  <>
                    <FormField label="Size / Specification">
                      <Input value={cSize} onChange={(e) => setCSize(e.target.value)} placeholder="e.g. Large, 5x5 cm, 2 ml, 1-0" className={inputCls} />
                    </FormField>
                    <FormField label="Material">
                      <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Latex, Cotton, Vicryl" className={inputCls} />
                    </FormField>
                    <FormField label="Sterile">
                      {sel(sterile, setSterile, ["Yes", "No"], "Select...")}
                    </FormField>
                    <FormField label="Single Use">
                      {sel(singleUse, setSingleUse, ["Yes (disposable)", "No (reusable)"], "Select...")}
                    </FormField>
                  </>
                )}
              </div>
            </SectionCard>

            {/* ─── COLUMN 2: Packaging & Stock ─── */}
            {!isAcc && <div className="space-y-3.5">
              <SectionCard title="Packaging Hierarchy" icon={Layers}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Purchase Unit" required className="col-span-2">
                    <Combo
                      value={pkg.purchaseUnit}
                      onChange={(v) => setP({ purchaseUnit: v })}
                      options={type === "INJECTION" ? INJ_PURCHASE : PURCHASE_OPTIONS}
                      className={inputCls}
                      placeholder={type === "INJECTION" ? "e.g. Box of vials" : "e.g. Box, Pack"}
                    />
                  </FormField>

                  <div className="col-span-2 flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      id="hasInterUnit"
                      checked={pkg.hasInter}
                      onChange={(e) => setP({ hasInter: e.target.checked, interUnit: "", basePerInter: "" })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5 cursor-pointer"
                    />
                    <label htmlFor="hasInterUnit" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      {type === "INJECTION" ? "Has a middle unit (e.g. Pack of vials)" : "Has a middle unit (e.g. Strip)"}
                    </label>
                  </div>

                  {pkg.hasInter ? (
                    <>
                      <FormField label="Middle Unit">
                        <Combo
                          value={pkg.interUnit}
                          onChange={(v) => setP({ interUnit: v })}
                          options={type === "INJECTION" ? INJ_MIDDLE : unitsBelow(pkg.purchaseUnit, true)}
                          className={inputCls}
                          placeholder="e.g. Strip"
                        />
                      </FormField>
                      <FormField
                        label={
                          pkg.interUnit.trim()
                            ? (pkg.purchaseUnit.trim() ? `${pkg.interUnit}s per ${pkg.purchaseUnit}` : `${pkg.interUnit}s in Pack`)
                            : (pkg.purchaseUnit.trim() ? `Strips per ${pkg.purchaseUnit}` : "Strips in Pack")
                        }
                      >
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 10"
                          value={pkg.perPurchase}
                          onChange={(e) => setP({ perPurchase: e.target.value })}
                          className={cn(inputCls, "font-mono")}
                        />
                      </FormField>

                      <FormField label="Single (Base) Unit" required>
                        <Combo
                          value={pkg.baseUnit}
                          onChange={(v) => setP({ baseUnit: v })}
                          options={type === "INJECTION" ? INJ_BASE : unitsBelow(pkg.interUnit || pkg.purchaseUnit)}
                          className={inputCls}
                          placeholder="e.g. Tablet, Vial, Piece"
                        />
                      </FormField>
                      <FormField
                        label={
                          pkg.baseUnit.trim()
                            ? (pkg.interUnit.trim() ? `${pkg.baseUnit}s per ${pkg.interUnit}` : `${pkg.baseUnit}s in Strip`)
                            : (pkg.interUnit.trim() ? `Units per ${pkg.interUnit}` : "Units in Strip")
                        }
                      >
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 10"
                          value={pkg.basePerInter}
                          onChange={(e) => setP({ basePerInter: e.target.value })}
                          className={cn(inputCls, "font-mono")}
                        />
                      </FormField>
                    </>
                  ) : (
                    <>
                      <FormField label="Single (Base) Unit" required>
                        <Combo
                          value={pkg.baseUnit}
                          onChange={(v) => setP({ baseUnit: v })}
                          options={type === "INJECTION" ? INJ_BASE : unitsBelow(pkg.purchaseUnit)}
                          className={inputCls}
                          placeholder="e.g. Tablet, Vial, Piece"
                        />
                      </FormField>
                      <FormField
                        label={
                          pkg.baseUnit.trim()
                            ? (pkg.purchaseUnit.trim() ? `${pkg.baseUnit}s per ${pkg.purchaseUnit}` : `${pkg.baseUnit}s in Pack`)
                            : (pkg.purchaseUnit.trim() ? `Units per ${pkg.purchaseUnit}` : "Units in Pack")
                        }
                      >
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 100"
                          value={pkg.perPurchase}
                          onChange={(e) => setP({ perPurchase: e.target.value })}
                          className={cn(inputCls, "font-mono")}
                        />
                      </FormField>
                    </>
                  )}

                  {hierarchyFormula ? (
                    <div className="col-span-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 text-center shadow-2xs">
                      {hierarchyFormula}
                    </div>
                  ) : (
                    <div className="col-span-2 rounded-md bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 px-3 py-1.5 text-[10px] text-slate-400 text-center">
                      Set base &amp; purchase units to preview hierarchy
                    </div>
                  )}

                  <div className="col-span-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowVisualizer(true)}
                      disabled={!pkg.baseUnit.trim() || !pkg.purchaseUnit.trim()}
                      className={cn(
                        "w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border text-xs font-semibold transition-all shadow-2xs select-none",
                        pkg.baseUnit.trim() && pkg.purchaseUnit.trim()
                          ? "bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 dark:from-blue-950/60 dark:via-sky-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:border-blue-400 hover:shadow-xs active:scale-[0.99]"
                          : "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Visualise Packaging</span>
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Stock & Storage" icon={PackageCheck}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label={(editing ? "Current Stock" : "Opening Stock")}>
                    <Input
                      type="number"
                      min="0"
                      disabled={!!editing}
                      title={editing ? "Change stock through purchase bills or stock adjustments" : undefined}
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "font-mono font-semibold")}
                    />
                  </FormField>
                  <FormField label="Reorder Level">
                    <Input
                      type="number"
                      min="0"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "font-mono")}
                    />
                  </FormField>
                  <FormField label="Storage Shelf / Location" className="col-span-2">
                    <Input
                      value={storageLocation}
                      onChange={(e) => setStorageLocation(e.target.value)}
                      placeholder={type === "INJECTION" ? "e.g. Cold chain fridge, Shelf 2" : isRx ? "e.g. Rack A-1, Pharmacy" : "e.g. Retail Floor"}
                      className={inputCls}
                    />
                  </FormField>
                  <div className="col-span-2 flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="trackBatch"
                      checked={batchTracking}
                      onChange={(e) => setBatchTracking(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5 cursor-pointer"
                    />
                    <label htmlFor="trackBatch" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      Track batch &amp; expiry in inventory ledger
                    </label>
                  </div>
                </div>
              </SectionCard>
            </div>}

            {/* ─── COLUMN 3: Pricing, Tax & Batch ─── */}
            <div className="space-y-3.5">
              <SectionCard title={isAcc ? "Tax" : "Pricing & Tax"} icon={IndianRupee}>
                <div className={cn("text-[10px] text-slate-500 -mt-1 mb-1 font-medium", isAcc && "hidden")}>
                  {pkg.purchaseUnit ? `Prices per 1 ${pkg.purchaseUnit}` : "Prices per purchase unit"}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Buy Price" className={isAcc ? "hidden" : ""}>
                    <MoneyInput value={purchasePrice} onChange={setPurchasePrice} placeholder="0" />
                  </FormField>
                  <FormField label="MRP" className={isAcc ? "hidden" : ""}>
                    <MoneyInput value={mrp} onChange={setMrp} placeholder="0" />
                  </FormField>
                  <FormField label="Selling Price" className={isAcc ? "hidden" : "col-span-2"}>
                    <MoneyInput value={salePrice} onChange={setSalePrice} placeholder="0" />
                  </FormField>

                  {baseUnitsPerPurchase > 1 && (Number(purchasePrice) > 0 || Number(salePrice) > 0 || Number(mrp) > 0) && (<>
                    <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border-l-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Per {pkg.baseUnit || "unit"}</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        Buy ₹{perBase(purchasePrice)} · MRP ₹{perBase(mrp)} · Sell ₹{perBase(salePrice || mrp)}
                      </span>
                    </div>
                    {pkg.hasInter && Number(pkg.basePerInter) > 0 && (
                      <div className="col-span-2 flex items-center justify-between gap-2 px-2.5 text-[11px] text-slate-500">
                        <span className="font-semibold">Per {pkg.interUnit || "middle"}</span>
                        <span className="font-mono font-semibold">Buy ₹{r2(perBase(purchasePrice) * Number(pkg.basePerInter))} · Sell ₹{r2(perBase(salePrice || mrp) * Number(pkg.basePerInter))}</span>
                      </div>
                    )}
                  </>)}

                  <FormField label="HSN / SAC Code">
                    <div className="relative">
                      <Input
                        value={hsn}
                        onChange={(e) => setHsn(e.target.value)}
                        placeholder="e.g. 3004"
                        className={cn(inputCls, "font-mono pr-14")}
                      />
                      <button
                        type="button"
                        onClick={handleAutoSuggestHsn}
                        title="Auto-suggest HSN and GST rate based on name"
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                      >
                        <Sparkles className="size-2.5" />
                        AUTO
                      </button>
                    </div>
                  </FormField>
                  <FormField label="GST Rate">
                    {sel(gst, setGst, GST_RATES)}
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard title="Batch & Expiry Date" icon={Calendar} className={isAcc ? "hidden" : ""}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Batch Number" className="col-span-2">
                    <Input
                      value={batchNo}
                      onChange={(e) => setBatchNo(e.target.value)}
                      placeholder="e.g. BT-2024-001"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Manufacturing Date">
                    <DatePicker
                      value={manufacturingDate}
                      onChange={setManufacturingDate}
                      placeholder="Select mfg date"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Expiry Date">
                    <DatePicker
                      value={expiryDate}
                      onChange={setExpiryDate}
                      placeholder="Select expiry date"
                      className={cn(inputCls, expiryDate && new Date(expiryDate) < new Date() ? "border-rose-500 text-rose-600 font-semibold" : "")}
                      showPresets={true}
                    />
                  </FormField>
                  {expiryDate && new Date(expiryDate) < new Date() && (
                    <div className="col-span-2 text-[10px] text-rose-600 font-medium bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 text-center">
                      ⚠ Expiry date is in the past
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>

          {type === "ACCESSORY" && (
            <SectionCard title="Price & stock list - one row per colour / size" icon={Layers}>
              <p className="text-[10px] text-slate-500 -mt-1">
                Add a row for every colour and size you stock (leave both empty if the item has only one kind). Each row is saved as its own item with its own price and stock.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
                <FormField label="Colour"><Combo value={vd.color} onChange={(v) => setVd({ ...vd, color: v })} options={COLOURS} className={inputCls} placeholder="e.g. Black" /></FormField>
                <FormField label="Size"><Combo value={vd.size} onChange={(v) => setVd({ ...vd, size: v })} options={SIZES} className={inputCls} placeholder="e.g. M" /></FormField>
                <FormField label="Buying Price"><MoneyInput value={vd.purchase} onChange={(v) => setVd({ ...vd, purchase: v })} /></FormField>
                <FormField label="Selling Price" required><MoneyInput value={vd.sale} onChange={(v) => setVd({ ...vd, sale: v })} /></FormField>
                <FormField label="MRP"><MoneyInput value={vd.mrp} onChange={(v) => setVd({ ...vd, mrp: v })} /></FormField>
                <FormField label="Stock in hand"><Input type="number" min="0" value={vd.qty} onChange={(e) => setVd({ ...vd, qty: e.target.value })} placeholder="0" className={cn(inputCls, "font-mono")} /></FormField>
                <FormField label="Alert when below"><Input type="number" min="0" value={vd.reorder} onChange={(e) => setVd({ ...vd, reorder: e.target.value })} placeholder="0" className={cn(inputCls, "font-mono")} /></FormField>
                <Button type="button" onClick={addVariant} className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"><Plus className="size-3.5" /> Add</Button>
              </div>
              {variants.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-[11px]">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        {["#", "Colour", "Size", "Buying", "Selling", "MRP", "Stock", "Alert below", ""].map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {variants.map((v, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1">{i + 1}</td>
                          <td className="px-2 py-1">{v.color || "-"}</td>
                          <td className="px-2 py-1">{v.size || "-"}</td>
                          <td className="px-2 py-1 font-mono">{v.purchase || 0}</td>
                          <td className="px-2 py-1 font-mono">{v.sale || 0}</td>
                          <td className="px-2 py-1 font-mono">{v.mrp || 0}</td>
                          <td className="px-2 py-1 font-mono">{v.qty || 0}</td>
                          <td className="px-2 py-1 font-mono">{v.reorder || 0}</td>
                          <td className="px-2 py-1 text-right">
                            <button type="button" aria-label="Remove row" onClick={() => setVariants((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600">
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* Dialog Action Buttons */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              <span className="text-rose-500 font-bold">*</span> Required fields
            </span>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="h-8 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
              >
                <Save className="size-3.5" />
                <span>{saving ? "Saving..." : editing ? "Update Item" : "Save Item"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {showVisualizer && (
        <PackagingVisualizerModal
          open={showVisualizer}
          onClose={() => setShowVisualizer(false)}
          itemName={name}
          productType={type}
          purchaseUnit={pkg.purchaseUnit}
          baseUnit={pkg.baseUnit}
          hasIntermediate={pkg.hasInter}
          intermediateUnit={pkg.interUnit}
          intermediateUnitsPerPurchase={pkg.perPurchase}
          baseUnitsPerIntermediate={pkg.basePerInter}
          baseUnitsPerPurchase={baseUnitsPerPurchase}
          purchasePrice={purchasePrice}
          mrp={mrp}
          salePrice={salePrice}
          onApplyArchetype={(config) => {
            setP({
              purchaseUnit: config.purchaseUnit,
              hasInter: config.hasIntermediate,
              interUnit: config.intermediateUnit || "",
              perPurchase: config.intermediateUnitsPerPurchase
                ? String(config.intermediateUnitsPerPurchase)
                : "",
              basePerInter: config.baseUnitsPerIntermediate
                ? String(config.baseUnitsPerIntermediate)
                : "",
              baseUnit: config.baseUnit,
            });
            toast.success(
              `Applied ${config.purchaseUnit} → ${
                config.hasIntermediate ? `${config.intermediateUnit} → ` : ""
              }${config.baseUnit} packaging template`
            );
          }}
        />
      )}
    </Dialog>
  );
}
