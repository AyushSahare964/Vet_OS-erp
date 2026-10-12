import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Stethoscope, 
  UserCheck, 
  UserPlus, 
  ArrowRight,
  Database,
  Building2,
  Sparkles,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp/store";
import { AuthService, type RegisterPayload, type UserProfile } from "@/lib/erp/auth";
import { ROLES, type RoleId } from "@/lib/erp/config";
import { PetShowcase } from "@/components/erp/PetShowcase";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { cn } from "@/lib/utils";
import { requestPasswordResetFn } from "@/lib/mongodb/serverFns/auth";
import { doctorHeadLinks } from "@/components/doctor/doctorHead";
import { BrandChip } from "@/components/doctor/shared/BrandChip";

const COMMON_EMAIL_DOMAINS = ["@gmail.com", "@vetos.cloud", "@outlook.com", "@yahoo.com"];

/** Cleans and caps input strictly to a 10-digit mobile number, handling pasted +91, 0, or formatting */
function clean10DigitPhone(input: string): string {
  let raw = String(input || "").trim();
  if (raw.startsWith("+91")) {
    raw = raw.slice(3);
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "VetOS Cloud — Staff Sign In & Practice Onboarding" },
      {
        name: "description",
        content: "Professional veterinary clinic operator sign in and multi-tenant practice registration portal.",
      },
    ],
    links: doctorHeadLinks,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { login, register, currentUser, isAuthenticated, isLoadingAuth } = useErp();
  const [seeding, setSeeding] = useState(false);

  const [mode, setMode] = useState<"login" | "register" | "clinic" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot-password state
  const [fpSent, setFpSent] = useState(false);
  const [fpEmail, setFpEmail] = useState("");

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await requestPasswordResetFn({ data: { email: fpEmail.trim() } });
      if (res.success) setFpSent(true);
      else toast.error(res.message);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Register state
  const [regData, setRegData] = useState<RegisterPayload>({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    clinicSlug: "",
    roleId: "doctor",
    licenseNumber: "",
    department: "Clinical Care",
    specialty: "General Practice",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!otpSent) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otpSent]);
  const fmt = (ms: number) => { const sec = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
  const resendIn = resendAt - now;
  const expiresIn = otpExpiresAt - now;
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const emailVerified = !!regData.email.trim() && regData.email.trim().toLowerCase() === verifiedEmail;

  // Redirect if already authenticated (wait for cookie hydration first)
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await AuthService.seedDemoUsers();
      toast.success(res.message);
    } catch {
      toast.error("Seed failed — check your MongoDB connection.");
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickLogin = async (staff: UserProfile & { _password?: string }) => {
    const pwd = staff._password || "12345678";
    setLoginEmail(staff.email);
    setLoginPassword(pwd);
    setLoading(true);
    try {
      let res = await (login ? login({ email: staff.email, password: pwd, rememberMe: true }) : AuthService.login({ email: staff.email, password: pwd, rememberMe: true }));
      if (!res.success && res.message?.includes("outside ErpProvider")) {
        res = await AuthService.login({ email: staff.email, password: pwd, rememberMe: true });
      }
      if (res.success) {
        toast.success(`Logged in as ${staff.fullName}`);
        navigate({ to: "/" });
      } else if (res.pendingApproval) {
        toast.info(res.message || "Your account is pending administrator approval.");
        try {
          sessionStorage.setItem("vetos.pending_user", JSON.stringify(res.user || staff));
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
      } else {
        toast.error(res.message || "Failed to sign in — ensure credentials are seeded in MongoDB");
      }
    } catch {
      toast.error("An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      let res = await (login ? login({ email: loginEmail, password: loginPassword, rememberMe }) : AuthService.login({ email: loginEmail, password: loginPassword, rememberMe }));
      if (!res.success && res.message?.includes("outside ErpProvider")) {
        res = await AuthService.login({ email: loginEmail, password: loginPassword, rememberMe });
      }

      if (res.success) {
        toast.success(res.message || "Login successful!");
        navigate({ to: "/" });
      } else if (res.pendingApproval) {
        toast.info(res.message || "Your account is awaiting clinic administrator approval.");
        try {
          sessionStorage.setItem("vetos.pending_user", JSON.stringify(res.user || { email: loginEmail }));
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
      } else {
        toast.error(res.message || "Invalid credentials.");
      }
    } catch (err: any) {
      console.error("[Login] error:", err);
      toast.error(err?.message || "Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const email = regData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid work email first.");
      return;
    }
    setLoading(true);
    try {
      const res = await AuthService.sendEmailOtp(email, regData.fullName);
      const t = Date.now();
      setNow(t);
      if (res.retryAfterSec) setResendAt(t + res.retryAfterSec * 1000);
      if (res.success) {
        toast.success(res.message);
        setOtpSent(true);
        setOtp("");
        setOtpExpiresAt(t + (res.expiresInSec ?? 600) * 1000);
      } else toast.error(res.message);
    } catch {
      toast.error("Could not send the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    setLoading(true);
    try {
      const res = await AuthService.confirmEmailOtp(regData.email.trim(), otp);
      if (res.success) {
        setVerifiedEmail(regData.email.trim().toLowerCase());
        setOtpSent(false);
        toast.success("Email verified!");
      } else toast.error(res.message);
    } catch {
      toast.error("Could not verify the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regData.fullName.trim() || !regData.email.trim() || !regData.password) {
      toast.error("Please fill in your name, email, and password.");
      return;
    }

    if (!emailVerified) {
      toast.error("Please verify your work email first.");
      return;
    }

    if (regData.password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!agreedTerms) {
      toast.error("Please accept the clinic data policy.");
      return;
    }

    setLoading(true);
    try {
      let res = await (register ? register(regData) : AuthService.register(regData));
      if (!res.success && res.message?.includes("outside ErpProvider")) {
        res = await AuthService.register(regData);
      }
      if (res.success || res.pendingApproval) {
        toast.success("Application submitted! Redirecting to preview...");
        try {
          sessionStorage.setItem("vetos.pending_user", JSON.stringify(res.user || { fullName: regData.fullName, email: regData.email, roleId: regData.roleId }));
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
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
      className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative selection:bg-[#7bbde8]/30 selection:text-[#001d39]"
      style={{
        backgroundColor: "#eaf3fa",
        backgroundImage: `radial-gradient(circle at 50% 12%, rgba(123, 189, 232, 0.28) 0%, transparent 55%), radial-gradient(circle at 85% 85%, rgba(10, 65, 116, 0.08) 0%, transparent 50%), url("/pattern/pets-pattern.svg")`,
        backgroundSize: "cover, cover, 280px 280px",
        backgroundRepeat: "no-repeat, no-repeat, repeat",
        fontFamily: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      
      {/* Brand Header above card */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 w-full max-w-4xl px-2">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#001d39] text-[#7bbde8] border border-[#bcd0e2] shadow-[0_4px_12px_rgba(0,29,57,0.12)] group-hover:scale-105 transition-transform">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">
                VetOS Cloud
              </span>
              <BrandChip />
            </div>
            <span className="block text-[0.72rem] text-[#4d6a86] font-medium leading-none">
              Veterinary Practice & Clinic Management
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2.5">
          {/* Quick Header CTA for Clinic Registration */}
          <Link
            to="/register-clinic"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#001d39] via-[#0a4174] to-[#001d39] px-3.5 py-2 rounded-xl border border-[#bcd0e2] shadow-[0_4px_14px_rgba(10,65,116,0.2)] hover:shadow-[0_6px_20px_rgba(10,65,116,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            <Building2 className="size-3.5 text-[#7bbde8]" />
            <span>Register New Clinic</span>
            <ArrowRight className="size-3 text-[#7bbde8]" />
          </Link>

          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            title="Seed demo staff users into MongoDB Atlas"
            className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-emerald-700 bg-white/90 border border-emerald-300 px-3 py-2 rounded-xl shadow-2xs hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            <Database className="size-3 text-emerald-600" />
            {seeding ? "Seeding…" : "Atlas DB"}
          </button>
        </div>
      </div>

      {/* Main Centered Professional Action Card */}
      <div className="w-full max-w-4xl rounded-3xl bg-white border border-[#bcd0e2] shadow-[0_20px_50px_rgba(0,29,57,0.12),0_1px_3px_rgba(0,29,57,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* LEFT COLUMN: CONTINUOUS PET ANIMATION SLIDER PREVIEW */}
        <div className="hidden md:block md:col-span-5 lg:col-span-5 border-r border-[#d3e2ef]">
          <PetShowcase />
        </div>

        {/* RIGHT COLUMN: ACTION WINDOW */}
        <div className="md:col-span-7 lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div className="space-y-4">
            
            {/* 3-Way Segmented Control */}
            <div className="flex rounded-xl bg-[#eaf3fa] p-1 border border-[#bcd0e2] w-full gap-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all",
                  mode === "login"
                    ? "bg-[#001d39] text-[#7bbde8] shadow-xs"
                    : "text-[#4d6a86] hover:text-[#001d39] hover:bg-white/60"
                )}
              >
                <UserCheck className="size-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all",
                  mode === "register"
                    ? "bg-[#001d39] text-[#7bbde8] shadow-xs"
                    : "text-[#4d6a86] hover:text-[#001d39] hover:bg-white/60"
                )}
              >
                <UserPlus className="size-3.5" />
                Staff Join
              </button>
              <button
                type="button"
                onClick={() => setMode("clinic")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all",
                  mode === "clinic"
                    ? "bg-gradient-to-r from-[#0a4174] to-[#001d39] text-white shadow-xs"
                    : "text-[#0a4174] hover:text-[#001d39] hover:bg-white/60 font-extrabold"
                )}
              >
                <Building2 className="size-3.5" />
                Clinic Setup
              </button>
            </div>

            {/* TAB: SIGN IN */}
            {mode === "login" ? (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-extrabold text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">
                      Welcome back
                    </h1>
                    <p className="text-xs text-[#4d6a86]">
                      Sign in to access clinical modules, OPD triage, and patient records.
                    </p>
                  </div>
                </div>

                {/* Quick Option for Clinic Registration */}
                <div className="rounded-xl border border-[#bcd0e2] bg-gradient-to-r from-[#f0f6fc] via-[#e7f1f9] to-[#f0f6fc] p-2.5 flex items-center justify-between gap-2.5 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#001d39] text-[#7bbde8] shadow-xs">
                      <Building2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#001d39] truncate">Opening a New Clinic or Practice?</p>
                      <p className="text-[0.68rem] text-[#4d6a86] truncate">Launch your isolated multi-tenant ERP in 2 minutes</p>
                    </div>
                  </div>
                  <Link
                    to="/register-clinic"
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#0a4174] hover:bg-[#001d39] text-white px-2.5 py-1.5 text-xs font-bold shadow-xs transition-all hover:scale-105 active:scale-95"
                  >
                    <span>Register</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#001d39]">Work Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#49769f]" />
                      <input
                        type="email"
                        required
                        list="login-email-suggestions"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        onBlur={() => {
                          if (loginEmail && !loginEmail.includes("@")) {
                            setLoginEmail(`${loginEmail}@gmail.com`);
                          }
                        }}
                        placeholder="staff@vetos.cloud"
                        className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] pl-9 pr-3 text-xs text-[#08233f] placeholder-[#7a93ab] outline-none transition-all focus:bg-white focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
                      />
                      <datalist id="login-email-suggestions">
                        {COMMON_EMAIL_DOMAINS.map((dom) => {
                          const username = loginEmail.split("@")[0] || "staff";
                          return <option key={dom} value={`${username}${dom}`} />;
                        })}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[#001d39]">Password</label>
                      <button
                        type="button"
                        onClick={() => { setFpEmail(loginEmail); setFpSent(false); setMode("forgot"); }}
                        className="text-[0.7rem] text-[#0a4174] font-bold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#49769f]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] pl-9 pr-9 text-xs text-[#08233f] outline-none transition-all focus:bg-white focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4d6a86] hover:text-[#001d39]"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#4d6a86] select-none font-medium">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="size-3.5 rounded border-[#bcd0e2] text-[#0a4174] focus:ring-[#7bbde8]"
                      />
                      <span>Remember session</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] to-[#0a4174] text-xs font-bold text-white shadow-md shadow-[#001d39]/15 hover:from-[#0a4174] hover:to-[#001d39] hover:shadow-lg hover:shadow-[#0a4174]/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>

              </div>
            ) : mode === "clinic" ? (
              /* TAB: CLINIC REGISTRATION QUICK LAUNCHER */
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd0e2] bg-[#eaf3fa] px-2.5 py-0.5 text-[0.68rem] font-bold text-[#0a4174] mb-1.5">
                    <Sparkles className="size-3 text-[#0a4174]" />
                    <span>Multi-Tenant Practice Onboarding</span>
                  </div>
                  <h1 className="text-xl font-extrabold text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">
                    Register Your Veterinary Clinic
                  </h1>
                  <p className="text-xs text-[#4d6a86] mt-0.5">
                    Launch an isolated, cloud-hosted VetOS ERP workspace with OPD consultation triage, live Rx inventory, and WhatsApp integration.
                  </p>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-[#d3e2ef] bg-[#f8fbfe] p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="size-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div className="text-xs">
                      <strong className="text-[#001d39]">Dedicated Tenant Isolation:</strong>
                      <span className="text-[#4d6a86] ml-1">Your patients, inventory, and accounts remain strictly private to your clinic.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="size-5 rounded-full bg-blue-100 text-[#0a4174] flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div className="text-xs">
                      <strong className="text-[#001d39]">Complete Clinical Suite:</strong>
                      <span className="text-[#4d6a86] ml-1">Appointments, OPD queue, digital prescriptions, lab reports, and billing.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="size-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div className="text-xs">
                      <strong className="text-[#001d39]">3-Minute Setup:</strong>
                      <span className="text-[#4d6a86] ml-1">Configure your clinic details, choose a plan, and invite your doctors immediately.</span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/register-clinic"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] to-[#0a4174] text-xs font-bold text-white shadow-md shadow-[#001d39]/15 hover:from-[#0a4174] hover:to-[#001d39] hover:shadow-lg hover:shadow-[#0a4174]/25 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  <Building2 className="size-4 text-[#7bbde8]" />
                  <span>Start 4-Step Clinic Registration</span>
                  <ArrowRight className="size-4 text-[#7bbde8]" />
                </Link>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs font-bold text-[#0a4174] hover:underline"
                  >
                    Already have a clinic workspace? Sign in here →
                  </button>
                </div>
              </div>
            ) : mode === "forgot" ? (
              /* TAB: FORGOT PASSWORD */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">Reset password</h1>
                  <p className="text-xs text-[#4d6a86]">
                    {fpSent
                      ? `If ${fpEmail} belongs to a staff account, a reset link is on its way. It expires in 30 minutes.`
                      : "Enter your staff email and we'll send you a secure reset link."}
                  </p>
                </div>
                {!fpSent && (
                  <form onSubmit={handleForgotSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-[#001d39]">Email</label>
                      <input
                        type="email"
                        required
                        list="fp-email-suggestions"
                        value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        onBlur={() => {
                          if (fpEmail && !fpEmail.includes("@")) {
                            setFpEmail(`${fpEmail}@gmail.com`);
                          }
                        }}
                        placeholder="staff@vetos.cloud"
                        className="h-10 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-3 text-xs text-[#08233f] outline-none focus:bg-white focus:border-[#0a4174] focus:ring-2 focus:ring-[#7bbde8]/40"
                      />
                      <datalist id="fp-email-suggestions">
                        {COMMON_EMAIL_DOMAINS.map((dom) => {
                          const username = fpEmail.split("@")[0] || "staff";
                          return <option key={dom} value={`${username}${dom}`} />;
                        })}
                      </datalist>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] to-[#0a4174] text-xs font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all shadow-md"
                    >
                      {loading ? "Please wait…" : "Send reset link"}
                    </button>
                  </form>
                )}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setFpSent(false); }}
                  className="w-full text-center text-xs font-bold text-[#0a4174] hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              /* TAB: CREATE OPERATOR PROFILE */
              <div className="space-y-3 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-xl font-extrabold text-[#001d39] font-['Bricolage_Grotesque',system-ui,sans-serif]">Create Staff Profile</h1>
                  <p className="text-xs text-[#4d6a86]">
                    Join your clinic's existing VetOS Cloud workspace as staff.
                  </p>
                  <p className="text-xs text-[#4d6a86] mt-0.5">
                    New clinic?{" "}
                    <button type="button" onClick={() => setMode("clinic")} className="text-[#0a4174] font-bold hover:underline">
                      Register your clinic instead →
                    </button>
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={regData.fullName}
                        onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                        placeholder="Dr. Rajesh Mehra"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Work Email *</label>
                      <div className="flex gap-1">
                        <input
                          type="email"
                          required
                          list="reg-email-suggestions"
                          value={regData.email}
                          onChange={(e) => {
                            const formatted = e.target.value.toLowerCase().replace(/\s/g, "");
                            setRegData({ ...regData, email: formatted });
                            setOtpSent(false);
                          }}
                          onBlur={() => {
                            if (regData.email && !regData.email.includes("@")) {
                              setRegData({ ...regData, email: `${regData.email}@gmail.com` });
                            }
                          }}
                          placeholder="rajesh@clinic.com"
                          className="h-8.5 min-w-0 flex-1 rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                        />
                        {emailVerified ? (
                          <span className="inline-flex h-8.5 items-center rounded-xl bg-emerald-50 px-2 text-[0.68rem] font-bold text-emerald-700">✓ Verified</span>
                        ) : (
                          <button type="button" onClick={handleSendOtp} disabled={loading || otpSent || !regData.email.trim()} className="h-8.5 rounded-xl bg-[#0a4174] px-2.5 text-[0.68rem] font-bold text-white disabled:opacity-60">
                            {otpSent ? "Sent" : "Verify"}
                          </button>
                        )}
                      </div>
                      <datalist id="reg-email-suggestions">
                        {COMMON_EMAIL_DOMAINS.map((dom) => {
                          const prefix = regData.email.split("@")[0] || (regData.fullName ? regData.fullName.toLowerCase().replace(/^dr\.?\s*/i, "").replace(/[^a-z0-9]+/g, ".") : "doctor");
                          return <option key={dom} value={`${prefix}${dom}`} />;
                        })}
                      </datalist>
                    </div>
                  </div>

                  {otpSent && !emailVerified && (
                    <div className="space-y-1.5 rounded-xl border border-[#bcd0e2] bg-[#eef6fc] p-2.5">
                      <p className="text-[0.68rem] text-[#001d39]">Enter the 6-digit code we emailed to <b>{regData.email}</b></p>
                      <div className="flex items-center gap-1.5">
                        <input
                          inputMode="numeric"
                          autoFocus
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                          placeholder="••••••"
                          className="h-8 w-28 rounded-lg border border-[#bcd0e2] bg-white px-2 text-center text-sm font-mono tracking-[0.35em] outline-none focus:border-[#0a4174]"
                        />
                        <button type="button" onClick={handleConfirmOtp} disabled={loading || otp.length !== 6 || expiresIn <= 0} className="h-8 rounded-lg bg-[#001d39] px-3 text-[0.68rem] font-bold text-[#7bbde8] disabled:opacity-60">
                          Confirm
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[0.65rem] text-[#4d6a86]">
                        <span>{expiresIn > 0 ? `Code expires in ${fmt(expiresIn)}` : "Code expired — request a new one"}</span>
                        {resendIn > 0 ? (
                          <span>Resend in {fmt(resendIn)}</span>
                        ) : (
                          <button type="button" onClick={handleSendOtp} disabled={loading} className="font-bold text-[#0a4174] hover:underline disabled:opacity-60">Resend code</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Phone Number (10 digits)</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={regData.phone || ""}
                        onKeyDown={(e) => {
                          if (
                            !/[0-9]/.test(e.key) &&
                            !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key) &&
                            !e.ctrlKey &&
                            !e.metaKey
                          ) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const clean = clean10DigitPhone(e.target.value);
                          setRegData({ ...regData, phone: clean });
                        }}
                        placeholder="9876543210"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174] font-mono tracking-wide"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Clinic Identifier *</label>
                      <input
                        type="text"
                        required
                        value={regData.clinicSlug}
                        onChange={(e) => setRegData({ ...regData, clinicSlug: e.target.value })}
                        placeholder="your_clinic_slug"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Password *</label>
                      <input
                        type="password"
                        required
                        value={regData.password}
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                        placeholder="••••••••"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Confirm Password *</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">Requested Role</label>
                      <select
                        value={regData.roleId}
                        onChange={(e) => setRegData({ ...regData, roleId: e.target.value as RoleId })}
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2 text-xs outline-none focus:bg-white focus:border-[#0a4174] font-medium"
                      >
                        <option value="doctor">🩺 Doctor / Senior Vet</option>
                        <option value="admin">🛡️ Clinic Admin</option>
                        <option value="reception">📋 Reception & Triage</option>
                        <option value="accounts">💳 Accounts & Billing</option>
                        <option value="platform">⚡ Platform Administrator</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-bold text-[#001d39]">License / VCI Reg No.</label>
                      <input
                        type="text"
                        value={regData.licenseNumber}
                        onChange={(e) => setRegData({ ...regData, licenseNumber: e.target.value })}
                        placeholder="VCI-KAR-2024-881"
                        className="h-8.5 w-full rounded-xl border border-[#bcd0e2] bg-[#f8fbfe] px-2.5 text-xs outline-none focus:bg-white focus:border-[#0a4174]"
                      />
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[0.68rem] text-[#4d6a86] select-none">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="size-3.5 rounded border-[#bcd0e2] text-[#0a4174] focus:ring-[#7bbde8]"
                      />
                      <span>I agree to clinic data policy</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#001d39] to-[#0a4174] text-xs font-bold text-white shadow-md shadow-[#001d39]/15 hover:from-[#0a4174] hover:to-[#001d39] hover:shadow-lg hover:shadow-[#0a4174]/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Create Operator Account</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Bottom Card Footer */}
          <div className="mt-4 pt-3 border-t border-[#d3e2ef] flex items-center justify-between text-[0.68rem] text-[#4d6a86]">
            {isAuthenticated && currentUser ? (
              <>
                <span>Signed in as <strong className="text-[#001d39]">{currentUser.fullName}</strong></span>
                <Link to="/" className="text-[#0a4174] font-bold hover:underline">
                  Launch Console →
                </Link>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 font-medium">
                  <Building2 className="size-3 text-[#0a4174]" />
                  <span>VetOS Multi-Tenant Architecture</span>
                </div>
                <span className="text-[#4d6a86]">MongoDB Atlas Connected</span>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Page Footer */}
      <p className="mt-5 text-[0.72rem] text-[#4d6a86] font-medium text-center">
        By signing in or registering you agree to the VetOS Clinic Compliance & Multi-Tenant Data Policy
      </p>
    </div>
  );
}
