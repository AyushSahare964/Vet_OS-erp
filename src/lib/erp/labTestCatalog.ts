/**
 * Shared diagnostic test catalog — backed by MongoDB via the generic ErpRow
 * store (moduleId "lab_test_catalog"). Used by both the Test Master &
 * Profiles admin screen and the Create Lab Order modal so both share a
 * single source of truth: tests added/removed in one place show up in the
 * other immediately.
 */
import { getRowsFn, addRowFn, deleteRowFn, resetRowsFn, updateRowFn } from "@/lib/mongodb/serverFns/rows";

export const LAB_TEST_CATALOG_MODULE = "lab_test_catalog";

/** One result field of a test, with its normal range ("threshold"): refRange is "min - max", "< max" or "> min". */
export interface LabTestParameter {
  name: string;
  unit: string;
  refRange: string;
}

export interface LabTestProfile {
  /** Panel the test belongs to, e.g. "Liver Function Panel". Tests are grouped by panel. */
  panel?: string;
  /** Parameters this test must report; they appear in the result-entry form when the test is ordered. */
  parameters?: LabTestParameter[];
  code: string;
  name: string;
  sample: string;
  dept: string;
  tat: string;
  price: number;
  urgentAvailable: boolean;
}

// ─── Standard Veterinary Test Presets (1-Click Templates) ────────────────────

export interface VetTestPreset {
  id: string;
  name: string;
  panel: string;
  dept: string;
  sample: string;
  tat: string;
  price: number;
  urgentAvailable: boolean;
  parameters: Array<{ name: string; unit: string; min: string; max: string }>;
}

