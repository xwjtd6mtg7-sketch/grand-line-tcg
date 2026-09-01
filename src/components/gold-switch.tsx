import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

export function GoldSwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn("g-switch", on && "is-on")}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <span className="g-switch-knob" />
    </button>
  );
}

const STEPS = 20;

export function snapVol(v: number) {
  return Math.max(0, Math.min(1, Math.round(v * STEPS) / STEPS));
}

export function VolumeSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const live = useRef(false);

  const at = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return;
    onChange(snapVol((x - r.left) / r.width));
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = true;
    at(e.clientX);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live.current || disabled) return;
    at(e.clientX);
  };
  const up = () => {
    live.current = false;
  };

  const shown = disabled ? 0 : value;
  const step = Math.round(shown * STEPS);

  return (
    <div
      ref={track}
      className={cn("g-vol", disabled && "is-off")}
      data-scrolllock-allow
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span className="g-vol-fill" style={{ width: `${shown * 100}%` }} />
      <span className="g-vol-ticks" aria-hidden>
        {Array.from({ length: STEPS + 1 }, (_, i) => (
          <i key={i} className={i <= step ? "is-lit" : undefined} />
        ))}
      </span>
      <span className="g-vol-knob" style={{ left: `${shown * 100}%` }} />
    </div>
  );
}
