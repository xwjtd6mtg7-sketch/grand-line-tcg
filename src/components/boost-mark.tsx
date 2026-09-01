import { useId } from "react";
import { cn } from "@/lib/utils";

/** Vector "point booster" — mini booster pack, gold DA. */
export function BoostMark({ className, gold }: { className?: string; gold?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 44" className={cn("boost-mark", gold && "is-gold", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3344" />
          <stop offset="1" stopColor="#121820" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ead4" />
          <stop offset="0.45" stopColor="#e8c96a" />
          <stop offset="1" stopColor="#c9a227" />
        </linearGradient>
      </defs>
      <rect
        x="3.2"
        y="2.2"
        width="25.6"
        height="39.6"
        rx="4.2"
        fill={gold ? `url(#${id}g)` : `url(#${id}b)`}
        stroke={`url(#${id}g)`}
        strokeWidth="1.6"
      />
      <rect x="6.4" y="6.2" width="19.2" height="14.8" rx="2" fill="#0b1018" stroke="#c9a22788" strokeWidth="0.8" />
      <path d="M10 11.4h12M12.2 14.6h7.6" stroke="#e8c96a" strokeWidth="1.15" strokeLinecap="round" />
      <rect x="5.2" y="23.2" width="21.6" height="6.2" rx="1.2" fill={gold ? "#102030" : `url(#${id}g)`} />
      <text x="16" y="27.8" textAnchor="middle" fill={gold ? "#f4ead4" : "#102030"} fontSize="5.4" fontFamily="Cinzel,serif" fontWeight="700">
        BP
      </text>
      <rect x="8" y="31.6" width="16" height="6.4" rx="1.1" fill="#0b1018" stroke="#c9a22755" strokeWidth="0.7" />
    </svg>
  );
}

/** Stacked packs hero, TCG Pocket-style. */
export function BoostHero({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 88 72" className={cn("boost-hero", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ead4" />
          <stop offset="1" stopColor="#c9a227" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id}g)`} strokeWidth="3.2" strokeLinejoin="round">
        <rect x="6" y="28" width="26" height="34" rx="6" transform="rotate(-14 19 45)" />
        <rect x="28" y="32" width="24" height="30" rx="6" />
        <rect x="46" y="10" width="32" height="44" rx="7" transform="rotate(8 62 32)" />
      </g>
      <circle cx="72" cy="14" r="2.2" fill="#e8c96a" />
      <circle cx="78" cy="22" r="1.4" fill="#f4ead4" />
      <circle cx="68" cy="8" r="1.1" fill="#f4ead4" />
    </svg>
  );
}
