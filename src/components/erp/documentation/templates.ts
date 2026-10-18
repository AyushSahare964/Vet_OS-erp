/**
 * Consent, acknowledgement and certificate templates. DRAFT wording: a doctor must review it before clinical or legal use.
 * (docs/VetechIQ_Veterinary_Consent_Certificate_Templates.docx is not in the project, so this is standard simple wording.)
 * Placeholders: {{pet}} {{species}} {{breed}} {{owner}} {{doctor}} {{clinic}} {{date}} and any field key, e.g. {{procedure}}.
 */
export interface DocField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date";
  placeholder?: string;
}

export interface DocTemplate {
  id: string;
  title: string;
  /** Paragraphs shown in order; {{key}} is replaced from the patient, owner, doctor, clinic and the extra fields. */
  body: string[];
  fields?: DocField[];
  /** Signature lines at the bottom. */
  signatures: string[];
  /** Fill a table from the patient's vaccine history instead of (or as well as) the body. */
  vaccineTable?: boolean;
}

const OWNER_SIGN = "Pet parent / authorised person";
const DOCTOR_SIGN = "Attending veterinarian";
const WITNESS = "Witness";

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "general-consent",
    title: "General Treatment Consent",
    body: [
      "I, {{owner}}, am the owner / authorised guardian of {{pet}} ({{species}}, {{breed}}).",
      "I request and authorise {{doctor}} and the staff of {{clinic}} to examine my pet and to carry out the routine diagnostic tests and treatment they consider necessary.",
      "The nature of the examination and treatment, the likely benefits and the common risks have been explained to me in a language I understand, and I have had the chance to ask questions.",
      "I understand that no outcome can be guaranteed and that the treatment plan may change as new findings appear. I agree to be responsible for the charges of the care provided.",
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN],
  },
  {
    id: "procedure-consent",
    title: "Procedure / Surgery Consent",
    body: [
      "I, {{owner}}, owner / authorised guardian of {{pet}} ({{species}}, {{breed}}), give consent for the following procedure to be performed by {{doctor}} at {{clinic}}: {{procedure}}.",
      "The reason for the procedure, how it is done, the expected benefits, the possible risks (including bleeding, infection, delayed healing and, rarely, death), and the alternatives, including not operating, have been explained to me.",
      "I agree that if an unexpected finding makes a change necessary, the surgeon may carry out the additional procedure needed to protect my pet's life and welfare. Estimated cost: Rs {{cost}}.",
      "I have read this form or had it read to me, and I understand it.",
    ],
    fields: [
      { key: "procedure", label: "Procedure", placeholder: "e.g. Ovariohysterectomy (spay)" },
      { key: "cost", label: "Estimated cost (Rs)", type: "number" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN, WITNESS],
  },
  {
    id: "anaesthesia-consent",
    title: "Anaesthesia Consent",
    body: [
      "I, {{owner}}, consent to {{pet}} ({{species}}, {{breed}}) receiving {{anaesthesia}} anaesthesia / sedation under the care of {{doctor}} at {{clinic}}.",
      "I understand that every anaesthetic carries a risk, even in healthy animals, and that the risk is higher for very young, old, overweight, flat-faced or sick animals. Complications can include breathing or heart problems, reactions to drugs and, rarely, death.",
      "I confirm that I have told the team about my pet's past illnesses, medicines and allergies, and that my pet was fasted as advised (last food / water: {{fasting}}).",
      "Pre-anaesthetic tests have been offered to me. Tests accepted: {{tests}}.",
    ],
    fields: [
      { key: "anaesthesia", label: "Type", placeholder: "General / local / sedation" },
      { key: "fasting", label: "Last food / water", placeholder: "e.g. 8 pm yesterday" },
      { key: "tests", label: "Pre-anaesthetic tests accepted", placeholder: "e.g. CBC, kidney and liver panel" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN],
  },
  {
    id: "diagnostic-consent",
    title: "Diagnostic Procedure Consent",
    body: [
      "I, {{owner}}, authorise {{doctor}} and {{clinic}} to carry out the following diagnostic procedure on {{pet}} ({{species}}, {{breed}}): {{procedure}}.",
      "The purpose, the way it is done, any need for sedation, the small risks (for example discomfort, bruising or a reaction to contrast / sedation) and the chance that the result may not give a final answer have been explained to me.",
      "I agree to the charges: Rs {{cost}}.",
    ],
    fields: [
      { key: "procedure", label: "Procedure", placeholder: "e.g. X-ray, ultrasound, biopsy, endoscopy" },
      { key: "cost", label: "Estimated cost (Rs)", type: "number" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN],
  },
  {
    id: "ipd-consent",
    title: "Hospitalisation / IPD Consent",
    body: [
      "I, {{owner}}, agree to admit {{pet}} ({{species}}, {{breed}}) to {{clinic}} under the care of {{doctor}} from {{admitDate}}, for: {{reason}}.",
      "I understand that my pet will be monitored by the hospital team, that the condition may change quickly, and that I will be informed of any important change. I will keep my phone reachable on {{phone}}.",
      "I agree to the daily hospitalisation charges and the cost of tests, medicines and procedures. I understand that visiting is allowed only at the times set by the hospital. I will collect my pet promptly on discharge.",
    ],
    fields: [
      { key: "admitDate", label: "Admission date", type: "date" },
      { key: "reason", label: "Reason for admission" },
      { key: "phone", label: "Contact number during stay" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN],
  },
  {
    id: "estimate-ack",
    title: "Estimated Cost & Treatment Plan Acknowledgement",
    body: [
      "I, {{owner}}, confirm that {{doctor}} has explained the proposed treatment plan for {{pet}} ({{species}}, {{breed}}) and the estimated cost.",
      "Plan: {{plan}}",
      "Estimated cost: Rs {{cost}} (range Rs {{costRange}}). I understand this is an estimate; the final bill depends on how my pet responds and on the tests and care that turn out to be needed. I will be informed before the cost goes much beyond this estimate.",
      "Advance paid: Rs {{advance}}.",
    ],
    fields: [
      { key: "plan", label: "Treatment plan", type: "textarea" },
      { key: "cost", label: "Estimated cost (Rs)", type: "number" },
      { key: "costRange", label: "Possible range (Rs)", placeholder: "e.g. 8,000 to 12,000" },
      { key: "advance", label: "Advance paid (Rs)", type: "number" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN],
  },
  {
    id: "high-risk-ack",
    title: "High-Risk Treatment / Referral Acknowledgement",
    body: [
      "I, {{owner}}, have been told by {{doctor}} that the treatment or procedure proposed for {{pet}} ({{species}}, {{breed}}), namely {{treatment}}, carries a high risk because of: {{risk}}.",
      "I understand that serious complications or death may occur even with the best care. I have been informed that referral to a specialist or a better-equipped centre is an option ({{referral}}).",
      "I have decided to proceed / to take my pet for referral (delete one) and I accept the risks explained to me.",
    ],
    fields: [
      { key: "treatment", label: "Treatment / procedure" },
      { key: "risk", label: "Reason for high risk", type: "textarea" },
      { key: "referral", label: "Referral option offered", placeholder: "e.g. Veterinary college hospital" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN, WITNESS],
  },
  {
    id: "refusal",
    title: "Refusal of Recommended Treatment",
    body: [
      "I, {{owner}}, owner / authorised guardian of {{pet}} ({{species}}, {{breed}}), confirm that {{doctor}} at {{clinic}} has recommended: {{recommended}}.",
      "The reasons for the recommendation and the possible results of not following it, including worsening of the illness, pain, long-term damage and death, have been explained to me.",
      "I have chosen not to accept this recommendation (reason: {{reason}}). I understand that I may change my mind at any time and return for care, and I will not hold {{clinic}} responsible for the results of this decision.",
    ],
    fields: [
      { key: "recommended", label: "Recommended treatment / test", type: "textarea" },
      { key: "reason", label: "Owner's reason" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN, WITNESS],
  },
  {
    id: "dama",
    title: "Discharge Against Medical Advice (DAMA)",
    body: [
      "I, {{owner}}, owner / authorised guardian of {{pet}} ({{species}}, {{breed}}), am taking my pet home from {{clinic}} on {{date}} against the medical advice of {{doctor}}.",
      "I have been told that my pet's condition ({{condition}}) needs further hospital care, and that leaving now may lead to worsening of the illness, complications or death.",
      "I accept full responsibility for this decision and for my pet's care after discharge. I have been given the home-care advice and medicines listed by the doctor, and I know I can return at any time.",
    ],
    fields: [{ key: "condition", label: "Condition / diagnosis", type: "textarea" }],
    signatures: [OWNER_SIGN, DOCTOR_SIGN, WITNESS],
  },
  {
    id: "euthanasia",
    title: "Euthanasia Consent and Record",
    body: [
      "I, {{owner}}, am the owner / authorised guardian of {{pet}} ({{species}}, {{breed}}) and have the right to make this decision.",
      "After discussion with {{doctor}} about my pet's condition ({{condition}}), the available options and the outlook, I request humane euthanasia of my pet at {{clinic}}.",
      "I understand that the procedure is final and cannot be reversed, that the drugs used will cause a painless death, and that my pet will be handled with respect. After-care chosen: {{aftercare}}.",
      "Record: date {{date}}, time {{time}}, method {{method}}, performed by {{doctor}}.",
    ],
    fields: [
      { key: "condition", label: "Condition / reason", type: "textarea" },
      { key: "aftercare", label: "After-care", placeholder: "e.g. Cremation (individual / communal), home burial" },
      { key: "time", label: "Time" },
      { key: "method", label: "Method / drugs used" },
    ],
    signatures: [OWNER_SIGN, DOCTOR_SIGN, WITNESS],
  },
  {
    id: "insurance",
    title: "Insurance Claim / Medical Statement",
    body: [
      "To: {{insurer}}. Claim / policy no.: {{policyNo}}.",
      "This is to certify that {{pet}} ({{species}}, {{breed}}), owned by {{owner}}, was examined at {{clinic}} by {{doctor}} on {{visitDate}}.",
      "Diagnosis: {{diagnosis}}",
      "Treatment given and total charges: {{treatment}}",
      "This statement is based on the clinical records of the hospital.",
    ],
    fields: [
      { key: "insurer", label: "Insurer" },
      { key: "policyNo", label: "Claim / policy no." },
      { key: "visitDate", label: "Date of visit", type: "date" },
      { key: "diagnosis", label: "Diagnosis", type: "textarea" },
      { key: "treatment", label: "Treatment and charges", type: "textarea" },
    ],
    signatures: [DOCTOR_SIGN],
  },
  {
    id: "legal-report",
    title: "Legal & Official Report",
    body: [
      "To: {{addressee}}. Subject: {{subject}}.",
      "I, {{doctor}}, veterinarian at {{clinic}}, examined {{pet}} ({{species}}, {{breed}}), owner {{owner}}, on {{examDate}}.",
      "Findings: {{findings}}",
      "Opinion: {{opinion}}",
      "This report is given from my own examination and the hospital records, and is true to the best of my knowledge.",
    ],
    fields: [
      { key: "addressee", label: "Addressed to" },
      { key: "subject", label: "Subject" },
      { key: "examDate", label: "Date of examination", type: "date" },
      { key: "findings", label: "Findings", type: "textarea" },
      { key: "opinion", label: "Opinion", type: "textarea" },
    ],
    signatures: [DOCTOR_SIGN],
  },
  {
    id: "vaccination-certificate",
    title: "Vaccination Certificate",
    body: [
      "This is to certify that {{pet}} ({{species}}, {{breed}}, {{sex}}), owned by {{owner}}, has received the vaccinations listed below at {{clinic}}.",
    ],
    vaccineTable: true,
    signatures: [DOCTOR_SIGN],
  },
];
