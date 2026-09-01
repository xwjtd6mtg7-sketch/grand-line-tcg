import { cn } from "@/lib/utils";

type BrandSize = "header" | "hero" | "cine" | "mat";

const INK = "#f4ead4";
const FILL = "#ead7a4";

export function BrandLockup({
  className,
  compact,
  size,
}: {
  className?: string;
  compact?: boolean;
  size?: BrandSize;
}) {
  const variant: BrandSize = size ?? (compact ? "cine" : "header");
  return (
    <div className={cn("brand", `brand-${variant}`, className)} aria-label="Grand Line TCG" role="img">
      <CompassMark className="brand-radar" />
      <span className="brand-grand">Grand Line</span>
      <span className="brand-tcg">TCG</span>
      <span className="brand-unoff">Unofficial TCG</span>
    </div>
  );
}

/** Reference compass: equal tips, SW filled, NE hollow. White-gold. */
export function CompassMark({
  className,
  color = INK,
  fill = FILL,
}: {
  className?: string;
  color?: string;
  fill?: string;
}) {
  const cx = 120;
  const cy = 120;
  const ticks = (n: number, r0: number, r1: number, w: number) => {
    const skip = n % 4 === 0 ? n / 4 : 0;
    return Array.from({ length: n }, (_, i) => {
      if (skip && i % skip === 0) return null;
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return (
        <line
          key={`${r0}-${i}`}
          x1={cx + Math.cos(a) * r0}
          y1={cy + Math.sin(a) * r0}
          x2={cx + Math.cos(a) * r1}
          y2={cy + Math.sin(a) * r1}
          stroke={color}
          strokeWidth={w}
        />
      );
    });
  };
  const tip = 114;
  const waist = 24;
  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden>
      <g fill="none" stroke={color} strokeLinecap="butt">
        <circle cx={cx} cy={cy} r="100" strokeWidth="6.2" />
        <circle cx={cx} cy={cy} r="82.5" strokeWidth="4.6" />
        {ticks(48, 85.5, 97.2, 1.1)}
        <circle cx={cx} cy={cy} r="64.5" strokeWidth="5.2" />
        {ticks(36, 39, 61.5, 1)}
        <line x1={cx} y1={cy - 100} x2={cx} y2={cy + 100} strokeWidth="1.9" />
        <line x1={cx - 100} y1={cy} x2={cx + 100} y2={cy} strokeWidth="1.9" />
        <circle cx={cx} cy={cy} r="36" strokeWidth="2.7" />
      </g>
      <g transform={`rotate(48 ${cx} ${cy})`}>
        <path
          fill={fill}
          fillRule="evenodd"
          d={`M${cx} ${cy + tip} L${cx + waist} ${cy} L${cx - waist} ${cy} Z
              M${cx} ${cy} m-16.5 0 a16.5 16.5 0 1 0 33 0 a16.5 16.5 0 1 0 -33 0`}
        />
        <path
          fill="none"
          stroke={color}
          strokeWidth="3.4"
          strokeLinejoin="miter"
          strokeMiterlimit="2.4"
          d={`M${cx} ${cy - tip} L${cx + waist} ${cy} L${cx} ${cy + tip} L${cx - waist} ${cy} Z`}
        />
        <circle cx={cx} cy={cy} r="16.5" fill="none" stroke={color} strokeWidth="2.4" />
      </g>
    </svg>
  );
}
