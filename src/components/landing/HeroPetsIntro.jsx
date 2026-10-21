import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PulseLed } from './ui'
import { BOOT_MS } from './Boot'

const SRC = `/landing/hero-pets/`

// ---- measured from the videos (copied verbatim from the prototype) ----
// w/h: video canvas; feetY / walkGroundY: paw line when sitting / walking; sitH: sitting height (source px);
// walkX0..X1 / sitX0..X1: body extent inside the canvas while walking / sitting (fractions of canvas width);
// walkEnd: video time where walking stops and the turn-and-sit starts; settle: video time where the pet has sat down.
const PETS = {
  rabbit: { w: 748, h: 666, feetY: 0.9459, walkGroundY: 0.9775, sitH: 543, size: 0.82, z: 5, walkX0: 0.0187, walkX1: 0.9786, turnX0: 0.0374, sitX0: 0.2353, sitX1: 0.7888, walkEnd: 3.875, settle: 8.0 },
  dog:    { w: 748, h: 626, feetY: 0.9233, walkGroundY: 0.9473, sitH: 537, size: 1.0, z: 3, walkX0: 0.0187, walkX1: 0.9826, turnX0: 0.0374, sitX0: 0.123, sitX1: 0.7995, walkEnd: 3.875, settle: 7.8 },
  cat:    { w: 766, h: 608, feetY: 0.9572, walkGroundY: 0.9737, sitH: 508, size: 0.88, z: 4, walkX0: 0.0222, walkX1: 0.9817, turnX0: 0.017, sitX0: 0.1828, sitX1: 0.7624, walkEnd: 3.25, settle: 6.75 },
}
const ORDER = ['rabbit', 'dog', 'cat']   // walking line: rabbit leads, puppy, then kitten
const LINE_GAP = 70         // space between one pet's tail and the next pet's nose while walking (≈2 cm)
const DECEL = 0.6           // seconds of gentle slow-down at the end of the walk
const SIT_RATE = 1.35       // turn-and-sit plays a bit faster so they settle quickly
const DOG_SIT_SHARE = 0.62  // puppy sitting height as a share of the pet area height
const SIT_GAP = 30          // space between sitting pets (px)
// DOM order of the pets on the stage (z-index decides what is in front)
const STAGE_ORDER = ['cat', 'dog', 'rabbit']

const COMPLIANCE = ['One record per pet', 'Live appointment queue', 'Medicine stock control', 'GST billing & reports']

function detectMode() {
  if (typeof window === 'undefined') return 'static'
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const canAlpha = !isSafari && document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''
  return reduce || !canAlpha ? 'static' : 'anim'
}

