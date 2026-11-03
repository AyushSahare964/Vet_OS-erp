/**
 * Signatures kept in memory so prescriptions, invoices and purchase documents can read them synchronously:
 *  - the hospital's (authorised signatory) signature, set under Hospital → Signature
 *  - one signature per doctor, set under Hospital → Doctor signatures
 * Both are loaded with the clinic profile (see store.tsx) and refreshed when a signature is saved.
 */
let hospitalSignature = "";
let headDoctor = "";
let doctorSigs: { key: string; name: string; url: string }[] = [];

export const getHospitalSignature = () => hospitalSignature;
export const setHospitalSignature = (dataUrl: string | undefined | null, headDoctorName?: string | null) => {
  hospitalSignature = dataUrl || "";
  headDoctor = headDoctorName || "";
};

/** "Dr. Makarand M. Dixit" and "Dr Makarand Mukund Dixit" give the same key: first + last name, titles/initials dropped. */
export const doctorKey = (name: string | undefined | null) => {
  const t = (name || "").toLowerCase().replace(/\b(dr|prof|mr|mrs|ms)\b\.?/g, " ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((x) => x.length > 1);
  return t.length ? `${t[0]}|${t[t.length - 1]}` : "";
};

export const setDoctorSignatures = (list: { name: string; signatureUrl?: string | undefined }[]) => {
  doctorSigs = list.filter((d) => d.signatureUrl).map((d) => ({ key: doctorKey(d.name), name: d.name, url: d.signatureUrl as string }));
};

/**
 * The signature of the named doctor. The head doctor (hospital profile) falls back to the hospital signature;
 * nobody else ever gets another doctor's signature.
 */
export const getSignatureForDoctor = (name: string | undefined | null): string => {
  const k = doctorKey(name);
  if (!k) return "";
  const own = doctorSigs.find((d) => d.key === k);
  if (own) return own.url;
  return hospitalSignature && doctorKey(headDoctor) === k ? hospitalSignature : "";
};
