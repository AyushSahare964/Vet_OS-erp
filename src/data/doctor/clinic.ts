import type { Clinic } from "./types";

// Sample clinic profile. Swap with real values from the ERP later.
export const clinic: Clinic = {
  name: "Real Care Small Animal Clinic",
  logoUrl: "/clinic-logo.png",
  emblemUrl: "/clinic-logo.png",
  stats: {
    newPatients: 15,
    revenueUpPct: 18,
    hoursSavedPerWeek: 6,
    reminderReturnPct: 94,
    followUps: 62,
    billingFasterPct: 40,
  },
};
