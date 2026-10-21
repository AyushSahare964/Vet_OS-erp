import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { PLANS } from './plans'
import { PayButton } from './PayButton'
import './landing.css'
import './pricing.css'

/* Colours come from the main site: indigo #5B32E8 (hover #4A24D6), deep text #1E1538, muted #5E5478,
   border #EADBFA, lavender tints #FAF7FE / #F4EEFC, white cards. Font: Poppins (the site default). */

function Reveal({ children, className = '', delay = 0, y = 24 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Check() {
  return (
    <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

const BTN = 'mt-10 inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-base font-semibold transition-all'
const BTN_SOLID = `${BTN} btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B32E8]`
const BTN_LIGHT = `${BTN} bg-white text-[#5B32E8] shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`

// the feature list is the only part of a card that scrolls; a soft fade at the bottom shows there is more
function FeatureList({ features, on }) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [])
  return (
    <div className="relative mt-8 min-h-0 flex-1">
      <ul
        ref={ref}
        tabIndex={0}
        aria-label="Plan features"
        className={`plan-scroll h-full space-y-3.5 overflow-y-auto overscroll-contain pr-3 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${on ? 'on focus-visible:outline-white' : 'focus-visible:outline-[#5B32E8]'}`}
      >
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${on ? 'bg-white/20 text-white' : 'bg-[#F4EEFC] text-[#5B32E8]'}`}>
              <Check />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t to-transparent transition-opacity duration-150 ${more ? 'opacity-100' : 'opacity-0'} ${on ? 'from-[#5B32E8]' : 'from-white'}`}
      />
    </div>
  )
}

function PlanButton({ plan, on, onMessage }) {
  const cls = on ? BTN_LIGHT : BTN_SOLID
  if (plan.pay) return <PayButton className={cls} label={plan.cta} onMessage={onMessage} />
  return (
    <Link to={plan.to.to} search={plan.to.search} className={on ? BTN_LIGHT : BTN_SOLID}>
      {plan.cta}
    </Link>
  )
}

export default function Pricing() {
  // the one purple card: set by mouse hover, keyboard focus or a tap (touch); stays on tap until another card is tapped
  const [notice, setNotice] = useState('')
  const [activeCard, setActiveCard] = useState(null)

  return (
    <main className="vx-page min-h-screen bg-white font-sans text-[#1E1538]">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#F1EAFF] to-[#FFEEF5] pb-16 pt-36 md:pb-24 md:pt-44">
        <Link to="/" className="absolute left-5 top-8 z-10 text-sm font-semibold text-[#4F26D9] hover:text-[#37189E] md:left-8">← Back to home</Link>
        <div className="absolute right-5 top-6 z-10 flex items-center gap-2 md:right-8">
          <Link to="/login" className="btn-ghost rounded-full px-4 py-2 text-sm font-bold">Sign In</Link>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-gradient-purple-pink opacity-20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-5 text-center md:px-8">
          <Reveal>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[#5B32E8]/70">Pricing</p>
            <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-7xl">Simple plans for every clinic</h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-[#5E5478]">
              Start small and grow. These are sample prices and can be changed at any time.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-white px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.1} className="h-full">
              <article
                tabIndex={-1}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActiveCard(plan.id) }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse' && !e.currentTarget.contains(document.activeElement)) setActiveCard((c) => (c === plan.id ? null : c))
                }}
                onPointerDown={(e) => { if (e.pointerType !== 'mouse') setActiveCard(plan.id) }}
                onFocus={() => setActiveCard(plan.id)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setActiveCard((c) => (c === plan.id ? null : c)) }}
                className={`relative flex h-[600px] flex-col rounded-3xl border p-8 outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-[250ms] ease-out motion-reduce:transform-none motion-reduce:transition-none md:p-10 lg:h-[720px] ${
                  activeCard === plan.id
                    ? '-translate-y-[6px] border-transparent bg-[#5B32E8] text-white shadow-soft-lg'
                    : `bg-white text-[#1E1538] shadow-soft ${plan.highlighted ? 'border-[#5B32E8]' : 'border-[#EADBFA]'}`
                }`}
              >
                {plan.badge && (
                  <span className="absolute right-6 top-6 inline-flex items-center gap-1 rounded-full bg-gradient-lavender-pink px-3 py-1 text-xs font-medium text-[#4F26D9]">
                    {plan.badgeIcon && <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{plan.badgeIcon}</span>}
                    {plan.badge}
                  </span>
                )}
                <h2 className="text-3xl font-semibold tracking-tight">{plan.name}</h2>
                <p className={`mt-2 text-sm leading-relaxed ${activeCard === plan.id ? 'text-white/75' : 'text-[#5E5478]'}`}>{plan.description}</p>
                <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
                  <span className={`${plan.period ? 'text-6xl lg:text-5xl' : 'text-4xl md:text-5xl lg:text-4xl'} font-medium`}>{plan.price}</span>
                  <span className={`text-sm ${activeCard === plan.id ? 'text-white/75' : 'text-[#5E5478]'}`}>{plan.period}</span>
                </p>

                <FeatureList features={plan.features} on={activeCard === plan.id} />

                <PlanButton plan={plan} on={activeCard === plan.id} onMessage={setNotice} />
                {plan.pay && notice && (
                  <p role="alert" className={`mt-3 text-center text-sm font-medium ${activeCard === plan.id ? 'text-white' : 'text-[#C0264F]'}`}>{notice}</p>
                )}
                {plan.note && (
                  <p className={`mt-4 text-center text-xs ${activeCard === plan.id ? 'text-white/90' : 'text-[#5E5478]'}`}>{plan.note}</p>
                )}
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-[#5E5478]">
          All prices are in ₹. GST is extra on paid plans.
        </p>
      </section>
    </main>
  )
}
