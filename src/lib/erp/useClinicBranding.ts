import { useErp, type ClinicBranding } from "./store";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";

/**
 * Same shape as the static CLINIC_CONFIG (so every existing
 * `CLINIC_CONFIG.xxx` reference in a print view keeps working unchanged —
 * just shadow the import with `const CLINIC_CONFIG = useClinicBranding();`
 * inside the component), but resolved from the logged-in tenant's own
 * ClinicConfig document, falling back to the static demo values only for
 * whatever that tenant hasn't set (e.g. no logo uploaded yet).
 */
export interface ResolvedClinicBranding {
  shortName: string;
  fullName: string;
  subName: string;
  doctorName: string;
  doctorQualifications: string;
  doctorDesignation: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  website: string;
  email: string;
  gstin: string;
  regNo: string;
  logoPath: string;
  tagline: string;
  subTagline: string;
}

// ClinicConfigModel carries more fields than ClinicBranding (the trimmed
// session-store type) exposes — read the extras defensively.
interface FullClinicConfig extends ClinicBranding {
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  doctorQualifications?: string;
  doctorLicenseNumber?: string;
}

export function useClinicBranding(): ResolvedClinicBranding {
  const { clinicBranding, currentUser } = useErp();
  const cb = clinicBranding as FullClinicConfig | null;

  // Real Care's static demo values are only a fallback for a session with NO
  // tenant branding loaded. Once a tenant's config exists, a field it hasn't
  // filled in must render blank — never another clinic's phone/doctor/website.
  const isTenant = Boolean(cb);
  const fb = <K extends keyof typeof CLINIC_CONFIG>(key: K): string => (isTenant ? "" : CLINIC_CONFIG[key]);

  const name = cb?.clinicName || currentUser?.clinicName || fb("shortName") || CLINIC_CONFIG.shortName;
  const cityState = cb ? [cb.city, cb.state].filter(Boolean).join(", ") : "";

  return {
    shortName: name,
    fullName: name,
    subName: cb?.tagline || fb("subName"),
    doctorName: cb?.doctorName || currentUser?.fullName || fb("doctorName"),
    doctorQualifications: cb?.doctorQualifications || currentUser?.qualification || fb("doctorQualifications"),
    doctorDesignation: fb("doctorDesignation"),
    addressLine1: cb?.address || fb("addressLine1"),
    addressLine2: cityState || fb("addressLine2"),
    phone: cb?.phone || currentUser?.phone || fb("phone"),
    website: cb?.website || fb("website"),
    email: cb?.email || fb("email"),
    gstin: cb?.gstin || fb("gstin"),
    regNo: cb?.doctorLicenseNumber || currentUser?.licenseNumber || fb("regNo"),
    logoPath: cb?.logoUrl || (isTenant ? "/favicon.svg" : CLINIC_CONFIG.logoPath),
    tagline: cb?.tagline || fb("tagline"),
    subTagline: fb("subTagline"),
  };
}
