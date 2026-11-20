/**
 * Veterinary test library: ready-made panels per species with their default parameters, units and
 * reference ranges, generated from the clinic's lab report templates (lab_test/*.docx).
 * Used by the Test Master "Browse library" picker; prices are set by the clinic when a panel is added.
 */
export interface LibraryParameter { name: string; unit: string; refRange: string }
export interface LibraryGroup { name: string; parameters: LibraryParameter[] }
export interface LibraryPanel {
  id: string;
  species: string;
  panel: string;
  dept: string;
  sample: string;
  groups: LibraryGroup[];
}

export const LAB_TEST_LIBRARY: LibraryPanel[] = [
  {
    "id": "basic-blood-health-cbc-dog",
    "species": "Dog",
    "panel": "Basic Blood Health (CBC)",
    "dept": "Hematology",
    "sample": "Whole Blood (EDTA)",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "6.0 - 17.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "08 -21(0.9 to 5.0)"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.3 - 1.5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "3.5 - 12.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "12.0 - 18.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "19.5 - 25.5"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "32.0 - 38.5"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.50 - 8.50"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "12.0 - 17.0"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "200 - 900"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "5.5 - 10.5"
          }
        ]
      }
    ]
  },
  {
    "id": "basic-blood-health-cbc-cat",
    "species": "Cat",
    "panel": "Basic Blood Health (CBC)",
    "dept": "Hematology",
    "sample": "Whole Blood (EDTA)",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "5.5 - 19.5"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "27 - 36"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0 - 5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "3.5 - 12.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "9.8 - 15.4"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "13 -17"
          },
          {
            "name": "MCHC",
            "unit": "gm/dl",
            "refRange": "31-36"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.0 - 10.0"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "41 - 54"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "25.0 - 45.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "14.0 - 18.5"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "2.3 - 6.8"
          }
        ]
      }
    ]
  },
  {
    "id": "complete-diagnostic-panel-dog",
    "species": "Dog",
    "panel": "Complete Diagnostic Panel",
    "dept": "Clinical Biochemistry",
    "sample": "Whole Blood (EDTA) + Serum",
    "groups": [
      {
        "name": "Blood Health Basic",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "6.0 - 17.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "08 -21(0.9 to 5.0)"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.3 - 1.5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "3.5 - 12.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "12.0 - 18.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "19.5 - 25.5"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "32.0 - 38.5"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.50 - 8.50"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "12.0 - 17.0"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "200 - 900"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "5.5 - 10.5"
          }
        ]
      },
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0 - 0.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "20 - 150"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "10 - 109"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "13 - 66"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "5.4 - 7.1"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "3.1 - 4.3"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "1.6 - 3.6"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.5 - 1.8"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "10 - 40"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "8 - 28"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "3.4 - 7.0"
          }
        ]
      },
      {
        "name": "Electrolyte Panel (Advanced)",
        "parameters": [
          {
            "name": "Calcium (Total)",
            "unit": "mg/dL",
            "refRange": "9.4-11.1"
          },
          {
            "name": "Ionized Calcium",
            "unit": "Mmol/L",
            "refRange": "1.16-1.40"
          },
          {
            "name": "Phosphorus (Inorganic)",
            "unit": "mg/dl",
            "refRange": "2.7-5.4"
          },
          {
            "name": "Magnesium",
            "unit": "mEq/L",
            "refRange": "1.5-2.1"
          },
          {
            "name": "Sodium",
            "unit": "mmol/L",
            "refRange": "140-154"
          },
          {
            "name": "Potassium",
            "unit": "mmol/L",
            "refRange": "3.8-5.4"
          },
          {
            "name": "Chloride",
            "unit": "Mmol/L",
            "refRange": "104-119"
          }
        ]
      },
      {
        "name": "TFT (thyroid function test)",
        "parameters": [
          {
            "name": "T3",
            "unit": "ng/dL",
            "refRange": "80 - 253"
          },
          {
            "name": "T4",
            "unit": "μg/dL",
            "refRange": "6.09- 12.23"
          },
          {
            "name": "TSH",
            "unit": "μIU/mL",
            "refRange": "0.37-6.00"
          }
        ]
      },
      {
        "name": "Lipid Profile",
        "parameters": [
          {
            "name": "TOTAL CHOLESTEROL",
            "unit": "Mg/dL",
            "refRange": "130 - 300"
          },
          {
            "name": "HDL",
            "unit": "Mg/dL",
            "refRange": "50 - 140"
          },
          {
            "name": "LDL",
            "unit": "Mg/dL",
            "refRange": "36 - 197"
          },
          {
            "name": "TRIGLYCERIDES",
            "unit": "Mg/dL",
            "refRange": "20 - 150"
          }
        ]
      }
    ]
  },
  {
    "id": "electrolyte-panel-advanced-cattle",
    "species": "Cattle",
    "panel": "Electrolyte Panel (Advanced)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "Electrolyte Panel (Advanced)",
        "parameters": [
          {
            "name": "Calcium (Total)",
            "unit": "mg/dL",
            "refRange": "8.9-10.9"
          },
          {
            "name": "Ionized Calcium",
            "unit": "Mmol/L",
            "refRange": "1.16-1.33"
          },
          {
            "name": "Phosphorus (Inorganic)",
            "unit": "mg/dl",
            "refRange": "4.1-7.3"
          },
          {
            "name": "Magnesium",
            "unit": "mEq/L",
            "refRange": "1.6-2.5"
          },
          {
            "name": "Sodium",
            "unit": "mmol/L",
            "refRange": "132-145"
          },
          {
            "name": "Potassium",
            "unit": "mmol/L",
            "refRange": "3.9-5.6"
          },
          {
            "name": "Chloride",
            "unit": "Mmol/L",
            "refRange": "90-113"
          }
        ]
      }
    ]
  },
  {
    "id": "electrolyte-panel-advanced-dog",
    "species": "Dog",
    "panel": "Electrolyte Panel (Advanced)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "Electrolyte Panel (Advanced)",
        "parameters": [
          {
            "name": "Calcium (Total)",
            "unit": "mg/dL",
            "refRange": "9.4-11.1"
          },
          {
            "name": "Ionized Calcium",
            "unit": "Mmol/L",
            "refRange": "1.16-1.40"
          },
          {
            "name": "Phosphorus (Inorganic)",
            "unit": "mg/dl",
            "refRange": "2.7-5.4"
          },
          {
            "name": "Magnesium",
            "unit": "mEq/L",
            "refRange": "1.5-2.1"
          },
          {
            "name": "Sodium",
            "unit": "mmol/L",
            "refRange": "140-154"
          },
          {
            "name": "Potassium",
            "unit": "mmol/L",
            "refRange": "3.8-5.4"
          },
          {
            "name": "Chloride",
            "unit": "Mmol/L",
            "refRange": "104-119"
          }
        ]
      }
    ]
  },
  {
    "id": "electrolyte-panel-advanced-horse",
    "species": "Horse",
    "panel": "Electrolyte Panel (Advanced)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "Electrolyte Panel (Advanced)",
        "parameters": [
          {
            "name": "Calcium (Total)",
            "unit": "mg/dL",
            "refRange": "10.8-12.9"
          },
          {
            "name": "Ionized Calcium",
            "unit": "Mmol/L",
            "refRange": "1.40-1.72"
          },
          {
            "name": "Phosphorus (Inorganic)",
            "unit": "mg/dl",
            "refRange": "2.1-4.7"
          },
          {
            "name": "Magnesium",
            "unit": "mEq/L",
            "refRange": "1.2-1.9"
          },
          {
            "name": "Sodium",
            "unit": "mmol/L",
            "refRange": "136-144"
          },
          {
            "name": "Potassium",
            "unit": "mmol/L",
            "refRange": "3.1-4.3"
          },
          {
            "name": "Chloride",
            "unit": "Mmol/L",
            "refRange": "95-104"
          }
        ]
      }
    ]
  },
  {
    "id": "electrolyte-panel-advanced-cat",
    "species": "Cat",
    "panel": "Electrolyte Panel (Advanced)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "Electrolyte Panel (Advanced)",
        "parameters": [
          {
            "name": "Calcium (Total)",
            "unit": "mg/dL",
            "refRange": "9.0-11.3"
          },
          {
            "name": "Ionized Calcium",
            "unit": "Mmol/L",
            "refRange": "1.11-1.38"
          },
          {
            "name": "Phosphorus (Inorganic)",
            "unit": "mg/dl",
            "refRange": "2.6-5.5"
          },
          {
            "name": "Magnesium",
            "unit": "mEq/L",
            "refRange": "1.7-2.2"
          },
          {
            "name": "Sodium",
            "unit": "mmol/L",
            "refRange": "147-157"
          },
          {
            "name": "Potassium",
            "unit": "mmol/L",
            "refRange": "3.6-5.2"
          },
          {
            "name": "Chloride",
            "unit": "Mmol/L",
            "refRange": "114-123"
          }
        ]
      }
    ]
  },
  {
    "id": "fever-screening-panel-cbc-slide-cat",
    "species": "Cat",
    "panel": "Fever Screening Panel (CBC & Slide)",
    "dept": "Clinical Biochemistry",
    "sample": "Whole Blood (EDTA) + Serum",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "5.5 - 19.5"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "1.0 - 7.0"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0 - 5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "2.8 - 13.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "8.0 - 15.4"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "13 - 17"
          },
          {
            "name": "MCHC",
            "unit": "gm/dl",
            "refRange": "31 - 38.5"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.0 - 10.0"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "30.0 - 45.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "25.0 - 45.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "14.0 - 18.5"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "300 - 6.8"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "8.0 - 12.0"
          }
        ]
      },
      {
        "name": "Lipid Profile",
        "parameters": [
          {
            "name": "TOTAL CHOLESTEROL",
            "unit": "Mg/dL",
            "refRange": "75 - 220"
          },
          {
            "name": "HDL",
            "unit": "Mg/dL",
            "refRange": "39 - 163"
          },
          {
            "name": "LDL",
            "unit": "Mg/dL",
            "refRange": "25 - 30"
          },
          {
            "name": "TRIGLYCERIDES",
            "unit": "Mg/dL",
            "refRange": "50 - 100"
          }
        ]
      }
    ]
  },
  {
    "id": "fever-screening-panel-cbc-slide-dog",
    "species": "Dog",
    "panel": "Fever Screening Panel (CBC & Slide)",
    "dept": "Hematology",
    "sample": "Whole Blood (EDTA)",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "6.0 - 17.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "08 -21(0.9 to 5.0)"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.3 - 1.5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "3.5 - 12.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "12.0 - 18.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "19.5 - 25.5"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "32.0 - 38.5"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.50 - 8.50"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "37.0 - 55.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "12.0 - 17.0"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "200 - 900"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "5.5 - 10.5"
          }
        ]
      }
    ]
  },
  {
    "id": "fever-screening-panel-cbc-slide-cattle",
    "species": "Cattle",
    "panel": "Fever Screening Panel (CBC & Slide)",
    "dept": "Hematology",
    "sample": "Whole Blood (EDTA)",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "4.0 -12.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "2.5 - 7.5"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.0 - 0.8"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "0.6 - 4.0"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "8.0 - 15.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "11.0 - 17.0"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "31.0 - 38.5"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "5.00 - 10.00"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "40.0 - 60.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "24.0 - 46.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "0.0 - 99.9"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "100 - 800"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "0.0 - 99.9"
          }
        ]
      }
    ]
  },
  {
    "id": "cbc-lft-kft-slide-goat",
    "species": "Goat",
    "panel": "CBC, LFT, KFT & Slide",
    "dept": "Clinical Biochemistry",
    "sample": "Whole Blood (EDTA) + Serum",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "4.0 - 13.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "2.0 - 9.0"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.0 - 1.0"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "1.2 - 7.2"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "8.0 - 12.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "5.2 - 8.0"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "30.0- 36.0"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "8.00 - 18.00"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "16.0 - 25.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "22.0 - 38.0"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "0.0 - 99.9"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "0 - 5000"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "0.0 - 99.9"
          }
        ]
      },
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0 - 0.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "93 - 387"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "6 - 19"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "167 - 513"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "6.4 - 7.0"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "2.7 - 3.9"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "2.7 - 4.1"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "1.0 - 1.8"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "10 - 35"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "10 - 20"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "0.9 - 1.4"
          }
        ]
      }
    ]
  },
  {
    "id": "hepato-renal-panel-lft-kft-cat",
    "species": "Cat",
    "panel": "Hepato-Renal Panel (LFT, KFT)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0.3 - 1.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "<0.2"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0 - 10"
          },
          {
            "name": "ALP",
            "unit": "U/L",
            "refRange": "14 - 111"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "<50"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "<50"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "6.0 - 8.0"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "3.5 - 5.2"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "2.5 - 3.5"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.8- 2.4"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "17 - 43"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "6 - 20"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "3.5 - 7.2"
          }
        ]
      }
    ]
  },
  {
    "id": "hepato-renal-panel-lft-kft-dog",
    "species": "Dog",
    "panel": "Hepato-Renal Panel (LFT, KFT)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0 - 0.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "20 - 150"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "10 - 109"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "13 - 66"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "5.4 - 7.1"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "3.1 - 4.3"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "1.6 - 3.6"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.5 - 1.8"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "10 - 40"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "8 - 28"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "3.4 - 7.0"
          }
        ]
      }
    ]
  },
  {
    "id": "hepato-renal-panel-lft-kft-cattle",
    "species": "Cattle",
    "panel": "Hepato-Renal Panel (LFT, KFT)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0.1-1.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0.01-08"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "30-120"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "6.9-40"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "60-125"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "6.0-8.0"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "2.5-3.8"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "2.89-4.1"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.5-2.2"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "2.5-6.7"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "10-20"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "7.0-8.7"
          },
          {
            "name": "Calcium",
            "unit": "Mg/dl",
            "refRange": "8.0 - 11.4"
          }
        ]
      },
      {
        "name": "Lipid Profile",
        "parameters": [
          {
            "name": "TOTAL CHOLESTEROL ( TC )",
            "unit": "Mg/dL",
            "refRange": "70 - 180"
          },
          {
            "name": "HDL",
            "unit": "Mg/dL",
            "refRange": "40 - 90"
          },
          {
            "name": "LDL",
            "unit": "Mg/dL",
            "refRange": "40 - 100"
          },
          {
            "name": "TRIGLYCERIDES",
            "unit": "Mg/dL",
            "refRange": "10 - 40"
          }
        ]
      }
    ]
  },
  {
    "id": "kidney-function-panel-kft-dog",
    "species": "Dog",
    "panel": "Kidney Function Panel (KFT)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.5 - 1.8"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "10 - 40"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "8 - 28"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "3.4 - 7.0"
          }
        ]
      }
    ]
  },
  {
    "id": "liver-function-panel-lft-dog",
    "species": "Dog",
    "panel": "Liver Function Panel (LFT)",
    "dept": "Clinical Biochemistry",
    "sample": "Serum",
    "groups": [
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0 - 0.2"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0 - 0.1"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "20 - 150"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "10 - 109"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "13 - 66"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "5.4 - 7.1"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "3.1 - 4.3"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "1.6 - 3.6"
          }
        ]
      }
    ]
  },
  {
    "id": "cbc-lft-kft-lipid-profile-rat",
    "species": "Rat",
    "panel": "CBC, LFT, KFT & Lipid Profile",
    "dept": "Clinical Biochemistry",
    "sample": "Whole Blood (EDTA) + Serum",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "6.0 - 17.0"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "5.0 - 9.1"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.1 - 0.5"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "1.3 - 4.1"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "11.0 - 18.0"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "17.7 - 20.1"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "31.4 - 33.6"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "7.00 - 10.00"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "36.0 - 48.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "43.6 - 48.6"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "0.0% - 99.9%"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "500 - 1300"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "- 99.99"
          }
        ]
      },
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "g/dL",
            "refRange": "6.0 - 8.3"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dL",
            "refRange": "0.0 - 0.3"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0.1 - 0.8"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "44 - 147"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "7 - 56"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "10 - 40"
          },
          {
            "name": "Total Protein",
            "unit": "g/dL",
            "refRange": "6.0 - 8.3"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dL",
            "refRange": "3.5 - 5.5"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dL",
            "refRange": "1.8 - 3.0"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dL",
            "refRange": "3.4 - 7.0"
          },
          {
            "name": "Urea",
            "unit": "mg/dL",
            "refRange": "15 - 40"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dL",
            "refRange": "7 - 20"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dL",
            "refRange": "3.4 - 7.0"
          },
          {
            "name": "Calcium",
            "unit": "Mg/dL",
            "refRange": "8.5 - 10.5"
          }
        ]
      },
      {
        "name": "Lipid Profile",
        "parameters": [
          {
            "name": "TOTAL CHOLESTEROL",
            "unit": "mg/dL",
            "refRange": "40 - 120"
          },
          {
            "name": "HDL",
            "unit": "mg/dL",
            "refRange": "20 - 50"
          },
          {
            "name": "LDL",
            "unit": "mg/dL",
            "refRange": "10 - 54"
          },
          {
            "name": "TRIGLYCERIDES",
            "unit": "mg/dL",
            "refRange": "30 - 100"
          }
        ]
      }
    ]
  },
  {
    "id": "cbc-lft-kft-horse",
    "species": "Horse",
    "panel": "CBC, LFT, KFT",
    "dept": "Clinical Biochemistry",
    "sample": "Whole Blood (EDTA) + Serum",
    "groups": [
      {
        "name": "CBC (Complete Blood Count)",
        "parameters": [
          {
            "name": "WBC",
            "unit": "x10^3/µL",
            "refRange": "5.6 - 12.1"
          },
          {
            "name": "LYM",
            "unit": "%",
            "refRange": "1.2 - 5.9"
          },
          {
            "name": "MON",
            "unit": "%",
            "refRange": "0.0 - 0.7"
          },
          {
            "name": "GRA",
            "unit": "",
            "refRange": "3.0 - 4.5"
          },
          {
            "name": "HGB",
            "unit": "g/dl",
            "refRange": "10.1 - 16.1"
          },
          {
            "name": "MCH",
            "unit": "Pg",
            "refRange": "13.7 - 18.2"
          },
          {
            "name": "MCHC",
            "unit": "gm/ dl",
            "refRange": "35.3 - 39.3"
          },
          {
            "name": "RBC",
            "unit": "x10^6/µL",
            "refRange": "6.00 - 10.40"
          },
          {
            "name": "MCV",
            "unit": "Fl",
            "refRange": "37.0 - 49.0"
          },
          {
            "name": "HCT",
            "unit": "",
            "refRange": "38.0 - 46.6"
          },
          {
            "name": "RDW",
            "unit": "%",
            "refRange": "12.0 - 17.5"
          },
          {
            "name": "PLT",
            "unit": "x10^5/µL",
            "refRange": "117 - 256"
          },
          {
            "name": "MPV",
            "unit": "",
            "refRange": "4.0 - 6.0"
          }
        ]
      },
      {
        "name": "LFT (Liver Function Test)",
        "parameters": [
          {
            "name": "Bilirubin Total",
            "unit": "mg/dl",
            "refRange": "0.5 - 2.1"
          },
          {
            "name": "Bilirubin Direct",
            "unit": "mg/dl",
            "refRange": "0.1 - 0.3"
          },
          {
            "name": "Bilirubin Indirect",
            "unit": "mg/dl",
            "refRange": "0.3 - 2.0"
          },
          {
            "name": "Serum Alkaline Phosphate (ALP)",
            "unit": "U/L",
            "refRange": "109 - 315"
          },
          {
            "name": "SGPT",
            "unit": "U/L",
            "refRange": "3 - 25"
          },
          {
            "name": "SGOT",
            "unit": "U/L",
            "refRange": "150 - 450"
          },
          {
            "name": "Total Protein",
            "unit": "g/dl",
            "refRange": "5.6 - 7.6"
          },
          {
            "name": "Serum Albumin",
            "unit": "g/dl",
            "refRange": "2.6 - 4.1"
          },
          {
            "name": "Serum Globulin",
            "unit": "g/dl",
            "refRange": "2.6 - 4.0"
          }
        ]
      },
      {
        "name": "KFT (Kidney Function test)",
        "parameters": [
          {
            "name": "Serum Creatinine",
            "unit": "mg/dl",
            "refRange": "0.4 - 2.2"
          },
          {
            "name": "Urea",
            "unit": "mg/dl",
            "refRange": "10 - 26"
          },
          {
            "name": "Blood Urea Nitrogen (BUN)",
            "unit": "mg/dl",
            "refRange": "11 - 27"
          },
          {
            "name": "Uric Acid",
            "unit": "mg/dl",
            "refRange": "0 - 0.33"
          }
        ]
      }
    ]
  }
];
