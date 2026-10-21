import { useEffect, useRef, useState } from 'react'
import { PulseLed } from '../ui'
import { SCREENS } from './ShowcaseScreens'
import modulePatientImg from '../assets/module-patient.jpg'
import moduleOpdImg from '../assets/module-opd.jpg'
import modulePharmacyImg from '../assets/module-pharmacy.jpg'
import './showcase.css'

const ARMS = [
  {
    idx: 'MODULE 01 // PET RECORDS & APPOINTMENTS',
    tag: 'Every pet, every visit, one record.',
    img: modulePatientImg,
    title: 'Pet Records & Appointments',
    items: [
      'Warns you if the owner or mobile number already exists',
      'Book by calendar and time slot, and give each pet a token',
      'See the whole history: visits, vaccines, labs, bills',
      'Weight and health trend graph for each pet',
    ],
    outcome: 'Less searching, fewer duplicates',
    sys: '01',
  },
  {
    idx: 'MODULE 02 // CONSULTATION & LAB',
    tag: 'Consult, prescribe and bill in one screen.',
    img: moduleOpdImg,
    title: 'Consultation & Lab',
    items: [
      'Record complaint, vitals and diagnosis',
      'Prescribe from your own medicine stock',
      'Order lab tests and see results with reference ranges',
      'Print lab reports and vaccination certificates',
    ],
    outcome: 'Faster consultations',
    sys: '02',
  },
  {
    idx: 'MODULE 03 // PHARMACY & INVENTORY',
    tag: 'Know what you have, and what is running out.',
    img: modulePharmacyImg,
    title: 'Pharmacy & Inventory',
    items: [
      'Batch and expiry tracking',
      'Low-stock and expiry alerts',
      'Medicines, injections, food and accessories',
      'Purchase orders with receiving and purchase bills',
    ],
    outcome: 'Fewer stock-outs and expiries',
    sys: '03',
  },
]

const MODULES = [
  {
    idx: 'MODULE 04 // BILLING & PAYMENTS',
    title: 'Billing & Payments',
    subtitle: 'Fast counter bills and clear payments.',
    items: [
      'GST invoices and quotations',
      'Split payment, for example cash plus UPI',
      'Paid, partly paid and unpaid status',
      'Supplier bills and purchase orders',
    ],
    outcome: 'Clear money, every day',
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    idx: 'MODULE 05 // REPORTS & LEDGERS',
    title: 'Reports & Ledgers',
    subtitle: 'See where the money stands.',
    items: [
      'Customer, supplier and cash ledgers',
      'Export to Excel, PDF or share by email and WhatsApp',
      'Expense records and discount schemes',
      'Sales and revenue reports',
    ],
    outcome: 'Know your numbers',
    status: 'Live',
    statusColor: 'bg-purple-100 text-[#4F26D9] border-purple-200',
  },
  {
    idx: 'MODULE 06 // STAFF & ACCESS',
    title: 'Staff & Access',
    subtitle: 'The right screens for the right person.',
    items: [
      'Roles for Admin, Doctor, Receptionist and Accountant',
      'Staff approval by the Admin',
      'Staff performance reports for the Admin',
      'Printable consent forms and certificates',
    ],
    outcome: 'Safer, simpler teamwork',
    status: 'Enabled',
    statusColor: 'bg-pink-100 text-pink-800 border-pink-200',
  },
]

/* 2 · sticky screen showcase: module text scrolls on the left, a sticky device on the right shows its screen */
export default function Showcase() {
  const textRef = useRef(null)
  const [current, setCurrent] = useState(0)

  // the module block closest to the middle of the viewport is the active one
  useEffect(() => {
    const blocks = [...textRef.current.querySelectorAll('.block[data-screen]')]
    let raf = 0
    const pick = () => {
      raf = 0
      const mid = window.innerHeight * 0.5
      let best = 0, bd = 1e9
      blocks.forEach((b) => {
        const r = b.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid)
        if (d < bd) { bd = d; best = +b.dataset.screen }
      })
      setCurrent(best)              // React skips the re-render when the value did not change
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    pick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const blockCls = (i) => `block${current === i ? ' active' : ''}`

  return (
    <section className="show vx-wrap" id="operational-arms">
      <div className="show-text" ref={textRef}>
        <div className="block intro">
          <span className="tagpill">Part 1 // Daily Clinic Work</span>
          <h2>The Daily Work of Your Clinic</h2>
          <p className="lead">From the front desk to the doctor's table, every step is in one flow.</p>
          <span className="tagpill soft">VetechIQ Modules 01 — 03</span>
        </div>

        {ARMS.map((a, i) => (
          <article key={a.sys} className={blockCls(i)} data-screen={i}>
            <img className="thumb" alt={a.title} src={a.img} />
            <div className="mtag">{a.idx}</div>
            <div className="lbl">{a.tag}</div>
            <h3>{a.title}</h3>
            <ul className="blist">{a.items.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="row">
              <span className="incl">{a.outcome}</span>
              <span className="chip">Core System {a.sys}</span>
            </div>
          </article>
        ))}

        <div className="block intro" id="modules">
          <span className="tagpill">Part 2 // Money & Staff</span>
          <h2>Billing, Reports &amp; Staff Access</h2>
          <span className="tagpill soft"><PulseLed color="bg-[#5B32E8]" />All modules work together</span>
        </div>

        {MODULES.map((m, i) => (
          <article key={m.title} className={blockCls(i + 3)} data-screen={i + 3}>
            <div className="lbl">{m.idx}</div>
            <h3>{m.title}</h3>
            <div className="sub">{m.subtitle}</div>
            <ul className="blist">{m.items.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="row">
              <span className="incl">{m.outcome}</span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${m.statusColor}`}>{m.status}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="show-device" aria-hidden="true">
        <div className="device">
          <div className="dev-top"><i /><i /><i /></div>
          <div className="dev-screen">
            {/* one screen per module; to use real screenshots, edit SCREENS in ShowcaseScreens.jsx */}
            {SCREENS.map((Screen, i) => (
              <div key={i} className={`scr${current === i ? ' on' : ''}`}><Screen /></div>
            ))}
          </div>
        </div>
        <div className="device-foot" />
        <div className="pager">{SCREENS.map((_, i) => <i key={i} className={current === i ? 'on' : ''} />)}</div>
      </div>
    </section>
  )
}
