import { useEffect, useState } from "react";
import { useErp } from "@/lib/erp/store";
import { VetechLogo } from "@/components/brand/VetechLogo";

const PLATFORM_LOGO = "/landing/logo-dark.png";

/**
 * Tenant logo on a white card, and a quiet "Powered by VetechIQ" under it.
 * Platform admins see the VetechIQ logo (and no "Powered by"); a clinic without a logo, or whose logo fails to load,
 * falls back to the VetechIQ logo.
 */
export function ClinicIdentity() {
  const { currentUser, clinicBranding, roleId } = useErp();
  const isPlatform = roleId === "platform" || currentUser?.roleId === "platform";
  const displayName = isPlatform ? "VetechIQ" : clinicBranding?.clinicName || currentUser?.clinicName || "Veterinary Hospital";
  const wanted = isPlatform ? PLATFORM_LOGO : clinicBranding?.logoUrl || PLATFORM_LOGO;

  const [src, setSrc] = useState(wanted);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSrc(wanted);
    setLoaded(false);
  }, [wanted]);

  return (
    <section className="clinic vd-clinic" aria-label="Clinic">
      <div className={`clinic-logo-card${loaded ? "" : " is-loading"}`}>
        {!loaded && <div className="clinic-logo-skeleton" aria-hidden="true" />}
        <img
          className="clinic-logo-img"
          id="clinicMark"
          src={src}
          alt={displayName}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (src !== PLATFORM_LOGO) setSrc(PLATFORM_LOGO);
          }}
        />
      </div>
      <h1 className="sr-only" id="clinicName">{displayName}</h1>
      {!isPlatform && (
        <div className="powered vd-powered">
          Powered by <VetechLogo className="h-5" />
        </div>
      )}
    </section>
  );
}
