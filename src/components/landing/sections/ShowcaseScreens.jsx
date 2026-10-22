/*
 * Screens shown inside the sticky device of the Showcase section, one per module (01–06).
 *
 * Each screen is a real screenshot of the VetechIQ ERP (demo data only), captured at 1440 x 850.
 * The device screen is about 16:10 (it scales with the column); the image is cropped to fill it.
 * To change a screen: replace the .webp in src/components/landing/assets/ (same name), or import a new one below.
 */
import petRecordsShot from '../assets/module-01-pet-records.webp'
import consultationShot from '../assets/module-02-consultation-lab.webp'
import inventoryShot from '../assets/module-03-pharmacy-inventory.webp'
import billingShot from '../assets/module-04-billing.webp'
import ledgersShot from '../assets/module-05-reports-ledgers.webp'
import staffShot from '../assets/module-06-staff-access.webp'

/* real screenshot: fills the whole device screen */
export function Screenshot({ src, alt = '' }) {
  return <img className="scr-shot" src={src} alt={alt} width="1440" height="850" loading="lazy" decoding="async" />
}

/* one entry per module, in order 01 → 06 */
export const SCREENS = [
  // 01 · Pet Records & Appointments
  () => <Screenshot src={petRecordsShot} alt="VetechIQ pet record showing a dog's visit history, prescriptions and a weight trend graph" />,
  // 02 · Consultation & Lab
  () => <Screenshot src={consultationShot} alt="VetechIQ doctor consultation screen with vitals, history, diagnosis and prescribed medicines" />,
  // 03 · Pharmacy & Inventory
  () => <Screenshot src={inventoryShot} alt="VetechIQ inventory alerts showing low-stock medicines and batches close to expiry" />,
  // 04 · Billing & Payments
  () => <Screenshot src={billingShot} alt="VetechIQ billing desk with a list of invoices marked paid, partly paid and unpaid" />,
  // 05 · Reports & Ledgers
  () => <Screenshot src={ledgersShot} alt="VetechIQ cash ledger with receipts, expenses and a running balance" />,
  // 06 · Staff & Access
  () => <Screenshot src={staffShot} alt="VetechIQ staff and access list with doctor, receptionist, accountant and admin roles" />,
]
