import { useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Building2, ArrowRight, ArrowLeft, Check, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp/store";
import type { RegisterTenantPayload } from "@/lib/erp/auth";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register-clinic")({
  head: () => ({
    meta: [{ title: "Register Your Clinic — VetOS Cloud" }],
  }),
  component: RegisterClinicPage,
});

const PLANS: Array<{ id: RegisterTenantPayload["planId"]; name: string; price: string; blurb: string; highlights: string[] }> = [
  {
    id: "plan_basic",
    name: "Basic",
    price: "₹999/mo",
    blurb: "CRM, appointments, billing, clinical records, basic inventory.",
    highlights: ["Up to 5 staff", "Up to 500 pets"],
  },
  {
    id: "plan_professional",
    name: "Professional",
    price: "₹2,499/mo",
    blurb: "Everything in Basic, plus laboratory, pharmacy, boarding, accounting, reports.",
    highlights: ["Up to 20 staff", "Up to 5,000 pets"],
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    price: "₹5,999/mo",
    blurb: "Everything in Professional, plus nutrition management and unlimited scale.",
    highlights: ["Unlimited staff", "Unlimited pets"],
  },
];

const INDIAN_STATES = [
  "Maharashtra", "Karnataka", "Delhi", "Uttar Pradesh", "Gujarat", "Tamil Nadu",
  "West Bengal", "Rajasthan", "Telangana", "Kerala", "Punjab", "Haryana",
  "Madhya Pradesh", "Bihar", "Andhra Pradesh",
];

const STEP_LABELS = ["Clinic Details", "Branding", "Choose Plan", "Admin Account"] as const;
type Step = 1 | 2 | 3 | 4;

const MAX_LOGO_DIMENSION = 320;
const LOGO_JPEG_QUALITY = 0.85;

/** Resizes/compresses an image file client-side before it's sent to the server, so a
 * multi-MB phone photo doesn't turn into a multi-MB MongoDB document. */
function resizeImageToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
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
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoProcessing, setLogoProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<RegisterTenantPayload>({
    clinicName: "",
    legalName: "",
    clinicType: "Small Animal",
    vetCouncilRegNo: "",
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
    planId: "plan_professional",
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
    form.clinicName.trim() && form.address.trim() && form.city.trim() && form.pin.trim() && form.phone.trim() && form.email.trim();

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

  const handleSubmit = async () => {
    if (!form.adminFullName.trim() || !form.adminEmail.trim() || !form.adminPassword) {
      toast.error("Please fill in your name, email, and password.");
      return;
    }
    if (form.adminPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await registerTenant(form);
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
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between w-full max-w-2xl px-2">
        <Link to="/login" className="flex items-center gap-2.5 group">
          <img src={CLINIC_CONFIG.logoPath} alt="VetOS Cloud" className="h-10 w-auto object-contain" />
          <span className="text-base font-bold tracking-tight text-navy">VetOS Cloud</span>
        </Link>
        <Link to="/login" className="text-xs font-semibold text-primary hover:underline">
          Already have a clinic? Sign in →
        </Link>
      </div>

      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 overflow-hidden p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-5 text-primary" />
          <h1 className="text-lg font-bold text-navy">Register Your Clinic</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Get your own isolated VetOS Cloud workspace in minutes — no card required, 14-day free trial.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center text-[0.65rem] font-bold shrink-0",
                    step === n ? "bg-primary text-primary-foreground" : step > n ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400",
                  )}
                >
                  {step > n ? <Check className="size-3.5" /> : n}
                </div>
                <span className={cn("text-[0.62rem] font-medium hidden sm:inline", step === n ? "text-navy" : "text-muted-foreground")}>{label}</span>
                {n < 4 && <div className="h-px flex-1 bg-slate-200" />}
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
              <Field label="Phone *" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 98765 43210" />
              <Field label="WhatsApp Number" value={form.whatsappNumber || ""} onChange={(v) => set("whatsappNumber", v)} placeholder="Same as phone" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact Email *" value={form.email} onChange={(v) => set("email", v)} placeholder="clinic@example.com" type="email" />
              <Field label="Website" value={form.website || ""} onChange={(v) => set("website", v)} placeholder="www.yourclinic.com" />
            </div>
            <Field label="Address *" value={form.address} onChange={(v) => set("address", v)} placeholder="Street, area" />
            <div className="grid grid-cols-3 gap-2">
              <Field label="City *" value={form.city} onChange={(v) => set("city", v)} placeholder="Nagpur" />
              <div className="space-y-0.5">
                <label className="block text-[0.68rem] font-semibold text-foreground">State *</label>
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Field label="PIN *" value={form.pin} onChange={(v) => set("pin", v)} placeholder="440001" />
            </div>
            <Field label="Vet Council Registration No." value={form.vetCouncilRegNo || ""} onChange={(v) => set("vetCouncilRegNo", v)} placeholder="Optional" />
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
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-40 mt-2"
            >
              Continue <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="block text-[0.68rem] font-semibold text-foreground">Clinic Logo</label>
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 h-8 text-xs font-semibold text-foreground hover:bg-slate-50 disabled:opacity-50"
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
              <div className="space-y-0.5">
                <label className="block text-[0.68rem] font-semibold text-foreground">Brand Colour</label>
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
              <button type="button" onClick={() => setStep(1)} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-input px-4 text-xs font-bold text-foreground">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-[0.99]"
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => set("planId", plan.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-3.5 transition-all",
                  form.planId === plan.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-navy">{plan.name}</span>
                  <span className="text-sm font-bold text-primary">{plan.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.blurb}</p>
                <div className="flex gap-3 mt-1.5">
                  {plan.highlights.map((h) => (
                    <span key={h} className="text-[0.65rem] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{h}</span>
                  ))}
                </div>
              </button>
            ))}
            <p className="text-[0.68rem] text-muted-foreground text-center">14-day free trial on any plan — no payment needed to start.</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(2)} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-input px-4 text-xs font-bold text-foreground">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-[0.99]"
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
              <Field label="Admin Email *" value={form.adminEmail} onChange={(v) => set("adminEmail", v)} placeholder="you@example.com" type="email" />
              <Field label="Phone" value={form.adminPhone || ""} onChange={(v) => set("adminPhone", v)} placeholder="+91 98765 43210" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Password *" value={form.adminPassword} onChange={(v) => set("adminPassword", v)} placeholder="••••••••" type="password" />
              <Field label="Confirm Password *" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" type="password" />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setStep(3)} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-input px-4 text-xs font-bold text-foreground">
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>Create My Clinic <ArrowRight className="size-3.5" /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-0.5">
      <label className="block text-[0.68rem] font-semibold text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
      />
    </div>
  );
}
