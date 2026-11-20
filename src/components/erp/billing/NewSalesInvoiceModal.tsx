import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Receipt,
  Calculator,
  Bell,
  Printer,
  Save,
  AlertCircle,
  Building2,
  Dog,
  User,
  Check,
  Package,
  ChevronDown,
  Pill,
  Syringe,
  Bone,
  Tag,
  Calendar,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { STATE_CODES } from "@/lib/finance/stateCodes";
import { todayIST, addDaysToISO, formatDisplayDate } from "@/lib/utils/dateUtils";
import { SplitPaymentInput, type PaymentAccount, type PaymentLine, type PaymentMode } from "@/components/erp/shared/SplitPaymentInput";
import { listPaymentAccountsFn } from "@/lib/mongodb/serverFns/masters";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { computeDocument, type TaxDocInput } from "@/lib/finance/taxEngine";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { finalizeVisitAndBillFn } from "@/lib/mongodb/serverFns/clinical";
import { listApprovedDoctorsFn } from "@/lib/mongodb/serverFns/auth";
import { getBranchStateCodeFn } from "@/lib/mongodb/serverFns/branches";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { getAvailableUnits, convertToBase, type PackagingHierarchy } from "@/lib/inventory/packagingUtils";
import { useErp } from "@/lib/erp/store";
import { useInventory, type Medicine, type ProductType } from "@/components/erp/inventory/useInventoryStore";
import { ProductMasterWizardDialog } from "@/components/erp/inventory/ProductMasterWizardDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";
import { vetNameOf } from "@/lib/clinical/attendingVet";
import { createAppointmentFn } from "@/lib/mongodb/serverFns/appointments";

interface InvoiceGridLine {
  id: string;
  sNo: number;
  itemName: string;
  itemDescription?: string | undefined;
  tag: string;
  quantity: number;
  uom: string;
  salePrice: number;
  discountPct: number;
  gstRate: number;
  amount: number;
  serialNo?: string | undefined;
  /** Inventory link: item code, plus the quantity expressed in the item's base unit. */
  itemCode?: string | undefined;
  quantityBase?: number | undefined;
  baseLabel?: string | undefined;
  /** Consultation-fee line added from the Doctor-Advised fee chips. */
  isFee?: boolean | undefined;
}

const FEE_PRESETS = [
  { code: "FREE", label: "Free / Follow-up", amount: 0 },
  { code: "RECHECK", label: "Re-check", amount: 300 },
  { code: "STANDARD", label: "Standard", amount: 500 },
  { code: "SPECIALIST", label: "Specialist", amount: 800 },
  { code: "EMERGENCY", label: "Emergency / Surgery", amount: 1200 },
  { code: "HOME_VISIT", label: "Home Visit", amount: 0 }, // price typed by the user
];

const DIAGNOSIS_OPTIONS = [
  "Hairfall", "Rashes on Skin", "Blood in Urine", "Lump on Body / Growth", "Itching", "Limping", "Constipation",
  "Urine Incontinence", "Vomiting", "Listlessness", "Dehydration", "Fever / Pyrexia", "Anorexia / Loss of Appetite",
  "Otitis / Ear Discharge", "Coughing / Sneezing", "Other",
];

const SYMPTOM_OPTIONS = ([
  ["Loss of appetite", "General"], ["Vomiting", "GI"], ["Diarrhoea", "GI"], ["Lethargy", "General"],
  ["Itching", "Skin/Coat"], ["Hairfall", "Skin/Coat"], ["Coughing", "Respiratory"], ["Sneezing", "Oral/Nose"],
  ["Limping", "Musculoskeletal"], ["Fever reported", "Fluid/Temperature"], ["Weight loss", "General"],
  ["Ear discharge", "Ear"], ["Eye discharge", "Eye"], ["Blood in urine", "Urinary"], ["Blood in stool", "GI"],
  ["Constipation", "GI"], ["Increased thirst", "Fluid/Temperature"], ["Skin rash", "Skin/Coat"], ["Other", ""],
] as [string, string][]).map(([label, tag]) => ({ label, tag }));

