import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import Logo from './Logo'
import { EASE, PulseLed } from './ui'

const NAV = [
  ['Overview', 'overview'],
  ['Core Modules', 'operational-arms'],
  ['Clinical Systems', 'modules'],
  ['Platform Impact', 'metrics'],
  ['Get Access', 'briefing-form'],
]

export default function Header() {
  const [active, setActive] = useState('top')
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // scroll-spy: the active link is the last target (in page order) whose top has passed 40% of the
    // viewport. Targets can sit inside one another (Clinical Systems is a block inside the Core Modules
    // section), so this works on positions rather than on which element is currently in view.
    let raf = 0
    const spy = () => {
      raf = 0
      const line = window.innerHeight * 0.4
      let cur = 'top'
      NAV.forEach(([, id]) => {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      })
      setActive(cur)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    spy()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // drawer links: closing the drawer unmounts the link mid-click and the browser drops the anchor
  // scroll, so close it and scroll to the target ourselves (scroll-margin-top is still respected)
  const goTo = (e, id) => {
    e.preventDefault()
    setOpen(false)
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <motion.header
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm py-2.5 border-b border-[#EADBFA]'
          : 'bg-white/90 backdrop-blur-sm py-3.5 border-b border-[#EADBFA]/70'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <a href="#top" className="flex items-center gap-3 shrink-0 group">
          <Logo />
          <div className="hidden sm:flex flex-col">
            <span className="badge-purple px-2.5 py-0.5 rounded-full text-[10px] tracking-wide inline-flex items-center gap-1">
              <span>CLINICAL INTELLIGENCE</span>
            </span>
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-[#5E5478] mt-0.5">
              <PulseLed color="bg-[#5B32E8]" />
              <span>Pune &amp; Bengaluru, India</span>
            </div>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {NAV.map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                active === id
                  ? 'text-[#4F26D9] font-bold'
                  : 'text-[#4A3E68] hover:text-[#1E1538] hover:bg-[#F3EDFC]'
              }`}
            >
              {label}
              {active === id && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-[#EFE8FA] rounded-full -z-10 border border-[#DEC9F7]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </a>
          ))}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="btn-ghost inline-flex text-xs md:text-sm font-bold rounded-full px-4 py-2.5"
          >
            Sign In
          </Link>
          <Link
            to="/pricing"
            className="btn-primary group inline-flex items-center justify-center text-xs md:text-sm font-bold px-5 sm:px-6 py-2.5 rounded-full"
          >
            <span>Try Demo</span>
            <span className="ml-1.5 transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden w-9 h-9 rounded-xl border border-[#DEC9F7] bg-white flex items-center justify-center text-[#1E1538] hover:bg-[#F4EEFC] transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            <span className="material-symbols-outlined text-[20px]">{open ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <motion.div
        style={{ scaleX: progress }}
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#5B32E8] via-[#FF8FB1] to-[#FFC9A8] origin-left"
      />

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="lg:hidden overflow-hidden bg-white border-t border-[#EADBFA] shadow-lg px-4 py-3"
          >
            {NAV.map(([label, id], i) => (
              <motion.a
                key={id}
                href={`#${id}`}
                onClick={(e) => goTo(e, id)}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`block px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  active === id ? 'bg-[#F0EAFA] text-[#4F26D9]' : 'text-[#4A3E68] hover:text-[#1E1538]'
                }`}
              >
                {label}
              </motion.a>
            ))}
            <div className="mt-3 pt-3 border-t border-[#EADBFA]">
              <Link to="/login" className="block text-center py-2.5 rounded-full font-bold text-sm text-[#4A3E68] hover:bg-[#F3EDFC]">
                Sign In
              </Link>
              <Link to="/pricing" className="btn-primary mt-2 w-full block text-center py-2.5 rounded-full font-bold text-sm">
                Try Demo →
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
