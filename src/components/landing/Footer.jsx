import './footer.css'

const FOOT = [
  ['01 // ERP MODULES', ['Pet Records', 'Appointments', 'Consultation', 'Lab']],
  ['02 // MONEY', ['Billing', 'Purchases', 'Ledgers', 'Reports']],
  ['03 // OPERATIONS', ['Inventory', 'Boarding & Swimming', 'Food & Nutrition', 'Documents']],
  ['04 // PLANS & SUPPORT', ['Pricing & Plans', 'Free Trial', 'Contact & Support']],
]

export default function Footer() {
  return (
    <footer className="foot">
      <div className="cols">
        {FOOT.map(([h, items]) => (
          <div key={h}>
            <h5>{h}</h5>
            {items.map((it) => <a key={it} href="#top">{it}</a>)}
          </div>
        ))}
      </div>

      <div className="legal">
        <span>
          © 2026 VetechIQ. All rights reserved.
        </span>
        <span>
          <a href="#top">Privacy Policy</a> • <a href="#top">Terms of Service</a>
        </span>
      </div>

      {/* Decorative Brand Watermark */}
      <div className="foot-word" aria-hidden="true">VETECHIQ</div>
    </footer>
  )
}