/** White dropdown + chips: pick several from the list, or choose "Other" / type your own and press Enter. */
function TagPicker({ value, onChange, options, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; options: { label: string; tag?: string }[]; placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [typingOther, setTypingOther] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (t: string) => {
    const v = t.trim();
    if (v && v.toLowerCase() !== "other" && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setQ("");
    setTypingOther(false);
    setOpen(false); // list closes after every pick
  };
  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const custom = q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={inputRef}
          value={q}
          placeholder={typingOther ? "Type here, then press Enter" : placeholder}
          onFocus={() => !typingOther && setOpen(true)}
          onClick={() => !typingOther && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQ(e.target.value); setOpen(!typingOther); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(q); }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {open && (shown.length > 0 || custom) && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-white py-1 text-sm text-slate-900 shadow-lg">
            {custom && (
              <li><button type="button" className="w-full px-3 py-1.5 text-left font-semibold hover:bg-slate-100"
                onMouseDown={(e) => { e.preventDefault(); add(q); }}>Add &ldquo;{q.trim()}&rdquo;</button></li>
            )}
            {shown.map((o) => (
              <li key={o.label}>
                <button type="button" className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-slate-100"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (o.label === "Other") { setQ(""); setTypingOther(true); setOpen(false); inputRef.current?.focus(); }
                    else add(o.label);
                  }}>
                  <span>{o.label}</span>
                  {o.tag && <span className="text-[10px] text-slate-500">{o.tag}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const COMMON_UOMS = ["PCS", "STRIP", "TAB", "BOTTLE", "VIAL", "ML", "GM", "KG", "BOX", "DOSE", "SESSION"];

const CLINIC_STAFF_OPTIONS = [
  "Sneha Kulkarni (Pharmacy)",
  "Jyoti Sahare (Front Desk)",
  "Cashier / Front Desk",
  "Other",
];

const ITEM_CATEGORIES = [
  { id: "RETAIL", label: "Food, Supplement, Accessories, Grooming" },
  { id: "ALL", label: "All Categories" },
  { id: "MEDICINE", label: "Medicines & Rx" },
  { id: "INJECTION", label: "Injections & Vaccines" },
  { id: "FOOD", label: "Pet Food & Diets" },
  { id: "ACCESSORY", label: "Accessories & Care" },
  { id: "CONSUMABLE", label: "Consumables & Surgery" },
  { id: "SERVICE", label: "Clinical Services" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onInvoiceCreated?: (newInvoice: any) => void;
  initialPet?: any;
  /** Receptionist "Doctor-Advised Medicine": doctor not on site; the bill records who prescribed and who dispensed. */
  advisedMode?: boolean;
}

export function NewSalesInvoiceModal({ open, onClose, onInvoiceCreated, initialPet, advisedMode }: Props) {
  const { currentUser, role, roleId } = useErp();
  // Receptionist invoices always carry a "given by reception" note; the prescribing doctor is optional unless advisedMode.
  const byReception = roleId === "reception";
  const activeDoctorName =
    currentUser?.fullName || (currentUser?.roleId === "doctor" ? currentUser.fullName : role?.person || "");

  const { medicines } = useInventory();

  // Set once "Save and Print" finishes — swaps this modal over to the real formatted
  // InvoicePrintView instead of the previous raw window.print() of the unstyled form.
  const [printableInvoice, setPrintableInvoice] = useState<any | null>(null);

  // ── 1. Invoice Header Information State ──
  const [invoiceType, setInvoiceType] = useState<"GST" | "NON_GST" | "BILL_OF_SUPPLY">("GST");
  const [docDate, setDocDate] = useState(todayIST());
  const [soldBy, setSoldBy] = useState(activeDoctorName || "");
  const [customSoldBy, setCustomSoldBy] = useState("");
  const [advisedDoctor, setAdvisedDoctor] = useState("");
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [linkTo, setLinkTo] = useState<"COUNTER_SALE" | "CLIENT_ACCOUNT">("COUNTER_SALE");
  const [mobileNo, setMobileNoRaw] = useState("");
  // Digits only, last 10 — drops a +91 / 0 prefix from stored or pasted numbers
  const setMobileNo = (v: string) => setMobileNoRaw(v.replace(/\D/g, "").slice(-10));
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [branchStateCode, setBranchStateCode] = useState("");
  // Clinic's own state: seller side of GST, and the default Place of Supply (editable)
  useEffect(() => {
    if (!open) return;
    getBranchStateCodeFn().then((c) => {
      setBranchStateCode(c);
      setPlaceOfSupply((p) => p || c);
    }).catch(() => {});
  }, [open]);
  const [clientGstin, setClientGstin] = useState("");

  // Customer Type: Patient vs Other / General Client
  const [customerType, setCustomerType] = useState<"PATIENT" | "OTHER">("PATIENT");
  const [otherClientType, setOtherClientType] = useState("Walk-in Retail / OTC");
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [showRegisterPetModal, setShowRegisterPetModal] = useState(false);
  const [clientListOpen, setClientListOpen] = useState(false);
  // Existing patients matching what is typed in Client Name (owner, pet or mobile)
  const clientMatches = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return pets.slice(0, 8);
    if (selectedPetId) return [];
    return pets.filter((p) =>
      [p.owner?.name, p.ownerName, p.name, p.owner?.phone, p.ownerPhone].some((v) => String(v || "").toLowerCase().includes(q))
    ).slice(0, 12);
  }, [clientName, pets, selectedPetId]);

  // ── 2. Inventory Items & Category Selection ──
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  // Invoices are for items that need no consultation, so browsing starts on Food / Supplement / Accessories / Grooming
  const [itemCategory, setItemCategory] = useState<string>(advisedMode ? "MEDICINE" : "RETAIL");
  useEffect(() => {
    if (!(advisedMode || byReception) || !open) return;
    setAdvisedDoctor("");
    if (advisedMode) setItemCategory("MEDICINE");
    listApprovedDoctorsFn().then((d) => setDoctors(d ?? [])).catch(() => setDoctors([]));
  }, [advisedMode, byReception, open]);
  // The inventory item the current entry row is linked to (null = free-typed)
  const [selectedItem, setSelectedItem] = useState<InventoryItemRow | null>(null);

  // ── 3. Particulars Line Entry State ──
  const [particularsMode, setParticularsMode] = useState<"Tagging" | "ItemCode">("Tagging");
  const [serialCode, setSerialCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [uom, setUom] = useState("PCS");
  const [quantity, setQuantity] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [lineSerialNo, setLineSerialNo] = useState("");

  // Grid Lines
  const [lines, setLines] = useState<InvoiceGridLine[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  // Follow-up visits (advised mode): N consecutive days after the invoice date, or hand-picked days
  const [fuOn, setFuOn] = useState(false);
  const [fuMode, setFuMode] = useState<"consecutive" | "individual">("consecutive");
  const [fuDays, setFuDays] = useState(3);
  const [fuPicked, setFuPicked] = useState<string[]>([]);
  const [fuNote, setFuNote] = useState("");
  const followUpDates = useMemo(() => {
    if (!advisedMode || !fuOn) return [] as string[];
    const base = docDate || todayIST();
    return fuMode === "consecutive"
      ? Array.from({ length: Math.min(60, Math.max(0, fuDays)) }, (_, i) => addDaysToISO(base, i + 1))
      : [...fuPicked].sort();
  }, [advisedMode, fuOn, fuMode, fuDays, fuPicked, docDate]);
  const [customFeeName, setCustomFeeName] = useState("");
  const [customFeeAmt, setCustomFeeAmt] = useState(0);
  // Overall bill discount (shown only in advisedMode at the totals section)
  const [overallDiscountType, setOverallDiscountType] = useState<"%" | "₹">("%");
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  // Manual Consultation Fee: receptionist types any free-form amount
  const [manualConsultFeeAmt, setManualConsultFeeAmtRaw] = useState(0);
  const MANUAL_FEE_ID = "fee_MANUAL";
  const isManualFeeActive = !!lines.find((l) => l.id === MANUAL_FEE_ID);
  const toggleManualFee = () => {
    setLines((prev) => {
      const next = prev.some((l) => l.id === MANUAL_FEE_ID)
        ? prev.filter((l) => l.id !== MANUAL_FEE_ID)
        : [
            ...prev,
            {
              id: MANUAL_FEE_ID,
              sNo: 0,
              tag: "",
              itemName: "Consultation - Manual",
              quantity: 1,
              uom: "SESSION",
              salePrice: manualConsultFeeAmt,
              discountPct: 0,
              gstRate: 0,
              amount: manualConsultFeeAmt,
              isFee: true,
            } as InvoiceGridLine,
          ];
      return next.map((l, i) => ({ ...l, sNo: i + 1, tag: `SR-${String(i + 1).padStart(3, "0")}` }));
    });
  };
  const setManualConsultFeeAmt = (val: number) => {
    setManualConsultFeeAmtRaw(val);
    setLines((prev) =>
      prev.map((l) => (l.id === MANUAL_FEE_ID ? { ...l, salePrice: val, amount: val } : l))
    );
  };

  // ── 4. Footer, Shipping & Partial Payment Details ──
  const [addShipping, setAddShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [hasInvoiceRef, setHasInvoiceRef] = useState(false);
  const [invoiceRefNo, setInvoiceRefNo] = useState("");

  const [paymentMode, setPaymentMode] = useState<"Cash" | "Cheque" | "Card" | "Mobile Wallet" | "Demand Draft" | "Bank Transfer">("Cash");
  const [paymentType, setPaymentType] = useState<"FULL" | "PARTIAL" | "UNPAID">("FULL");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string>(() => addDaysToISO(todayIST(), 7));
  // Split payment: one line per mode (e.g. Cash 900 + UPI 20); the lines must add up to "Amount received"
  const [payLines, setPayLines] = useState<PaymentLine[]>([]);
  const [payAccounts, setPayAccounts] = useState<PaymentAccount[]>([]);
  useEffect(() => {
    if (!open) return;
    listPaymentAccountsFn()
      .then((a: any[]) => setPayAccounts(a && a.length ? a : []))
      .catch(() => setPayAccounts([]));
    setPayLines([]);
    // Reset manual consultation fee state on each new modal open
    setManualConsultFeeAmtRaw(0);
    // Reset overall discount
    setOverallDiscountValue(0);
    setOverallDiscountType("%");
    setFuOn(false); setFuMode("consecutive"); setFuDays(3); setFuPicked([]); setFuNote("");
  }, [open]);
  // A clinic with no payment accounts configured still gets Cash and Bank lines
  const splitAccounts: PaymentAccount[] = payAccounts.length
    ? payAccounts
    : [
        { _id: "cash", name: "Cash in Hand", type: "CASH", isDefault: true },
        { _id: "bank", name: "Bank", type: "BANK", isDefault: true },
      ];
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [remarksPrivate, setRemarksPrivate] = useState("");

  const [saving, setSaving] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // ── 5. Add Inventory Item Modal State & Handler ──
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductDefaultType, setAddProductDefaultType] = useState<ProductType>("MEDICINE");
  const [addProductInitialName, setAddProductInitialName] = useState("");

  const handleOpenAddProduct = (type?: ProductType, nameVal?: string) => {
    let targetType: ProductType = type || "MEDICINE";
    if (!type) {
      if (itemCategory === "INJECTION") targetType = "INJECTION";
      else if (itemCategory === "FOOD") targetType = "FOOD";
      else if (itemCategory === "ACCESSORY") targetType = "ACCESSORY";
      else targetType = "MEDICINE";
    }
    setAddProductDefaultType(targetType);
    setAddProductInitialName(nameVal !== undefined ? nameVal : itemName || "");
    setShowAddProductModal(true);
  };

  const handleProductCreated = (item: Medicine) => {
    const rowItem: InventoryItemRow = {
      itemCode: item.itemCode,
      name: item.name,
      genericName: item.genericName || "",
      brand: item.brand || "",
      manufacturer: item.manufacturer || "",
      description: item.description || "",
      category: item.category as any,
      productType: item.productType as any,
      sku: item.sku || "",
      unit: item.unit,
      purchaseUom: item.purchaseUom,
      salesUom: item.salesUom,
      uomConversions: [],
      maintainStock: item.maintainStock,
      valuationMethod: item.valuationMethod,
      currentStock: item.currentStock || 0,
      minStockLevel: item.minStockLevel || 10,
      reorderLevel: item.reorderLevel || 10,
      defaultSalePrice: item.defaultSalePrice || 0,
      defaultPurchasePrice: item.defaultPurchasePrice || 0,
      mrp: item.mrp || 0,
      minSalePrice: item.minSalePrice || 0,
      isExempt: false,
      status: "Active",
    };
    setInventoryItems((prev) => [rowItem, ...prev.filter((x) => x.itemCode !== rowItem.itemCode)]);
    handleSelectInventoryItem(rowItem);
    setIsInvoiceItemDropdownOpen(false);
    setShowAddProductModal(false);
    toast.success(`Created "${item.name}" (${item.itemCode}) and selected for billing!`);
  };

  // Auto-calculated next serial number with respect to existing lines count
  const autoGeneratedSerialNo = useMemo(() => {
    return `SR-${String(lines.length + 1).padStart(3, "0")}`;
  }, [lines.length]);

  // Load pets and inventory items on open
  useEffect(() => {
    if (open) {
      listPetsWithOwnersFn()
        .then((data) => {
          setPets(data || []);
          if (initialPet) {
            setSelectedPetId(initialPet.petId || initialPet._id);
            setClientName(initialPet.owner?.name || initialPet.ownerName || "CASH");
            setMobileNo(initialPet.owner?.phone || initialPet.ownerPhone || "");
            setLinkTo("CLIENT_ACCOUNT");
            setCustomerType("PATIENT");
          }
        })
        .catch(console.error);

      getItemsFn({ data: { status: "Active" } })
        .then((items) => {
          if (items && items.length > 0) {
            setInventoryItems(items);
          }
        })
        .catch(console.error);
    }
  }, [open, initialPet]);

  // Filter inventory items based on selected category
  const filteredInventoryItems = useMemo(() => {
    let list: any[] = inventoryItems;
    if (list.length === 0 && medicines && medicines.length > 0) {
      // Fallback to cache medicines
      list = medicines.map((m: any) => ({
        itemCode: m.itemCode || m.id || "M-001",
        name: m.name,
        productType: (m.type || "MEDICINE") as any,
        genericName: m.genericName || "",
        brand: m.brand || "",
        manufacturer: m.manufacturer || "",
        description: m.description || "",
        category: m.category || "Medicine",
        subGroup: "",
        hasVariants: false,
        sku: m.sku || "",
        unit: m.unit || "PCS",
        purchaseUom: m.purchaseUom || "PCS",
        salesUom: m.salesUom || "PCS",
        uomConversions: [],
        maintainStock: true,
        valuationMethod: "FEFO",
        currentStock: m.currentStock || 10,
        minStockLevel: 5,
        reorderLevel: 10,
        defaultSalePrice: m.defaultSalePrice || m.mrp || 0,
        defaultPurchasePrice: m.purchaseRate || 0,
        mrp: m.mrp || 0,
        minSalePrice: 0,
        isTaxExempt: false,
        status: "Active",
      }));
    }

    if (itemCategory !== "ALL") {
      list = list.filter((i) => {
        if (itemCategory === "RETAIL") {
          const sub = `${(i as any).subGroup ?? ""} ${i.name ?? ""}`.toLowerCase();
          return (
            i.productType === "FOOD" ||
            i.productType === "ACCESSORY" ||
            /supplement|shampoo|groom/.test(sub)
          );
        }
        if (itemCategory === "MEDICINE") {
          return i.productType === "MEDICINE" || i.category?.toLowerCase().includes("med");
        }
        if (itemCategory === "INJECTION") {
          return i.productType === "INJECTION" || i.category?.toLowerCase().includes("injection");
        }
        if (itemCategory === "FOOD") {
          return i.productType === "FOOD" || i.category?.toLowerCase().includes("food");
        }
        if (itemCategory === "ACCESSORY") {
          return i.productType === "ACCESSORY" || i.category?.toLowerCase().includes("access");
        }
        if (itemCategory === "CONSUMABLE") {
          return i.category?.toLowerCase().includes("consum") || i.category?.toLowerCase().includes("surg");
        }
        if (itemCategory === "SERVICE") {
          return i.category?.toLowerCase().includes("serv") || i.category?.toLowerCase().includes("proc");
        }
        return true;
      });
    }
    return list;
  }, [inventoryItems, medicines, itemCategory]);

  const [isInvoiceItemDropdownOpen, setIsInvoiceItemDropdownOpen] = useState(false);
  const invoiceItemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (invoiceItemDropdownRef.current && !invoiceItemDropdownRef.current.contains(e.target as Node)) {
        setIsInvoiceItemDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchedInvoiceItems = useMemo(() => {
    const q = itemName.trim().toLowerCase();
    if (!q) return filteredInventoryItems;
    return filteredInventoryItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
    );
  }, [itemName, filteredInventoryItems]);

  // When Link To changes
  useEffect(() => {
    if (linkTo === "CLIENT_ACCOUNT" && clientName === "CASH") {
      setClientName("");
    }
  }, [linkTo]);

  // When pet is selected in dropdown
  const [petPickerOpen, setPetPickerOpen] = useState(false);
  const handlePetSelect = (petId: string) => {
    if (!petId || petId === "WALKIN") {
      setSelectedPetId("");
      return;
    }
    setSelectedPetId(petId);
    const pet = pets.find((p) => p.petId === petId || p._id === petId);
    if (pet) {
      setClientName(pet.owner?.name || pet.ownerName || "CASH");
      setMobileNo(pet.owner?.phone || pet.ownerPhone || "");
      if (pet.owner?.address) setAddress(pet.owner.address);
      setLinkTo("CLIENT_ACCOUNT");
      setCustomerType("PATIENT");
    }
  };

  // Quick select an item from the category / inventory browse
  // A linked item only sells in the units its inventory record actually has:
  // 1) its saved packaging chain (Box/Strip/Tablet), else
  // 2) the pack size written in its name/generic name, e.g. "relaxzyme (1*10)" = 1 strip of 10 tablets, else
  // 3) just its own unit. Nothing is invented.
  const hierarchyOf = (it: InventoryItemRow): PackagingHierarchy => {
    if (it.packagingHierarchy) return it.packagingHierarchy as PackagingHierarchy;
    const unit = it.unit || it.salesUom || "PCS";
    const pack = /\((\d+)\s*[*xX×]\s*(\d+)\)/.exec(`${it.genericName ?? ""} ${it.name} ${it.description ?? ""}`);
    if (pack && /^(tablet|capsule)$/i.test(unit)) {
      const strips = Number(pack[1]);
      const perStrip = Number(pack[2]);
      if (perStrip > 1) {
        return strips > 1
          ? {
              baseUnit: unit, purchaseUnit: "Box", baseUnitsPerPurchase: strips * perStrip, hasIntermediateUnit: true,
              intermediateUnit: "Strip", intermediateUnitsPerPurchase: strips, baseUnitsPerIntermediate: perStrip,
            }
          : { baseUnit: unit, purchaseUnit: "Strip", baseUnitsPerPurchase: perStrip, hasIntermediateUnit: false };
      }
    }
    return { baseUnit: unit, purchaseUnit: unit, baseUnitsPerPurchase: 1, hasIntermediateUnit: false };
  };
  const hierarchy = selectedItem ? hierarchyOf(selectedItem) : undefined;
  const unitsOf = (h: PackagingHierarchy) => [...new Set(getAvailableUnits(h))].reverse(); // Box / Strip / Tablet
  const uomOptions = hierarchy ? unitsOf(hierarchy) : COMMON_UOMS;

  // The saved sale price is per the item's selling unit (e.g. ₹37 per Tablet). Price for any other
  // unit = that price x (base units in that unit / base units in the selling unit). Matches the real data.
  const sellingUnitOf = (it: InventoryItemRow, h: PackagingHierarchy) =>
    it.salesUom && unitsOf(h).includes(it.salesUom) ? it.salesUom : h.baseUnit;
  const priceForUnit = (it: InventoryItemRow, u: string, h: PackagingHierarchy) => {
    const price = it.defaultSalePrice || it.mrp || 0;
    const ratio = convertToBase(1, u, h) / convertToBase(1, sellingUnitOf(it, h), h);
    return Math.round(price * ratio * 100) / 100;
  };
  const baseQtyOf = (qty: number, unit: string, h: PackagingHierarchy | undefined) =>
    h ? convertToBase(qty, unit, h) : qty;

  const handleUomChange = (u: string) => {
    setUom(u);
    if (selectedItem && hierarchy) {
      setSalePrice(priceForUnit(selectedItem, u, hierarchy));
    }
  };

  const handleSelectInventoryItem = (item: InventoryItemRow) => {
    setItemName(item.name);
    setSelectedItem(item);
    const h = hierarchyOf(item);
    // Start on the item's own selling unit; the receptionist can switch to Strip/Box
    const defaultUnit = sellingUnitOf(item, h);
    setUom(defaultUnit);
    setSalePrice(priceForUnit(item, defaultUnit, h));
    const gst =
      (item as any).gstRate !== undefined
        ? (item as any).gstRate
        : item.productType === "MEDICINE" || item.productType === "INJECTION"
        ? 12
        : item.productType === "FOOD"
        ? 18
        : 18;
    setGstRate(gst);
    setItemDescription(item.genericName || item.brand || item.description || "");
    if ((item as any).batchNumber || (item as any).medicineDetails?.batchNumber) {
      setLineSerialNo((item as any).batchNumber || (item as any).medicineDetails?.batchNumber);
    }
    setQuantity(1);
    itemInputRef.current?.focus();
  };

  // Particulars Amount calculation
  const calculatedParticularsAmount = useMemo(() => {
    const gross = (quantity || 0) * (salePrice || 0);
    const disc = (gross * (discountPct || 0)) / 100;
    return Math.max(0, gross - disc);
  }, [quantity, salePrice, discountPct]);

  // Document Totals using pure Tax Engine
  const totals = useMemo(() => {
    if (lines.length === 0) {
      const ship = addShipping ? Math.max(0, shippingCost || 0) : 0;
      return {
        subTotal: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        taxTotal: 0,
        shipping: ship,
        roundOff: 0,
        grandTotal: ship,
        billDiscountAmt: 0,
      };
    }

    // Bill of Supply is a real, distinct invoice type (GST-exempt / composition
    // scheme) that must charge zero tax — collapsing it into "GST" here would
    // silently charge tax on a document type the law says is untaxed.
    const taxInvoiceType = invoiceType === "GST" ? "GST" : invoiceType;

    // Compute raw sub-total (sum of all line gross values before bill discount)
    const rawSubTotal = lines.reduce((acc, l) => acc + (l.quantity || 1) * (l.salePrice || 0), 0);
    // Bill-level discount in ₹ (convert % to absolute based on raw sub-total)
    const billDiscountAmt = overallDiscountValue > 0
      ? overallDiscountType === "%"
        ? roundMoney((rawSubTotal * Math.min(overallDiscountValue, 100)) / 100)
        : Math.min(overallDiscountValue, rawSubTotal)
      : 0;

    const docInput: TaxDocInput = {
      lines: lines.map((l) => ({
        quantity: l.quantity,
        rate: l.salePrice,
        discountType: "percentage",
        discountValue: l.discountPct,
        gstRate: taxInvoiceType === "GST" ? l.gstRate : 0,
      })),
      invoiceType: taxInvoiceType,
      branchStateCode: branchStateCode || placeOfSupply,
      placeOfSupply,
      shippingAmount: addShipping ? Math.max(0, shippingCost || 0) : 0,
      invoiceDiscount: billDiscountAmt > 0 ? billDiscountAmt : undefined,
    };

    const res = computeDocument(docInput);

    return {
      subTotal: res.subTotal,
      taxable: res.taxableValue,
      cgst: res.cgst,
      sgst: res.sgst,
      igst: res.igst,
      taxTotal: res.taxTotal,
      shipping: addShipping ? Math.max(0, shippingCost || 0) : 0,
      roundOff: res.roundOff,
      grandTotal: res.grandTotal,
      billDiscountAmt,
    };
  }, [lines, invoiceType, placeOfSupply, branchStateCode, addShipping, shippingCost, overallDiscountType, overallDiscountValue]);

  // Sync paidAmount when grandTotal changes based on paymentType
  useEffect(() => {
    if (paymentType === "FULL") {
      setPaidAmount(totals.grandTotal);
    } else if (paymentType === "UNPAID") {
      setPaidAmount(0);
    }
  }, [totals.grandTotal, paymentType]);

  // Derived effective payment figures
  const effectivePaidAmount = useMemo(() => {
    if (paymentType === "FULL") return totals.grandTotal;
    if (paymentType === "UNPAID") return 0;
    return Math.max(0, Math.min(totals.grandTotal, paidAmount || 0));
  }, [paymentType, totals.grandTotal, paidAmount]);

  const balanceDue = useMemo(() => {
    return Math.max(0, totals.grandTotal - effectivePaidAmount);
  }, [totals.grandTotal, effectivePaidAmount]);

  // Push line to grid (Green [+] button)
  const handleAddLine = () => {
    if (!itemName.trim()) {
      toast.error("Please enter an Item Name");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (salePrice < 0) {
      toast.error("Sale price cannot be negative");
      return;
    }

    // Link to inventory: the picked item, or a typed name that exactly matches one
    const linked =
      selectedItem ??
      inventoryItems.find((it) => it.name.trim().toLowerCase() === itemName.trim().toLowerCase()) ??
      null;
    const linkedH = linked ? hierarchyOf(linked) : undefined;
    const qtyBase = baseQtyOf(quantity, uom, linkedH);
    if (linked) {
      if (lines.some((l) => l.itemCode === linked.itemCode)) {
        toast.error(`${linked.name} is already on this invoice. Remove it or change its quantity.`);
        return;
      }
      if (linked.maintainStock !== false && qtyBase > (linked.currentStock ?? 0)) {
        toast.error(
          `Only ${linked.currentStock ?? 0} ${linkedH?.baseUnit ?? linked.unit} of ${linked.name} in stock (you entered ${qtyBase}).`
        );
        return;
      }
    }

    const assignedTag = serialCode.trim() || autoGeneratedSerialNo;

    const newLine: InvoiceGridLine = {
      id: "line_" + Date.now(),
      sNo: lines.length + 1,
      itemName: itemName.trim(),
      itemDescription: itemDescription.trim() || undefined,
      tag: assignedTag,
      quantity,
      uom,
      salePrice,
      discountPct: discountPct || 0,
      gstRate: invoiceType === "NON_GST" ? 0 : gstRate,
      amount: calculatedParticularsAmount,
      serialNo: lineSerialNo || undefined,
      itemCode: linked?.itemCode,
      quantityBase: linked ? qtyBase : undefined,
      baseLabel: linked && linkedH && uom !== linkedH.baseUnit ? `= ${qtyBase} ${linkedH.baseUnit}` : undefined,
    };

    setLines((prev) => [...prev, newLine]);

    // Reset particulars entry fields
    setItemName("");
    setSelectedItem(null);
    setItemDescription("");
    setQuantity(0);
    setSalePrice(0);
    setDiscountPct(0);
    setLineSerialNo("");
    setSerialCode("");
    itemInputRef.current?.focus();
  };

  // Fee chips are multi-select: each selected chip is its own Consultation line on the bill.
  const feeLine = (code: string) => lines.find((l) => l.id === `fee_${code}`);
  const toggleFee = (p: (typeof FEE_PRESETS)[number]) => {
    setLines((prev) => {
      const id = `fee_${p.code}`;
      const next = prev.some((l) => l.id === id)
        ? prev.filter((l) => l.id !== id)
        : [
            ...prev,
            {
              id, sNo: 0, tag: "", itemName: p.code === "HOME_VISIT" ? "Home Visit" : `Consultation - ${p.label}`,
              quantity: 1, uom: "SESSION", salePrice: p.amount, discountPct: 0, gstRate: 0, amount: p.amount, isFee: true,
            } as InvoiceGridLine,
          ];
      return next.map((l, i) => ({ ...l, sNo: i + 1, tag: `SR-${String(i + 1).padStart(3, "0")}` }));
    });
  };
  const renumber = (ls: InvoiceGridLine[]) =>
    ls.map((l, i) => ({ ...l, sNo: i + 1, tag: `SR-${String(i + 1).padStart(3, "0")}` }));
  const addCustomFee = () => {
    const name = customFeeName.trim();
    if (!name || customFeeAmt <= 0) { toast.error("Enter a fee name and an amount."); return; }
    setLines((prev) => renumber([...prev, {
      id: `fee_custom_${Date.now()}`, sNo: 0, tag: "", itemName: name, quantity: 1, uom: "SESSION",
      salePrice: customFeeAmt, discountPct: 0, gstRate: 0, amount: customFeeAmt, isFee: true,
    }]));
    setCustomFeeName(""); setCustomFeeAmt(0);
  };
  const removeLineById = (id: string) => setLines((prev) => renumber(prev.filter((l) => l.id !== id)));
  const setFeePrice = (code: string, price: number) =>
    setLines((prev) => prev.map((l) => (l.id === `fee_${code}` ? { ...l, salePrice: price, amount: price } : l)));

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return filtered.map((l, i) => ({
        ...l,
        sNo: i + 1,
        tag: `SR-${String(i + 1).padStart(3, "0")}`,
      }));
    });
  };

  // Keyboard shortcuts (F9 Save, F10 Save & Print, Esc)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        void handleSave(false);
      } else if (e.key === "F10") {
        e.preventDefault();
        void handleSave(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, lines, totals, clientName, mobileNo, paymentMode, paidAmount, paymentType, paymentDueDate]);

  const handleSave = async (andPrint = false) => {
    if (lines.length === 0) {
      toast.error("Please add at least one line item to the invoice");
      return;
    }
    if (mobileNo && mobileNo.length !== 10) {
      toast.error("Mobile number must be 10 digits");
      return;
    }
    if (linkTo === "CLIENT_ACCOUNT" && !clientName.trim()) {
      toast.error("Client Name is required");
      return;
    }

    setSaving(true);
    try {
      const isPatient = customerType === "PATIENT" && Boolean(selectedPetId && selectedPetId !== "WALKIN");
      const selectedPet = isPatient ? pets.find((p) => p.petId === selectedPetId || p._id === selectedPetId) : null;

      const generatedVisitId =
        initialPet?.visitId ||
        `V-POS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const mappedPaymentMode: "UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due" =
        paymentType === "UNPAID"
          ? "Account Due"
          : paymentMode === "Mobile Wallet"
          ? "UPI"
          : paymentMode === "Demand Draft"
          ? "Cheque"
          : paymentMode === "Bank Transfer"
          ? "NetBanking"
          : paymentMode === "Card"
          ? "Card"
          : paymentMode === "Cheque"
          ? "Cheque"
          : "Cash";

      const toServerMode = (m: PaymentMode) =>
        m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : m === "CARD" ? "Card" : m === "CHEQUE" ? "Cheque" : "NetBanking";
      const usedLines = paymentType === "UNPAID" ? [] : payLines.filter((l) => (Number(l.amount) || 0) > 0);
      const linesTotal = roundMoney(usedLines.reduce((t, l) => t + (Number(l.amount) || 0), 0));
      if (usedLines.length > 0 && Math.abs(linesTotal - roundMoney(effectivePaidAmount)) > 0.01) {
        toast.error(`Payment lines add up to ₹${linesTotal.toFixed(2)} but Amount received is ₹${roundMoney(effectivePaidAmount).toFixed(2)}.`);
        setSaving(false);
        return;
      }
      const firstMode = usedLines[0] ? toServerMode(usedLines[0].mode) : null;

      const dispenserName = soldBy === "Other" ? customSoldBy.trim() || "Staff" : soldBy;
      if (advisedMode && !advisedDoctor) {
        toast.error("Select the doctor who advised this medicine.");
        setSaving(false);
        return;
      }
      // Advised bill: the doctor is the prescriber on the visit, the receptionist is recorded as the dispenser.
      // The doctor on the visit is the prescriber (advised doctor), or the logged-in vet; never the dispensing receptionist.
      const effectiveDoctorName = advisedDoctor || vetNameOf(currentUser);
      const advisedNote = advisedDoctor
        ? `Doctor contacted: ${advisedDoctor}. Medicine dispensed on his order. Dispensed by ${activeDoctorName} (Reception).`
        : byReception
        ? `Dispensed by ${activeDoctorName} (Reception).`
        : "";

      const paymentStatus: "Full" | "Partial" | "Unpaid" =
        balanceDue === 0 ? "Full" : effectivePaidAmount > 0 ? "Partial" : "Unpaid";

      const effectiveDueDate =
        paymentType !== "FULL" && balanceDue > 0
          ? (paymentDueDate || addDaysToISO(docDate || todayIST(), 7))
          : undefined;

      const payload = {
        visitId: generatedVisitId,
        date: docDate || undefined,
        dueDate: effectiveDueDate,
        paymentDueDate: effectiveDueDate,
        petId: selectedPet?.petId || (customerType === "OTHER" ? "RETAIL-CLIENT" : "OTC-WALKIN"),
        petName:
          selectedPet?.name ||
          (customerType === "OTHER"
            ? `${clientName.trim() || "Retail"} (${otherClientType})`
            : clientName.trim() && clientName.trim() !== "CASH"
            ? `${clientName.trim()}'s Pet`
            : "General OTC Walk-in"),
        species: selectedPet?.species || (customerType === "OTHER" ? "General Client" : "Canine"),
        breed: selectedPet?.breed || (customerType === "OTHER" ? otherClientType : "General"),
        ownerId: selectedPet?.ownerId || "WALKIN",
        ownerName: clientName.trim() || "CASH",
        ownerPhone: mobileNo.trim() || undefined,
        branch: "Main Clinic",
        billType: invoiceType === "NON_GST" ? ("Non-GST" as const) : ("GST" as const),
        doctorName: effectiveDoctorName,
        diagnosis: advisedMode
          ? diagnoses.join(", ") || "Doctor-Advised Medicine"
          : deliveryTerms
          ? `Terms: ${deliveryTerms}`
          : customerType === "OTHER"
          ? `Retail Sale: ${otherClientType}`
          : "Counter Sale & Services",
        clinicalNotes: [advisedNote, symptoms.length > 0 && `Symptoms: ${symptoms.join(", ")}.`, remarksPrivate.trim()].filter(Boolean).join(" ") || undefined,
        items: lines.map((l, idx) => {
          const discPct = Math.min(100, Math.max(0, l.discountPct || 0));
          const gross = (l.quantity || 1) * (l.salePrice || 0);
          const discAmt = (gross * discPct) / 100;
          const taxable = Math.max(0, gross - discAmt);
          return {
            // food and accessories are billed as such, not as pharmacy
            lineType: ((): "Pharmacy" | "Food" | "Accessory" | "Consultation" => {
              if (l.isFee) return "Consultation";
              const t = inventoryItems.find((x) => x.itemCode === l.itemCode)?.productType;
              return t === "FOOD" ? "Food" : t === "ACCESSORY" ? "Accessory" : "Pharmacy";
            })(),
            name: l.itemName + (l.itemDescription ? ` (${l.itemDescription})` : "") + (l.baseLabel ? ` [${l.uom}]` : ""),
            ...(l.itemCode ? { itemCode: l.itemCode, unit: l.uom, quantityBase: l.quantityBase } : {}),
            quantity: l.quantity > 0 ? l.quantity : 1,
            unitPrice: Math.max(0, l.salePrice || 0),
            discountPercent: discPct,
            discountType: "percentage" as const,
            discountValue: discPct,
            discountAmount: discAmt,
            taxableAmount: taxable,
            gstRate: invoiceType === "GST" ? Math.max(0, l.gstRate || 0) : 0,
            lineTotal: l.amount,
          };
        }),
        subtotal: totals.subTotal,
        billDiscount: totals.billDiscountAmt,
        taxableAmount: totals.taxable,
        gstAmount: totals.taxTotal,
        roundOff: totals.roundOff,
        totalAmount: totals.grandTotal,
        amountPaid: effectivePaidAmount,
        pendingAmount: balanceDue,
        paymentStatus,
        paymentMode: (paymentType === "UNPAID" ? mappedPaymentMode : (firstMode ?? mappedPaymentMode)) as typeof mappedPaymentMode,
        ...(usedLines.length > 0
          ? {
              paymentSplits: usedLines.map((l) => ({
                mode: toServerMode(l.mode),
                amount: roundMoney(Number(l.amount) || 0),
                ...(l.referenceNo ? { trxRef: l.referenceNo } : {}),
              })),
            }
          : {}),
        trxRef: hasInvoiceRef ? invoiceRefNo : undefined,
      };

      const res = await finalizeVisitAndBillFn({ data: payload });
      const invoiceLabel = res.invoiceNo || "Generated";

      if (followUpDates.length) {
        try {
          await Promise.all(
            followUpDates.map((d, i) =>
              createAppointmentFn({
                data: {
                  token: `A-${(Date.now() % 1000000) + i}`,
                  pet: payload.petName,
                  petId: payload.petId,
                  species: payload.species,
                  breed: payload.breed,
                  owner: payload.ownerName,
                  phone: payload.ownerPhone || "",
                  doctor: effectiveDoctorName,
                  reason: fuNote.trim() || `Follow-up (${i + 1} of ${followUpDates.length})`,
                  type: "Follow-up",
                  status: "Waiting",
                  appointment_date: d,
                  date: d,
                  slot: "To be assigned",
                  priority: "Routine",
                  sourceVisitId: payload.visitId,
                },
              })
            )
          );
          toast.success(`${followUpDates.length} follow-up appointment${followUpDates.length > 1 ? "s" : ""} booked`);
        } catch (e) {
          console.warn("Follow-up booking failed:", e);
          toast.error("Invoice saved, but follow-up appointments could not be booked.");
        }
      }

      if (paymentStatus === "Partial") {
        toast.success(
          `Invoice ${invoiceLabel} saved! Paid: ₹${effectivePaidAmount.toFixed(2)}, Balance Due: ₹${balanceDue.toFixed(2)}${effectiveDueDate ? ` (Due: ${formatDisplayDate(effectiveDueDate)})` : ""}`
        );
      } else if (paymentStatus === "Unpaid") {
        toast.info(
          `Credit Invoice ${invoiceLabel} saved! Balance Due: ₹${balanceDue.toFixed(2)}${effectiveDueDate ? ` (Due: ${formatDisplayDate(effectiveDueDate)})` : ""}`
        );
      } else {
        toast.success(`Invoice ${invoiceLabel} saved fully paid!`);
      }

      onInvoiceCreated?.(res);
      // The Billing register may be open behind a Quick Action invoice; tell it to reload.
      window.dispatchEvent(new Event("invoices:changed"));

      if (andPrint) {
        // Show the real formatted invoice (same component finalized clinical visits use)
        // instead of window.print()-ing the raw, unstyled entry form.
        setPrintableInvoice(res);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error("[NewSalesInvoiceModal] Save failed:", err);
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  if (printableInvoice) {
    return (
      <InvoicePrintView
        visit={printableInvoice}
        open={true}
        onClose={() => {
          setPrintableInvoice(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-7xl p-0 overflow-hidden border-border bg-card shadow-2xl rounded-2xl">
        {/* Window Title Bar */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Receipt className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">{advisedMode ? "Doctor-Advised Medicine Invoice" : "Unsaved Invoice"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              F9: Save • F10: Save &amp; Print
            </span>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className={cn("space-y-3 overflow-y-auto", advisedMode
          // compact density: tighter panels, gaps and control heights so more fits in one view
          ? "p-2 space-y-1.5 max-h-[92vh] [&_fieldset]:p-2 [&_fieldset]:space-y-1.5 [&_fieldset_.space-y-1]:space-y-0.5 [&_fieldset_.space-y-1\\.5]:space-y-1 [&_.gap-3]:gap-2 [&_.gap-2]:gap-1.5 [&_legend]:text-[10px] [&_legend]:leading-none [&_label]:text-[11px] [&_input:not([type=checkbox]):not([type=radio])]:h-7 [&_button[role=combobox]]:h-7 [&_.h-8]:h-7"
          : "p-5 max-h-[82vh]")}>
          {/* ── 1. GROUPBOX: Invoice Information (Matching Image 4) ── */}
          <fieldset className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3 relative">
            <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Invoice information
            </legend>

            {/* Row 1: Invoice Type, Date, Sold By Dropdown */}
            <div className={cn("grid grid-cols-1 gap-3", advisedMode ? "md:grid-cols-4" : "md:grid-cols-3")}>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">
                  Invoice Type <span className="text-rose-500">*</span>
                </Label>
                <Select value={invoiceType} onValueChange={(v: any) => setInvoiceType(v)}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="NON_GST">Non-GST</SelectItem>
                    <SelectItem value="BILL_OF_SUPPLY">Bill of Supply</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Date</Label>
                <Input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="h-8 text-xs bg-background font-mono"
                />
              </div>

              {(advisedMode || byReception) && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">
                    Prescribed by (doctor contacted) {advisedMode ? <span className="text-rose-500">*</span> : <span className="text-muted-foreground">(optional)</span>}
                  </Label>
                  <Select value={advisedDoctor} onValueChange={setAdvisedDoctor}>
                    <SelectTrigger className="h-8 text-xs bg-background" aria-label="Doctor contacted">
                      <SelectValue placeholder="Which doctor advised this?" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sold By: Interactive Dropdown with clinic staff & custom entry */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">{advisedMode || byReception ? "Dispensed by" : "Sold By"}</Label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={CLINIC_STAFF_OPTIONS.includes(soldBy) ? soldBy : "Other"}
                    onValueChange={(val) => {
                      if (val === "Other") {
                        setSoldBy("Other");
                      } else {
                        setSoldBy(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background flex-1">
                      <SelectValue placeholder="Select Staff / Doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINIC_STAFF_OPTIONS.map((staff) => (
                        <SelectItem key={staff} value={staff}>
                          {staff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {soldBy === "Other" && (
                    <Input
                      value={customSoldBy}
                      onChange={(e) => setCustomSoldBy(e.target.value)}
                      placeholder="Staff name..."
                      className="h-8 text-xs bg-background w-36"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Link To (Counter Sale / Client Account), Mobile No., Client Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Link To</Label>
                <div className="flex items-center gap-4 h-8">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="linkTo"
                      checked={linkTo === "COUNTER_SALE"}
                      onChange={() => setLinkTo("COUNTER_SALE")}
                      className="size-3.5 text-primary"
                    />
                    <span>Counter Sale</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="linkTo"
                      checked={linkTo === "CLIENT_ACCOUNT"}
                      onChange={() => setLinkTo("CLIENT_ACCOUNT")}
                      className="size-3.5 text-primary"
                    />
                    <span>Client Account</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">Mobile No.</Label>
                <Input
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Mobile number"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-foreground">
                  Client Name
                </Label>
                <div className="relative">
                  <Input
                    value={clientName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setClientName(v);
                      setClientListOpen(true);
                      // editing the name away from the chosen client unlinks the pet
                      if (selectedPetId) {
                        const p = pets.find((x) => (x.petId || x._id) === selectedPetId);
                        if (p && (p.owner?.name || p.ownerName) !== v) setSelectedPetId("");
                      }
                    }}
                    onFocus={() => setClientListOpen(true)}
                    onBlur={() => setTimeout(() => setClientListOpen(false), 150)}
                    placeholder="Search client / pet, or type a name"
                    className="h-8 text-xs font-semibold bg-background"
                  />
                  {clientListOpen && (clientMatches.length > 0 || clientName.trim().length > 1) && (
                    <ul className="absolute z-50 mt-1 max-h-60 w-full min-w-72 overflow-auto rounded-md border border-border bg-white py-1 text-xs text-slate-900 shadow-lg">
                      {clientMatches.map((p) => {
                        const id = p.petId || p._id;
                        return (
                          <li key={id}>
                            <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-slate-100"
                              onMouseDown={(e) => { e.preventDefault(); handlePetSelect(id); setClientListOpen(false); }}>
                              <span className="font-semibold">{p.owner?.name || p.ownerName || "Owner"} <span className="font-normal text-slate-500">· {p.name} ({p.breed || p.species})</span></span>
                              {(p.owner?.phone || p.ownerPhone) && <span className="font-mono text-[10px] text-slate-500">{p.owner?.phone || p.ownerPhone}</span>}
                            </button>
                          </li>
                        );
                      })}
                      {clientName.trim().length > 1 && (
                        <li>
                          <button type="button" className="w-full border-t px-3 py-1.5 text-left font-semibold text-blue-700 hover:bg-slate-100"
                            onMouseDown={(e) => { e.preventDefault(); setClientListOpen(false); setShowRegisterPetModal(true); }}>
                            + Register &ldquo;{clientName.trim()}&rdquo; as new client &amp; patient
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Address, Place of Supply, Client GSTIN & Customer Type (Patient vs Other) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs font-medium text-foreground">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, PIN..."
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs font-medium text-foreground">
                  Place of Supply <span className="text-rose-500">*</span>
                </Label>
                <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {STATE_CODES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-medium text-foreground">Client GSTIN</Label>
                <Input
                  value={clientGstin}
                  onChange={(e) => setClientGstin(e.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              {/* Customer Selector: Patient / Pet vs Other */}
              <div className="space-y-1 md:col-span-4">
                <div className="flex items-center justify-between pb-0.5">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                    {customerType === "PATIENT" ? (
                      <Dog className="size-3 text-primary" />
                    ) : (
                      <Building2 className="size-3 text-primary" />
                    )}
                    <span>{customerType === "PATIENT" ? "Patient / Pet" : "Customer / Client Type"}</span>
                  </Label>
                  <div className="inline-flex rounded-md bg-muted p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCustomerType("PATIENT")}
                      className={cn(
                        "px-2 py-0.5 rounded transition-all",
                        customerType === "PATIENT"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerType("OTHER");
                        setSelectedPetId("");
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded transition-all",
                        customerType === "OTHER"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {customerType === "PATIENT" ? (
                  <div className="flex gap-1.5 items-center">
                    <Popover open={petPickerOpen} onOpenChange={setPetPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-8 flex-1 justify-between text-xs font-normal bg-background min-w-0">
                          <span className="truncate">
                            {selectedPetId === "WALKIN" || !selectedPetId
                              ? "Walk-in / Select Pet"
                              : (() => { const p = pets.find((x) => (x.petId || x._id) === selectedPetId); return p ? `${p.name} - ${p.owner?.name || "Owner"}` : "Walk-in / Select Pet"; })()}
                          </span>
                          <ChevronDown className="size-3 opacity-70 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-64" align="start">
                        <Command filter={(v, q) => (v.toLowerCase().includes(q.trim().toLowerCase()) ? 1 : 0)}>
                          <CommandInput placeholder="Type pet or owner name…" className="h-8 text-xs" />
                          <CommandList className="max-h-60">
                            <CommandEmpty>No patient found.</CommandEmpty>
                            <CommandItem value="walk-in general patient" onSelect={() => { handlePetSelect("WALKIN"); setPetPickerOpen(false); }}>
                              -- Walk-in General Patient --
                            </CommandItem>
                            {pets.map((p) => {
                              const id = p.petId || p._id;
                              return (
                                <CommandItem
                                  key={id}
                                  value={`${p.name} ${p.breed || p.species || ""} ${p.owner?.name || ""}`}
                                  onSelect={() => { handlePetSelect(id); setPetPickerOpen(false); }}
                                >
                                  {p.name} ({p.breed || p.species}) - {p.owner?.name || "Owner"}
                                </CommandItem>
                              );
                            })}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRegisterPetModal(true)}
                      title="Add New Pet"
                      className="size-8 shrink-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select value={otherClientType} onValueChange={setOtherClientType}>
                    <SelectTrigger className="h-8 text-xs bg-background font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Walk-in Retail / OTC">Walk-in Retail / OTC Customer</SelectItem>
                      <SelectItem value="External Client / Pet Parent">External Client / Non-Patient</SelectItem>
                      <SelectItem value="Breeder / Kennel / Farm">Breeder / Kennel / Farm</SelectItem>
                      <SelectItem value="Rescue / NGO / Shelter">Rescue / NGO / Shelter</SelectItem>
                      <SelectItem value="Corporate / Institution">Corporate / Institutional Partner</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </fieldset>

          {advisedMode && (
            <fieldset className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3 relative">
              <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Symptoms, Diagnosis &amp; Consultation Fee
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Symptoms</Label>
                  <TagPicker value={symptoms} onChange={setSymptoms} placeholder="Select or type a symptom, press Enter" options={SYMPTOM_OPTIONS} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Diagnosis</Label>
                  <TagPicker value={diagnoses} onChange={setDiagnoses} placeholder="Select or type a diagnosis, press Enter" options={DIAGNOSIS_OPTIONS.map((label) => ({ label }))} />
                </div>
                {/* Follow-up: consecutive days or individually picked days */}
                <div className="space-y-1 md:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Follow-up visits</Label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                      <input type="checkbox" className="size-3.5" checked={fuOn} onChange={(e) => setFuOn(e.target.checked)} />
                      Required
                    </label>
                  </div>
                  {fuOn ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[11px] font-bold">
                        {(["consecutive", "individual"] as const).map((m) => (
                          <button key={m} type="button" onClick={() => setFuMode(m)}
                            className={cn("px-2.5 py-0.5 rounded", fuMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                            {m === "consecutive" ? "Consecutive days" : "Individual days"}
                          </button>
                        ))}
                      </div>
                      {fuMode === "consecutive" ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {[3, 5, 7, 14].map((n) => (
                            <button key={n} type="button" onClick={() => setFuDays(n)}
                              className={cn("px-2 py-0.5 rounded border text-[11px] font-bold", fuDays === n ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border")}>
                              {n}d
                            </button>
                          ))}
                          <Input type="number" min={1} max={60} value={fuDays || ""} onChange={(e) => setFuDays(Math.max(0, Number(e.target.value) || 0))} className="h-7 w-16 font-mono text-xs" aria-label="Number of days" />
                          <span className="text-[10px] text-muted-foreground">days after invoice date</span>
                        </div>
                      ) : (
                        <Input type="date" min={docDate || todayIST()} value="" onChange={(e) => {
                          const v = e.target.value;
                          if (v) setFuPicked((p) => (p.includes(v) ? p : [...p, v]));
                        }} className="h-7 w-40 font-mono text-xs" aria-label="Add follow-up day" />
                      )}
                      {fuMode === "individual" && fuPicked.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {followUpDates.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                              {formatDisplayDate(d)}
                              <button type="button" aria-label={`Remove ${d}`} onClick={() => setFuPicked((p) => p.filter((x) => x !== d))}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <Input value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder="Follow-up note (optional)" className="h-7 text-xs" />
                      {followUpDates.length > 0 && (
                        <p className="text-[10px] font-medium text-primary">
                          {followUpDates.length} appointment{followUpDates.length > 1 ? "s" : ""}: {formatDisplayDate(followUpDates[0]!)}
                          {followUpDates.length > 1 ? ` – ${formatDisplayDate(followUpDates[followUpDates.length - 1]!)}` : ""}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground">No follow-up. Tick Required to book return visits.</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Consultation Fee (select one or more)</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {FEE_PRESETS.map((p) => {
                    const on = !!feeLine(p.code);
                    return (
                      <span key={p.code} className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFee(p)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-foreground border-border hover:bg-muted"
                          )}
                        >
                          {p.label} {p.code === "HOME_VISIT" ? "(₹ ____)" : `(₹${p.amount})`}
                        </button>
                        {on && p.code === "HOME_VISIT" && (
                          <Input
                            type="number" min={0} className="h-8 w-24 font-mono" placeholder="₹ amount"
                            value={feeLine("HOME_VISIT")?.salePrice || ""}
                            onChange={(e) => setFeePrice("HOME_VISIT", Math.max(0, Number(e.target.value) || 0))}
                          />
                        )}
                      </span>
                    );
                  })}
                  {/* ── Manual Consultation Fee chip ── */}
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleManualFee}
                      title="Enter a custom consultation fee amount manually"
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                        isManualFeeActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-amber-50 text-amber-700 border-amber-300 border-dashed hover:bg-amber-100"
                      )}
                    >
                      {isManualFeeActive ? "✓" : "+"} Manual Fee (₹ ____)
                    </button>
                    {isManualFeeActive && (
                      <Input
                        type="number"
                        min={0}
                        autoFocus
                        className="h-8 w-28 font-mono border-amber-400 focus:ring-amber-400"
                        placeholder="₹ amount"
                        value={manualConsultFeeAmt || ""}
                        onChange={(e) => setManualConsultFeeAmt(Math.max(0, Number(e.target.value) || 0))}
                      />
                    )}
                  </span>

                  {lines.filter((l) => l.id.startsWith("fee_custom_")).map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                      {l.itemName} (₹{l.salePrice})
                      <button type="button" aria-label={`Remove ${l.itemName}`} onClick={() => removeLineById(l.id)}>×</button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input className="h-8 w-56" placeholder="Other fee name (e.g. Dressing)" value={customFeeName} onChange={(e) => setCustomFeeName(e.target.value)} />
                  <Input type="number" min={0} className="h-8 w-28 font-mono" placeholder="₹ amount" value={customFeeAmt || ""} onChange={(e) => setCustomFeeAmt(Math.max(0, Number(e.target.value) || 0))} />
                  <Button type="button" size="sm" variant="outline" onClick={addCustomFee}>+ Add</Button>
                </div>
                {isManualFeeActive && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    ₹{manualConsultFeeAmt} manual consultation fee will be saved to this patient&apos;s profile as a Consultation line.
                  </p>
                )}
              </div>
            </fieldset>
          )}

          {/* ── 2. GROUPBOX: Particulars Line Entry (Matching Image 4) ── */}
          <fieldset className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3 relative">
            <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Particulars
            </legend>

            {/* Mode & Category Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="particularsMode"
                    checked={particularsMode === "Tagging"}
                    onChange={() => setParticularsMode("Tagging")}
                    className="size-3.5 text-primary"
                  />
                  <span>Tagging</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="particularsMode"
                    checked={particularsMode === "ItemCode"}
                    onChange={() => setParticularsMode("ItemCode")}
                    className="size-3.5 text-primary"
                  />
                  <span>Item Code</span>
                </label>
              </div>

              {/* Category Filter for Inventory Items */}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  Inventory Category:
                </Label>
                <span className="max-w-[220px] text-[10px] leading-tight italic text-muted-foreground" title="Consultation, medicines and injections are billed from the consultation.">
                  Consultation, medicines and injections are billed from the consultation.
                </span>
                <div className="flex items-center gap-1.5">
                  <Select value={itemCategory} onValueChange={setItemCategory}>
                    <SelectTrigger className="h-7 text-xs bg-background w-56 font-medium">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Inventory Quick Pick Dropdown */}
                  <Select
                    value=""
                    onValueChange={(selectedCode) => {
                      const item = filteredInventoryItems.find((it) => it.itemCode === selectedCode);
                      if (item) {
                        handleSelectInventoryItem(item);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-primary/10 border-primary/20 text-primary font-semibold w-44">
                      <SelectValue placeholder={`Browse Items (${filteredInventoryItems.length})`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 w-80">
                      {filteredInventoryItems.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No items found in this category
                        </div>
                      ) : (
                        filteredInventoryItems.slice(0, 50).map((it) => (
                          <SelectItem key={it.itemCode} value={it.itemCode}>
                            <div className="flex flex-col text-left py-0.5">
                              <span className="font-semibold text-foreground">{it.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {it.itemCode} • ₹{it.defaultSalePrice || it.mrp || 0} • {it.salesUom || it.unit || "PCS"}{" "}
                                {it.currentStock !== undefined ? `(Stock: ${it.currentStock})` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {/* + Add Item Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 px-2.5 shadow-xs"
                      >
                        <Plus className="size-3.5" />
                        <span>Add Item</span>
                        <ChevronDown className="size-3 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 text-xs">
                      <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Add New To Inventory
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleOpenAddProduct("MEDICINE")}
                        className="cursor-pointer gap-2 py-1.5"
                      >
                        <Pill className="size-3.5 text-emerald-600" />
                        <span className="font-medium">Medicine</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenAddProduct("INJECTION")}
                        className="cursor-pointer gap-2 py-1.5"
                      >
                        <Syringe className="size-3.5 text-rose-600" />
                        <span className="font-medium">Injection / Vaccine</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenAddProduct("FOOD")}
                        className="cursor-pointer gap-2 py-1.5"
                      >
                        <Bone className="size-3.5 text-amber-600" />
                        <span className="font-medium">Animal Food & Diet</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleOpenAddProduct("ACCESSORY")}
                        className="cursor-pointer gap-2 py-1.5"
                      >
                        <Tag className="size-3.5 text-blue-600" />
                        <span className="font-medium">Pet Accessory</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Input Row: Serial No (yellow auto-generated), Item Name with [+] button, UoM, Qty, Sale Price, Discount, Amount, Add [+] */}
            <div className="grid grid-cols-12 gap-2 items-end">
              {/* Serial No. (yellow highlight input from screenshot, automatically generated based on line existence) */}
              <div className="col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">Serial No.</Label>
                  <span className="text-[9px] text-amber-700 dark:text-amber-400 font-mono font-bold">Auto</span>
                </div>
                <Input
                  value={serialCode}
                  onChange={(e) => setSerialCode(e.target.value)}
                  placeholder="Auto"
                  className="h-8 text-xs font-mono bg-amber-100/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 font-bold"
                />
              </div>

              {/* Item Name with datalist search and quick-add button */}
              <div className="col-span-4 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Item Name <span className="text-rose-500">*</span>
                  </Label>
                  {selectedItem ? (
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      Linked · stock {selectedItem.currentStock ?? 0} {hierarchy?.baseUnit ?? selectedItem.unit}
                    </span>
                  ) : (
                    filteredInventoryItems.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        ({filteredInventoryItems.length} available)
                      </span>
                    )
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1" ref={invoiceItemDropdownRef}>
                    <div className="relative flex items-center">
                      <Input
                        ref={itemInputRef}
                        value={itemName}
                        onFocus={() => setIsInvoiceItemDropdownOpen(true)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemName(val);
                          if (selectedItem && val !== selectedItem.name) setSelectedItem(null);
                          setIsInvoiceItemDropdownOpen(true);
                        }}
                        placeholder="Type or select item name..."
                        className="h-8 text-xs bg-background flex-1 font-semibold pr-7"
                      />
                      <button
                        type="button"
                        onClick={() => setIsInvoiceItemDropdownOpen((prev) => !prev)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                        tabIndex={-1}
                      >
                        <ChevronDown className={`size-3.5 transition-transform duration-150 ${isInvoiceItemDropdownOpen ? "rotate-180 text-primary" : ""}`} />
                      </button>
                    </div>

                    {/* Decent Floating Dropdown Menu */}
                    {isInvoiceItemDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-full min-w-[360px] max-w-[460px] rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                        <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                          <span>Matching Items ({searchedInvoiceItems.length})</span>
                          <span className="text-[10px]">Click to select</span>
                        </div>
                        <div className="max-h-52 overflow-y-auto divide-y divide-border">
                          {searchedInvoiceItems.length === 0 ? (
                            <div className="p-3 text-xs text-center text-muted-foreground">
                              No items matching "{itemName}".
                            </div>
                          ) : (
                            searchedInvoiceItems.slice(0, 40).map((m) => (
                              <div
                                key={m.itemCode}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectInventoryItem(m);
                                  setIsInvoiceItemDropdownOpen(false);
                                }}
                                className="p-2.5 hover:bg-muted/60 cursor-pointer flex items-center justify-between gap-2 transition-colors group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-xs text-foreground group-hover:text-primary truncate">
                                    {m.name}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-medium uppercase">
                                      {m.category || m.productType}
                                    </span>
                                    <span>•</span>
                                    <span>{m.salesUom || m.unit || "PCS"}</span>
                                    {m.genericName && (
                                      <span className="truncate max-w-[130px]">• {m.genericName}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                    ₹{m.defaultSalePrice || m.mrp || 0}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Quick Add To Catalogue Action Bar */}
                        <div className="p-2.5 bg-muted/40 border-t border-border space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                            <span className="flex items-center gap-1 truncate">
                              <Plus className="size-3 text-primary shrink-0" />
                              {itemName.trim() ? `Add "${itemName}" as:` : "Add new item as:"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">Saves to master</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleOpenAddProduct("MEDICINE", itemName);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors text-left"
                            >
                              <Pill className="size-3.5 shrink-0 text-emerald-600" />
                              <span className="truncate">+ Medicine</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleOpenAddProduct("INJECTION", itemName);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors text-left"
                            >
                              <Syringe className="size-3.5 shrink-0 text-rose-600" />
                              <span className="truncate">+ Injection</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleOpenAddProduct("FOOD", itemName);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors text-left"
                            >
                              <Bone className="size-3.5 shrink-0 text-amber-600" />
                              <span className="truncate">+ Animal Food</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleOpenAddProduct("ACCESSORY", itemName);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors text-left"
                            >
                              <Tag className="size-3.5 shrink-0 text-blue-600" />
                              <span className="truncate">+ Accessory</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Add [+] Button beside Item Name */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenAddProduct(undefined, itemName)}
                    title="Add new item to inventory master"
                    className="h-8 w-8 shrink-0 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:hover:bg-emerald-950/40"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              {/* UoM */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">UoM</Label>
                <Select value={uom} onValueChange={handleUomChange}>
                  <SelectTrigger className="h-8 text-xs bg-background px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uomOptions.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">
                  Quantity <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantity || ""}
                  placeholder="Qty"
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs bg-background text-center font-mono font-bold"
                />
              </div>

              {/* Sale Price with Calculator Icon & ₹ prefix */}
              <div className="col-span-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">
                    Sale Price <span className="text-rose-500">*</span>
                  </Label>
                  <Calculator className="size-2.5 text-primary" />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={salePrice || ""}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="h-8 pl-5 text-xs bg-background font-mono font-bold"
                  />
                </div>
              </div>

              {/* Discount (%) with % icon */}
              <div className="col-span-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-foreground">Discount</Label>
                  <span className="text-[10px] font-bold text-muted-foreground">%</span>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPct || ""}
                  onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8 text-xs bg-background text-center font-mono"
                />
              </div>

              {/* Amount (₹) */}
              <div className="col-span-1 space-y-1">
                <Label className="text-[11px] font-medium text-foreground">Amount</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    readOnly
                    value={calculatedParticularsAmount.toFixed(2)}
                    className="h-8 pl-5 text-xs bg-muted font-mono font-bold text-foreground"
                  />
                </div>
              </div>

              {/* Green [+] Button */}
              <div className="col-span-1">
                <Button
                  type="button"
                  onClick={handleAddLine}
                  title="Add Line (Enter)"
                  className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black p-0 shadow-sm rounded-lg"
                >
                  <Plus className="size-4 stroke-[3]" />
                </Button>
              </div>
            </div>

            {/* Description Row below Item Name */}
            <div className="grid grid-cols-12 gap-2 pt-1">
              <div className="col-span-8">
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Item Description (printed on invoice)..."
                  className="h-7 text-[11px] bg-background text-muted-foreground"
                />
              </div>
              <div className="col-span-4">
                <Input
                  value={lineSerialNo}
                  onChange={(e) => setLineSerialNo(e.target.value)}
                  placeholder="Batch / Serial No. / Expiry..."
                  className="h-7 text-[11px] font-mono bg-background text-muted-foreground"
                />
              </div>
            </div>
          </fieldset>

          {/* ── 3. TABLE GRID: Blue Header (Matching Image 4) ── */}
          <div className="rounded-xl border border-border overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1976d2] dark:bg-primary text-white font-bold">
                  <th className="px-3 py-2.5 text-center w-12">S. No.</th>
                  <th className="px-3 py-2.5">Item Name</th>
                  <th className="px-3 py-2.5 text-center w-24">Serial / Tag</th>
                  <th className="px-3 py-2.5 text-center w-16">Quantity</th>
                  <th className="px-3 py-2.5 text-center w-16">UoM</th>
                  <th className="px-3 py-2.5 text-right w-24">Sale Price (₹)</th>
                  <th className="px-3 py-2.5 text-center w-20">Disc. (%)</th>
                  <th className="px-3 py-2.5 text-right w-28">Amount (₹)</th>
                  <th className="px-3 py-2.5 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      No particulars added yet. Select a category, browse an item, or enter details above and click [ + ].
                    </td>
                  </tr>
                ) : (
                  lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 text-center font-mono text-muted-foreground">{line.sNo}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-foreground">{line.itemName}</div>
                        {line.itemDescription && (
                          <div className="text-[11px] text-muted-foreground">{line.itemDescription}</div>
                        )}
                        {line.serialNo && (
                          <div className="text-[10px] font-mono text-primary/80">Batch/SN: {line.serialNo}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {line.tag || `SR-${String(line.sNo).padStart(3, "0")}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground text-[11px]">{line.uom}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">₹{line.salePrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {line.discountPct ? `${line.discountPct}%` : "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-foreground">
                        ₹{line.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── 4. BOTTOM ROW: Options, Payment Details & Totals (Matching Image 4) ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
            {/* Left Column (5 cols): Bell, Checkboxes & Payment Details Groupbox */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 cursor-pointer hover:bg-blue-500/20">
                  <Bell className="size-4" />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addShipping}
                    onChange={(e) => setAddShipping(e.target.checked)}
                    className="size-3.5 rounded text-primary"
                  />
                  <span>Add Shipping and Packaging Costs</span>
                </label>

                {addShipping && (
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={shippingCost || ""}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="h-7 pl-5 text-xs font-mono bg-background"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer ml-9">
                  <input
                    type="checkbox"
                    checked={hasInvoiceRef}
                    onChange={(e) => setHasInvoiceRef(e.target.checked)}
                    className="size-3.5 rounded text-primary"
                  />
                  <span>Invoice Reference</span>
                </label>
                {hasInvoiceRef && (
                  <Input
                    value={invoiceRefNo}
                    onChange={(e) => setInvoiceRefNo(e.target.value)}
                    placeholder="PO / Ref Number..."
                    className="h-7 text-xs bg-background flex-1"
                  />
                )}
              </div>

              {/* Groupbox: Payment Details with Partial Payment Capabilities */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Payment status
                  </legend>

                  {/* Payment Type Selection: Full Payment / Partial Payment / Credit Unpaid */}
                  <div role="radiogroup" aria-label="Payment status: Paid in full, Partly paid or Unpaid" className="inline-flex rounded-lg bg-muted p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("FULL");
                        setPaidAmount(totals.grandTotal);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "FULL"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Paid in full
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("PARTIAL");
                        setPaidAmount(roundMoney(totals.grandTotal * 0.5));
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "PARTIAL"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Partly paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType("UNPAID");
                        setPaidAmount(0);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        paymentType === "UNPAID"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Unpaid
                    </button>
                  </div>
                </div>

                {/* Amount Paid Now Input & Partial Payment Information */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-foreground whitespace-nowrap">
                      {paymentType === "PARTIAL" ? "Paid Now" : "Amount Received"}{" "}
                      <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max={totals.grandTotal}
                        step="any"
                        value={paymentType === "UNPAID" ? 0 : paidAmount || ""}
                        disabled={paymentType === "UNPAID"}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPaidAmount(val);
                          if (val < totals.grandTotal && val > 0) {
                            setPaymentType("PARTIAL");
                          } else if (val >= totals.grandTotal) {
                            setPaymentType("FULL");
                          }
                        }}
                        placeholder="0.00"
                        className="h-8 pl-6 text-xs font-mono font-bold bg-background"
                      />
                    </div>
                    {paymentType === "PARTIAL" && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.25))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          25%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.5))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidAmount(roundMoney(totals.grandTotal * 0.75))}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          75%
                        </button>
                      </div>
                    )}
                  </div>

                  {paymentType !== "UNPAID" && effectivePaidAmount > 0 && (
                    <SplitPaymentInput
                      total={roundMoney(effectivePaidAmount)}
                      lines={payLines}
                      onChange={setPayLines}
                      accounts={splitAccounts}
                      requireExactMatch
                      defaultMode="UPI"
                    />
                  )}

                  {/* Partial Payment Notice / Breakdown */}
                  {paymentType === "PARTIAL" && balanceDue > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                        <AlertCircle className="size-3.5" />
                        <span>Partial Payment:</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          Paid: ₹{effectivePaidAmount.toFixed(2)}
                        </span>
                        <span className="text-amber-800 dark:text-amber-300 font-black">
                          Balance Due: ₹{balanceDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {paymentType === "UNPAID" && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs flex items-center justify-between">
                      <span className="text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="size-3.5" /> Credit Invoice (Full Balance Due)
                      </span>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                        ₹{totals.grandTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </fieldset>
            </div>

            {/* Middle Column (3 cols): Delivery Terms & Remarks (Private Use) */}
            <div className="md:col-span-3 space-y-2.5">
              <fieldset className="rounded-xl border border-border bg-card/60 p-2.5 space-y-1">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery Terms
                </legend>
                <Textarea
                  rows={2}
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  placeholder="Immediate counter delivery..."
                  className="text-xs bg-background min-h-[44px]"
                />
              </fieldset>

              <fieldset className="rounded-xl border border-border bg-card/60 p-2.5 space-y-1">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Remarks (Private Use)
                </legend>
                <Textarea
                  rows={2}
                  value={remarksPrivate}
                  onChange={(e) => setRemarksPrivate(e.target.value)}
                  placeholder="Internal clinic note (never printed)..."
                  className="text-xs bg-background min-h-[44px]"
                />
              </fieldset>
            </div>

            {/* Right Column (4 cols): Sub Total, Shipping, Total Amount & Action Buttons */}
            <div className="md:col-span-4 flex flex-col justify-between space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Sub Total:</span>
                  <span className="font-semibold text-foreground">₹{totals.subTotal.toFixed(2)}</span>
                </div>

                {/* Overall Bill Discount — advisedMode only */}
                {advisedMode && (
                  <div className="space-y-1.5 pb-1 border-b border-dashed border-border/60">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Overall Bill Discount
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex rounded-md bg-muted p-0.5 text-[10px] font-bold shrink-0">
                        <button
                          type="button"
                          onClick={() => setOverallDiscountType("%")}
                          className={cn(
                            "px-2 py-0.5 rounded transition-all",
                            overallDiscountType === "%" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                          )}
                        >%</button>
                        <button
                          type="button"
                          onClick={() => setOverallDiscountType("₹")}
                          className={cn(
                            "px-2 py-0.5 rounded transition-all",
                            overallDiscountType === "₹" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                          )}
                        >₹</button>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={overallDiscountType === "%" ? 100 : undefined}
                        value={overallDiscountValue || ""}
                        onChange={(e) =>
                          setOverallDiscountValue(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="0"
                        className="h-7 font-mono text-xs bg-background flex-1 min-w-0"
                      />
                      {totals.billDiscountAmt > 0 && (
                        <span className="text-xs text-emerald-600 font-bold whitespace-nowrap shrink-0">
                          -₹{totals.billDiscountAmt.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {totals.billDiscountAmt > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold text-[11px]">
                    <span>
                      Discount ({overallDiscountType === "%" ? `${overallDiscountValue}%` : "Fixed ₹"}):
                    </span>
                    <span>-₹{totals.billDiscountAmt.toFixed(2)}</span>
                  </div>
                )}

                {totals.taxTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>GST:</span>
                    <span>₹{totals.taxTotal.toFixed(2)}</span>
                  </div>
                )}

                {totals.shipping > 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Shipping (+):</span>
                    <span>₹{totals.shipping.toFixed(2)}</span>
                  </div>
                )}

                {totals.roundOff !== 0 && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Round Off:</span>
                    <span>{totals.roundOff > 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}</span>
                  </div>
                )}

                <div className="border-t border-border pt-2 flex justify-between items-center text-sm font-black text-foreground">
                  <span className="uppercase tracking-wide">TOTAL AMOUNT:</span>
                  <span className="text-xl font-black text-primary">
                    ₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Partial Payment / Balance Breakdown */}
                {balanceDue > 0 ? (
                  <div className="border-t border-dashed border-border/80 pt-2 space-y-1">
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <span>Amount Received:</span>
                      <span>₹{effectivePaidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 dark:text-rose-400 font-black text-sm">
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-rose-500 animate-pulse inline-block" />
                        Balance Due:
                      </span>
                      <span>₹{balanceDue.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-0.5 text-center font-bold">
                      PARTIAL PAYMENT (Due Balance Tracked)
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-dashed border-border/80 pt-1.5 flex justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <span>Payment Status:</span>
                    <span className="flex items-center gap-1">
                      <Check className="size-3" /> Fully Paid
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons: [ 🖨️ Save and Print ] and [ 💾 Save ] */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSave(true)}
                  disabled={saving}
                  className="flex-1 h-9 bg-[#1976d2] dark:bg-primary hover:bg-[#1565c0] text-white text-xs font-bold gap-1.5 shadow-md"
                >
                  <Printer className="size-4" />
                  <span>Save and Print</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => void handleSave(false)}
                  disabled={saving}
                  className="flex-1 h-9 bg-[#1976d2] dark:bg-primary hover:bg-[#1565c0] text-white text-xs font-bold gap-1.5 shadow-md"
                >
                  <Save className="size-4" />
                  <span>Save</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Direct Client & Pet Registration Modal */}
        {showRegisterPetModal && (
          <OwnerPetRegistrationModal
            open={showRegisterPetModal}
            prefillOwnerName={clientName.trim() || undefined}
            registrationSource="Reception"
            onClose={() => setShowRegisterPetModal(false)}
            onRegistered={async ({ owner, pets: newPets }) => {
              setShowRegisterPetModal(false);
              try {
                const refreshed = await listPetsWithOwnersFn();
                setPets(refreshed || []);
                if (newPets && newPets.length > 0) {
                  const firstPet = newPets[0];
                  const pId = firstPet.petId || firstPet._id;
                  setSelectedPetId(pId);
                  setClientName(owner.name || "CASH");
                  setMobileNo(owner.phone || "");
                  if (owner.address) setAddress(owner.address);
                  setLinkTo("CLIENT_ACCOUNT");
                  setCustomerType("PATIENT");
                }
                toast.success(`Client "${owner.name}" registered and selected!`);
              } catch (err) {
                console.error(err);
              }
            }}
          />
        )}

        {/* Dynamic Product Master Wizard Dialog */}
        <ProductMasterWizardDialog
          open={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          defaultProductType={addProductDefaultType}
          initialName={addProductInitialName}
          onItemCreated={handleProductCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
