import { useEffect, useRef, useState } from 'react'
import { useInView, animate } from 'framer-motion'

export const EASE = [0.16, 1, 0.3, 1]

/* ---------------------------------------------------------------- primitives */

export function Count({ to, prefix = '', suffix = '', decimals = 0, pad = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 2.2, ease: EASE, onUpdate: setV })
    return () => c.stop()
  }, [inView, to])
  const n = v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return <span ref={ref} className={className}>{prefix}{pad ? n.padStart(pad, '0') : n}{suffix}</span>
}

export function PulseLed({ color = 'bg-[#5B32E8]' }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0">
      <span className={`absolute inset-0 rounded-full ${color} opacity-75 animate-ping`} />
      <span className={`relative w-2.5 h-2.5 rounded-full ${color}`} />
    </span>
  )
}

export function Clock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return <>{t.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} IST</>
}
