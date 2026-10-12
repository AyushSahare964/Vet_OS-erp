import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Pet, Section } from "@/data/doctor/types";
import { buildRealHistoryRecords, buildRealGraphData } from "@/lib/doctor/realPatientAdapter";
import { SECTION_ICON } from "../shared/sectionIcons";
import { InvoicePrintView } from "@/components/erp/clinical/InvoicePrintView";
import { BigView } from "./BigView";
import type { ChartSelection } from "./ChartCard";
import { GraphPanel } from "./GraphPanel";
import { RecordCard } from "./RecordCard";

const NO_SELECTION: ChartSelection = { point: null, zone: null };

/** Full history page: records on the left (newest first), sticky graph report on the right. */
export function HistoryPage({ pet, section, p360 }: { pet: Pet; section: Section; p360?: any }) {
  const navigate = useNavigate();
  const page = useMemo(
    () => buildRealHistoryRecords(pet, section, p360 || {}),
    [pet, section, p360]
  );
  const graphs = useMemo(
    () => buildRealGraphData(pet, section, p360 || {}),
    [pet, section, p360]
  );
  const [metricKey, setMetricKey] = useState(graphs.def);
  const [selections, setSelections] = useState<Record<string, ChartSelection>>({});
  const [bigKey, setBigKey] = useState<string | null>(null);
  const [bill, setBill] = useState<string | null>(null);

  // Resolves the real clinical visit for the clicked bill to render the actual examination InvoicePrintView
  const selectedVisit = useMemo(() => {
    if (!bill) return null;
    const visits = Array.isArray(p360?.visits) ? p360.visits : [];
    const norm = (s: any) => String(s || "").trim().toLowerCase();
    const found = visits.find(
      (v: any) => norm(v.invoiceNo) === norm(bill) || norm(v.visitId) === norm(bill)
    );

    const petName = found?.petName || p360?.pet?.name || pet.name;
    const petId = found?.petId || p360?.pet?.petId || pet.id;
    const species = found?.species || p360?.pet?.species || "Canine";
    const breed = found?.breed || p360?.pet?.breed || pet.breed;
    const ownerName = found?.ownerName || p360?.owner?.name || pet.owner;
    const ownerPhone = found?.ownerPhone || p360?.owner?.phone || pet.phone;
    const ownerId = found?.ownerId || p360?.owner?.ownerId || p360?.pet?.ownerId || "CLIENT";
    const doctorName = found?.doctorName || "Dr Bharat Menon";
    const totalAmount = Number(found?.totalAmount ?? 0);
    const amountPaid = Number(found?.amountPaid ?? (totalAmount > 0 ? totalAmount : 500));
    const balanceDue = Number(found?.balanceDue ?? Math.max(0, totalAmount - amountPaid));
    const billType = found?.billType || "GST";

    const rawItems = Array.isArray(found?.items) && found.items.length > 0 ? found.items : [];
    const items =
      rawItems.length > 0
        ? rawItems.map((it: any) => ({
            ...it,
            name: it.name || it.medicineName || "Clinical Consultation",
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice ?? it.price ?? it.rate ?? 0),
            lineTotal: Number(
              it.lineTotal ?? (Number(it.quantity) || 1) * Number(it.unitPrice ?? it.price ?? 0)
            ),
            lineType: it.lineType || "Consultation",
          }))
        : [
            {
              name:
                found?.diagnosis ||
                found?.vitals?.complaint ||
                "Veterinary Consultation & Physical Examination",
              quantity: 1,
              unitPrice: totalAmount > 0 ? totalAmount : 500,
              lineTotal: totalAmount > 0 ? totalAmount : 500,
              lineType: "Consultation",
            },
          ];

    const payments =
      Array.isArray(found?.payments) && found.payments.length > 0
        ? found.payments
        : amountPaid > 0
        ? [
            {
              mode: found?.paymentMode || "Cash / UPI",
              amount: amountPaid,
              timestamp: found?.date || found?.createdAt || new Date(),
              recordedBy: doctorName,
              trxRef: found?.trxRef || "DIRECT",
            },
          ]
        : [];

    return {
      ...(found || {}),
      invoiceNo: found?.invoiceNo || bill,
      date:
        found?.date ||
        (found?.createdAt
          ? new Date(found.createdAt).toLocaleDateString("en-GB")
          : new Date().toLocaleDateString("en-GB")),
      billType,
      petName,
      petId,
      species,
      breed,
      ownerName,
      ownerPhone,
      ownerId,
      doctorName,
      items,
      totalAmount: totalAmount > 0 ? totalAmount : (items[0]?.lineTotal || 500),
      amountPaid: amountPaid > 0 ? amountPaid : (items[0]?.lineTotal || 500),
      balanceDue,
      payments,
      paymentMode: found?.paymentMode || "Cash / UPI",
    };
  }, [bill, p360, pet]);
  const Icon = SECTION_ICON[section];

  const selectionOf = (key: string) => selections[key] ?? NO_SELECTION;
  const setSelectionOf = (key: string) => (s: ChartSelection) =>
    setSelections((all) => ({ ...all, [key]: s }));
  const bigMetric = bigKey ? graphs.metrics.find((m) => m.key === bigKey) : undefined;

  // Esc goes back to the patient file (overlays and the picker catch Esc first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate({ to: "/patient/$id", params: { id: pet.id } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pet.id]);

  return (
    <section className="detail" aria-label={`${pet.name}, ${page.title}`}>
      <div className="d-bar">
        <Link to="/patient/$id" params={{ id: pet.id }} className="p-back">
          <ArrowLeft strokeWidth={1.8} aria-hidden="true" /> Back to {pet.name}&apos;s file
        </Link>
        <nav className="d-crumbs" aria-label="Breadcrumb">
          <Link to="/" className="crumb">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/patient/$id" params={{ id: pet.id }} className="crumb">
            {pet.name}
          </Link>{" "}
          / <b>{page.title}</b>
        </nav>
      </div>

      <div className="d-title">
        <span className="s-ico">
          <Icon strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2>
            {pet.name} · {page.title}
          </h2>
          <p>
            {page.records.length} records · every detail, newest first · graph report on the side
          </p>
        </div>
      </div>

      <div className="d-body">
        <div className="d-records">
          {page.records.map((r, i) => (
            <RecordCard key={i} record={r} onViewBill={setBill} />
          ))}
        </div>
        <GraphPanel
          data={graphs}
          metricKey={metricKey}
          onMetric={setMetricKey}
          selection={selectionOf(metricKey)}
          onSelection={setSelectionOf(metricKey)}
          onBigView={() => setBigKey(metricKey)}
        />
      </div>

      {bigMetric && (
        <BigView
          metric={bigMetric}
          selection={selectionOf(bigMetric.key)}
          onSelection={setSelectionOf(bigMetric.key)}
          onClose={() => setBigKey(null)}
        />
      )}
      {bill && selectedVisit && (
        <InvoicePrintView
          visit={selectedVisit}
          open={!!bill}
          onClose={() => setBill(null)}
        />
      )}
    </section>
  );
}
