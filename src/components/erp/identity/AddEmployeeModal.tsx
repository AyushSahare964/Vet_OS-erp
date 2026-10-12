import { useState, useId, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  Mail,
  Lock,
  Phone,
  Shield,
  Building2,
  Award,
  Sparkles,
  Stethoscope,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  FileBadge,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthService } from "@/lib/erp/auth";
import { useErp } from "@/lib/erp/store";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { ROLES, type RoleId } from "@/lib/erp/config";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (employee: any) => void;
}

type SpecialtyType = "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";

const ROLE_PRESETS: Record<
  RoleId,
  {
    department: string;
    specialty: SpecialtyType;
    label: string;
    icon: typeof Stethoscope;
    badgeColor: string;
  }
> = {
  doctor: {
    department: "Clinical OPD & Surgery",
    specialty: "Canine",
    label: "Doctor / Senior Vet (Clinical Practice)",
    icon: Stethoscope,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
  },
  admin: {
    department: "Veterinary Administration",
    specialty: "Administration",
    label: "Clinic Administrator (Full Control)",
    icon: Shield,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300",
  },
  reception: {
    department: "Patient Admittance & Triage",
    specialty: "General Practice",
    label: "Receptionist & Triage Lead",
    icon: Briefcase,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  accounts: {
    department: "Finance, Billing & Taxation",
    specialty: "Administration",
    label: "Accounts & Billing Manager",
    icon: Award,
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300",
  },
  platform: {
    department: "Platform Systems Administration",
    specialty: "Administration",
    label: "Platform Systems Administrator",
    icon: Sparkles,
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

function generateSecurePassword(): string {
  const words = ["Alpha", "Paws", "VetOS", "Care", "Flora", "Nova", "Pulse", "Helix", "Zenith", "Breeze"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const specials = ["@", "!", "#", "$", "%", "*"];
  const special = specials[Math.floor(Math.random() * specials.length)];
  return `${word}${special}${num}`;
}

function calculatePasswordStrength(pass: string): {
  score: number; // 0 - 4
  label: "Very Weak" | "Weak" | "Fair" | "Strong";
  color: string;
  hasMinLen: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
} {
  const hasMinLen = pass.length >= 8;
  const hasUpper = /[A-Z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[^A-Za-z0-9]/.test(pass);

  let score = 0;
  if (pass.length >= 6) score += 1;
  if (hasMinLen) score += 1;
  if (hasUpper && hasNumber) score += 1;
  if (hasSpecial) score += 1;

  let label: "Very Weak" | "Weak" | "Fair" | "Strong" = "Very Weak";
  let color = "bg-rose-500";

  if (score === 1) {
    label = "Weak";
    color = "bg-rose-500";
  } else if (score === 2) {
    label = "Fair";
    color = "bg-amber-500";
  } else if (score >= 3) {
    label = "Strong";
    color = "bg-emerald-500";
  }

  return { score, label, color, hasMinLen, hasUpper, hasNumber, hasSpecial };
}

export function AddEmployeeModal({ open, onClose, onAdded }: Props) {
  const { currentUser, clinicBranding } = useErp();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // Dynamic tenant / campus defaults
  const activeHospital = useMemo(() => {
    return (
      clinicBranding?.clinicName ||
      currentUser?.clinicName ||
      CLINIC_CONFIG.clinicName ||
      "Harmony Pet Super-Specialty Hospital"
    );
  }, [clinicBranding, currentUser]);

  const activeBranch = useMemo(() => {
    return currentUser?.branch || "Central Hospital Campus";
  }, [currentUser]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "Password@123",
    phone: "",
    roleId: "doctor" as RoleId,
    department: ROLE_PRESETS.doctor.department,
    specialty: ROLE_PRESETS.doctor.specialty,
    licenseNumber: "",
    qualification: "",
    clinicName: activeHospital,
    branch: activeBranch,
  });

  // Re-sync hospital name if clinic branding or tenant changes
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      clinicName: activeHospital,
      branch: activeBranch,
    }));
  }, [activeHospital, activeBranch]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({
        fullName: "",
        email: "",
        password: generateSecurePassword(),
        phone: "",
        roleId: "doctor",
        department: ROLE_PRESETS.doctor.department,
        specialty: ROLE_PRESETS.doctor.specialty,
        licenseNumber: "",
        qualification: "",
        clinicName: activeHospital,
        branch: activeBranch,
      });
      setShowPassword(false);
      setCopiedPass(false);
    }
  }, [open, activeHospital, activeBranch]);

  const passwordAnalysis = useMemo(
    () => calculatePasswordStrength(form.password),
    [form.password]
  );

  if (!open) return null;

  const handleRoleChange = (newRole: RoleId) => {
    const preset = ROLE_PRESETS[newRole] || ROLE_PRESETS.doctor;
    setForm((prev) => ({
      ...prev,
      roleId: newRole,
      department: preset.department,
      specialty: preset.specialty,
    }));
  };

  const handleGeneratePassword = () => {
    const newPass = generateSecurePassword();
    setForm((prev) => ({ ...prev, password: newPass }));
    setShowPassword(true);
    toast.info("Generated high-entropy temporary password.");
  };

  const handleCopyPassword = () => {
    if (!form.password) return;
    navigator.clipboard.writeText(form.password);
    setCopiedPass(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim().toLowerCase();
    const trimmedPassword = form.password.trim();

    if (!trimmedName || trimmedName.length < 2) {
      toast.error("Please enter a valid staff full name (min 2 characters).");
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please provide a valid staff email address.");
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        fullName: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        phone: form.phone.trim() || undefined,
        roleId: form.roleId,
        department: form.department.trim() || ROLE_PRESETS[form.roleId].department,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber.trim() || undefined,
        qualification: form.qualification.trim() || undefined,
        clinicName: form.clinicName || activeHospital,
        branch: form.branch || activeBranch,
      };

      const res = await AuthService.createStaffMember(payload);
      if (res.success) {
        toast.success(res.message || `Employee ${trimmedName} successfully authorized!`);
        onAdded(res.user || payload);
        onClose();
      } else {
        toast.error(res.message || "Failed to create staff member.");
      }
    } catch (err: any) {
      console.error("Error creating staff record:", err);
      toast.error(err?.message || "Error creating staff record in database.");
    } finally {
      setLoading(false);
    }
  };

  const activePreset = ROLE_PRESETS[form.roleId] || ROLE_PRESETS.doctor;
  const RoleIcon = activePreset.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl rounded-2xl bg-white border border-border shadow-2xl overflow-hidden dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-50/90 px-6 py-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
                <UserPlus className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-navy dark:text-white">
                    Add New Hospital Employee
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                    <Sparkles className="size-3 text-primary animate-pulse" />
                    Instant Authorized Access
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct administrative creation into <span className="font-semibold text-foreground">{activeHospital}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {/* Row 1: Full Name & Work Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Full Name <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground pointer-events-none">
                    <UserPlus className="size-3.5" />
                  </span>
                  <Input
                    required
                    placeholder="e.g. Dr. Rajesh Mehra"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="h-9 pl-9 text-xs focus-visible:ring-primary font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Staff Work Email <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground pointer-events-none">
                    <Mail className="size-3.5" />
                  </span>
                  <Input
                    type="email"
                    required
                    placeholder="rajesh.mehra@vetos.cloud"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-9 pl-9 text-xs font-mono focus-visible:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Enhanced Password Field with Generator, Copy & Strength */}
            <div className="rounded-xl border border-border/80 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  <span>Initial Temporary Password <span className="text-rose-500">*</span></span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 text-[11px] font-bold transition-colors"
                    title="Generate a random secure temporary password"
                  >
                    <RefreshCw className="size-3" />
                    <span>Generate Secure</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card hover:bg-muted text-foreground px-2 py-1 text-[11px] font-semibold transition-colors"
                    title="Copy password to send to employee"
                  >
                    {copiedPass ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copiedPass ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Min 6 characters (e.g. Paws@2026)"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-9 pr-10 text-xs font-mono tracking-wider focus-visible:ring-primary bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground font-medium">Strength:</span>
                  <span className={cn(
                    "font-bold",
                    passwordAnalysis.score >= 3 ? "text-emerald-600 dark:text-emerald-400" :
                    passwordAnalysis.score === 2 ? "text-amber-600 dark:text-amber-400" : "text-rose-500"
                  )}>
                    {passwordAnalysis.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-300", passwordAnalysis.score >= 1 ? passwordAnalysis.color : "bg-transparent")} />
                  <div className={cn("h-full rounded-full transition-all duration-300", passwordAnalysis.score >= 2 ? passwordAnalysis.color : "bg-transparent")} />
                  <div className={cn("h-full rounded-full transition-all duration-300", passwordAnalysis.score >= 3 ? passwordAnalysis.color : "bg-transparent")} />
                  <div className={cn("h-full rounded-full transition-all duration-300", passwordAnalysis.score >= 4 ? passwordAnalysis.color : "bg-transparent")} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-muted-foreground">
                  <span className={cn("flex items-center gap-1", passwordAnalysis.hasMinLen ? "text-emerald-600 font-medium" : "")}>
                    {passwordAnalysis.hasMinLen ? <CheckCircle2 className="size-2.5" /> : "•"} 8+ chars
                  </span>
                  <span className={cn("flex items-center gap-1", passwordAnalysis.hasUpper ? "text-emerald-600 font-medium" : "")}>
                    {passwordAnalysis.hasUpper ? <CheckCircle2 className="size-2.5" /> : "•"} Uppercase
                  </span>
                  <span className={cn("flex items-center gap-1", passwordAnalysis.hasNumber ? "text-emerald-600 font-medium" : "")}>
                    {passwordAnalysis.hasNumber ? <CheckCircle2 className="size-2.5" /> : "•"} Number
                  </span>
                  <span className={cn("flex items-center gap-1", passwordAnalysis.hasSpecial ? "text-emerald-600 font-medium" : "")}>
                    {passwordAnalysis.hasSpecial ? <CheckCircle2 className="size-2.5" /> : "•"} Symbol
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: Role & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Assigned Role <span className="text-rose-500">*</span></span>
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border", activePreset.badgeColor)}>
                    <RoleIcon className="size-2.5" />
                    {ROLES[form.roleId]?.name.split(" ")[0]}
                  </span>
                </label>
                <select
                  value={form.roleId}
                  onChange={(e) => handleRoleChange(e.target.value as RoleId)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary font-semibold text-foreground shadow-2xs"
                >
                  <option value="doctor">🩺 Doctor / Senior Vet (Clinical Practice)</option>
                  <option value="admin">🛡️ Clinic Administrator (Full Control)</option>
                  <option value="reception">📋 Receptionist & Triage Lead</option>
                  <option value="accounts">💳 Accounts & Billing Manager</option>
                  <option value="platform">⚡ Platform Systems Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Department
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground pointer-events-none">
                    <Building2 className="size-3.5" />
                  </span>
                  <Input
                    placeholder="e.g. Clinical OPD & Surgery"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="h-9 pl-9 text-xs focus-visible:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Phone & Qualifications */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Contact Phone</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground pointer-events-none">
                    <Phone className="size-3.5" />
                  </span>
                  <Input
                    placeholder="+91 98000 12345"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-9 pl-9 text-xs font-mono focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Qualifications / Degrees
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-muted-foreground pointer-events-none">
                    <Award className="size-3.5" />
                  </span>
                  <Input
                    placeholder="e.g. BVSc & AH, MVSc (Orthopedics)"
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="h-9 pl-9 text-xs focus-visible:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Row 5: VCI License & Specialty Focus */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileBadge className="size-3.5 text-muted-foreground" />
                  <span>VCI / License Registration No.</span>
                </label>
                <Input
                  placeholder="e.g. VCI-KAR-2024-9182"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  className="h-9 text-xs font-mono focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Specialty Focus</label>
                <select
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value as SpecialtyType })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary text-foreground shadow-2xs"
                >
                  <option value="Canine">Canine</option>
                  <option value="Feline">Feline</option>
                  <option value="Surgery">Surgery & Ortho</option>
                  <option value="Avian">Avian / Exotic</option>
                  <option value="General Practice">General Practice</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>
            </div>

            {/* Row 6: Dynamic Hospital Campus & Branch Display */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-navy dark:text-white leading-tight">
                    {form.clinicName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Branch: {form.branch}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold">
                Active Tenant Scoped
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 border-t border-border pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={onClose}
                className="h-9 text-xs font-semibold px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-xs px-6 shadow-sm flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving to Database…</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Create & Authorize Employee</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