export default function HeroPetsIntro() {
  const heroRef = useRef(null)
  const stageRef = useRef(null)
  const copyRef = useRef(null)
  // decided once: animated walk, or the still-image fallback (no videos are even rendered then)
  const [mode] = useState(detectMode)

  useEffect(() => {
    const hero = heroRef.current, stage = stageRef.current, copy = copyRef.current
    const animated = mode === 'anim'
    const pets = ORDER.map(k => {
      const el = stage.querySelector(`.pet[data-pet="${k}"]`)
      return { k, el, cfg: PETS[k], intro: el.querySelector('.intro'), idle: el.querySelector('.idle') }
    })
    if (animated) pets.forEach(p => { p.intro.muted = true; p.idle.muted = true })

    let cancelled = false
    const timers = new Set()
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id); return id }
    const rafs = new Set()
    const frame = fn => { const id = requestAnimationFrame(n => { rafs.delete(id); fn(n) }); rafs.add(id); return id }

    // the fixed site header sits on top of the hero: reserve its height
    let hdr = 0
    function measureHeader() {
      const h = document.querySelector('header')
      if (h && (!hdr || window.scrollY <= 20)) hdr = h.offsetHeight
      hero.style.setProperty('--hdr', hdr + 'px')
    }

    function fitText() {
      copy.style.zoom = ''; copy.style.setProperty('--sp', '0px'); copy.style.setProperty('--pt', '0px')
      if (window.innerWidth <= 820) return
      const heroR = hero.getBoundingClientRect(), r0 = copy.getBoundingClientRect()
      const top = r0.top - heroR.top, bottomSpace = Math.max(22, heroR.height * 0.03)
      const avail = heroR.height - top - bottomSpace
      // 1) grow the text a little (kept narrow enough to leave room for the pets)
      const byWidth = (window.innerWidth * 0.52 - r0.left) / r0.width
      const z = Math.max(0.8, Math.min(avail / r0.height, byWidth, 1.4))
      copy.style.zoom = z.toFixed(3)
      // 2) spread any leftover height between the text groups, then centre what is still left
      const left = avail - copy.getBoundingClientRect().height
      if (left > 0) {
        const sp = Math.min(left / 5, 40)
        copy.style.setProperty('--sp', (sp / z).toFixed(1) + 'px')
        const rest = avail - copy.getBoundingClientRect().height
        if (rest > 0) copy.style.setProperty('--pt', (rest / 2 / z).toFixed(1) + 'px')
      }
    }

    let geo = null
    function layout() {
      measureHeader()
      fitText()
      const vw = window.innerWidth, desktop = vw > 820
      stage.style.left = desktop ? '0px' : ''; stage.style.right = desktop ? '0px' : ''
      const s = stage.getBoundingClientRect()
      // final spots: the lower-right area, right of the text column
      const areaL = desktop ? copy.getBoundingClientRect().right + 20 : 12, areaR = s.width - 16, areaW = areaR - areaL
      const rel = k => PETS[k].size * (PETS.dog.sitH / PETS[k].sitH)
      const sitW = k => (PETS[k].sitX1 - PETS[k].sitX0) * PETS[k].w * rel(k)        // sitting width per unit
      const minGap = 16
      // when a pet arrives it is still side-on, so its nose reaches past its sitting body: reserve that space
      const nose = k => (PETS[k].walkX1 - PETS[k].sitX1) * PETS[k].w * rel(k)
      const tail = k => (PETS[k].sitX0 - PETS[k].walkX0) * PETS[k].w * rel(k)
      const byWidth = (areaW - 4 * minGap) / (sitW('cat') + sitW('dog') + sitW('rabbit') + nose('cat') + nose('dog') + tail('dog') + tail('rabbit'))
      const byHeight = Math.min((s.height * DOG_SIT_SHARE) / PETS.dog.sitH,
                                ...ORDER.map(k => (s.height * 0.98) / (PETS[k].h * PETS[k].feetY * rel(k))))
      const unit = Math.min(byWidth, byHeight)
      pets.forEach(p => {
        const c = p.cfg, kk = unit * rel(p.k)
        p.bw = c.w * kk; p.bh = c.h * kk; p.lift = (c.walkGroundY - c.feetY) * p.bh
        p.el.style.width = p.bw + 'px'; p.el.style.height = p.bh + 'px'
        p.el.style.bottom = (-(1 - c.feetY) * p.bh) + 'px'; p.el.style.zIndex = c.z
      })
      // spread the sitting pets inside the area: cat | puppy | rabbit, leaving room for the arriving pet's nose
      const get = k => pets.find(p => p.k === k)
      const seq = ['cat', 'dog', 'rabbit']
      const widths = seq.map(k => (PETS[k].sitX1 - PETS[k].sitX0) * get(k).bw)
      const room = [(PETS.cat.walkX1 - PETS.cat.sitX1) * get('cat').bw + (PETS.dog.sitX0 - PETS.dog.walkX0) * get('dog').bw,
                    (PETS.dog.walkX1 - PETS.dog.sitX1) * get('dog').bw + (PETS.rabbit.sitX0 - PETS.rabbit.walkX0) * get('rabbit').bw]
      const spare = Math.max(0, areaW - widths.reduce((a, b) => a + b, 0) - room[0] - room[1] - 2 * minGap)
      const extra = Math.min(40, spare / 4)
      const gaps = [room[0] + minGap + extra, room[1] + minGap + extra]
      const used = widths.reduce((a, b) => a + b, 0) + gaps[0] + gaps[1]
      let x = areaL + (areaW - used) / 2
      seq.forEach((k, i) => { const p = get(k); p.finalLeft = x - PETS[k].sitX0 * p.bw; x += widths[i] + (gaps[i] || 0) })
      // closer, bigger sitting group: puppy keeps its spot, kitten and bunny sit right next to it
      {
        const dogP = get('dog'), dogCenter = dogP.finalLeft + (PETS.dog.sitX0 + PETS.dog.sitX1) / 2 * dogP.bw
        const half = k => (PETS[k].sitX1 - PETS[k].sitX0) / 2 * PETS[k].w * rel(k)
        const full = k => 2 * half(k)
        const u2 = Math.min(unit * 1.25, byHeight,
                            (areaR - dogCenter - SIT_GAP) / (half('dog') + full('rabbit')),
                            (dogCenter - areaL - SIT_GAP) / (half('dog') + full('cat')))
        pets.forEach(p => {
          const c = p.cfg, kk = u2 * rel(p.k)
          p.bw = c.w * kk; p.bh = c.h * kk; p.lift = (c.walkGroundY - c.feetY) * p.bh
          p.el.style.width = p.bw + 'px'; p.el.style.height = p.bh + 'px'
          p.el.style.bottom = (-(1 - c.feetY) * p.bh) + 'px'
        })
        const d = get('dog'), c = get('cat'), r = get('rabbit')
        const dogL = dogCenter - half('dog') * u2, dogR = dogCenter + half('dog') * u2
        d.finalLeft = dogL - PETS.dog.sitX0 * d.bw
        c.finalLeft = dogL - SIT_GAP - PETS.cat.sitX1 * c.bw
        r.finalLeft = dogR + SIT_GAP - PETS.rabbit.sitX0 * r.bw
      }
      // walking: every pet starts fully off the left edge of the screen and walks at the SAME speed.
      // While still side-on, a pet needs more room than when sitting, so each follower first stops a little
      // to the left (clear of the pet in front), then glides into its sitting spot WHILE it turns.
      {
        const G = 26, r = get('rabbit'), d = get('dog'), c = get('cat')
        r.shift = 0
        d.shift = Math.max(0, (d.finalLeft + d.cfg.walkX1 * d.bw + G) - (r.finalLeft + Math.min(r.cfg.walkX0, r.cfg.turnX0) * r.bw))
        c.shift = Math.max(0, (c.finalLeft + c.cfg.walkX1 * c.bw + G) - (d.finalLeft - d.shift + Math.min(d.cfg.walkX0, d.cfg.turnX0) * d.bw))
      }
      pets.forEach(p => { p.startLeft = -s.left - p.cfg.walkX1 * p.bw - 10; p.dist = (p.finalLeft - p.shift) - p.startLeft })
      const lead = pets[0]
      const v = lead.dist / (lead.cfg.walkEnd - DECEL / 2)                          // lead pet uses its whole walk
      pets.forEach(p => {
        p.T = Math.min(p.dist / v + DECEL / 2, p.cfg.walkEnd)
        p.offset = p.cfg.walkEnd - p.T                                                // start its video a little later in the walk
      })
      // tight line: each follower walks right behind the one in front (about LINE_GAP between tail and nose)
      geo = { v }
      pets[0].delay = 0
      for (let i = 1; i < pets.length; i++) {
        const a = pets[i - 1], b = pets[i]
        const want = LINE_GAP
        const fits = d => {                       // is b always at least `want` behind a if it starts d seconds after?
          for (let t = d; t <= a.delay + a.T - DECEL; t += 0.02) {   // while both are walking in line
            const ax = a.startLeft + walked(a, t - a.delay), bx = b.startLeft + walked(b, t - d)
            if (bx + b.cfg.walkX1 * b.bw > ax + a.cfg.walkX0 * a.bw - want + 0.5) return false
          }
          return true
        }
        let lo = a.delay, hi = a.delay + 6
        for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m }
        b.delay = hi
      }
      geo = { left: s.left, width: s.width, height: s.height, v }
    }

    // distance walked after `u` seconds of walking (constant speed, then a gentle stop)
    function walked(p, u) {
      const v = geo.v, T = p.T
      if (u <= 0) return 0
      if (u <= T - DECEL) return v * u
      const w = Math.min(u, T) - (T - DECEL)
      return v * (T - DECEL) + v * (w - (w * w) / (2 * DECEL))
    }
    const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
    function place(p, vt) {                     // vt = the pet's own video time (feet stay in step with the movement)
      const u = vt - p.offset
      const x = p.startLeft + walked(p, u) + p.shift * smooth((vt - p.cfg.walkEnd - 0.6) / 2.4)   // glide in while turning
      const y = -p.lift * (1 - smooth((vt - p.cfg.walkEnd) / 1.0))
      p.el.style.transform = `translate3d(${x}px, ${y}px, 0)`
      return x
    }
    function placeFinal(p) { p.el.style.transform = `translate3d(${p.finalLeft}px, 0, 0)` }

    function showStatic() {
      hero.classList.add('static', 'done'); layout(); pets.forEach(placeFinal); stage.classList.add('placed')
      // no walk to wait for here, so measure again once the fonts are in
      const again = () => { if (!cancelled) { layout(); pets.forEach(placeFinal) } }
      if (document.fonts) document.fonts.ready.then(again)
    }

    function goIdle(p) {                          // idle fades in ON TOP of the intro, so the pet never looks see-through
      if (p.idling) return; p.idling = true
      p.idle.currentTime = 0
      const show = () => {
        if (cancelled) return
        p.el.classList.add('idling')
        later(() => { p.el.classList.add('intro-off'); p.intro.pause() }, 280)
      }
      p.idle.play().then(() => {
        if (cancelled) return
        if (p.idle.requestVideoFrameCallback) p.idle.requestVideoFrameCallback(show); else show()
      }).catch(show)
    }

    let t0 = 0, revealDone = false
    function tick(now) {
      if (cancelled) return
      const clock = (now - t0) / 1000
      pets.forEach(p => {
        if (!p.started && clock >= p.delay) { p.started = true; p.clock0 = now; p.intro.currentTime = p.offset; p.intro.play().catch(() => {}) }
        // smooth clock for movement (video time can update in small bursts); it follows the video if the video stalls
        let vt = p.offset
        if (p.started) {
          vt = p.offset + (now - p.clock0) / 1000
          const real = p.intro.currentTime
          if (real < p.cfg.walkEnd) {
            if (vt - real > 0.2) { vt = Math.max(p.lastVt || p.offset, real); p.clock0 = now - (vt - p.offset) * 1000 }  // video stalled: wait, never step back
            else if (real - vt > 0.2) { vt = real; p.clock0 = now - (vt - p.offset) * 1000 }                               // video ahead: catch up
          }
          if (vt >= p.cfg.walkEnd) vt = Math.max(p.cfg.walkEnd, real)
        }
        // safety: if the pet in front briefly pauses (e.g. its video is still loading), the follower waits too
        const i = pets.indexOf(p)
        if (i > 0 && p.started && vt < p.cfg.walkEnd && p.intro.currentTime < p.cfg.walkEnd) {
          const a = pets[i - 1]
          const limit = a.x + Math.min(a.cfg.walkX0, a.cfg.turnX0) * a.bw - p.cfg.walkX1 * p.bw - 24   // keep a clear gap, even if the one in front pauses
          const want = p.startLeft + walked(p, vt - p.offset)
          if (want > limit && a.x !== undefined) { p.clock0 += now - (p.lastNow || now); vt = p.lastVt }
        }
        p.lastNow = now
        p.lastVt = vt
        p.x = place(p, vt)
        if (p.started && !p.fast && p.intro.currentTime >= p.cfg.walkEnd) { p.fast = true; p.intro.playbackRate = SIT_RATE }
        if (p.started && !p.idling && (p.intro.currentTime >= p.cfg.settle || p.intro.ended)) goIdle(p)
      })
      if (!revealDone) {
        const lead = pets[0], edge = geo.left + lead.x + lead.cfg.walkX1 * lead.bw     // text appears as the rabbit passes
        if (lead.started && lead.intro.currentTime >= lead.cfg.walkEnd) {
          revealDone = true
          const from = edge, dur = 600, start = performance.now()
          const fin = n => {
            if (cancelled) return
            const k = Math.min((n - start) / dur, 1), e = 1 - Math.pow(1 - k, 3)
            hero.style.setProperty('--r', (from + (window.innerWidth + 200 - from) * e) + 'px')
            if (k < 1) frame(fin); else hero.classList.add('done')
          }
          frame(fin)
        } else hero.style.setProperty('--r', Math.max(edge, 0) + 'px')
      }
      if (!pets.every(p => p.idling)) frame(tick)
      else pets.forEach(placeFinal)
    }

    const canStart = v => new Promise(res => {
      if (v.readyState >= 3) return res()
      v.addEventListener('canplay', res, { once: true })
    })

    async function start() {
      hero.classList.remove('done', 'static'); revealDone = false; stage.classList.remove('placed')
      pets.forEach(p => {
        p.started = p.idling = p.fast = false; p.lastVt = 0; p.x = undefined
        p.el.classList.remove('idling', 'intro-off')
      })
      if (!animated) return showStatic()
      pets.forEach(p => { p.intro.pause(); p.intro.playbackRate = 1; p.intro.currentTime = 0; p.idle.pause() })
      layout(); pets.forEach(p => place(p, p.offset)); stage.classList.add('placed')   // all start off-screen left
      hero.style.setProperty('--r', '0px')
      await Promise.race([
        Promise.all([
          ...pets.map(p => canStart(p.intro)),
          document.fonts ? document.fonts.ready : Promise.resolve(),
          new Promise(r => later(r, BOOT_MS + 300)),          // let the boot overlay fade first
        ]),
        new Promise(r => later(r, 8000)),
      ])                                                      // text stays hidden until the pets walk past it
      if (cancelled) return
      layout(); pets.forEach(p => place(p, p.offset))         // fonts are in now: final measurements
      t0 = performance.now(); frame(tick)
    }

    const onResize = () => { layout(); if (hero.classList.contains('done')) pets.forEach(placeFinal) }
    window.addEventListener('resize', onResize)
    start()

    return () => {
      cancelled = true
      rafs.forEach(id => cancelAnimationFrame(id)); rafs.clear()
      timers.forEach(id => clearTimeout(id)); timers.clear()
      window.removeEventListener('resize', onResize)
      if (animated) pets.forEach(p => { p.intro.pause(); p.idle.pause() })
    }
  }, [mode])

  return (
    <section id="top" ref={heroRef} className={`hero-pets${mode === 'static' ? ' static done' : ''}`}>
      <div className="hp-reveal">
        <div className="hp-status flex items-center gap-2 text-xs font-bold text-[#5E5478]">
          <PulseLed color="bg-[#5B32E8]" />
          <span>VetechIQ • 8 modules, one login</span>
        </div>

        <div className="hp-ghost" aria-hidden="true">VETECHIQ</div>

        <div className="hp-copy max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={copyRef} className="hp-copy-inner">
            <div className="flex flex-col items-start gap-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF1EE] border border-[#FF8FB1]/30 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#FF8FB1] animate-pulse" />
                <span className="text-xs font-bold text-[#1E1538] tracking-wide">
                  Made for veterinary clinics
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full badge-purple text-xs">
                <span className="material-symbols-outlined text-[16px] text-[#4F26D9]">pets</span>
                <span>Clinic software, one login</span>
              </div>
            </div>

            <h1 className="hp-g text-3xl sm:text-5xl lg:text-[54px] font-extrabold text-[#1E1538] leading-[1.12] tracking-tight">
              Run Your Whole Vet Clinic From One Screen.
            </h1>
            <p className="hp-g text-xl sm:text-2xl font-bold text-gradient-purple-pink">
              More time for pets. Less time on paperwork.
            </p>

            <p className="hp-g text-base sm:text-lg text-[#5E5478] leading-relaxed font-medium">
              VetechIQ is clinic software made for veterinary doctors. Pet records, appointments, prescriptions, lab, medicine stock and billing live in one place, so your team writes things once and finds them fast.
            </p>

            {/* CTAs */}
            <div className="hp-g flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
              <a
                href="#operational-arms"
                className="group inline-flex items-center justify-center bg-white hover:bg-[#F6F1FD] border-2 border-[#D8C7F5] hover:border-[#5B32E8] text-[#1E1538] font-bold text-sm sm:text-base px-7 py-4 rounded-full shadow-sm transition-all duration-300"
              >
                <span>Explore All Modules</span>
                <motion.span
                  className="ml-2 inline-block text-[#5B32E8] font-extrabold"
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  ↓
                </motion.span>
              </a>
            </div>

            {/* Compliance Pills */}
            <div className="hp-g flex flex-wrap items-center gap-2 pt-4 border-t border-[#EADBFA]">
              <span className="text-xs font-bold text-[#1E1538] mr-1">What you get:</span>
              {COMPLIANCE.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#F4EEFC] text-[#4F26D9] border border-[#DEC9F7]"
                >
                  ✓ {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div ref={stageRef} className="hp-stage" aria-hidden="true">
        <div className="hp-floor" />
        {STAGE_ORDER.map((k) => (
          <div key={k} className="pet" data-pet={k}>
            {mode === 'anim' && (
              <>
                <video className="intro" muted playsInline preload="auto" src={`${SRC}${k}_intro.webm`} />
                <video className="idle" muted playsInline loop preload="auto" src={`${SRC}${k}_idle.webm`} />
              </>
            )}
            <img alt="" src={`${SRC}${k}_still.webp`} />
          </div>
        ))}
      </div>
    </section>
  )
}
