import type { CSSProperties, PointerEventHandler } from "react";
import { CardBack, CardFace } from "@/components/card-face";
import { cn } from "@/lib/utils";
import { engineCard } from "@/lib/tcg/engine";
import { DON_BACK_SRC, DON_SRC, useCosmeticSrc } from "@/lib/tcg/art";

export function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="ink-stroke mb-0.5 text-center font-display text-[8px] tracking-[0.32em] text-foam">{children}</p>
  );
}

export function DonFace({
  className,
  back,
  style,
  live,
}: {
  className?: string;
  back?: boolean;
  style?: CSSProperties;
  live?: boolean;
}) {
  const equipped = useCosmeticSrc("don");
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[6px] bg-ink shadow-[0_4px_12px_rgb(0_0_0/0.45)]",
        live && "don-face-live",
        className,
      )}
      style={style}
    >
      <img
        src={back ? DON_BACK_SRC : equipped || DON_SRC}
        alt="DON!!"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}

export function DonAttach({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div className="don-attach">
      <DonFace className="don-attach-face" />
      <span className="don-chip">{n}</span>
    </div>
  );
}

export function DonStack({
  active,
  rested,
  remain,
  className,
  hot,
  glow,
  onPointerDown,
  turnActive,
  mine,
}: {
  active: number;
  rested: number;
  remain?: number;
  className?: string;
  hot?: boolean;
  glow?: boolean;
  turnActive?: boolean;
  mine?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}) {
  const total = Math.max(0, (remain ?? 0) + active + rested);
  const depth = total <= 0 ? 0 : Math.min(3, total);
  const grab = Boolean(onPointerDown);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center w-[56px]",
        hot && "drop-hot",
        glow && "don-pulse",
        turnActive && "don-turn",
        grab && "touch-none",
        className,
      )}
      onPointerDown={onPointerDown}
      data-drag={grab ? "don" : undefined}
      data-don-stack={mine ? "me" : "opp"}
    >
      <ZoneLabel>DON!!</ZoneLabel>
      <div className="don-pile">
        {total === 0 ? <div className="don-pile-empty" /> : null}
        {Array.from({ length: depth }).map((_, i) => (
          <DonFace
            key={`p${i}`}
            live={turnActive && active > 0 && i === depth - 1}
            className="don-pile-card"
            style={{
              transform: `translate(${i * 2}px, ${-i * 2}px)`,
              zIndex: i,
            }}
          />
        ))}
        {rested > 0 ? <DonFace className="don-pile-rest" /> : null}
      </div>
      <p className="ink-stroke font-display text-[11px] tabular-nums text-don">
        {active}
        <span className="text-subtle">/{total}</span>
      </p>
    </div>
  );
}

export function DeckPile({ n, label, side }: { n: number; label: string; side?: "me" | "opp" }) {
  return (
    <div className="pile-slot" data-deck={side}>
      <ZoneLabel>{label}</ZoneLabel>
      <div className={cn("pile-card", n <= 0 && "is-empty")}>
        {n > 0 ? <CardBack className="pile-card-face" /> : <div className="pile-card-empty" />}
        {n > 0 ? <span className="pile-n font-display">{n}</span> : null}
      </div>
    </div>
  );
}

export function TrashPile({ ids, onOpen }: { ids: string[]; onOpen?: () => void }) {
  const top = ids[ids.length - 1];
  const n = ids.length;
  return (
    <button type="button" className="pile-slot" onClick={onOpen} aria-label={`Défausse, ${n} carte${n > 1 ? "s" : ""}`}>
      <ZoneLabel>TRASH</ZoneLabel>
      <div className={cn("pile-card", !top && "is-empty")}>
        {top ? <CardFace card={engineCard(top)} className="pile-card-face" /> : <div className="pile-card-empty" />}
        {n > 0 ? <span className="trash-badge font-display">{n}</span> : null}
      </div>
    </button>
  );
}

export function LifeRow({ n, side }: { n: number; reverse?: boolean; side?: "me" | "opp" }) {
  if (n <= 0) {
    return (
      <div className={cn("life-card is-empty", side === "opp" ? "is-opp" : "is-me")} data-life={side}>
        <span className="ink-stroke life-empty-label">LIFE</span>
      </div>
    );
  }
  return (
    <div className={cn("life-card", side === "opp" ? "is-opp" : "is-me")} data-life={side}>
      <CardBack className="h-full w-full rounded-[7px] shadow-[0_8px_16px_rgb(0_0_0/0.45)]" />
      <span className="life-n font-display">{n}</span>
    </div>
  );
}

export function OppHand({ n }: { n: number }) {
  const shown = Math.min(n, 8);
  const mid = (shown - 1) / 2;
  if (n <= 0) return <div className="h-9 w-12" />;
  const w = 48;
  const step = shown <= 1 ? w : Math.max(20, Math.min(26, Math.round(w * 0.42)));
  const cardH = Math.round((w * 88) / 63);
  return (
    <div
      className="relative flex items-start justify-center overflow-visible"
      data-hand="opp"
      style={{ height: cardH + 10, width: w + Math.max(0, shown - 1) * step }}
    >
      {Array.from({ length: shown }).map((_, i) => {
        const rot = shown <= 1 ? 0 : (i - mid) * Math.min(4.2, 18 / shown);
        const lift = Math.abs(i - mid) * 3;
        return (
          <div
            key={i}
            className="relative shrink-0"
            style={{
              width: w,
              height: cardH,
              marginLeft: i === 0 ? 0 : step - w,
              zIndex: i,
              transform: `rotate(${rot}deg) translateY(${-lift}px)`,
              transformOrigin: "50% 12%",
            }}
          >
            <div
              className="relative h-full w-full overflow-hidden rounded-[5px] shadow-[0_4px_12px_rgb(0_0_0/0.55)]"
              style={{ transform: "rotate(180deg)" }}
            >
              <CardBack className="absolute inset-0 h-full w-full rounded-none" />
            </div>
          </div>
        );
      })}
      <span className="opp-hand-count">{n}</span>
    </div>
  );
}

