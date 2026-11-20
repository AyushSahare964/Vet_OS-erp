import { useClinicBranding } from "@/lib/erp/useClinicBranding";
import { getHospitalSignature } from "@/lib/erp/hospitalSignature";

/** Cursive fallback used on the documents when a doctor has no signature image. */
const SCRIPT = { fontFamily: "'Dancing Script', 'Brush Script MT', cursive" } as const;

/**
 * Miniature of the footers where a doctor's signature is printed (prescription and tax invoice), so the doctor
 * sees the signature in place, with their own details, before saving it.
 */
export function SignatureDocPreview({
  signature,
  doctorName,
  title,
}: {
  signature: string;
  doctorName: string;
  /** Specialty / designation printed under the name. */
  title?: string | undefined;
}) {
  const clinic = useClinicBranding();
  const name = doctorName || clinic.doctorName;
  const hospitalSig = getHospitalSignature();

  const Page = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 animate-in fade-in duration-300">
      <Page label="On the prescription">
        <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-2 text-[8px] text-slate-500">
          <div className="space-y-0.5">
            <p>• Administer medicines per prescribed dose and schedule.</p>
            <p>• Store in a cool and dry place.</p>
          </div>
          <div className="min-w-[110px] space-y-0.5 text-center">
            {signature ? (
              <img src={signature} alt="Signature preview" className="mx-auto max-h-10 object-contain" />
            ) : (
              <p className="text-[13px] leading-none text-slate-500" style={SCRIPT}>{name}</p>
            )}
            <div className="border-b border-slate-400 pb-1 font-serif text-[8px] italic text-slate-400">Digitally Signed</div>
            <p className="text-[9px] font-bold text-slate-800">{name}</p>
            <p className="text-[8px] text-slate-500">{title || clinic.doctorDesignation || "Registered Veterinary Practitioner"}</p>
          </div>
        </div>
        <p className="mt-2 border-t border-dashed border-slate-200 pt-1 text-[7px] text-slate-400">
          {clinic.fullName} · Electronically Generated &amp; Signed Clinical Prescription
        </p>
      </Page>

      <Page label="On the final bill">
        <div className="flex items-end justify-between gap-3 border-t border-slate-200 pt-2 text-[8px] text-slate-500">
          <div className="space-y-0.5">
            <p>• This is a computer-generated tax invoice.</p>
          </div>
          <div className="flex items-end gap-4">
            <div className="min-w-[100px] text-center">
              <div className="relative mb-3">
                <div className="h-px w-full bg-slate-300" />
                {signature ? (
                  <img src={signature} alt="Signature preview" className="absolute -top-8 left-1/2 max-h-10 -translate-x-1/2 object-contain" />
                ) : (
                  <p className="absolute -top-3 left-0 right-0 text-center text-[12px] leading-none text-slate-500" style={SCRIPT}>{name}</p>
                )}
              </div>
              <p className="text-[9px] font-bold text-slate-800">{name}</p>
              <p className="text-[8px] text-slate-500">{clinic.doctorQualifications || "BVSc & AH"} · Attending Veterinarian</p>
            </div>
            <div className="min-w-[90px] text-right">
              <p className="mb-3 text-[8px] font-bold text-slate-700">For {clinic.fullName || clinic.shortName}</p>
              {hospitalSig && <img src={hospitalSig} alt="Authorized signature" className="-mt-3 mb-0.5 ml-auto max-h-8 object-contain" />}
              <div className="h-px w-full bg-slate-300" />
              <p className="pt-0.5 text-[7px] text-slate-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </Page>
    </div>
  );
}
