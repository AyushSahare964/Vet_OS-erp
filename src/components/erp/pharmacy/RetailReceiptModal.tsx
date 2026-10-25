import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";

interface Props {
  open: boolean;
  onClose: () => void;
  sale: any;
}

/** Retail counter bill — rendered with the same InvoicePrintView as clinical invoices. */
export function RetailReceiptModal({ open, onClose, sale }: Props) {
  if (!sale) return null;

  // Older sales were saved without line items; fall back to the single summary line.
  const lines: any[] = sale.items?.length
    ? sale.items
    : [{ name: sale.item, quantity: sale.qty || 1, unitPrice: (sale.amount || 0) / (sale.qty || 1), gstRate: 0 }];

  const items = lines.map((c) => ({
    name: c.name,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    discountType: "percentage",
    discountValue: c.discountPercent || 0,
    gstRate: c.gstRate || 0,
    gstApplicable: (c.gstRate || 0) > 0,
    lineType: sale.category || "Medicine",
    batchNo: c.batchNo,
  }));

  const total = Number(sale.amount) || 0;
  const hasTotals = sale.subtotal !== undefined && sale.gst !== undefined;
  const visit = {
    invoiceNo: sale.bill,
    date: sale.date,
    billType: items.some((i) => i.gstApplicable) ? "GST" : "NON_GST",
    ownerName: sale.customer || "Walk-in",
    ownerPhone: sale.customerPhone,
    items,
    totalAmount: total,
    amountPaid: total,
    balanceDue: 0,
    paymentMode: sale.payment,
    trxRef: sale.trxRef,
    ...(hasTotals ? { roundOff: Math.round((total - (Number(sale.subtotal) + Number(sale.gst))) * 100) / 100 } : {}),
  };

  return <InvoicePrintView visit={visit} open={open} onClose={onClose} />;
}
