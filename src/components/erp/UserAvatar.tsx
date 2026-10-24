import { useEffect, useState } from "react";

/**
 * Round profile picture. With no photo (or a broken one) it shows a neutral grey "no photo" avatar
 * (plain head and shoulders, drawn inline: no image download, no initials, no animal).
 */
export function UserAvatar({ src, size = 104, label = "Profile photo", className = "" }: { src?: string | undefined; size?: number; label?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const style = { width: size, height: size } as const;

  if (src && !failed) {
    return <img src={src} alt={label} style={style} className={`shrink-0 rounded-full border border-border object-cover ${className}`} onError={() => setFailed(true)} />;
  }
  return (
    <svg role="img" aria-label={`${label}: none set`} viewBox="0 0 100 100" style={style} className={`shrink-0 rounded-full ${className}`}>
      <rect width="100" height="100" fill="#dfe3e8" />
      <circle cx="50" cy="38" r="17" fill="#fff" fillOpacity="0.9" />
      <path d="M16 100c0-22 15-35 34-35s34 13 34 35z" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}
