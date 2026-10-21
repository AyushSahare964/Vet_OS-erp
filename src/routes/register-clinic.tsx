import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Building2, ArrowRight, ArrowLeft, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp/store";
import type { RegisterTenantPayload } from "@/lib/erp/auth";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { TRIAL_DAYS } from "@/lib/erp/features";
import { cn } from "@/lib/utils";
import { normaliseMobile, validateMobile, validatePin } from "@/lib/finance/validators";
import { PetShowcase } from "@/components/erp/PetShowcase";
import { PayButton } from "@/components/landing/PayButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/register-clinic")({
  // ?plan=<planId> comes from the pricing page and preselects the plan in step 4.
  validateSearch: (s: Record<string, unknown>): { plan?: RegisterTenantPayload["planId"]; pay?: string } => {
    const p = typeof s["plan"] === "string" && SELECTABLE_PLAN_IDS.includes(s["plan"]) ? (s["plan"] as RegisterTenantPayload["planId"]) : undefined;
    const pay = typeof s["pay"] === "string" && s["pay"].length <= 80 ? s["pay"] : undefined;
    return { ...(p ? { plan: p } : {}), ...(pay ? { pay } : {}) };
  },
  head: () => ({
    meta: [{ title: "Register Your Clinic — VetechIQ" }],
  }),
  component: RegisterClinicPage,
});

const SELECTABLE_PLAN_IDS: string[] = ["plan_starter", "plan_professional"];

const PLANS: Array<{ id: RegisterTenantPayload["planId"]; name: string; price: string; blurb: string; highlights: string[]; soon?: boolean }> = [
  {
    id: "plan_starter",
    name: "Starter",
    price: `₹0 for ${TRIAL_DAYS} days`,
    blurb: "Pet records, appointments, consultation, lab, pharmacy and GST invoices.",
    highlights: ["Up to 5 staff", "Up to 500 pets"],
  },
  {
    id: "plan_professional",
    name: "Pro",
    price: "₹2,000/mo + GST",
    blurb: "Everything in Starter, plus ledgers, reports, boarding, swimming and nutrition.",
    highlights: ["Up to 20 staff", "Up to 5,000 pets"],
  },
  {
    id: "plan_enterprise",
    name: "Max",
    price: "Coming soon",
    blurb: "Everything in Pro, with smart AI help for your clinic.",
    highlights: ["Unlimited staff", "Unlimited pets"],
    soon: true,
  },
];

const INDIAN_STATES = [
  "Maharashtra", "Karnataka", "Delhi", "Uttar Pradesh", "Gujarat", "Tamil Nadu",
  "West Bengal", "Rajasthan", "Telangana", "Kerala", "Punjab", "Haryana",
  "Madhya Pradesh", "Bihar", "Andhra Pradesh",
];

const STEP_LABELS = ["Clinic Details", "Doctor Details", "Branding", "Admin Account"] as const;
type Step = 1 | 2 | 3 | 4;

