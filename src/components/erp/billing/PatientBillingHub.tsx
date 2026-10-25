import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { InventoryProvider } from "@/components/erp/inventory/useInventoryStore";
import { useClinicBranding } from "@/lib/erp/useClinicBranding";

// One-Page Dashboard Component
import { BillingDeskDashboard, type RegisterTab } from "./BillingDeskDashboard";

// Modals
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { NewSalesInvoiceModal } from "./NewSalesInvoiceModal";
import { QuotationModal } from "./QuotationModal";
import { BillingReminderModal } from "./BillingReminderModal";
import { PaymentInModal } from "./PaymentInModal";
import type { PurchaseBillDraft } from "@/lib/mongodb/serverFns/purchaseBillDrafts";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import { ExpenseFormModal } from "@/components/erp/accounting/ExpenseFormModal";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { NewSupplierModal } from "@/components/erp/accounting/NewSupplierModal";
import { SupplierLedgerModal } from "@/components/erp/accounting/SupplierLedgerModal";
import { type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { DailySummaryModal } from "./DailySummaryModal";
import { StockSummaryModal } from "./StockSummaryModal";
import { PurchaseOrderModal, type ClinicPurchaseOrderRecord } from "./PurchaseOrderModal";
import { PurchaseOrderReceiveModal, patchPurchaseOrder, type ReceivedLine } from "./PurchaseOrderReceiveModal";
import { type BillPrefill } from "@/components/erp/accounting/SupplierBillFormModal";
import { daysBetweenISO } from "@/lib/utils/dateUtils";

function PatientBillingHubInner({ initialRegisterTab }: { initialRegisterTab?: RegisterTab }) {
  const CLINIC_CONFIG = useClinicBranding();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPurchaseBillModal, setShowPurchaseBillModal] = useState(false);
  // Receive / check a purchase order, then convert the checked lines to a purchase bill
  const [receivePO, setReceivePO] = useState<ClinicPurchaseOrderRecord | null>(null);
  const [billPrefill, setBillPrefill] = useState<BillPrefill | null>(null);
  const [billPO, setBillPO] = useState<{ po: ClinicPurchaseOrderRecord; lines: ReceivedLine[] } | null>(null);
  const [purchasesRefreshKey, setPurchasesRefreshKey] = useState(0);
  const [suppliersRefreshKey, setSuppliersRefreshKey] = useState(0);
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentInModal, setShowPaymentInModal] = useState(false);
  const [payInvoiceNo, setPayInvoiceNo] = useState<string | undefined>(undefined);

  // Direct Client Intake & Supplier modals (No duplicate 'double double' party forms)
  const [showPetOwnerModal, setShowPetOwnerModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierMasterRow | null>(null);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<string | null>(null);

  // Summary Modals
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showStockSummary, setShowStockSummary] = useState(false);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [editingPoDraft, setEditingPoDraft] = useState<ClinicPurchaseOrderRecord | null>(null);
  const [editingBillDraft, setEditingBillDraft] = useState<PurchaseBillDraft | null>(null);

  // Full Patient Bill Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Deep link from Global Search (?petId=...&petName=...), read once on mount
  const [deepLinkPet, setDeepLinkPet] = useState<{ petId: string; petName: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const petId = params.get("petId");
    if (petId) {
      setDeepLinkPet({ petId, petName: params.get("petName") || "this patient" });
      const url = new URL(window.location.href);
      url.searchParams.delete("petId");
      url.searchParams.delete("petName");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvoicesFn({ data: { query: "" } });
      setInvoices(data || []);
    } catch (err) {
      console.error("[PatientBillingHub] Failed to load invoices:", err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
    const reload = () => void loadInvoices();
    window.addEventListener("invoices:changed", reload);
    return () => window.removeEventListener("invoices:changed", reload);
  }, [loadInvoices]);

  // Keyboard shortcuts for high-speed counter billing (Plan §5.7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "F2" || (e.altKey && (e.key === "n" || e.key === "N"))) {
        e.preventDefault();
        setShowNewInvoiceModal(true);
      } else if (e.altKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        setShowQuotationModal(true);
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowPurchaseBillModal(true);
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setShowExpenseModal(true);
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setShowPetOwnerModal(true);
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowReminderModal(true);
      } else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setPayInvoiceNo(undefined);
        setShowPaymentInModal(true);
      } else if (e.altKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        setShowPurchaseOrderModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Shell title={`Billing Desk — ${CLINIC_CONFIG.fullName}`}>
      <div className="w-full">
        {/* ── Main Dashboard Area (Full-Width, Aligned with Shell Topbar & Floating Bars) ── */}
        <BillingDeskDashboard
          invoices={invoices}
          loading={loading}
          deepLinkPet={deepLinkPet}
          onRefresh={loadInvoices}
          purchasesRefreshKey={purchasesRefreshKey}
          suppliersRefreshKey={suppliersRefreshKey}
          clientsRefreshKey={clientsRefreshKey}
          {...(initialRegisterTab ? { initialRegisterTab } : {})}
          onNewInvoice={() => setShowNewInvoiceModal(true)}
          onNewQuotation={() => setShowQuotationModal(true)}
          onAddPurchase={() => setShowPurchaseBillModal(true)}
          onEditPurchaseBillDraft={(d) => {
            setEditingBillDraft(d);
            setShowPurchaseBillModal(true);
          }}
          onAddPurchaseOrder={() => setShowPurchaseOrderModal(true)}
          onEditPurchaseOrderDraft={(d) => {
            setEditingPoDraft(d);
            setShowPurchaseOrderModal(true);
          }}
          onReceivePurchaseOrder={(po) => setReceivePO(po)}
          onAddExpense={() => setShowExpenseModal(true)}
          onPaymentIn={(invoiceNo) => {
            setPayInvoiceNo(invoiceNo);
            setShowPaymentInModal(true);
          }}
          onPaymentOut={() => setShowExpenseModal(true)}
          onAddCustomer={() => setShowPetOwnerModal(true)}
          onAddSupplier={() => {
            setEditingSupplier(null);
            setShowNewSupplierModal(true);
          }}
          onEditSupplier={(sup) => {
            setEditingSupplier(sup);
            setShowNewSupplierModal(true);
          }}
          onViewSupplierLedger={(supId) => setSelectedSupplierForLedger(supId)}
          onAddReminder={() => setShowReminderModal(true)}
          onViewInvoice={(invoice) => setSelectedInvoice(invoice)}
          onConvertToInvoice={(quotation) => {
            setShowNewInvoiceModal(true);
            toast.success(`Converting quotation ${quotation.quotationNo} for ${quotation.petName} to Live Invoice!`);
          }}
        />

        {/* ── 1. Full Patient Bill Detail Modal ── */}
        {selectedInvoice && (
          <InvoiceDetailModal
            open={!!selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            invoice={selectedInvoice}
            onUpdated={loadInvoices}
            onDeleted={loadInvoices}
          />
        )}

        {/* ── 2. New Sales Invoice Modal (Matches Image 4) ── */}
        <NewSalesInvoiceModal
          open={showNewInvoiceModal}
          onClose={() => setShowNewInvoiceModal(false)}
          onInvoiceCreated={loadInvoices}
        />

        {/* ── 3. Medical Quotation & Cost Estimate Modal ── */}
        <QuotationModal
          open={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
          onConvertToInvoice={(quotationData) => {
            setShowQuotationModal(false);
            setShowNewInvoiceModal(true);
            toast.success(`Converted estimate for ${quotationData.petName} to Live Invoice!`);
          }}
        />

        {/* ── 4. Billing Reminders & Dues Modal ── */}
        <BillingReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          invoices={invoices}
        />

        {/* ── 5. Add Supplier Purchase Bill Modal (Matches Image 2) ── */}
        <SupplierBillFormModal
          open={showPurchaseBillModal}
          draft={editingBillDraft}
          onClose={() => {
            setShowPurchaseBillModal(false);
            setEditingBillDraft(null);
            setBillPrefill(null);
            setBillPO(null);
          }}
          onSuccess={() => setPurchasesRefreshKey((k) => k + 1)}
          prefill={billPrefill ?? undefined}
          onSaved={(billNo) => {
            // Keep the PO and link it to the bill; mark it received only when every line arrived in full
            if (!billPO) return;
            const { po, lines } = billPO;
            const full = po.items.every((it) => {
              const r = po.receipts?.[it.id];
              return r?.checked && r.receivedQty - r.damagedQty >= it.quantity;
            });
            patchPurchaseOrder(po.id, { linkedBillNo: billNo, status: full ? "RECEIVED" : "PENDING_DELIVERY" });
            setPurchasesRefreshKey((k) => k + 1);
            void lines;
          }}
        />

        <PurchaseOrderReceiveModal
          open={!!receivePO}
          po={receivePO}
          onClose={() => setReceivePO(null)}
          onConvert={(po, lines, grnDate) => {
            const days = po.poDate ? Math.max(0, daysBetweenISO(po.poDate.slice(0, 10), grnDate)) : null;
            setBillPO({ po, lines });
            setBillPrefill({
              supplierId: po.supplierId,
              poNumber: po.poNumber,
              remarks: `Against PO ${po.poNumber}. Ordered ${po.poDate}, received ${grnDate}${days !== null ? ` (delivery time ${days} day${days === 1 ? "" : "s"})` : ""}.`,
              lines,
            });
            setReceivePO(null);
            setShowPurchaseBillModal(true);
          }}
        />

        {/* ── 6. Add Clinic Expense Modal ── */}
        <ExpenseFormModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={loadInvoices}
        />

        {/* ── 7. Payment In / Receipt Collection Modal ── */}
        <PaymentInModal
          open={showPaymentInModal}
          onClose={() => {
            setShowPaymentInModal(false);
            setPayInvoiceNo(undefined);
          }}
          invoices={invoices}
          initialInvoiceNo={payInvoiceNo}
          onSuccess={loadInvoices}
        />

        {/* ── 8. Register New Pet & Owner Modal (Direct Clinic Client Registration) ── */}
        <OwnerPetRegistrationModal
          open={showPetOwnerModal}
          onClose={() => setShowPetOwnerModal(false)}
          onRegistered={({ owner, pets: registeredPets }) => {
            toast.success(`Client "${owner.name}" (${registeredPets.length} pet${registeredPets.length === 1 ? "" : "s"}) registered successfully!`);
            void loadInvoices();
            setClientsRefreshKey((k) => k + 1);
          }}
        />

        {/* ── 9. Daily Till Summary Modal ── */}
        <DailySummaryModal
          open={showDailySummary}
          onClose={() => setShowDailySummary(false)}
          invoices={invoices}
        />

        {/* ── 10. Stock Summary Modal ── */}
        <StockSummaryModal
          open={showStockSummary}
          onClose={() => setShowStockSummary(false)}
        />

        {/* ── 13. Purchase Order Modal ── */}
        <PurchaseOrderModal
          open={showPurchaseOrderModal}
          draft={editingPoDraft}
          onClose={() => {
            setShowPurchaseOrderModal(false);
            setEditingPoDraft(null);
          }}
          onSuccess={() => setPurchasesRefreshKey((k) => k + 1)}
        />

        {/* ── 11. New / Edit Supplier Profile Modal (Matches Image 1 & 2) ── */}
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => {
            setShowNewSupplierModal(false);
            setEditingSupplier(null);
          }}
          supplierToEdit={editingSupplier}
          onSuccess={(sup) => {
            setSuppliersRefreshKey((k) => k + 1);
          }}
        />

        {/* ── 12. Supplier Statement / Ledger Modal ── */}
        {selectedSupplierForLedger && (
          <SupplierLedgerModal
            open={!!selectedSupplierForLedger}
            onClose={() => setSelectedSupplierForLedger(null)}
            supplierId={selectedSupplierForLedger}
          />
        )}
      </div>
    </Shell>
  );
}

export function PatientBillingHub({ initialRegisterTab }: { initialRegisterTab?: RegisterTab } = {}) {
  return (
    <InventoryProvider>
      <PatientBillingHubInner {...(initialRegisterTab ? { initialRegisterTab } : {})} />
    </InventoryProvider>
  );
}
