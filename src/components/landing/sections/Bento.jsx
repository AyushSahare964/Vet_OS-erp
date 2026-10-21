import { useEffect, useRef } from 'react'
import './bento.css'

const SRC = `/landing/hero-pets/`

const MODULES = [
  { c: 'c1', icon: 'pets', title: "Pet Records", desc: "Every pet's visits, vaccines, lab reports and weight in one file." },
  { c: 'c2', icon: 'calendar_month', title: "Appointments", desc: "Calendar, time slots and a live queue with tokens." },
  { c: 'c3', icon: 'local_hospital', title: "Consultation & Lab", desc: "Consult, diagnose, prescribe and order tests in one flow." },
  { c: 'c4', icon: 'medication', title: "Pharmacy & Stock", desc: "Batch and expiry tracking with low-stock alerts." },
  { c: 'c5', icon: 'receipt_long', title: "Billing & Payments", desc: "GST invoices, split payments and clear paid or unpaid status." },
  { c: 'c6', icon: 'account_balance', title: "Boarding & Care", desc: "Boarding, swimming and food plans, managed with the same records." },
]

/* 1 · bento: big heading tile, 4 stat tiles, 6 module tiles */
export default function Bento() {
  const ref = useRef(null)

  useEffect(() => {
    const root = ref.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rafs = new Set()

    // number counters: count up, then end on exactly the text written in the page
    function count(el) {
      const end = +el.dataset.count, pad = +(el.dataset.pad || 0), suf = el.dataset.suffix || '', comma = el.dataset.comma
      const fmt = n => { let s = String(Math.round(n)); if (pad) s = s.padStart(pad, '0'); if (comma) s = Number(s).toLocaleString('en-US'); return s + suf }
      const final = el.dataset.final
      if (reduce) return
      const t0 = performance.now(), dur = 1300
      const step = now => {
        const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3)
        el.textContent = fmt(end * e)
        if (k < 1) rafs.add(requestAnimationFrame(step)); else el.textContent = final
      }
      rafs.add(requestAnimationFrame(step))
    }

    // pop-in for the tiles (plus the kitten in the heading tile)
    const tiles = [...root.querySelectorAll('.pop')]
    tiles.forEach((el, i) => { el.style.transitionDelay = ((i % 4) * 70) + 'ms' })
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      const t = e.target; t.classList.add('in'); io.unobserve(t)
      t.querySelectorAll('[data-count]').forEach(count)
    }), { rootMargin: '0px 0px -10% 0px' })
    tiles.forEach(t => io.observe(t))

    return () => {
      io.disconnect()
      rafs.forEach(id => cancelAnimationFrame(id))
      root.querySelectorAll('[data-count]').forEach(el => { el.textContent = el.dataset.final })
    }
  }, [])

  return (
    <section ref={ref} className="bento vx-wrap" id="overview">
      <div className="b-head tile pop">
        <img className="kitty" alt="" src={`${SRC}cat_still.webp`} />
        <span className="tagpill">Everything in One Console</span>
        <h2>Everything a Vet Clinic Needs, In One Place</h2>
        <p className="lead">Your front desk, doctor, lab, pharmacy and billing work from the same records, so nothing gets lost between rooms.</p>
      </div>

      <div className="tile stat pop">
        <div className="k">LIVE QUEUE</div>
        <div className="v">Live</div>
        <div className="d">See who is waiting, who is with the doctor, and who is done.</div>
        <svg className="spark" viewBox="0 0 120 30" aria-hidden="true"><path d="M0 22 L15 18 L28 21 L42 12 L55 15 L70 8 L84 11 L98 4 L120 6" /></svg>
      </div>
      <div className="tile stat pop">
        <div className="k">CORE PLATFORM</div>
        <div className="v"><span data-count="8" data-pad="2" data-final="08">08</span> Modules</div>
        <div className="d">Connected, one login</div>
        <div className="dots8" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--d': `${i * 90}ms` }} />)}
        </div>
      </div>
      <div className="tile stat pop">
        <div className="k">GST BILLING</div>
        <div className="v">GST</div>
        <div className="d">GST-ready invoices for every sale</div>
        <div className="bar" aria-hidden="true"><b style={{ '--w': '100%' }} /></div>
      </div>
      <div className="tile stat pop">
        <div className="k">ROLE-BASED ACCESS</div>
        <div className="v"><span data-count="4" data-final="4">4</span> Roles</div>
        <div className="d">Admin • Doctor • Receptionist • Accountant</div>
      </div>

      {MODULES.map((m) => (
        <div key={m.title} className={`tile mod pop ${m.c}`}>
          <span className="ic"><span className="material-symbols-outlined">{m.icon}</span></span>
          <h4>{m.title}</h4>
          <p>{m.desc}</p>
        </div>
      ))}
    </section>
  )
}
