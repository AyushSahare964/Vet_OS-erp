import { useState } from 'react'

// variant: 'dark' (purple mark, for light backgrounds) or 'light' (for dark backgrounds)
export default function Logo({ className = 'h-9 sm:h-10 w-auto', variant = 'dark' }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className="font-extrabold text-xl tracking-wide text-[#1E1538] font-sans">VetechIQ</span>
  return (
    <img
      src={`/landing/logo-${variant}.png`}
      alt="VetechIQ"
      className={`${className} max-w-none shrink-0 object-contain object-left`}
      onError={() => setFailed(true)}
    />
  )
}
