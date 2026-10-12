import type { Section } from "@/data/doctor/types";

export type ResultIcon = "paw" | "clock" | "pharmacy" | Section;

export interface SearchResult {
  key: string;
  petId: string;
  /** Set for records; opens that history page instead of the patient page. */
  section?: Section | undefined;
  /** If pointing to an ERP module (e.g. inventory) */
  toModule?: string | undefined;
  icon: ResultIcon;
  title: string;
  sub: string;
  tag: string;
}

/** DOM id of a result row, for aria-activedescendant. */
export const optionId = (listId: string, index: number) => `${listId}-opt-${index}`;

export interface ResultGroup {
  heading: string;
  items: SearchResult[];
}
