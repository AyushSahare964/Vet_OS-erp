import { useErp } from "@/lib/erp/store";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { BrandChip } from "../shared/BrandChip";

/** Clinic logo and "Powered by VetOS", centred in the free space. */
export function ClinicIdentity() {
  const { currentUser, clinicBranding } = useErp();
  const displayName = clinicBranding?.clinicName || currentUser?.clinicName || "Veterinary Hospital";
  const logoSrc = clinicBranding?.logoUrl || CLINIC_CONFIG.logoPath;

  return (
    <section className="clinic vd-clinic" aria-label="Clinic">
      <img
        className="clinic-mark vd-clinic-mark"
        id="clinicMark"
        src={logoSrc}
        alt={displayName}
        onError={(e) => {
          (e.target as HTMLElement).src = CLINIC_CONFIG.logoPath;
        }}
      />
      <h1 className="sr-only" id="clinicName">{displayName}</h1>
      <div className="powered vd-powered">
        Powered by <BrandChip />
      </div>
    </section>
  );
}
