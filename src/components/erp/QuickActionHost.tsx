import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { closeQuickAction, useQuickAction } from "@/components/doctor/layout/quickActions";
import { InventoryProvider } from "@/components/erp/inventory/useInventoryStore";
import { NewSalesInvoiceModal } from "@/components/erp/billing/NewSalesInvoiceModal";
import { QuotationModal } from "@/components/erp/billing/QuotationModal";
import { PaymentInModal } from "@/components/erp/billing/PaymentInModal";
import { ExpenseFormModal } from "@/components/erp/accounting/ExpenseFormModal";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { BookAppointmentModal } from "@/components/erp/appointments/BookAppointmentModal";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { BillingReminderModal } from "@/components/erp/billing/BillingReminderModal";
import { PurchaseOrderModal } from "@/components/erp/billing/PurchaseOrderModal";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import { CreateLabOrderModal } from "@/components/erp/laboratory/CreateLabOrderModal";
import { EnquiryDialog } from "@/components/erp/EnquiryDialog";
import { StartConsultPicker } from "@/components/erp/clinical/StartConsultPicker";

/**
 * Opens the existing Billing / CRM / Appointments modals from the right bar's Quick Action flyout, on any page.
 * Loaded lazily by SideBar the first time a quick action is chosen. No new behaviour: same modals, same handlers.
 */
export function QuickActionHost() {
  const action = useQuickAction();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    // Actions that open a page instead of a modal
    const page: Record<string, { moduleId: string; search: Record<string, string> }> = {
      documentation: { moduleId: "communication", search: { tab: "documents" } },
    };
    const target = action ? page[action] : undefined;
    if (target) {
      closeQuickAction();
      void navigate({ to: "/m/$moduleId", params: { moduleId: target.moduleId }, search: target.search as never });
    }
    if (action === "payment" || action === "reminder") listInvoicesFn({ data: { query: "" } }).then((d) => setInvoices(d || [])).catch(() => setInvoices([]));
  }, [action, navigate]);

  return (
    <InventoryProvider>
      <NewSalesInvoiceModal open={action === "invoice"} onClose={closeQuickAction} />
      <NewSalesInvoiceModal advisedMode open={action === "advisedMedicine"} onClose={closeQuickAction} />
      <QuotationModal open={action === "quotation"} onClose={closeQuickAction} />
      <PaymentInModal open={action === "payment"} onClose={closeQuickAction} invoices={invoices} />
      {/* Payment Out opens the same modal the Billing desk uses for it (the expense / payment-out form) */}
      <ExpenseFormModal open={action === "expense" || action === "paymentOut"} onClose={closeQuickAction} />
      <BillingReminderModal open={action === "reminder"} onClose={closeQuickAction} invoices={invoices} />
      <OwnerPetRegistrationModal open={action === "client"} onClose={closeQuickAction} />
      <BookAppointmentModal open={action === "appointment"} onClose={closeQuickAction} />
      <PurchaseOrderModal open={action === "purchaseOrder"} onClose={closeQuickAction} />
      <SupplierBillFormModal open={action === "purchaseBill"} onClose={closeQuickAction} />
      <CreateLabOrderModal open={action === "labOrder"} onClose={closeQuickAction} />
      <EnquiryDialog open={action === "enquiry"} onClose={closeQuickAction} />
      <StartConsultPicker open={action === "consultation"} onClose={closeQuickAction} />
    </InventoryProvider>
  );
}
