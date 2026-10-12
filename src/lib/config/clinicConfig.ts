/**
 * Centralized Clinic Configuration defaults
 * Provides safe fallback branding when no tenant-specific profile is loaded.
 */

export const CLINIC_CONFIG = {
  /** Short name shown in sidebar / mobile header fallback */
  shortName: "VetOS Clinic",
  /** Full name shown in invoices and prescriptions fallback */
  fullName: "Veterinary Care & Animal Hospital",
  /** Sub-brand fallback */
  subName: "Clinical Complex & Animal Healthcare",
  /** Primary doctor fallback */
  doctorName: "Attending Veterinary Surgeon",
  /** Doctor qualifications fallback */
  doctorQualifications: "B.V.Sc & AH, M.V.Sc",
  /** Doctor designation fallback */
  doctorDesignation: "Chief Veterinary Physician & Surgeon",
  /** Address line 1 fallback */
  addressLine1: "Veterinary Healthcare Facility",
  /** Address line 2 fallback */
  addressLine2: "",
  /** Phone number fallback */
  phone: "",
  /** Website fallback */
  website: "",
  /** Email fallback */
  email: "",
  /** GSTIN fallback */
  gstin: "",
  /** Registration number fallback */
  regNo: "",
  /** Path to the default clinic logo */
  logoPath: "/favicon.svg",
  /** Tagline fallback */
  tagline: "Dedicated to Excellence in Veterinary Medicine",
  /** Sub-tagline fallback */
  subTagline: "Compassionate Clinical Care",
} as const;
