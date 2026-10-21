import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The VetechIQ product logo (not the clinic's own logo, which comes from clinic branding).
 * "dark" wordmark for light backgrounds, "light" wordmark for dark ones, "icon" for the V mark alone.
 * Falls back to plain text if the image cannot load, so a missing file never leaves a hole.
 */
export function VetechLogo({ variant = "dark", className }: { variant?: "dark" | "light" | "icon"; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={cn("font-black tracking-tight", variant === "light" ? "text-white" : "text-[#001d39]")}>VetechIQ</span>;
  return (
    <img
      src={variant === "icon" ? "/landing/icon.png" : `/landing/logo-${variant}.png`}
      alt="VetechIQ"
      onError={() => setFailed(true)}
      className={cn(variant === "icon" ? "h-8 w-8" : "h-9 w-auto max-w-none", "object-contain", className)}
    />
  );
}
