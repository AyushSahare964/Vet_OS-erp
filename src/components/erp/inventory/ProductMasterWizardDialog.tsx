/**
 * ProductMasterWizardDialog
 * Guided 5-Step Product Master Wizard for Veterinary ERP
 * Steps: 1. Identity & Specs | 2. Stock & Inventory | 3. Pricing & Tax | 4. Purchasing | 5. Sales & Accounts
 * Supports Category-Specific Profiles: Medicine, Food, Accessory
 * Draft Autosave/Recovery in localStorage
 * Category Immutability in Edit Mode
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pill,
  Syringe,
  Bone,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCcw,
  Save,
  ArrowRight,
  ArrowLeft,
  Info,
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  useInventory,
  resolveProductType,
  type Medicine,
  type ProductType,
  type UnitOfMeasure,
  type ValuationMethod,
} from "./useInventoryStore";
import {
  getDefaultHierarchy,
  deriveBaseUnitsPerPurchase,
  stockDisplayLabel,
  getAvailableUnits,
  convertToBase,
  resolveUnitPrice,
  normalizeHierarchy,
  type PackagingHierarchy,
} from "@/lib/inventory/packagingUtils";
import { peekItemCodeFn } from "@/lib/mongodb/serverFns/inventory";
import { createPurchaseBillFn } from "@/lib/mongodb/serverFns/purchaseBills";
import { todayIST } from "@/lib/utils/dateUtils";
import { NewItemModal } from "@/components/erp/accounting/NewItemModal";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import type { InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import {
  PurchaseBillWizardSection,
  type PurchaseBillWizardState,
} from "./PurchaseBillWizardSection";

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS: UnitOfMeasure[] = [
  "Tablet",
  "ml",
  "Vial",
  "Box",
  "Strip",
  "Kg",
  "Bottle",
  "Unit",
  "Piece",
  "Gm",
  "Litre",
];

const VALUATION_METHODS: ValuationMethod[] = ["FEFO", "FIFO", "Moving Average"];
const GST_RATES = [0, 5, 12, 18, 28];

export function getFutureDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function getExpiryDiffDays(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STEPS = [
  { id: 1, title: "Identity & Specs", desc: "Core details & category profile" },
  { id: 2, title: "Stock & Inventory", desc: "UoM, levels & tracking" },
  { id: 3, title: "Pricing & Tax", desc: "MRP, sales price & GST" },
  { id: 4, title: "Purchasing", desc: "Suppliers & lead times" },
  { id: 5, title: "Sales & Accounts", desc: "Revenue accounts & finish" },
];

// Data-driven category registry — add a new entry here to add a new Product Master
// category tile; nothing else in the picker UI needs to change.
interface CategoryDef {
  type: ProductType;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  namePlaceholder: string;
  genericPlaceholder: string;
  subGroupPlaceholder: string;
  swatch: string; // icon tile bg/text
  accent: string; // selected badge/section accent
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    type: "MEDICINE",
    label: "Medicine",
    blurb: "Batch, expiry, Rx",
    Icon: Pill,
    namePlaceholder: "e.g. Amoxicillin 250mg",
    genericPlaceholder: "e.g. Amoxicillin Trihydrate",
    subGroupPlaceholder: "e.g. Antibiotics, NSAIDs",
    swatch: "bg-emerald-500/10 text-emerald-600",
    accent: "emerald",
  },
  {
    type: "INJECTION",
    label: "Injection",
    blurb: "Vials, route, cold chain",
    Icon: Syringe,
    namePlaceholder: "e.g. Meloxicam 20mg/ml Injection",
    genericPlaceholder: "e.g. Meloxicam Injectable Solution",
    subGroupPlaceholder: "e.g. Analgesics, Vaccines, Antibiotics",
    swatch: "bg-rose-500/10 text-rose-600",
    accent: "rose",
  },
  {
    type: "FOOD",
    label: "Animal Food",
    blurb: "Species, kibble, diet",
    Icon: Bone,
    namePlaceholder: "e.g. Royal Canin Maxi Adult 4kg",
    genericPlaceholder: "e.g. Canine adult large breed diet",
    subGroupPlaceholder: "e.g. Dog Food, Feline Diet, Prescription Food",
    swatch: "bg-amber-500/10 text-amber-600",
    accent: "amber",
  },
  {
    type: "ACCESSORY",
    label: "Pet Accessory",
    blurb: "Gear, bowl, comfort",
    Icon: Tag,
    namePlaceholder: "e.g. Ergonomic Padded Dog Harness (L)",
    genericPlaceholder: "e.g. Nylon Chest Harness",
    subGroupPlaceholder: "e.g. Gear, Feeding, Comfort",
    swatch: "bg-blue-500/10 text-blue-600",
    accent: "blue",
  },
];

export interface WizardFormState {
  // Category & Identity
  productType: ProductType;
  itemCode: string;
  sku: string;
  name: string;
  genericName: string;
  brand: string;
  manufacturer: string;
  description: string;
  subGroup: string;
  hasVariants: boolean;

  // Medicine Specific
  composition: string;
  strength: string;
  dosageForm: string;
  route: string;
  storageCondition: string;
  schedule: string;
  controlledSubstance: boolean;

  // Food Specific
  targetSpecies: string;
  foodType: string;
  lifeStage: string;
  flavour: string;
  packSize: string;
  dietaryIndication: string;

  // Accessory Specific
  accessoryType: string;
  petSize: string;
  material: string;
  color: string;

  // Injection Specific
  injComposition: string;
  injStrength: string;
  injRoute: string;
  injectionSite: string;
  vialSize: string;
  withdrawalPeriod: string;
  coldChainRequired: boolean;
  injSchedule: string;
  injControlledSubstance: boolean;

  // Stock
  unit: UnitOfMeasure;
  purchaseUom: string;
  salesUom: string;
  maintainStock: boolean;
  valuationMethod: ValuationMethod;
  openingStock: string; // Used when creating
  openingStockUnit: string; // Unit used when entering opening stock (purchase unit or base)
  currentStock: number; // Read-only authoritative in edit mode
  reorderLevel: string;
  reorderQty: string;
  safetyStock: string;
  storageLocation: string;
  batchTracking: boolean;
  serialTracking: boolean;
  allowNegativeStock: boolean;
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string;

  // Packaging Hierarchy
  pkgBaseUnit: string;
  pkgPurchaseUnit: string;
  pkgBaseUnitsPerPurchase: string;
  pkgHasIntermediate: boolean;
  pkgIntermediateUnit: string;
  pkgIntermediateUnitsPerPurchase: string;
  pkgBaseUnitsPerIntermediate: string;

  // Pricing
  defaultPurchasePrice: string;
  defaultSalePrice: string;
  mrp: string;
  minSalePrice: string;
  maxDiscountPct: string;
  valuationRate: string;
  gstRate: string;
  hsnCode: string;
  taxCategory: string;
  samplePriceNote: string;

  // Purchasing
  defaultSupplierId: string;
  defaultSupplierName: string;
  leadTimeDays: string;
  minOrderQty: string;
  purchaseAccount: string;
  expenseAccount: string;

  // Sales & Meta
  incomeAccount: string;
  costCenter: string;
  isSalesItem: boolean;
  allowAlternativeItem: boolean;
  status: "Active" | "Inactive";
}

function getDefaultFormState(
  editing?: Medicine,
  defaultProductType: ProductType = "MEDICINE"
): WizardFormState {
  if (editing) {
    const pType = resolveProductType(editing.category, editing.productType);

    return {
      productType: pType,
      itemCode: editing.itemCode || "",
      sku: editing.sku || "",
      name: editing.name || "",
      genericName: editing.genericName || "",
      brand: editing.brand || "",
      manufacturer: editing.manufacturer || "",
      description: editing.description || "",
      subGroup: editing.subGroup || "",
      hasVariants: editing.hasVariants || false,

      // Medicine details
      composition: editing.medicineDetails?.composition || "",
      strength: editing.medicineDetails?.strength || "",
      dosageForm: editing.medicineDetails?.dosageForm || "",
      route: editing.medicineDetails?.route || "",
      storageCondition:
        editing.medicineDetails?.storageCondition || editing.injectionDetails?.storageCondition || "",
      schedule: editing.medicineDetails?.schedule || "",
      controlledSubstance: editing.medicineDetails?.controlledSubstance || false,

      // Food details
      targetSpecies: editing.foodDetails?.targetSpecies || "",
      foodType: editing.foodDetails?.foodType || "",
      lifeStage: editing.foodDetails?.lifeStage || "",
      flavour: editing.foodDetails?.flavour || "",
      packSize: editing.foodDetails?.packSize || "",
      dietaryIndication: editing.foodDetails?.dietaryIndication || "",

      // Accessory details
      accessoryType: editing.accessoryDetails?.accessoryType || "",
      petSize: editing.accessoryDetails?.petSize || "",
      material: editing.accessoryDetails?.material || "",
      color: editing.accessoryDetails?.color || "",

      // Injection details
      injComposition: editing.injectionDetails?.composition || "",
      injStrength: editing.injectionDetails?.strength || "",
      injRoute: editing.injectionDetails?.route || "",
      injectionSite: editing.injectionDetails?.injectionSite || "",
      vialSize: editing.injectionDetails?.vialSize || "",
      withdrawalPeriod: editing.injectionDetails?.withdrawalPeriod || "",
      coldChainRequired: editing.injectionDetails?.coldChainRequired || false,
      injSchedule: editing.injectionDetails?.schedule || "",
      injControlledSubstance: editing.injectionDetails?.controlledSubstance || false,

      // Stock
      unit: (editing.unit as UnitOfMeasure) || "Tablet",
      purchaseUom: editing.purchaseUom || "Box",
      salesUom: editing.salesUom || "Tablet",
      maintainStock: editing.maintainStock ?? true,
      valuationMethod: editing.valuationMethod || "FEFO",
      openingStock: "0",
      openingStockUnit: editing.packagingHierarchy?.purchaseUnit ?? editing.unit ?? "Box",
      currentStock: editing.currentStock ?? 0,
      reorderLevel: String(editing.reorderLevel ?? 10),
      reorderQty: String(editing.reorderQty ?? 20),
      safetyStock: String(editing.safetyStock ?? 5),
      storageLocation: editing.storageLocation || "",
      batchTracking: editing.batchTracking ?? false,
      serialTracking: editing.serialTracking ?? false,
      allowNegativeStock: editing.allowNegativeStock ?? false,
      batchNo: editing.batchNo || editing.medicineDetails?.batchNo || editing.injectionDetails?.batchNo || "",
      expiryDate: editing.expiryDate || editing.medicineDetails?.expiryDate || editing.injectionDetails?.expiryDate || "",
      manufacturingDate: editing.manufacturingDate || editing.medicineDetails?.manufacturingDate || editing.injectionDetails?.manufacturingDate || "",

      // Packaging Hierarchy — loaded from existing item or inferred
      pkgBaseUnit: editing.packagingHierarchy?.baseUnit ?? editing.unit ?? "Tablet",
      pkgPurchaseUnit: editing.packagingHierarchy?.purchaseUnit ?? "Box",
      pkgBaseUnitsPerPurchase: String(editing.packagingHierarchy?.baseUnitsPerPurchase ?? 100),
      pkgHasIntermediate: editing.packagingHierarchy?.hasIntermediateUnit ?? false,
      pkgIntermediateUnit: editing.packagingHierarchy?.intermediateUnit ?? "",
      pkgIntermediateUnitsPerPurchase: String(editing.packagingHierarchy?.intermediateUnitsPerPurchase ?? ""),
      pkgBaseUnitsPerIntermediate: String(editing.packagingHierarchy?.baseUnitsPerIntermediate ?? ""),

      // Pricing
      defaultPurchasePrice: String(editing.defaultPurchasePrice || ""),
      defaultSalePrice: String(editing.defaultSalePrice || ""),
      mrp: String(editing.mrp || editing.defaultSalePrice || ""),
      minSalePrice: String(editing.minSalePrice || ""),
      maxDiscountPct: String(editing.maxDiscountPct || "10"),
      valuationRate: String(editing.valuationRate || ""),
      gstRate: String(editing.gstRate || "12"),
      hsnCode: editing.hsnCode || "",
      taxCategory: editing.taxCategory || "Standard",
      samplePriceNote: editing.samplePriceNote || "",

      // Purchasing
      defaultSupplierId: editing.defaultSupplierId || "",
      defaultSupplierName: editing.defaultSupplierName || "",
      leadTimeDays: String(editing.leadTimeDays || "7"),
      minOrderQty: String(editing.minOrderQty || "1"),
      purchaseAccount: editing.purchaseAccount || "5010 - Cost of Goods Sold",
      expenseAccount: editing.expenseAccount || "5020 - Operating Supplies",

      // Sales & Meta
      incomeAccount: editing.incomeAccount || "4010 - Sales Revenue",
      costCenter: editing.costCenter || (pType === "MEDICINE" || pType === "INJECTION" ? "Pharmacy" : "Retail Store"),
      isSalesItem: editing.isSalesItem ?? true,
      allowAlternativeItem: editing.allowAlternativeItem ?? false,
      status: editing.status || "Active",
    };
  }

  // New item defaults based on category
  return {
    productType: defaultProductType,
    itemCode: "",
    sku: "",
    name: "",
    genericName: "",
    brand: "",
    manufacturer: "",
    description: "",
    subGroup: "",
    hasVariants: false,

    composition: "",
    strength: "",
    dosageForm: defaultProductType === "MEDICINE" ? "Tablet" : "",
    route: defaultProductType === "MEDICINE" ? "Oral" : "",
    storageCondition:
      defaultProductType === "INJECTION" ? "Cold Chain (2-8°C)" : "Room Temperature (15-25°C)",
    schedule: "Schedule H",
    controlledSubstance: false,

    targetSpecies: defaultProductType === "FOOD" ? "Dog" : "",
    foodType: defaultProductType === "FOOD" ? "Dry Kibble" : "",
    lifeStage: "Adult",
    flavour: "",
    packSize: "",
    dietaryIndication: "Maintenance",

    accessoryType: defaultProductType === "ACCESSORY" ? "Collar / Leash / Harness" : "",
    petSize: "Medium",
    material: "Nylon",
    color: "Black",

    injComposition: "",
    injStrength: "",
    injRoute: defaultProductType === "INJECTION" ? "IM" : "",
    injectionSite: "",
    vialSize: "",
    withdrawalPeriod: "0 days",
    coldChainRequired: defaultProductType === "INJECTION",
    injSchedule: "Schedule H",
    injControlledSubstance: false,

    unit: defaultProductType === "MEDICINE" ? "Tablet"
      : defaultProductType === "INJECTION" ? "Vial"
      : defaultProductType === "FOOD" ? "Kg" : "Piece",
    purchaseUom: "",
    salesUom: "",
    maintainStock: true,
    valuationMethod: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "FEFO" : "FIFO",
    openingStock: "0",
    openingStockUnit: defaultProductType === "MEDICINE" ? "Box"
      : defaultProductType === "INJECTION" ? "Box"
      : defaultProductType === "FOOD" ? "Bag" : "Piece",
    currentStock: 0,
    reorderLevel: defaultProductType === "MEDICINE" ? "200"
      : defaultProductType === "INJECTION" ? "10"
      : defaultProductType === "FOOD" ? "10" : "5",
    reorderQty: defaultProductType === "MEDICINE" ? "500"
      : defaultProductType === "INJECTION" ? "20"
      : defaultProductType === "FOOD" ? "20" : "15",
    safetyStock: "50",
    storageLocation: defaultProductType === "MEDICINE" ? "Pharmacy Shelf A1"
      : defaultProductType === "INJECTION" ? "Pharmacy Cold Chain Fridge"
      : "Retail Floor",
    batchTracking: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION",
    serialTracking: false,
    allowNegativeStock: false,
    batchNo: "",
    expiryDate: "",
    manufacturingDate: "",

    // Packaging Hierarchy defaults by product type
    pkgBaseUnit: defaultProductType === "MEDICINE" ? "Tablet"
      : defaultProductType === "INJECTION" ? "Vial"
      : defaultProductType === "FOOD" ? "Kg" : "Piece",
    pkgPurchaseUnit: defaultProductType === "FOOD" ? "Bag" : "Box",
    pkgBaseUnitsPerPurchase: defaultProductType === "MEDICINE" ? "100"
      : defaultProductType === "INJECTION" ? "5"
      : defaultProductType === "FOOD" ? "4" : "1",
    pkgHasIntermediate: defaultProductType === "MEDICINE",
    pkgIntermediateUnit: defaultProductType === "MEDICINE" ? "Strip" : "",
    pkgIntermediateUnitsPerPurchase: defaultProductType === "MEDICINE" ? "10" : "",
    pkgBaseUnitsPerIntermediate: defaultProductType === "MEDICINE" ? "10" : "",

    defaultPurchasePrice: "",
    defaultSalePrice: "",
    mrp: "",
    minSalePrice: "",
    maxDiscountPct: "10",
    valuationRate: "",
    gstRate: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "12"
      : defaultProductType === "FOOD" ? "5" : "18",
    hsnCode: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "3004"
      : defaultProductType === "FOOD" ? "2309" : "4201",
    taxCategory: "Standard",
    samplePriceNote: "",

    defaultSupplierId: "",
    defaultSupplierName: "",
    leadTimeDays: "7",
    minOrderQty: "1",
    purchaseAccount: "5010 - Cost of Goods Sold",
    expenseAccount: "5020 - Operating Supplies",

    incomeAccount: "4010 - Sales Revenue",
    costCenter: defaultProductType === "MEDICINE" || defaultProductType === "INJECTION" ? "Pharmacy" : "Retail Store",
    isSalesItem: true,
    allowAlternativeItem: false,
    status: "Active",
  };
}

// ─── Add flow: New Item → Purchase Bill → back to inventory ──────────────────

function AddItemFlow({
  open,
  onClose,
  defaultType,
  initialName,
  onItemCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultType: ProductType;
  initialName?: string | undefined;
  onItemCreated?: ((item: Medicine) => void) | undefined;
}) {
  const { refetchItems } = useInventory();
  const [created, setCreated] = useState<InventoryItemRow | null>(null);

  useEffect(() => {
    if (!open) setCreated(null);
  }, [open]);

  const finish = () => {
    setCreated(null);
    void refetchItems(); // inventory list shows the new item (and any stock change)
    onClose();
  };

  return (
    <>
      <NewItemModal
        open={open && !created}
        onClose={onClose}
        defaultType={defaultType}
        initialName={initialName}
        onSuccess={(item) => {
          setCreated(item);
          void refetchItems();
          onItemCreated?.(item as unknown as Medicine);
        }}
      />
      {created && (
        <SupplierBillFormModal open onClose={finish} onSuccess={finish} initialItem={created} />
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ProductMasterWizardDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Medicine | undefined;
  defaultProductType?: ProductType;
  initialName?: string;
  onItemCreated?: (item: Medicine) => void;
}

export function ProductMasterWizardDialog({
  open,
  onClose,
  editing,
  defaultProductType = "MEDICINE",
  initialName,
  onItemCreated,
}: ProductMasterWizardDialogProps) {
  const { addMedicine, updateMedicine, getTotalQty } = useInventory();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(() => {
    const s = getDefaultFormState(editing, defaultProductType);
    if (initialName && !editing) s.name = initialName;
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [nextCode, setNextCode] = useState("");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);

  const draftKey = `vetos_draft_${form.productType}`;
  const activeDef = CATEGORY_DEFS.find((d) => d.type === form.productType) ?? CATEGORY_DEFS[0]!;

  const [purchaseBillState, setPurchaseBillState] = useState<PurchaseBillWizardState>(() => ({
    enabled: !editing,
    purchaseType: "GST",
    billDate: todayIST(),
    paymentStatus: "PAID",
    paymentMode: "CASH",
    supplierId: editing?.defaultSupplierId || "",
    supplierName: editing?.defaultSupplierName || "",
    placeOfSupply: "Maharashtra",
    poNumber: "",
    purchaseBillNo: `PB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    lines: [],
    addShipping: false,
    shippingCost: 0,
    remarks: "",
  }));

  // Reset or load initial data when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      const initial = getDefaultFormState(editing, defaultProductType);
      if (initialName && !editing) {
        initial.name = initialName;
      }
      setForm(initial);

      setPurchaseBillState({
        enabled: !editing,
        purchaseType: "GST",
        billDate: todayIST(),
        paymentStatus: "PAID",
        paymentMode: "CASH",
        supplierId: editing?.defaultSupplierId || "",
        supplierName: editing?.defaultSupplierName || "",
        placeOfSupply: "Maharashtra",
        poNumber: "",
        purchaseBillNo: `PB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        lines: [],
        addShipping: false,
        shippingCost: 0,
        remarks: "",
      });

      // Check draft only when adding and no explicit initialName
      if (!editing && !initialName) {
        try {
          const raw = localStorage.getItem(`vetos_draft_${defaultProductType}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data && parsed.updatedAt) {
              setHasSavedDraft(true);
              setDraftTimestamp(new Date(parsed.updatedAt).toLocaleTimeString());
            }
          }
        } catch (e) {
          console.warn("Could not check localStorage draft:", e);
        }
      } else {
        setHasSavedDraft(false);
      }
    }
  }, [open, editing, defaultProductType, initialName]);

  // Peek next code for category
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    peekItemCodeFn({ data: { type: form.productType } })
      .then((code) => {
        if (!cancelled && code) {
          setNextCode(code);
          setForm((prev) => ({
            ...prev,
            itemCode: code,
            sku: prev.sku || `${code}-STD`,
          }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, editing, form.productType]);

  // Autosave draft (debounced) when adding
  useEffect(() => {
    if (!open || editing) return;
    const timer = setTimeout(() => {
      if (form.name.trim().length > 0) {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ data: form, updatedAt: new Date().toISOString() })
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, open, editing, draftKey]);

  // Draft recovery actions
  const handleRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data) {
          const defaults = getDefaultFormState(undefined, parsed.data.productType || form.productType);
          setForm({ ...defaults, ...parsed.data });
          toast.success("Draft recovered successfully");
        }
      }
    } catch {
      toast.error("Failed to restore draft");
    } finally {
      setHasSavedDraft(false);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(draftKey);
    setHasSavedDraft(false);
    toast.info("Draft discarded");
  };

  const updateField = <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Step Validation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!form.name.trim()) {
        toast.error("Item Name is required");
        return false;
      }
      if (form.productType === "MEDICINE" && !form.strength.trim()) {
        toast.warning("Tip: Medicine strength (e.g. 250mg) is recommended for clarity.");
      }
      if (form.expiryDate) {
        const days = getExpiryDiffDays(form.expiryDate);
        if (days !== null && days < 0) {
          toast.warning("Selected expiry date is in the past. Ensure this is intentional.");
        }
      }
      return true;
    }
    if (step === 2) {
      if (!form.reorderLevel || isNaN(Number(form.reorderLevel))) {
        toast.error("Valid Minimum / Reorder level is required for alerts");
        return false;
      }
      if (Number(form.openingStock) > 0 && form.batchTracking && !form.expiryDate) {
        const nextYear = getFutureDate(12);
        updateField("expiryDate", nextYear);
        toast.info("Opening stock tracked: Expiry Date automatically defaulted to 1 year ahead.");
      }
      return true;
    }
    if (step === 3) {
      if (!form.defaultSalePrice || Number(form.defaultSalePrice) <= 0) {
        toast.error("A valid Default Selling Price is required");
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep((s) => s + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  // Final Save Handler
  const handleSaveProduct = async () => {
    if (!validateStep(currentStep)) return;
    setSaving(true);

    try {
      const categoryName =
        form.productType === "MEDICINE"
          ? "Medicine"
          : form.productType === "INJECTION"
          ? "Injection"
          : form.productType === "FOOD"
          ? "Animal Food"
          : "Animal Accessories";

      const payload = {
        name: form.name.trim(),
        genericName: form.genericName.trim(),
        brand: form.brand.trim(),
        manufacturer: form.manufacturer.trim(),
        description: form.description.trim(),
        category: categoryName as any,
        productType: form.productType,
        sku: form.sku.trim() || undefined,
        subGroup: form.subGroup.trim(),
        hasVariants: form.hasVariants,

        unit: form.pkgBaseUnit || form.unit,
        purchaseUom: form.pkgPurchaseUnit || form.purchaseUom || form.unit,
        salesUom: form.pkgBaseUnit || form.salesUom || form.unit,
        maintainStock: form.maintainStock,
        valuationMethod: form.valuationMethod,
        reorderLevel: Number(form.reorderLevel) || 10,
        reorderQty: Number(form.reorderQty) || 20,
        safetyStock: Number(form.safetyStock) || 5,

        // Build packaging hierarchy from form fields
        packagingHierarchy: (() => {
          const baseUnitsPerPurchase = form.pkgHasIntermediate
            ? (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1)
            : Number(form.pkgBaseUnitsPerPurchase) || 1;
          const h: PackagingHierarchy = {
            baseUnit: form.pkgBaseUnit || form.unit,
            purchaseUnit: form.pkgPurchaseUnit || "Box",
            baseUnitsPerPurchase,
            hasIntermediateUnit: form.pkgHasIntermediate,
            intermediateUnit: form.pkgHasIntermediate ? form.pkgIntermediateUnit : undefined,
            intermediateUnitsPerPurchase: form.pkgHasIntermediate ? Number(form.pkgIntermediateUnitsPerPurchase) || undefined : undefined,
            baseUnitsPerIntermediate: form.pkgHasIntermediate ? Number(form.pkgBaseUnitsPerIntermediate) || undefined : undefined,
          };
          // purchase unit = base unit means one level (1 Vial = 1 Vial), never "1 Vial = 10 Vial"
          return normalizeHierarchy(h);
        })(),

        // Opening stock: entered in openingStockUnit → convert to base units
        currentStock: editing ? editing.currentStock : (() => {
          const openingQty = Number(form.openingStock) || 0;
          if (openingQty <= 0) return 0;
          const baseUnitsPerPurchase = form.pkgHasIntermediate
            ? (Number(form.pkgIntermediateUnitsPerPurchase) || 1) * (Number(form.pkgBaseUnitsPerIntermediate) || 1)
            : Number(form.pkgBaseUnitsPerPurchase) || 1;
          const openingUnit = form.openingStockUnit;
          const pkgPurchaseUnit = form.pkgPurchaseUnit || "Box";
          const pkgBaseUnit = form.pkgBaseUnit || form.unit;
          if (openingUnit === pkgBaseUnit) return openingQty; // same unit as stock: no multiplier (10 Vial opened must stay 10)
          if (openingUnit === pkgPurchaseUnit) return openingQty * baseUnitsPerPurchase;
          if (openingUnit === form.pkgIntermediateUnit && form.pkgHasIntermediate)
            return openingQty * (Number(form.pkgBaseUnitsPerIntermediate) || 1);
          if (openingUnit === pkgBaseUnit) return openingQty;
          return openingQty; // fallback
        })(),
        minStockLevel: Number(form.reorderLevel) || 10,
        storageLocation: form.storageLocation.trim(),
        batchTracking: form.batchTracking,
        serialTracking: form.serialTracking,
        allowNegativeStock: form.allowNegativeStock,
        batchNo: form.batchNo.trim(),
        expiryDate: form.expiryDate.trim(),
        manufacturingDate: form.manufacturingDate.trim(),

        defaultPurchasePrice: Number(form.defaultPurchasePrice) || 0,
        defaultSalePrice: Number(form.defaultSalePrice) || 0,
        mrp: Number(form.mrp) || Number(form.defaultSalePrice) || 0,
        minSalePrice: Number(form.minSalePrice) || 0,
        maxDiscountPct: Number(form.maxDiscountPct) || 0,
        valuationRate: Number(form.valuationRate) || Number(form.defaultPurchasePrice) || 0,
        lastPurchaseRate: Number(form.defaultPurchasePrice) || 0,
        samplePriceNote: form.samplePriceNote.trim() || undefined,

        gstRate: Number(form.gstRate) || 0,
        hsnCode: form.hsnCode.trim(),
        taxCategory: form.taxCategory || "Standard",
        isZeroRated: false,
        isExempt: false,
        isImport: false,

        defaultSupplierId: form.defaultSupplierId.trim(),
        defaultSupplierName: form.defaultSupplierName.trim(),
        leadTimeDays: Number(form.leadTimeDays) || 7,
        minOrderQty: Number(form.minOrderQty) || 1,
        purchaseAccount: form.purchaseAccount || "5010 - Cost of Goods Sold",
        expenseAccount: form.expenseAccount || "5020 - Operating Supplies",

        incomeAccount: form.incomeAccount || "4010 - Sales Revenue",
        costCenter: form.costCenter || "Retail Store",
        isSalesItem: form.isSalesItem,
        allowAlternativeItem: form.allowAlternativeItem,

        // Profile details
        medicineDetails:
          form.productType === "MEDICINE"
            ? {
                composition: form.composition,
                strength: form.strength,
                dosageForm: form.dosageForm,
                route: form.route,
                storageCondition: form.storageCondition,
                schedule: form.schedule,
                controlledSubstance: form.controlledSubstance,
                batchNo: form.batchNo.trim(),
                expiryDate: form.expiryDate.trim(),
                manufacturingDate: form.manufacturingDate.trim(),
              }
            : undefined,

        foodDetails:
          form.productType === "FOOD"
            ? {
                targetSpecies: form.targetSpecies,
                foodType: form.foodType,
                lifeStage: form.lifeStage,
                flavour: form.flavour,
                packSize: form.packSize,
                dietaryIndication: form.dietaryIndication,
              }
            : undefined,

        accessoryDetails:
          form.productType === "ACCESSORY"
            ? {
                accessoryType: form.accessoryType,
                petSize: form.petSize,
                material: form.material,
                color: form.color,
              }
            : undefined,

        injectionDetails:
          form.productType === "INJECTION"
            ? {
                composition: form.injComposition,
                strength: form.injStrength,
                route: form.injRoute,
                injectionSite: form.injectionSite,
                vialSize: form.vialSize,
                withdrawalPeriod: form.withdrawalPeriod,
                coldChainRequired: form.coldChainRequired,
                storageCondition: form.storageCondition,
                schedule: form.injSchedule,
                controlledSubstance: form.injControlledSubstance,
                batchNo: form.batchNo.trim(),
                expiryDate: form.expiryDate.trim(),
                manufacturingDate: form.manufacturingDate.trim(),
              }
            : undefined,
      };

      if (editing) {
        await updateMedicine(editing.itemCode, {
          ...payload,
          status: form.status,
        } as any);
        toast.success(`Updated ${form.name} successfully`);
      } else {
        const created = await addMedicine(payload as any);
        localStorage.removeItem(draftKey);

        // Auto-generate Purchase Bill in Billing & Payments if enabled
        if (purchaseBillState.enabled && purchaseBillState.lines.length > 0) {
          try {
            const subTotal = purchaseBillState.lines.reduce((s, l) => s + (l.amount || 0), 0);
            const shipping = purchaseBillState.addShipping ? Math.max(0, purchaseBillState.shippingCost || 0) : 0;
            const grandTotal = Math.round((subTotal + shipping) * 100) / 100;
            const invItemId = created ? (created as any)._id || created.itemCode : undefined;

            const paymentStatus = purchaseBillState.paymentStatus || "PAID";
            const finalTotal = grandTotal > 0 ? grandTotal : 1;
            const actualPaidAmount =
              paymentStatus === "PAID"
                ? finalTotal
                : paymentStatus === "PARTIAL"
                ? Math.min(finalTotal, Math.max(0, purchaseBillState.paidAmount ?? Math.round(finalTotal / 2)))
                : 0;
            const hasPayment = actualPaidAmount > 0;

            await createPurchaseBillFn({
              data: {
                supplierId: purchaseBillState.supplierId || "GENERIC_SUPPLIER",
                supplierName: purchaseBillState.supplierName || form.defaultSupplierName || "Supplier",
                billNumber: purchaseBillState.purchaseBillNo.trim() || `PB-${Date.now()}`,
                billDate: purchaseBillState.billDate,
                dueDate: purchaseBillState.dueDate || undefined,
                taxType: "INTRA",
                subtotal: subTotal,
                discountTotal: 0,
                taxableTotal: subTotal,
                cgstTotal: 0,
                sgstTotal: 0,
                igstTotal: 0,
                otherCharges: shipping,
                roundOff: 0,
                grandTotal: finalTotal,
                remarks: purchaseBillState.remarks.trim() || undefined,
                paymentNow: hasPayment,
                paymentLines: hasPayment
                  ? [
                      {
                        mode: purchaseBillState.paymentMode || "CASH",
                        accountId: "DEFAULT_ACCOUNT",
                        accountName:
                          purchaseBillState.paymentMode === "CASH"
                            ? "Cash Register"
                            : "Main Bank Account",
                        amount: actualPaidAmount,
                      },
                    ]
                  : undefined,
                items: purchaseBillState.lines.map((l, idx) => ({
                  lineNo: idx + 1,
                  itemType: "INVENTORY",
                  inventoryItemId: invItemId,
                  description: l.productName,
                  hsnCode: form.hsnCode || "3004",
                  qty: l.quantity,
                  freeQty: 0,
                  unit: l.unit,
                  purchaseRate: l.purchasePrice,
                  mrp: l.mrp || Number(form.mrp) || undefined,
                  discountPct: 0,
                  gstPct: Number(form.gstRate) || 0,
                  taxableAmount: l.amount,
                  taxAmount: 0,
                  lineTotal: l.amount,
                  batchNo: (l as any).batchNo || form.batchNo || undefined,
                  expiryDate: (l as any).expiryDate || form.expiryDate || undefined,
                })),
              },
            });

            toast.success(
              `Created ${form.name} and generated Purchase Bill (${purchaseBillState.purchaseBillNo}) in Billing!`
            );
          } catch (pbErr: any) {
            console.error("[ProductMasterWizard] Auto-generate purchase bill failed:", pbErr);
            toast.warning(`Item created, but failed to generate purchase bill: ${pbErr.message || "Unknown error"}`);
          }
        } else {
          toast.success(`Created ${form.name} (${nextCode || "New"}) successfully`);
        }

        if (created) {
          onItemCreated?.(created);
        }
      }

      onClose();
    } catch (err: any) {
      console.error("[ProductMasterWizard] Save error:", err);
      toast.error(err.message || "Failed to save product master record");
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySwitch = (newType: ProductType) => {
    if (editing || form.productType === newType) return;
    const defaults = getDefaultFormState(undefined, newType);
    setForm((prev) => ({
      ...prev,
      productType: newType,
      unit: prev.unit || defaults.unit,
      storageLocation: defaults.storageLocation,
      gstRate: defaults.gstRate,
      hsnCode: defaults.hsnCode,
      reorderLevel: defaults.reorderLevel,
      reorderQty: defaults.reorderQty,
      costCenter: defaults.costCenter,
      batchTracking: defaults.batchTracking,
    }));
  };

  const handleQuickSave = async () => {
    if (!form.name.trim()) {
      toast.error("Item Name is required");
      return;
    }
    if (!form.defaultSalePrice) {
      setForm((prev) => ({ ...prev, defaultSalePrice: "0" }));
    }
    if (form.batchTracking && !form.expiryDate) {
      setForm((prev) => ({ ...prev, expiryDate: getFutureDate(12) }));
    }
    await handleSaveProduct();
  };

  const getCategoryBadge = (type: ProductType) => {
    switch (type) {
      case "MEDICINE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Pill className="h-3.5 w-3.5" /> Medicine Master
          </span>
        );
      case "INJECTION":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Syringe className="h-3.5 w-3.5" /> Injection Master
          </span>
        );
      case "FOOD":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Bone className="h-3.5 w-3.5" /> Food Item Master
          </span>
        );
      case "ACCESSORY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Tag className="h-3.5 w-3.5" /> Accessory Master
          </span>
        );
      default:
        return null;
    }
  };

  // Add → New Item modal then a purchase bill; Edit → the same modal, prefilled.
  if (!editing) {
    return (
      <AddItemFlow
        open={open}
        onClose={onClose}
        defaultType={defaultProductType}
        initialName={initialName}
        onItemCreated={onItemCreated}
      />
    );
  }

  return <EditItemModal open={open} onClose={onClose} editing={editing} />;
}

function EditItemModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Medicine }) {
  const { refetchItems } = useInventory();
  return (
    <NewItemModal
      open={open}
      onClose={onClose}
      editing={editing as unknown as InventoryItemRow}
      onSuccess={() => void refetchItems()}
    />
  );
}
