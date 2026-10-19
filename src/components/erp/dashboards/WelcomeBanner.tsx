import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";
import { todayIST } from "@/lib/utils/dateUtils";
import { useTransparentCatImage } from "./RealCatJumpingWelcome";

export type WelcomeStat = { label: string; value: ReactNode; moduleId: string; tab?: string };

/** Full-width welcome card: cat, one "Welcome, Dr <name>" heading with date and clinic, optional stat chips and extra controls (e.g. branch). */
export function WelcomeBanner({ className = "", stats = [], extra }: { className?: string; stats?: WelcomeStat[]; extra?: ReactNode }) {
  const { currentUser, role, roleId } = useErp();
  const cat = useTransparentCatImage("/pets/real-cat-sitting.jpg");
  const name = (currentUser?.fullName || role.person || "").trim();
  // "Dr" only for people who are doctors (or already carry the title); a receptionist is not called Dr
  const titled = /^dr\.?\s/i.test(name) || roleId === "doctor" ? (/^dr\.?\s/i.test(name) ? name.replace(/^dr\.?\s+/i, "Dr ") : `Dr ${name}`) : name;
  const d = new Date(`${todayIST()}T00:00:00`);
  const day = d.toLocaleDateString("en-IN", { weekday: "long" });
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const clinic = currentUser?.clinicName || currentUser?.branch || role.scope;

  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-border bg-gradient-to-r from-primary/5 via-card to-card px-5 py-3 shadow-sm md:flex-row md:gap-5 ${className}`}>
      <style>{`.vd-welcome-cat{animation:vd-cat-hop 3.2s ease-in-out infinite}@keyframes vd-cat-hop{0%,86%,100%{transform:translateY(0)}92%{transform:translateY(-6px)}}@media (prefers-reduced-motion:reduce){.vd-welcome-cat{animation:none}}`}</style>
      <div className="flex size-[104px] shrink-0 items-center justify-center rounded-full bg-primary/10">
        <img src={cat} alt="" className="vd-welcome-cat h-[92px] w-auto object-contain" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 text-center md:text-left">
        <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">{`Welcome, ${titled}`}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {day}, {date}
          {clinic ? ` · ${clinic}` : ""}
        </p>
      </div>
      {(stats.length > 0 || extra) && (
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          {stats.map((s) => (
            <Link
              key={s.label}
              to="/m/$moduleId"
              params={{ moduleId: s.moduleId }}
              search={(s.tab ? { tab: s.tab } : {}) as never}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-center shadow-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="text-lg font-extrabold leading-none text-foreground">{s.value}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
            </Link>
          ))}
          {extra}
        </div>
      )}
    </div>
  );
}