export const COMMON_VET_PRESETS: VetTestPreset[] = [
  {
    id: "cbc",
    name: "Complete Blood Count (CBC / Hemogram)",
    panel: "Hematology Routine",
    dept: "Hematology",
    sample: "Whole Blood (EDTA Purple Top)",
    tat: "1 hr",
    price: 650,
    urgentAvailable: true,
    parameters: [
      { name: "Hemoglobin (Hb)", unit: "g/dL", min: "12.0", max: "18.0" },
      { name: "Total RBC Count", unit: "x10^6/uL", min: "5.5", max: "8.5" },
      { name: "Packed Cell Volume (PCV / HCT)", unit: "%", min: "37.0", max: "55.0" },
      { name: "Total Leucocyte Count (TLC / WBC)", unit: "x10^3/uL", min: "6.0", max: "17.0" },
      { name: "Platelet Count", unit: "x10^3/uL", min: "200", max: "500" },
      { name: "Neutrophils (%)", unit: "%", min: "60", max: "77" },
      { name: "Lymphocytes (%)", unit: "%", min: "12", max: "30" },
      { name: "Monocytes (%)", unit: "%", min: "3", max: "10" },
      { name: "Eosinophils (%)", unit: "%", min: "2", max: "10" },
    ],
  },
  {
    id: "lft",
    name: "Comprehensive Liver Function Panel (LFT)",
    panel: "Biochemistry Profile",
    dept: "Clinical Biochemistry",
    sample: "Serum (SST Yellow Top)",
    tat: "2 hrs",
    price: 950,
    urgentAvailable: true,
    parameters: [
      { name: "ALT (SGPT)", unit: "U/L", min: "10", max: "100" },
      { name: "AST (SGOT)", unit: "U/L", min: "10", max: "50" },
      { name: "ALP (Alkaline Phosphatase)", unit: "U/L", min: "23", max: "212" },
      { name: "Total Bilirubin", unit: "mg/dL", min: "0.1", max: "0.5" },
      { name: "Direct Bilirubin", unit: "mg/dL", min: "0.0", max: "0.2" },
      { name: "Total Protein", unit: "g/dL", min: "5.2", max: "8.2" },
      { name: "Serum Albumin", unit: "g/dL", min: "2.5", max: "4.0" },
      { name: "Serum Globulin", unit: "g/dL", min: "2.5", max: "4.5" },
      { name: "A:G Ratio", unit: "ratio", min: "0.8", max: "1.5" },
    ],
  },
  {
    id: "kft",
    name: "Kidney Function Panel (KFT / RFT)",
    panel: "Biochemistry Profile",
    dept: "Clinical Biochemistry",
    sample: "Serum (SST Yellow Top)",
    tat: "2 hrs",
    price: 750,
    urgentAvailable: true,
    parameters: [
      { name: "Serum Creatinine", unit: "mg/dL", min: "0.5", max: "1.5" },
      { name: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", min: "7.0", max: "27.0" },
      { name: "BUN / Creatinine Ratio", unit: "ratio", min: "10", max: "25" },
      { name: "Serum Phosphorus", unit: "mg/dL", min: "2.5", max: "6.0" },
      { name: "Serum Calcium", unit: "mg/dL", min: "9.0", max: "11.5" },
    ],
  },
  {
    id: "electrolytes",
    name: "Serum Electrolyte Panel (Na, K, Cl)",
    panel: "Electrolytes & Blood Gas",
    dept: "Clinical Biochemistry",
    sample: "Serum (SST Yellow Top)",
    tat: "1 hr",
    price: 600,
    urgentAvailable: true,
    parameters: [
      { name: "Sodium (Na+)", unit: "mmol/L", min: "140", max: "155" },
      { name: "Potassium (K+)", unit: "mmol/L", min: "3.5", max: "5.5" },
      { name: "Chloride (Cl-)", unit: "mmol/L", min: "105", max: "120" },
      { name: "Na / K Ratio", unit: "ratio", min: "27", max: "40" },
    ],
  },
  {
    id: "thyroid",
    name: "Thyroid Panel (Total T4 & TSH)",
    panel: "Endocrine & Hormones",
    dept: "Endocrinology",
    sample: "Serum (SST Yellow Top)",
    tat: "4 hrs",
    price: 1200,
    urgentAvailable: false,
    parameters: [
      { name: "Total Thyroxine (T4)", unit: "ug/dL", min: "1.0", max: "4.0" },
      { name: "Canine TSH (cTSH)", unit: "ng/mL", min: "0.03", max: "0.50" },
      { name: "Free T4", unit: "pmol/L", min: "8.0", max: "40.0" },
    ],
  },
  {
    id: "urinalysis",
    name: "Routine Urinalysis with Microscopy",
    panel: "Urinalysis & Fluids",
    dept: "Urinalysis",
    sample: "Fresh Urine (Sterile Cup)",
    tat: "30 mins",
    price: 400,
    urgentAvailable: true,
    parameters: [
      { name: "Specific Gravity (USG)", unit: "ratio", min: "1.015", max: "1.045" },
      { name: "pH", unit: "pH", min: "6.0", max: "7.5" },
      { name: "Urine Protein", unit: "mg/dL", min: "", max: "30" },
      { name: "Urine Glucose", unit: "mg/dL", min: "", max: "10" },
      { name: "Ketones", unit: "mg/dL", min: "", max: "5" },
      { name: "Bilirubin", unit: "mg/dL", min: "", max: "0.2" },
      { name: "Microscopic Pus Cells (WBC)", unit: "HPF", min: "", max: "5" },
      { name: "Microscopic RBCs", unit: "HPF", min: "", max: "5" },
    ],
  },
  {
    id: "fecal",
    name: "Fecal Examination (Floatation & Wet Mount)",
    panel: "Parasitology",
    dept: "Parasitology",
    sample: "Fresh Feces (Sterile Container)",
    tat: "1 hr",
    price: 350,
    urgentAvailable: false,
    parameters: [
      { name: "Helminth Ova / Nematode Eggs", unit: "obs", min: "", max: "0" },
      { name: "Coccidian Oocysts / Giardia", unit: "obs", min: "", max: "0" },
      { name: "Fecal Occult Blood", unit: "obs", min: "", max: "0" },
    ],
  },
  {
    id: "pancreatic",
    name: "Pancreatic Lipase & Enzymes (cPL)",
    panel: "Biochemistry Profile",
    dept: "Clinical Biochemistry",
    sample: "Serum (SST Yellow Top)",
    tat: "2 hrs",
    price: 1100,
    urgentAvailable: true,
    parameters: [
      { name: "Specific Canine Pancreatic Lipase (cPL)", unit: "ug/L", min: "", max: "200" },
      { name: "Serum Amylase", unit: "U/L", min: "500", max: "1500" },
      { name: "Serum Lipase", unit: "U/L", min: "200", max: "1800" },
    ],
  },
  {
    id: "glucose",
    name: "Blood Glucose & Diabetic Monitoring",
    panel: "Biochemistry Profile",
    dept: "Clinical Biochemistry",
    sample: "Fluoride Plasma (Grey Top)",
    tat: "30 mins",
    price: 300,
    urgentAvailable: true,
    parameters: [
      { name: "Fasting Blood Glucose", unit: "mg/dL", min: "70", max: "120" },
      { name: "Post-Prandial Glucose", unit: "mg/dL", min: "80", max: "150" },
      { name: "Fructosamine", unit: "umol/L", min: "175", max: "350" },
    ],
  },
  {
    id: "tick_4dx",
    name: "Canine Vector-Borne SNAP 4Dx Panel",
    panel: "Serology & Infectious Disease",
    dept: "Serology & Immunology",
    sample: "Whole Blood (EDTA Purple Top)",
    tat: "30 mins",
    price: 1500,
    urgentAvailable: true,
    parameters: [
      { name: "Dirofilaria immitis (Heartworm)", unit: "Ag", min: "", max: "0" },
      { name: "Ehrlichia canis Antibody", unit: "Ab", min: "", max: "0" },
      { name: "Anaplasma phagocytophilum", unit: "Ab", min: "", max: "0" },
      { name: "Borrelia burgdorferi (Lyme)", unit: "Ab", min: "", max: "0" },
    ],
  },
];

export const COMMON_DEPARTMENTS = [
  "Hematology",
  "Clinical Biochemistry",
  "Microbiology",
  "Serology & Immunology",
  "Urinalysis",
  "Parasitology",
  "Endocrinology",
  "Cytology & Pathology",
  "General",
];

export const COMMON_SAMPLES = [
  "Whole Blood (EDTA Purple Top)",
  "Serum (SST Yellow Top)",
  "Serum (Plain Red Top)",
  "Fluoride Plasma (Grey Top)",
  "Heparin Whole Blood (Green Top)",
  "Fresh Urine (Sterile Cup)",
  "Fresh Feces (Sterile Container)",
  "Skin Scraping / Deep Scraping",
  "Ear Swab / Exudate",
  "Fine Needle Aspirate (FNA)",
  "Peritoneal / Pleural Fluid",
];

export const COMMON_TATS = [
  "30 mins",
  "1 hr",
  "2 hrs",
  "4 hrs",
  "Same Day (EOD)",
  "24 hrs",
  "48 hrs",
];

/** Fast dictionary for parameter name auto-suggestion */
export const COMMON_PARAM_DICTIONARY: Record<string, { unit: string; min: string; max: string }> = {
  "hemoglobin": { unit: "g/dL", min: "12.0", max: "18.0" },
  "hb": { unit: "g/dL", min: "12.0", max: "18.0" },
  "rbc": { unit: "x10^6/uL", min: "5.5", max: "8.5" },
  "pcv": { unit: "%", min: "37.0", max: "55.0" },
  "hct": { unit: "%", min: "37.0", max: "55.0" },
  "wbc": { unit: "x10^3/uL", min: "6.0", max: "17.0" },
  "tlc": { unit: "x10^3/uL", min: "6.0", max: "17.0" },
  "platelet": { unit: "x10^3/uL", min: "200", max: "500" },
  "neutrophil": { unit: "%", min: "60", max: "77" },
  "lymphocyte": { unit: "%", min: "12", max: "30" },
  "monocyte": { unit: "%", min: "3", max: "10" },
  "eosinophil": { unit: "%", min: "2", max: "10" },
  "creatinine": { unit: "mg/dL", min: "0.5", max: "1.5" },
  "bun": { unit: "mg/dL", min: "7.0", max: "27.0" },
  "urea": { unit: "mg/dL", min: "15", max: "45" },
  "alt": { unit: "U/L", min: "10", max: "100" },
  "sgpt": { unit: "U/L", min: "10", max: "100" },
  "ast": { unit: "U/L", min: "10", max: "50" },
  "sgot": { unit: "U/L", min: "10", max: "50" },
  "alp": { unit: "U/L", min: "23", max: "212" },
  "bilirubin": { unit: "mg/dL", min: "0.1", max: "0.5" },
  "total protein": { unit: "g/dL", min: "5.2", max: "8.2" },
  "albumin": { unit: "g/dL", min: "2.5", max: "4.0" },
  "globulin": { unit: "g/dL", min: "2.5", max: "4.5" },
  "glucose": { unit: "mg/dL", min: "70", max: "120" },
  "blood sugar": { unit: "mg/dL", min: "70", max: "120" },
  "sodium": { unit: "mmol/L", min: "140", max: "155" },
  "potassium": { unit: "mmol/L", min: "3.5", max: "5.5" },
  "chloride": { unit: "mmol/L", min: "105", max: "120" },
  "calcium": { unit: "mg/dL", min: "9.0", max: "11.5" },
  "phosphorus": { unit: "mg/dL", min: "2.5", max: "6.0" },
  "amylase": { unit: "U/L", min: "500", max: "1500" },
  "lipase": { unit: "U/L", min: "200", max: "1800" },
  "t4": { unit: "ug/dL", min: "1.0", max: "4.0" },
  "tsh": { unit: "ng/mL", min: "0.03", max: "0.50" },
};

// ─── Data Access Functions ────────────────────────────────────────────────────

export async function loadTestCatalog(): Promise<LabTestProfile[]> {
  const rows = await getRowsFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE } });
  return (rows ?? []) as unknown as LabTestProfile[];
}

export async function addTestToCatalog(test: LabTestProfile) {
  return addRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, row: test as unknown as Record<string, unknown> } });
}

export async function updateTestInCatalog(code: string, updatedTest: LabTestProfile, index?: number) {
  return updateRowFn({
    data: {
      moduleId: LAB_TEST_CATALOG_MODULE,
      match: { code },
      index,
      row: updatedTest as unknown as Record<string, unknown>,
    },
  });
}

export async function deleteTestFromCatalog(index: number) {
  return deleteRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, index } });
}

export async function clearTestCatalog() {
  return resetRowsFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE } });
}
