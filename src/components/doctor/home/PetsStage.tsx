import { useEffect, useState, useMemo } from "react";
import { useErp } from "@/lib/erp/store";
import { getDoctorHomeStatsFn, type DoctorHomeStats } from "@/lib/mongodb/serverFns/search";
import { buildTenantRunningMessages } from "./messages";
import { RunningScreen } from "./RunningScreen";

/**
 * Kitten at bottom left holding board's top-left corner:
 * Tail layer BEHIND the board, body layer IN FRONT.
 * Head and paws stay still; tail swishes and body sways gently.
 */
export function PetsStage() {
  const { currentUser, clinicBranding } = useErp();
  const [stats, setStats] = useState<DoctorHomeStats | null>(null);

  useEffect(() => {
    let active = true;
    getDoctorHomeStatsFn()
      .then((res) => {
        if (active && res) setStats(res);
      })
      .catch((err) => console.warn("[PetsStage] Failed to fetch live tenant stats:", err));
    return () => {
      active = false;
    };
  }, []);

  const clinicName = clinicBranding?.clinicName || currentUser?.clinicName || "Your Clinic";
  const messages = useMemo(
    () => buildTenantRunningMessages(stats, clinicName),
    [stats, clinicName]
  );

  return (
    <section className="stage vd-stage" aria-label="Live clinic updates">
      <div className="kitten" aria-hidden="true">
        <div className="k-sway">
          <i className="k-tail" />
        </div>
      </div>
      <RunningScreen messages={messages} />
      <div className="kitten" aria-hidden="true">
        <div className="k-sway">
          <i className="k-body" />
        </div>
      </div>
    </section>
  );
}
