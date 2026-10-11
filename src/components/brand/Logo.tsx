import { BRAND } from "@/config/brand";

/** Two crossing threads: the Warpwork mark. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 9c5 0 6 10 11 10s6-10 11-10" />
      <path d="M3 19c5 0 6-10 11-10s6 10 11 10" />
    </svg>
  );
}

/** The mark and the brand name, in the current text color. */
export function Logo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-[-0.02em]" style={{ fontSize: Math.round(size * 0.8) }}>
        {BRAND.name}
      </span>
    </span>
  );
}
