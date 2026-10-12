import type { IsoDate } from "@/data/doctor/types";

/** Parse "YYYY-MM-DD" as a local date (not UTC), so the day never shifts. */
export const parseDate = (iso: IsoDate | string | undefined | null): Date => {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return new Date(NaN);
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
};

/** "14 Aug 2025" */
export const formatDate = (iso: IsoDate | string | undefined | null): string => {
  const d = parseDate(iso);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return "Not recorded";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
