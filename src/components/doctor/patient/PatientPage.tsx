import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, PawPrint, ShieldCheck, Stethoscope, Syringe, User, Phone, MapPin, Mail, ShoppingCart } from "lucide-react";
import type { Pet, Section } from "@/data/doctor/types";
import { useErp } from "@/lib/erp/store";
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { BrandChip } from "../shared/BrandChip";
import { SECTION_ICON } from "../shared/sectionIcons";
import { StatusCard } from "./StatusCard";
import { vetNameOf } from "@/lib/clinical/attendingVet";

const BUTTONS: [Section, string, string][] = [
  ["medical", "Medical", "Visits and treatments"],
  ["lab", "Laboratory", "Blood reports and graphs"],
  ["purchase", "Purchase", "Products and invoices"],
  ["vaccine", "Vaccine history", "Every vaccine given"],
  ["grooming", "Grooming", "Grooming bookings and visits"],
];

interface PatientPageProps {
  pet: Pet;
  p360?: any;
}

/** Patient file: header card with rich Owner details, status cards, and section history. */
export function PatientPage({ pet, p360 }: PatientPageProps) {
  const owner = p360?.owner;
  const otherPets = Array.isArray(p360?.otherPets) ? p360.otherPets : [];
  const isWalkIn = Boolean(p360?.isWalkIn || /OTC-WALKIN|WALKIN/i.test(pet.id));

  const ownerName = owner?.name || pet.owner;
  const ownerPhone = owner?.phone || pet.phone;
  const ownerEmail = owner?.email;
  const ownerAddress = [owner?.address, owner?.city].filter(Boolean).join(", ");
  const ownerId = owner?.ownerId;
  const balance = Number(owner?.outstandingBalance || 0);

  // Start Consultation: same behaviour as "Admit" on the Clinic Dashboard
  // (ClinicDashboard.handleAdmitPetDirectly): reopen the pet's active visit if there is one,
  // otherwise open the workspace with a new admitted-visit draft.
  const { currentUser, role } = useErp();
  const [workspaceVisit, setWorkspaceVisit] = useState<any | null>(null);
  const activeDoctorName = vetNameOf(currentUser);

  const startConsultation = () => {
    const p = p360?.pet;
    if (!p) return;
    const visits: any[] = Array.isArray(p360?.visits) ? p360.visits : [];
    const existingActiveVisit = visits.find(
      (v) =>
        v.petId === p.petId &&
        v.status !== "Paid" &&
        v.status !== "Settled" &&
        v.status !== "Completed"
    );
    if (existingActiveVisit) {
      setWorkspaceVisit({ ...existingActiveVisit, doctorName: existingActiveVisit.doctorName || activeDoctorName });
      return;
    }
    setWorkspaceVisit({
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionNo: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: p.petId,
      petName: p.name,
      species: p.species,
      breed: p.breed,
      ownerId: owner?.ownerId || p.ownerId,
      ownerName: owner?.name || "Client",
      ownerPhone: owner?.phone || "N/A",
      doctorName: activeDoctorName,
      vitals: {
        weightKg: p.weightKg || 25,
        tempC: 38.5,
        complaint: p.allergies?.length ? `History: ${p.allergies.join(", ")}` : "OPD Consultation",
      },
      status: "Admitted",
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    });
  };

  return (
    <>
      <Link to="/" className="p-back home-btn">
        <ArrowLeft strokeWidth={1.8} aria-hidden="true" /> Home
      </Link>
      <section className="patient" aria-label="Patient and Client file">
        {/* Main Profile Header */}
        <div className="card p-head">
          <div className="p-avatar">
            {isWalkIn ? <ShoppingCart strokeWidth={1.7} aria-hidden="true" /> : <PawPrint strokeWidth={1.7} aria-hidden="true" />}
          </div>
          <div className="p-id">
            <div className="p-file">
              <BrandChip /> {isWalkIn ? "Walk-in Counter File" : "Patient File"} · <span className="font-mono text-xs opacity-75">{pet.id}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <h2>{pet.name}</h2>
              {!isWalkIn && p360?.pet && (
                <button
                  type="button"
                  onClick={startConsultation}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    height: "40px",
                    padding: "0 18px",
                    borderRadius: "999px",
                    border: "none",
                    background: "var(--brand-deep)",
                    color: "#fff",
                    font: "700 14px var(--font-display)",
                    cursor: "pointer",
                  }}
                >
                  <Stethoscope size={17} aria-hidden="true" /> Start Consultation
                </button>
              )}
            </div>
            <p>
              {pet.breed} · {pet.age} · {pet.sex}
            </p>
          </div>
          <div className="p-owner">
            Owner<b>{ownerName}</b>
            <span>{ownerPhone}</span>
            {ownerId && <span className="block text-[11px] font-mono text-muted-foreground mt-0.5">ID: {ownerId}</span>}
          </div>
        </div>

        {/* Detailed Owner & Client Information Card */}
        <div className="card" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "rgba(10, 65, 116, 0.08)",
                  color: "#0a4174",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User size={19} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{ownerName}</strong>
                  {ownerId && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "rgba(10, 65, 116, 0.06)",
                        color: "#0a4174",
                        fontWeight: 600,
                      }}
                    >
                      {ownerId}
                    </span>
                  )}
                  {balance > 0 ? (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "#fff1f0",
                        color: "#cf1322",
                        border: "1px solid #ffa39e",
                        fontWeight: 700,
                      }}
                    >
                      Balance Due: ₹{balance.toLocaleString("en-IN")}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "#f6ffed",
                        color: "#389e0d",
                        border: "1px solid #b7eb8f",
                        fontWeight: 600,
                      }}
                    >
                      Account Clear ✓
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "14px",
                    fontSize: "12px",
                    color: "var(--muted)",
                    marginTop: "4px",
                  }}
                >
                  {ownerPhone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Phone size={12} color="#0a4174" /> {ownerPhone}
                    </span>
                  )}
                  {ownerEmail && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Mail size={12} color="#0a4174" /> {ownerEmail}
                    </span>
                  )}
                  {ownerAddress && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={12} color="#0a4174" /> {ownerAddress}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Other Registered Pets for this Client */}
            {otherPets.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>
                  Other pets:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {otherPets.map((op: any) => (
                    <Link
                      key={op.petId}
                      to="/patient/$id"
                      params={{ id: op.petId }}
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "3px 9px",
                        borderRadius: "8px",
                        background: "#e6f4ff",
                        color: "#0958d9",
                        border: "1px solid #91caff",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      🐾 {op.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Cards (Vaccine & Deworming) */}
        {!isWalkIn && (
          <div className="p-status">
            <StatusCard icon={Syringe} title="Vaccine" dose={pet.vaccine} />
            <Link to="/patient/$id/$section" params={{ id: pet.id, section: "deworm" }} style={{ display: "block", color: "inherit", textDecoration: "none" }} aria-label="Open deworming history">
              <StatusCard icon={ShieldCheck} title="Deworming" dose={pet.deworm} />
            </Link>
          </div>
        )}

        {/* History Navigation Buttons */}
        <div className="p-grid">
          {BUTTONS.map(([section, title, sub]) => {
            const Icon = SECTION_ICON[section];
            return (
              <Link
                key={section}
                to="/patient/$id/$section"
                params={{ id: pet.id, section }}
                className="card p-btn"
              >
                <span className="p-ico">
                  <Icon strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="p-txt">
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      {workspaceVisit && (
        <VisitWorkspaceModal
          open
          onClose={() => setWorkspaceVisit(null)}
          visit={workspaceVisit}
          onVisitFinalized={(updated) => {
            if (updated) setWorkspaceVisit(updated);
          }}
        />
      )}
    </>
  );
}
