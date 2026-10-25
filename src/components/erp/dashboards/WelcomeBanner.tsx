import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";
import { UserAvatar } from "@/components/erp/UserAvatar";

export type WelcomeStat = { label: string; value: ReactNode; moduleId: string; tab?: string };

const clean = (v: unknown) => (typeof v === "string" && v.trim() && !/^(undefined|null)$/i.test(v.trim()) ? v.trim() : "");

/** "Sun, 25 Oct 2026" in the user's own timezone. */
function localDateChip(now = new Date()): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(now).map((x) => [x.type, x.value]));
  return `${p["weekday"]}, ${p["day"]} ${p["month"]} ${p["year"]}`;
}

/**
 * Line under the name: role/designation and clinic. Platform admins see their role and VetechIQ.
 * Never returns "undefined" or an empty string.
 */
function welcomeSubtitle(user: { roleId?: string; roleName?: string; clinicName?: string; branch?: string } | null | undefined, roleFallback: string, scope: string): string {
  const role = clean(user?.roleName) || roleFallback;
  if (user?.roleId === "platform") return `${role || "Platform Systems Administrator"} · VetechIQ`;
  // The account has no separate designation field, so the role name stands in; "Admin" reads better in full.
  const title = user?.roleId === "admin" && /^admin(istrator)?$/i.test(role) ? "Clinic Administrator" : role;
  const clinic = clean(user?.clinicName) || clean(user?.branch) || clean(scope);
  return [title, clinic].filter(Boolean).join(" · ");
}

/** Full-width welcome card: profile photo, "Welcome, <name>", role · clinic, date chip, optional stat chips and extra controls (e.g. branch). */
export function WelcomeBanner({ className = "", stats = [], extra }: { className?: string; stats?: WelcomeStat[]; extra?: ReactNode }) {
  const { currentUser, role, roleId } = useErp();
  const name = (currentUser?.fullName || role.person || "").trim();
  // "Dr" only for people who are doctors (or already carry the title); a receptionist is not called Dr
  const titled = /^dr\.?\s/i.test(name) || roleId === "doctor" ? (/^dr\.?\s/i.test(name) ? name.replace(/^dr\.?\s+/i, "Dr ") : `Dr ${name}`) : name;
  const heading = `Welcome, ${titled}`;
  const subtitle = welcomeSubtitle(currentUser, role.name, role.scope);

  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-border bg-gradient-to-r from-primary/5 via-card to-card px-5 py-3 shadow-sm md:flex-row md:gap-5 ${className}`}>
      <UserAvatar src={currentUser?.avatarUrl} size={88} label="Your profile photo" />
      <div className="min-w-0 flex-1 text-center md:text-left">
        <h2 className="truncate text-[28px] font-extrabold leading-tight tracking-tight text-foreground" title={heading}>{heading}</h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={subtitle}>{subtitle}</p>
        )}
      </div>
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
        <span className="whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{localDateChip()}</span>
      </div>
    </div>
  );
}
