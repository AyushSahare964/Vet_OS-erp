import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import './metrics.css'

const SRC = `/landing/hero-pets/`

const METRICS = [
  {
    idx: '01 // CLEAR BILLING',
    val: 'GST',
    gauge: 'ring', p: 100,
    label: 'Every sale on record',
    body: 'GST invoices, split payments and a clear paid or unpaid status help you see what you earned and what is pending.',
    foot: 'Saves time',
  },
  {
    idx: '02 // FASTER FRONT DESK',
    val: 'Live',
    gauge: 'ring', p: 75,
    label: 'Live queue',
    body: 'A calendar, time slots and a live queue show who is next, so your front desk stays calm even on busy days.',
    foot: 'Fewer mistakes',
  },
  {
    idx: '03 // ONE SYSTEM',
    val: '8 Modules',
    gauge: 'eight',
    label: 'Shared records',
    body: 'Records, lab, stock and billing share the same data, so your team never types the same thing twice.',
    foot: 'One login',
  },
]

function Gauge({ m }) {
  if (m.gauge === 'eight') {
    return (
      <div className="gauge eight">
        <div className="ring8" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--r': `${i * 45}deg`, '--d': `${300 + i * 110}ms` }} />)}
        </div>
        <b>{m.val}</b>
      </div>
    )
  }
  return (
    <div className="gauge" style={{ '--p': m.p }}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" /><circle className="fg" cx="60" cy="60" r="50" /></svg>
      <b>{m.val}</b>
    </div>
  )
}

/* puppy guide: idle loop plays only while visible; still image on Safari/iOS and reduced motion */
function PuppyGuide() {
  const ref = useRef(null)
  useEffect(() => {
    const pup = ref.current, v = pup.querySelector('video')
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!v || isSafari || reduce) return
    v.muted = true
    let alive = true
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        if (!v.getAttribute('src')) v.src = v.dataset.src          // load only once it is first needed
        v.play().then(() => { if (alive) pup.classList.add('playing') }).catch(() => {})
      } else v.pause()
    }), { threshold: 0.3 })
    io.observe(pup)
    return () => { alive = false; io.disconnect(); v.pause() }
  }, [])
  return (
    <div ref={ref} className="pup" aria-hidden="true">
      <video muted playsInline loop preload="none" poster={`${SRC}dog_still.webp`} data-src={`${SRC}dog_idle.webm`} />
      <img alt="" src={`${SRC}dog_still.webp`} />
    </div>
  )
}

/* 4 · metrics: header with the puppy guide, three gauge cards, demo strip */
export default function Metrics() {
  const ref = useRef(null)
  const ctaRef = useRef(null)

  // cards pop in once; the gauges animate as they arrive
  useEffect(() => {
    const els = [...ref.current.querySelectorAll('.pop')]
    els.forEach((el, i) => { el.style.transitionDelay = ((i % 4) * 70) + 'ms' })
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }), { rootMargin: '0px 0px -10% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // bunny guide rises up when the closing banner scrolls in
  useEffect(() => {
    const el = ctaRef.current
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { el.classList.add('in'); io.disconnect() }
    }), { rootMargin: '0px 0px -10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="metrics vx-wrap" id="metrics">
      <div className="m-head">
        <div>
          <span className="tagpill">04 // Why VetechIQ</span>
          <h2>Why Clinics Choose VetechIQ</h2>
          <p className="lead">Less writing. Fewer mistakes. One place for your whole team.</p>
          <span className="tagpill soft">Built for vet clinics</span>
        </div>
        <PuppyGuide />
      </div>

      <div className="m-grid">
        {METRICS.map((m) => (
          <div key={m.idx} className="tile mcard pop">
            <Gauge m={m} />
            <div className="lbl">{m.idx}</div>
            <div className="lbl dim">{m.label}</div>
            <p>{m.body}</p>
            <div className="mrow">
              <span className="vm">✓ {m.foot}</span>
            </div>
          </div>
        ))}
      </div>

      <div ref={ctaRef} className="cta-wrap" id="briefing-form">
        <img className="bunny" alt="" src={`${SRC}rabbit_still.webp`} />
        <div className="cta-strip pop">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#5B32E8] shrink-0">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <b>Ready to try VetechIQ in your clinic?</b>
              <span className="cs-sub">Try it free. Pick a plan when you are ready.</span>
            </div>
          </div>
          <Link
            to="/pricing"
            className="btn-primary inline-flex items-center justify-center text-sm font-bold px-7 py-3.5 rounded-full shrink-0"
          >
            <span>View Plans &amp; Pricing</span>
            <span className="ml-1.5">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
