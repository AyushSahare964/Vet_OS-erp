import { lazy, Suspense, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";
import { barItemsFor } from "./barItems";
import { FloatingBar } from "./FloatingBar";
import { quickActionsFor } from "./menuConfig";
import { useQuickAction } from "./quickActions";

// Quick Action modals are only loaded the first time someone uses the flyout.
const QuickActionHost = lazy(() =>
  import("@/components/erp/QuickActionHost").then((m) => ({ default: m.QuickActionHost })),
);

/**
 * One of the two slim side bars with the signed-in role's menu (same modules, icons and routes as the
 * ERP sidebar). Left: Clinic emblem badge. Right: VetechIQ badge. Used by the doctor UI and by Shell.
 */
export function SideBar({ side }: { side: "left" | "right" }) {
  const { role, clinicBranding } = useErp();
  const bars = useMemo(() => barItemsFor(role), [role]);
  const items = bars[side];
  const quickActions = useMemo(() => quickActionsFor(role.id, bars.held), [bars, role.id]);
  const qa = useQuickAction();
  const emblemSrc = clinicBranding?.logoUrl || "/clinic-logo.png";
  if (side === "right")
    return (
      <>
        <FloatingBar
          side="right"
          label="Run and manage the hospital"
          items={items}
          quickActions={quickActions}
          badgeClass="is-vet"
          badge={
            <img src="/landing/icon.png" alt="VetechIQ" />
          }
        />
        {qa && (
          <Suspense fallback={null}>
            <QuickActionHost />
          </Suspense>
        )}
      </>
    );
  return (
    <FloatingBar
      side="left"
      label="Treat and manage the patient"
      items={items}
      badge={
        <Link to="/" aria-label="Go to home" className="vd-badge-link">
          <img
            src={emblemSrc}
            alt=""
            onError={(e) => {
              (e.target as HTMLElement).src = "/clinic-logo.png";
            }}
          />
        </Link>
      }
    />
  );
}
