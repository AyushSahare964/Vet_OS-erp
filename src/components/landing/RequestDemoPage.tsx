import { useState, type FormEvent } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { requestDemoFn } from "@/lib/mongodb/serverFns/demo";
import Logo from "./Logo";
import "./landing.css";

const SIZES = ["Solo doctor", "2–5 staff", "6–15 staff", "16+ staff / multiple branches"];

const EMPTY = { name: "", clinicName: "", email: "", phone: "", city: "", clinicSize: "", preferredTime: "", message: "", website: "" };

export function RequestDemoPage() {
  const { interest } = useSearch({ strict: false }) as { interest?: string };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      const res = await requestDemoFn({ data: { ...clean, ...(interest ? { interest } : {}) } as never });
      setDone(res.message);
    } catch {
      setError("Please check the details and try again. Name, clinic, a valid email, phone and city are required.");
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof EMPTY, label: string, props: Record<string, string | boolean> = {}) => (
    <label className="block text-sm font-semibold text-[#4A3E68]">
      {label}
      <input className="vx-field mt-1.5 font-normal" value={form[k]} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <main className="vx-page min-h-screen bg-gradient-to-br from-[#F1EAFF] to-[#FFEEF5] px-5 py-8 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" aria-label="VetechIQ home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <Link to="/pricing" className="btn-ghost rounded-full px-4 py-2 text-sm font-bold">Pricing</Link>
          <Link to="/login" className="btn-ghost rounded-full px-4 py-2 text-sm font-bold">Sign In</Link>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-[#EADBFA] bg-white p-7 shadow-soft md:p-10">
        {done ? (
          <div className="py-10 text-center" role="status">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#5B32E8]/70">Request received</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{done}</h1>
            <Link to="/" className="btn-primary mt-8 inline-flex rounded-full px-7 py-3 text-sm font-bold">Back to home</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#5B32E8]/70">{interest === "max" ? "Max plan" : "Request a demo"}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              {interest === "max" ? "Get notified when Max launches" : "See VetechIQ in your clinic"}
            </h1>
            <p className="mt-3 text-[#5E5478]">Tell us a little about your clinic and our team will reach out to schedule a walkthrough.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {field("name", "Your name", { required: true, autoComplete: "name" })}
              {field("clinicName", "Clinic name", { required: true })}
              {field("email", "Email", { required: true, type: "email", autoComplete: "email" })}
              {field("phone", "Phone / WhatsApp", { required: true, type: "tel", autoComplete: "tel" })}
              {field("city", "City", { required: true })}
              <label className="block text-sm font-semibold text-[#4A3E68]">
                Clinic size
                <select className="vx-field mt-1.5 font-normal" value={form.clinicSize} onChange={set("clinicSize")}>
                  <option value="">Select…</option>
                  {SIZES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2">{field("preferredTime", "Preferred time to call (optional)", { placeholder: "e.g. weekdays after 4 pm" })}</div>
              <label className="block text-sm font-semibold text-[#4A3E68] sm:col-span-2">
                Anything we should know? (optional)
                <textarea className="vx-field mt-1.5 min-h-24 font-normal" value={form.message} onChange={set("message")} maxLength={1000} />
              </label>
              {/* honeypot: hidden from people, bots fill it */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={form.website} onChange={set("website")} />
            </div>

            {error && <p role="alert" className="mt-5 text-sm font-medium text-[#C0264F]">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary mt-8 inline-flex h-12 w-full items-center justify-center rounded-full text-base font-semibold disabled:opacity-60">
              {busy ? "Sending…" : "Request Demo"}
            </button>
            <p className="mt-4 text-center text-sm text-[#5E5478]">
              Ready to start now? <Link to="/pricing" className="font-semibold text-[#4F26D9]">See plans and start a free trial</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
