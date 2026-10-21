/*
 * Screens shown inside the sticky device of the Showcase section, one per module (01–06).
 *
 * These are text-free PLACEHOLDER mock-ups.
 * ── To use a real VetechIQ screenshot instead ─────────────────────────────────────────
 *   1. put the image in src/assets/ (e.g. src/assets/screen-patients.png)
 *   2. import it here:          import patientsShot from '../assets/screen-patients.png'
 *   3. replace the entry in SCREENS below with:
 *          () => <Screenshot src={patientsShot} />
 *   The device screen is about 16:10 (it scales with the column); the image is cropped to fill it.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/* real screenshot: fills the whole device screen */
export function Screenshot({ src, alt = '' }) {
  return <img className="scr-shot" src={src} alt={alt} />
}

/* 01 · patient list + selected patient profile */
function PatientList() {
  return (
    <div className="scr-grid s0">
      <div className="side" />
      <div className="main">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="row-l" />)}</div>
      <div className="pane">
        <div className="av" />
        <div className="ln" /><div className="ln s" /><div className="ln" />
        <div className="tags"><i /><i /><i /></div>
      </div>
    </div>
  )
}

/* 02 · OPD board: check-in → in-consultation → completed */
function OpdBoard() {
  return (
    <div className="scr-grid">
      <div className="side" />
      <div className="kan">
        <div className="col"><b /><i /><i /><i /></div>
        <div className="col"><b /><i /><i /></div>
        <div className="col"><b /><i /><i /><i /><i /></div>
      </div>
    </div>
  )
}

/* 03 · pharmacy shelves with stock levels (red = low stock) */
const STOCK = [['82%'], ['35%', 'low'], ['64%'], ['91%'], ['22%', 'low'], ['58%'], ['76%'], ['47%'], ['88%']]
function PharmacyShelves() {
  return (
    <div className="scr-grid">
      <div className="side" />
      <div className="shelf">{STOCK.map(([p, low], i) => <i key={i} className={low || undefined} style={{ '--p': p }} />)}</div>
    </div>
  )
}

/* 04 · invoice with total and split payments */
function Invoice() {
  return (
    <div className="scr-grid">
      <div className="side" />
      <div className="inv">
        <div className="hd" />
        <div className="ln" /><div className="ln" /><div className="ln" /><div className="ln" />
        <div className="tot" />
        <div className="pay"><i /><i /><i /></div>
      </div>
    </div>
  )
}

/* 05 · revenue chart + ledger */
const BARS = ['40%', '62%', '48%', '80%', '66%', '92%', '74%']
function AccountingChart() {
  return (
    <div className="scr-grid">
      <div className="side" />
      <div className="acc">
        <div className="chart">{BARS.map((h, i) => <i key={i} style={{ '--h': h }} />)}</div>
        <div className="ledger"><i /><i /><i /></div>
      </div>
    </div>
  )
}

/* 06 · staff access screen */
const SHIFTS = [['a', '1/2/2/4'], ['b', '2/1/3/3'], ['c', '3/3/4/6'], ['a', '4/2/5/5'], ['b', '5/4/6/7'], ['c', '2/5/3/7']]
function StaffRoster() {
  return (
    <div className="scr-grid">
      <div className="side" />
      <div className="ros">{SHIFTS.map(([c, area], i) => <i key={i} className={c} style={{ gridArea: area }} />)}</div>
    </div>
  )
}

/* one entry per module, in order 01 → 06 — swap any of these for () => <Screenshot src={…} /> */
export const SCREENS = [
  PatientList,      // 01 · Patient Records & Appointment Engine
  OpdBoard,         // 02 · Consultation & Lab
  PharmacyShelves,  // 03 · Pharmacy & Inventory Control
  Invoice,          // 04 · Smart Billing & POS
  AccountingChart,  // 05 · Reports & Ledgers
  StaffRoster,      // 06 · Staff & Access
]
