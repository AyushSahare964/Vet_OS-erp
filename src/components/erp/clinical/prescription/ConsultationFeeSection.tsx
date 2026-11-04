import React, { useRef } from "react";
import { IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard, type SaveStatus } from "./SectionCard";
import { cn } from "@/lib/utils";

export interface ConsultationFeeSectionProps {
  id?: string | undefined;
  amount: number | null;
  preset: string | null;
  onChangeAmount: (amt: number | null, preset: string | null) => void;
  onSave: () => Promise<void>;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  isLocked?: boolean | undefined;
}

const PRESETS = [
  { label: "Free / Follow-up", amount: 0, code: "FREE" },
  { label: "Re-check", amount: 300, code: "RECHECK" },
  { label: "Standard", amount: 500, code: "STANDARD" },
  { label: "Specialist", amount: 800, code: "SPECIALIST" },
  { label: "Emergency / Surgery", amount: 1200, code: "EMERGENCY" },
];
// Home visit has no fixed price: the doctor types the amount.
const HOME_VISIT = "HOME_VISIT";

export function ConsultationFeeSection({
  id = "sec-fee",
  amount,
  preset,
  onChangeAmount,
  onSave,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  isLocked = false,
}: ConsultationFeeSectionProps) {
  const amountRef = useRef<HTMLInputElement>(null);
  // Multi-select: `preset` holds comma-joined codes; `amount` is the running total.
  // Home Visit is an add-on stored as "HOME_VISIT:<fee>"; amount = consultation + home fee.
  const parts = preset ? preset.split(",") : [];
  const homePart = parts.find((c) => c.split(":")[0] === HOME_VISIT);
  const isHomeVisit = !!homePart;
  const homeFee = Number(homePart?.split(":")[1]) || 0;
  const selected = parts.filter((c) => c !== homePart);
  const consult = Math.max(0, (amount ?? 0) - homeFee);

  const emit = (c: number, h: number, sel: string[], home: boolean) => {
    const codes = home ? [...sel, `${HOME_VISIT}:${h}`] : sel;
    onChangeAmount(codes.length || c + h > 0 ? c + h : null, codes.join(",") || null);
  };

  const toggle = (code: string, pAmount: number) => {
    if (isLocked) return;
    const on = selected.includes(code);
    const next = on ? selected.filter((c) => c !== code) : [...selected, code];
    emit(Math.max(0, consult + (on ? -pAmount : pAmount)), homeFee, next, isHomeVisit);
  };

  const toggleHome = () => {
    if (isLocked) return;
    emit(consult, 0, selected, !isHomeVisit);
    if (!isHomeVisit) setTimeout(() => amountRef.current?.focus(), 0);
  };

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <SectionCard
      id={id}
      icon={<IndianRupee className="size-4" />}
      title="Consultation Fee"
      subtitle="Doctor consultation charges applied directly to patient billing"
      status={status}
      lastSavedAt={lastSavedAt}
      isDirty={isDirty}
      onSave={onSave}
      saveLabel="Save Fee ✓"
      isLocked={isLocked}
    >
      <div className="space-y-3">
        {/* Preset Chips */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
            Select Consultation Preset
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const isSelected = selected.includes(p.code);

              return (
                <button
                  key={p.code}
                  type="button"
                  disabled={isLocked}
                  onClick={() => toggle(p.code, p.amount)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 text-foreground border-border hover:bg-muted"
                  )}
                >
                  <span>{p.label}</span>
                  <span className="font-mono opacity-90">(₹{p.amount})</span>
                </button>
              );
            })}
            <button
              type="button"
              disabled={isLocked}
              onClick={toggleHome}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                isHomeVisit
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/40 text-foreground border-dashed border-border hover:bg-muted"
              )}
            >
              <span>{isHomeVisit ? "✓" : "+"} Home Visit</span>
            </button>
          </div>
        </div>

        {/* Custom Input */}
        <div className="flex flex-wrap gap-3 pt-1">
          <div className="w-44 space-y-1">
            <Label htmlFor="custom-consultation-fee" className="text-[11px] font-semibold text-muted-foreground">
              Consultation Fee (₹)
            </Label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs font-bold text-muted-foreground pointer-events-none">₹</span>
              <Input
                id="custom-consultation-fee"
                type="number"
                min={0}
                max={100000}
                disabled={isLocked}
                value={amount === null ? "" : consult}
                onChange={(e) => emit(num(e.target.value), homeFee, selected, isHomeVisit)}
                placeholder="0"
                className="pl-7 font-mono font-bold text-sm h-9 bg-background"
              />
            </div>
          </div>
          {isHomeVisit && (
            <>
              <span className="self-end pb-2 text-sm font-bold text-muted-foreground">+</span>
              <div className="w-44 space-y-1">
                <Label htmlFor="home-visit-fee" className="text-[11px] font-semibold text-muted-foreground">
                  Home Visit Fee (₹)
                </Label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-muted-foreground pointer-events-none">₹</span>
                  <Input
                    id="home-visit-fee"
                    ref={amountRef}
                    type="number"
                    min={0}
                    max={100000}
                    disabled={isLocked}
                    value={homeFee || ""}
                    onChange={(e) => emit(consult, num(e.target.value), selected, true)}
                    placeholder="0"
                    className="pl-7 font-mono font-bold text-sm h-9 bg-background"
                  />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1 self-end pb-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground">Total</div>
            <div className="font-mono font-bold text-sm">₹{(amount ?? 0).toFixed(0)}</div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {amount === 0 ? "₹0 fee recorded (Fee waived / Follow-up check)" : "Synced to Billing: Doctor Consultation" + (isHomeVisit ? " and Home Visit as separate lines" : " line")}
        </p>
      </div>
    </SectionCard>
  );
}
