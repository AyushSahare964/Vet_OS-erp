import { cn } from "@/lib/utils";

export const PRINT_CSS = `@media print{body *{visibility:hidden!important}#doc-print,#doc-print *{visibility:visible!important}#doc-print{position:absolute;left:0;top:0;width:100%;box-shadow:none!important;border:0!important}#doc-print input{border-color:transparent!important}}`;

export interface SheetClinic {
  fullName: string;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  regNo?: string | undefined;
  gstin?: string | undefined;
  logoPath?: string | undefined;
}

export interface SheetData {
  title: string;
  /** keys: patient, species, sexAge, owner, phone, date, address, microchip */
  header: Record<string, string>;
  paragraphs: string[];
  vaccines: Array<Record<string, string>>;
  vaccineTable: boolean;
  signatures: string[];
  doctor: string;
}

interface Props {
  clinic: SheetClinic;
  data: SheetData;
  /** When set, header cells and paragraphs can be edited in place. */
  onHeader?: (key: string, value: string) => void;
  onParagraph?: (index: number, value: string) => void;
  emptyVaccineMessage?: string;
}

const CELL = "border border-gray-300 p-1.5";

function Cell({ label, k, data, onHeader, colSpan }: { label: string; k: string; data: SheetData; onHeader?: Props["onHeader"]; colSpan?: number }) {
  const v = data.header[k] ?? "";
  return (
    <td className={CELL} colSpan={colSpan}>
      <b>{label}:</b>{" "}
      {onHeader ? (
        <input
          value={v}
          onChange={(e) => onHeader(k, e.target.value)}
          placeholder="________"
          aria-label={label}
          className="w-[60%] border-b border-dashed border-gray-400 bg-transparent px-0.5 outline-none focus:border-primary"
        />
      ) : (
        v || "—"
      )}
    </td>
  );
}

/** The printable form/certificate. Same layout whether it is being filled in or viewed from Saved documents. */
export function DocumentSheet({ clinic, data, onHeader, onParagraph, emptyVaccineMessage }: Props) {
  return (
    <article id="doc-print" className="erp-card mx-auto w-full max-w-[820px] space-y-4 bg-white p-8 text-[13px] leading-relaxed text-gray-900">
      <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
        <div>
          <h1 className="text-lg font-extrabold">{clinic.fullName}</h1>
          <p className="text-[11px] text-gray-600">{[clinic.addressLine1, clinic.addressLine2].filter(Boolean).join(", ")}</p>
          <p className="text-[11px] text-gray-600">{[clinic.phone, clinic.email].filter(Boolean).join(" · ")}</p>
          <p className="text-[11px] text-gray-600">{[clinic.regNo && `Reg. ${clinic.regNo}`, clinic.gstin && `GSTIN ${clinic.gstin}`].filter(Boolean).join(" · ")}</p>
        </div>
        {clinic.logoPath && <img src={clinic.logoPath} alt="" className="h-14 w-auto object-contain" onError={(e) => ((e.target as HTMLElement).style.display = "none")} />}
      </header>

      <h2 className="text-center text-base font-extrabold uppercase tracking-wide">{data.title}</h2>

      <table className="w-full border border-gray-300 text-[12px]">
        <tbody>
          <tr>
            <Cell label="Patient" k="patient" data={data} onHeader={onHeader} />
            <Cell label="Species / breed" k="species" data={data} onHeader={onHeader} />
            <Cell label="Sex / age" k="sexAge" data={data} onHeader={onHeader} />
          </tr>
          <tr>
            <Cell label="Owner" k="owner" data={data} onHeader={onHeader} />
            <Cell label="Phone" k="phone" data={data} onHeader={onHeader} />
            <Cell label="Date" k="date" data={data} onHeader={onHeader} />
          </tr>
          <tr>
            <Cell label="Address" k="address" data={data} onHeader={onHeader} colSpan={2} />
            <Cell label="Microchip" k="microchip" data={data} onHeader={onHeader} />
          </tr>
        </tbody>
      </table>

      <div className="space-y-2.5">
        {data.paragraphs.map((p, i) => (
          <p
            key={i}
            contentEditable={!!onParagraph}
            suppressContentEditableWarning
            onBlur={onParagraph ? (e) => e.currentTarget.innerText !== p && onParagraph(i, e.currentTarget.innerText) : undefined}
            className={cn("whitespace-pre-wrap", onParagraph && "rounded px-1 outline-none hover:bg-amber-50 focus:bg-amber-50 focus:ring-1 focus:ring-primary/40 print:bg-transparent")}
          >
            {p}
          </p>
        ))}
      </div>

      {data.vaccineTable && (
        <table className="w-full border border-gray-300 text-[12px]">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className={CELL}>Vaccine</th>
              <th className={CELL}>Date given</th>
              <th className={CELL}>Batch</th>
              <th className={CELL}>Next due</th>
              <th className={CELL}>Doctor</th>
            </tr>
          </thead>
          <tbody>
            {data.vaccines.map((v, i) => (
              <tr key={i}>
                <td className={CELL}>{v["name"]}</td>
                <td className={CELL}>{v["date"]}</td>
                <td className={CELL}>{v["batchNo"] || "—"}</td>
                <td className={CELL}>{v["nextDue"] || "—"}</td>
                <td className={CELL}>{v["doctor"] || "—"}</td>
              </tr>
            ))}
            {data.vaccines.length === 0 && (
              <tr>
                <td className="border border-gray-300 p-3 text-center text-gray-500" colSpan={5}>
                  {emptyVaccineMessage ?? "No vaccination records."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="grid gap-8 pt-10" style={{ gridTemplateColumns: `repeat(${data.signatures.length}, minmax(0, 1fr))` }}>
        {data.signatures.map((s) => (
          <div key={s} className="text-center">
            <div className="border-t border-gray-700 pt-1 text-[11px] font-semibold">{s === "Attending veterinarian" ? `${s}: ${data.doctor || ""}` : s}</div>
            <div className="text-[10px] text-gray-500">Name, signature and date</div>
          </div>
        ))}
      </div>

      <footer className="border-t pt-2 text-center text-[10px] text-gray-500">Generated by VetechIQ</footer>
    </article>
  );
}
