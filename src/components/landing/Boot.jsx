import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from './Logo'
import { EASE } from './ui'

export const BOOT_MS = 900        // overlay visible time
export const BOOT_FADE_MS = 500   // overlay fade-out

export default function Boot() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), BOOT_MS)
    return () => clearTimeout(t)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center gap-4"
          exit={{ opacity: 0 }}
          transition={{ duration: BOOT_FADE_MS / 1000, ease: EASE }}
        >
          <Logo />
          <span className="text-xs font-bold text-[#4F26D9]">Intelligence Behind Every Care</span>
          <div className="w-48 h-1.5 bg-[#F0EAFA] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#5B32E8]"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