const COUNCILS = [
  "Maharashtra State Veterinary Council",
  "Veterinary Council of India",
  "Karnataka Veterinary Council",
  "Gujarat Veterinary Council",
  "Tamil Nadu Veterinary Council",
  "Andhra Pradesh Veterinary Council",
  "Telangana State Veterinary Council",
  "Kerala Veterinary and Animal Sciences Council",
  "Madhya Pradesh Veterinary Council",
  "Uttar Pradesh Veterinary Council",
  "Punjab Veterinary Council",
  "Haryana Veterinary Council",
  "Rajasthan Veterinary Council",
  "Delhi Veterinary Council",
  "West Bengal Veterinary Council",
  "Bihar Veterinary Council",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digits = (v: string, max: number) => normaliseMobile(v).replace(/\D/g, "").slice(0, max);
const emailError = (v: string) => (v && !EMAIL_RE.test(v.trim()) ? "Enter a valid email address" : null);
const phoneError = (v: string, required = true) => (v || required ? validateMobile(v, required) : null);

const MAX_ID_CARD_DIMENSION = 1200; // large enough to stay legible for manual verification

const MAX_LOGO_DIMENSION = 320;
const LOGO_JPEG_QUALITY = 0.85;

/** Resizes/compresses an image file client-side before it's sent to the server, so a
 * multi-MB phone photo doesn't turn into a multi-MB MongoDB document. */
function resizeImageToDataUri(file: File, maxDim = MAX_LOGO_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function RegisterClinicPage() {
  const navigate = useNavigate();
  const { registerTenant } = useErp();
  const { plan, pay } = Route.useSearch();
  // Pro is paid on the pricing page first; without a payment there is nothing to register against.
  useEffect(() => {
    if (plan === "plan_professional" && !pay) void navigate({ to: "/pricing" });
  }, [plan, pay, navigate]);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [idCardProcessing, setIdCardProcessing] = useState(false);
  const idCardInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<RegisterTenantPayload>({
    clinicName: "",
    legalName: "",
    clinicType: "Small Animal",
    doctorName: "",
    doctorRegNo: "",
    doctorCouncil: COUNCILS[0]!,
    doctorRegValidUpto: "",
    doctorQualification: "",
    doctorIdCardDataUri: "",
    address: "",
    city: "",
    state: "Maharashtra",
    pin: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    website: "",
    gstin: "",
    pan: "",
    isCompositionDealer: false,
    planId: plan ?? "plan_starter",
    ...(pay ? { paymentId: pay } : {}),
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
    tagline: "",
    primaryColor: "#2563eb",
    hasBoardingFacility: true,
    hasSwimmingPool: false,
    kennelCapacity: 20,
  });
  const [confirmPassword, setConfirmPassword] = useState("");

  const set = <K extends keyof RegisterTenantPayload>(key: K, value: RegisterTenantPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canContinueStep1 =
    !!form.clinicName.trim() && !!form.address.trim() && !!form.city.trim() &&
    !validatePin(form.pin, true) && !phoneError(form.phone) && !phoneError(form.whatsappNumber || "", false) && !!form.email && !emailError(form.email);

  const handleLogoPick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Logo file is too large (max 8MB before compression).");
      return;
    }
    setLogoProcessing(true);
    try {
      const dataUri = await resizeImageToDataUri(file);
      setLogoPreview(dataUri);
      set("logoDataUri", dataUri);
    } catch {
      toast.error("Could not process that image.");
    } finally {
      setLogoProcessing(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const canContinueDoctor =
    form.doctorName.trim().length >= 2 && form.doctorRegNo.trim().length >= 3 && form.doctorCouncil.trim() &&
    form.doctorRegValidUpto > today && !!form.doctorIdCardDataUri;

  const handleIdCardPick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo/scan of the ID card (JPG or PNG).");
      return;
    }
    setIdCardProcessing(true);
    try {
      set("doctorIdCardDataUri", await resizeImageToDataUri(file, MAX_ID_CARD_DIMENSION));
    } catch {
      toast.error("Could not process that image.");
    } finally {
      setIdCardProcessing(false);
    }
  };

  // Last step: check the admin account, then ask the user to confirm (or upgrade) the plan before creating anything.
  const openConfirm = () => {
    if (!form.adminFullName.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      toast.error("Please fill in your name, email, and password.");
      return;
    }
    if (emailError(form.adminEmail) || phoneError(form.adminPhone || "", false)) {
      toast.error("Please correct your email or mobile number.");
      return;
    }
    if (form.adminPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPayMsg("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const withCode = (v: string | undefined) => (v ? `+91 ${v}` : "");
      const res = await registerTenant({
        ...form,
        phone: withCode(form.phone),
        whatsappNumber: withCode(form.whatsappNumber),
        adminPhone: withCode(form.adminPhone),
      });
      if (res.success) {
        toast.success(res.message || "Clinic registered!");
        navigate({ to: "/" });
      } else {
        toast.error(res.message || "Registration failed.");
      }
    } catch {
      toast.error("Could not complete registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10"
      style={{
        backgroundColor: "#eaf3fa",
        backgroundImage: `radial-gradient(circle at 50% 12%, rgba(123, 189, 232, 0.28) 0%, transparent 55%), radial-gradient(circle at 85% 85%, rgba(10, 65, 116, 0.08) 0%, transparent 50%), url("/pattern/pets-pattern.svg")`,
        backgroundSize: "cover, cover, 280px 280px",
        backgroundRepeat: "no-repeat, no-repeat, repeat",
        fontFamily: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 w-full max-w-5xl px-2">
        <Link to="/" className="flex items-center gap-3" aria-label="VetechIQ home">
          <img src="/landing/logo-dark.png" alt="VetechIQ" className="h-10 w-auto max-w-none object-contain object-left" />
          <span className="hidden sm:block text-[0.72rem] text-[#4d6a86] font-medium leading-none">Veterinary Practice & Clinic Management</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <Link to="/pricing" className="text-xs font-bold text-[#001d39] hover:underline px-2 py-2">Plans & pricing</Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] px-3.5 py-2 rounded-xl border border-[#bcd0e2] shadow-[0_4px_14px_rgba(10,65,116,0.2)] hover:scale-105 active:scale-95 transition-all"
          >
            Already have a clinic? Sign in <ArrowRight className="size-3 text-[#7bbde8]" />
          </Link>
        </div>
      </div>

      <div className="w-full max-w-5xl rounded-3xl bg-white border border-[#bcd0e2] shadow-[0_20px_50px_rgba(0,29,57,0.12),0_1px_3px_rgba(0,29,57,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <div className="hidden md:block md:col-span-4 border-r border-[#d3e2ef]">
          <PetShowcase />
        </div>
        <div className="md:col-span-8 p-6 sm:p-8 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-6 text-[#0a4174]" />
          <h1 className="text-2xl font-black tracking-tight text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">Register Your Clinic</h1>
        </div>
        <p className="text-sm text-[#4d6a86] mb-6">
          Get your own isolated VetechIQ workspace in minutes — no card required, {TRIAL_DAYS}-day free trial.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    step === n ? "bg-[#001d39] text-[#7bbde8]" : step > n ? "bg-emerald-500 text-white" : "bg-[#eaf3fa] text-[#4d6a86]",
                  )}
                >
                  {step > n ? <Check className="size-3.5" /> : n}
                </div>
                <span className={cn("text-[0.7rem] font-semibold hidden lg:inline", step === n ? "text-[#001d39]" : "text-muted-foreground")}>{label}</span>
                {n < 4 && <div className="h-px flex-1 bg-[#d3e2ef]" />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Clinic Name *" value={form.clinicName} onChange={(v) => set("clinicName", v)} placeholder="Sunrise Pet Hospital" />
              <Field label="Legal Name" value={form.legalName || ""} onChange={(v) => set("legalName", v)} placeholder="Same as clinic name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mobile Number *" value={form.phone} onChange={(v) => set("phone", digits(v, 10))} placeholder="98765 43210" prefix="+91" type="tel" inputMode="numeric" autoComplete="tel-national" error={phoneError(form.phone)} />
              <Field label="WhatsApp Number" value={form.whatsappNumber || ""} onChange={(v) => set("whatsappNumber", digits(v, 10))} placeholder="Same as mobile" prefix="+91" type="tel" inputMode="numeric" error={phoneError(form.whatsappNumber || "", false)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact Email *" value={form.email} onChange={(v) => set("email", v.toLowerCase().replace(/\s/g, ""))} placeholder="clinic@example.com" type="email" inputMode="email" autoComplete="email" error={emailError(form.email)} />
              <Field label="Website" value={form.website || ""} onChange={(v) => set("website", v)} placeholder="www.yourclinic.com" />
            </div>
            <Field label="Address *" value={form.address} onChange={(v) => set("address", v)} placeholder="Street, area" />
            <div className="grid grid-cols-3 gap-2">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} placeholder="Nagpur" />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#001d39]">State *</label>
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-white px-3 text-sm outline-none focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Field label="PIN *" value={form.pin} onChange={(v) => set("pin", v.replace(/\D/g, "").slice(0, 6))} placeholder="440001" inputMode="numeric" maxLength={6} error={form.pin ? validatePin(form.pin, true) : null} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="GSTIN" value={form.gstin || ""} onChange={(v) => set("gstin", v)} placeholder="Optional" />
              <Field label="PAN" value={form.pan || ""} onChange={(v) => set("pan", v)} placeholder="Optional" />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer text-[0.68rem] text-muted-foreground select-none pt-0.5">
              <input
                type="checkbox"
                checked={form.isCompositionDealer ?? false}
                onChange={(e) => set("isCompositionDealer", e.target.checked)}
                className="size-3.5 rounded border-input text-primary focus:ring-primary"
              />
              <span>Registered as a GST Composition Dealer</span>
            </label>
            <button
              type="button"
              disabled={!canContinueStep1}
              onClick={() => setStep(2)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,65,116,0.25)] transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 mt-2"
            >
              Continue <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <p className="text-xs text-muted-foreground">
              Enter the registered veterinary practitioner responsible for this clinic exactly as on the state veterinary council ID card.
            </p>
            <Field label="Doctor's Name (as on card) *" value={form.doctorName} onChange={(v) => set("doctorName", v)} placeholder="Dr. Makarand Mukund Dixit" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Council Regn. No. *" value={form.doctorRegNo} onChange={(v) => set("doctorRegNo", v)} placeholder="MSVC-8648/2011" />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#001d39]">Valid Upto *</label>
                <input
                  type="date"
                  min={today}
                  value={form.doctorRegValidUpto}
                  onChange={(e) => set("doctorRegValidUpto", e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-white px-3 text-sm outline-none focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
                />
                {form.doctorRegValidUpto && form.doctorRegValidUpto <= today && (
                  <p className="text-[0.65rem] text-destructive">This registration has expired — it must be valid after today.</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#001d39]">Veterinary Council *</label>
              <input
                list="vet-councils"
                value={form.doctorCouncil}
                onChange={(e) => set("doctorCouncil", e.target.value)}
                className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-white px-3 text-sm outline-none focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
              />
              <datalist id="vet-councils">{COUNCILS.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <Field label="Qualification" value={form.doctorQualification || ""} onChange={(v) => set("doctorQualification", v)} placeholder="BVSc & AH, MVSc" />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#001d39]">Council Identity Card (photo / scan) *</label>
              <input
                ref={idCardInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleIdCardPick(e.target.files?.[0])}
              />
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                  {form.doctorIdCardDataUri ? (
                    <img src={form.doctorIdCardDataUri} alt="ID card preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="size-5 text-slate-300" />
                  )}
                </div>
                <button
                  type="button"
                  disabled={idCardProcessing}
                  onClick={() => idCardInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#bcd0e2] px-3 h-10 text-sm font-semibold text-[#001d39] hover:bg-[#eaf3fa] disabled:opacity-50"
                >
                  <Upload className="size-3.5" />
                  {idCardProcessing ? "Processing…" : form.doctorIdCardDataUri ? "Replace card" : "Upload ID card"}
                </button>
              </div>
              <p className="text-[0.65rem] text-muted-foreground">Used only to verify the practitioner. Each council registration number can be linked to one clinic.</p>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(1)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#bcd0e2] px-5 text-sm font-bold text-[#001d39] hover:bg-[#eaf3fa]">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={!canContinueDoctor}
                onClick={() => setStep(3)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,65,116,0.25)] hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#001d39]">Clinic Logo</label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="size-6 text-slate-300" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleLogoPick(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={logoProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#bcd0e2] px-3 h-10 text-sm font-semibold text-[#001d39] hover:bg-[#eaf3fa] disabled:opacity-50"
                  >
                    <Upload className="size-3.5" />
                    {logoProcessing ? "Processing…" : logoPreview ? "Change logo" : "Upload logo"}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => { setLogoPreview(null); set("logoDataUri", undefined); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="inline-flex items-center gap-1 text-[0.68rem] text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[0.65rem] text-muted-foreground">PNG or JPG. Auto-resized — shows on your dashboard, invoices, and prescriptions.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Tagline" value={form.tagline || ""} onChange={(v) => set("tagline", v)} placeholder="Caring for your pets, always" />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#001d39]">Brand Colour</label>
                <div className="flex items-center gap-2 h-8">
                  <input
                    type="color"
                    value={form.primaryColor || "#2563eb"}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="h-8 w-10 rounded border border-input cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground font-mono">{form.primaryColor}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-[0.68rem] font-semibold text-foreground">Facilities</p>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={form.hasBoardingFacility ?? true}
                  onChange={(e) => set("hasBoardingFacility", e.target.checked)}
                  className="size-3.5 rounded border-input text-primary focus:ring-primary"
                />
                <span>We offer pet boarding</span>
              </label>
              {form.hasBoardingFacility && (
                <div className="pl-5">
                  <Field
                    label="Kennel Capacity"
                    value={String(form.kennelCapacity ?? 20)}
                    onChange={(v) => set("kennelCapacity", Number(v.replace(/\D/g, "")) || 0)}
                    placeholder="20"
                  />
                </div>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={form.hasSwimmingPool ?? false}
                  onChange={(e) => set("hasSwimmingPool", e.target.checked)}
                  className="size-3.5 rounded border-input text-primary focus:ring-primary"
                />
                <span>We offer pet swimming / hydrotherapy</span>
              </label>
            </div>

            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(2)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#bcd0e2] px-5 text-sm font-bold text-[#001d39] hover:bg-[#eaf3fa]">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,65,116,0.25)] hover:brightness-110 active:scale-[0.99]"
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <p className="text-xs text-muted-foreground">This account becomes the clinic's administrator.</p>
            <Field label="Full Name *" value={form.adminFullName} onChange={(v) => set("adminFullName", v)} placeholder="Dr. Jane Doe" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Admin Email *" value={form.adminEmail} onChange={(v) => set("adminEmail", v.toLowerCase().replace(/\s/g, ""))} placeholder="you@example.com" type="email" inputMode="email" autoComplete="email" error={emailError(form.adminEmail)} />
              <Field label="Mobile Number" value={form.adminPhone || ""} onChange={(v) => set("adminPhone", digits(v, 10))} placeholder="98765 43210" prefix="+91" type="tel" inputMode="numeric" autoComplete="tel-national" error={phoneError(form.adminPhone || "", false)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Password *" value={form.adminPassword} onChange={(v) => set("adminPassword", v)} placeholder="••••••••" type="password" />
              <Field label="Confirm Password *" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" type="password" />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(4)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#bcd0e2] px-5 text-sm font-bold text-[#001d39] hover:bg-[#eaf3fa]">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={openConfirm}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] text-sm font-bold text-white shadow-[0_4px_14px_rgba(10,65,116,0.25)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>Review & Create Clinic <ArrowRight className="size-3.5" /></>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md rounded-3xl border-[#bcd0e2]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#001d39]">Confirm your plan</DialogTitle>
            <DialogDescription>Check the plan for your clinic before we create the workspace.</DialogDescription>
          </DialogHeader>
          {(() => {
            const chosen = PLANS.find((p) => p.id === form.planId) ?? PLANS[0]!;
            const pro = PLANS.find((p) => p.id === "plan_professional")!;
            const isPro = form.planId === "plan_professional";
            return (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#0a4174] bg-[#eaf3fa] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#001d39]">{chosen.name}</span>
                    <span className="text-sm font-bold text-[#0a4174]">{isPro ? "Paid ✓" : chosen.price}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#4d6a86]">{chosen.blurb}</p>
                </div>
                {!isPro && (
                  <div className="rounded-2xl border border-[#bcd0e2] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#001d39]">Upgrade to {pro.name}</span>
                      <span className="text-xs font-bold text-[#0a4174]">{pro.price}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#4d6a86]">{pro.blurb}</p>
                    <PayButton
                      className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-[#0a4174] text-sm font-bold text-[#0a4174] hover:bg-[#eaf3fa]"
                      label="Upgrade to Pro: pay ₹2,360"
                      onMessage={setPayMsg}
                      onPaid={(id) => {
                        setForm((f) => ({ ...f, planId: "plan_professional", paymentId: id }));
                        setPayMsg("");
                      }}
                    />
                    {payMsg && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{payMsg}</p>}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} className="h-11 rounded-xl border border-[#bcd0e2] px-5 text-sm font-bold text-[#001d39] hover:bg-[#eaf3fa]">
              Go back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] px-5 text-sm font-bold text-white hover:brightness-110"
            >
              Confirm & create clinic
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", prefix, error, ...rest
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  prefix?: string; error?: string | null;
  inputMode?: "numeric" | "email" | "tel" | "text"; autoComplete?: string; maxLength?: number;
}) {
  const bad = !!error && value !== "";
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-[#001d39]">{label}</label>
      <div
        className={cn(
          "flex h-10 w-full items-center overflow-hidden rounded-xl border bg-white focus-within:ring-2",
          bad ? "border-red-400 focus-within:ring-red-200" : "border-[#bcd0e2] focus-within:border-[#0a4174] focus-within:ring-[#7bbde8]/40",
        )}
      >
        {prefix && <span className="flex h-full items-center border-r border-[#bcd0e2] bg-[#eaf3fa] px-3 text-sm font-semibold text-[#4d6a86]">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={bad}
          className="h-full w-full bg-transparent px-3 text-sm outline-none"
          {...rest}
        />
      </div>
      {bad && <p className="text-[0.7rem] font-medium text-red-600">{error}</p>}
    </div>
  );
}
