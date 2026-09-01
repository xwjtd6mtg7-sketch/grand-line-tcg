import { useEffect, useMemo, useState, type CSSProperties, type PointerEventHandler } from "react";
import { cn } from "@/lib/utils";
import type { TcgCard } from "@/lib/tcg/types";
import { COLOR_HEX, baseCardId } from "@/lib/tcg/catalog";
import { packSrc, useCosmeticSrc } from "@/lib/tcg/art";

export function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  const src = useCosmeticSrc("back");
  return (
    <div className={cn("relative overflow-hidden rounded-[8px] bg-ink", className)} style={style}>
      <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
    </div>
  );
}

export function CardFace({
  card,
  className,
  rested,
  selected,
  dimmed,
  playable,
  badge,
  onClick,
  onPointerDown,
}: {
  card: TcgCard;
  className?: string;
  rested?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  playable?: boolean;
  badge?: string;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLElement>;
}) {
  const [err, setErr] = useState(false);
  const [srcI, setSrcI] = useState(0);
  const sources = useMemo(() => {
    const base = baseCardId(card.id);
    const list = [card.image, `/cards-fr/${card.id}.webp`];
    if (base !== card.id) list.push(`/cards-fr/${base}.webp`);
    return [...new Set(list.filter(Boolean))];
  }, [card.id, card.image]);
  useEffect(() => {
    setErr(false);
    setSrcI(0);
  }, [card.id, card.image]);
  const src = sources[srcI];
  const ring =
    card.rarity === "SP"
      ? "rarity-sp card-foil"
      : card.rarity === "SEC"
        ? "rarity-sec card-foil"
        : card.rarity === "SR"
          ? "rarity-sr card-foil"
          : card.rarity === "L"
            ? "rarity-l card-foil"
            : "";
  const tag = badge ?? (card.rarity === "SP" ? "MANGA" : card.parallel ? "ALT" : undefined);
  const border = card.colors[0] ? COLOR_HEX[card.colors[0]] : undefined;
  const inner = (
    <>
      {err || !src ? (
        <CardBack className="h-full w-full rounded-none" />
      ) : (
        <img
          src={src}
          alt={card.name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            if (srcI + 1 < sources.length) setSrcI(srcI + 1);
            else setErr(true);
          }}
          className="pointer-events-none h-full w-full object-cover"
        />
      )}
      {tag ? (
        <span className="absolute bottom-1 right-1 rounded-full bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] text-foam">
          {tag}
        </span>
      ) : null}
    </>
  );
  const cls = cn(
    "relative aspect-[63/88] overflow-hidden rounded-[8px] bg-surface",
    "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
    ring,
    selected && "ring-2 ring-foam",
    playable && "card-playable",
    dimmed && "card-dim",
    (onClick || onPointerDown) && (onPointerDown ? "touch-none" : "touch-pan-y"),
    className,
  );
  const style = border ? { boxShadow: `inset 0 0 0 1.5px ${border}` } : undefined;
  if (onClick || onPointerDown) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        className={cls}
        style={style}
        aria-label={card.name}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

export function BoosterPack({
  setId,
  name,
  className,
  cover,
}: {
  setId: string;
  name?: string;
  className?: string;
  cover?: boolean;
}) {
  const [src, setSrc] = useState(packSrc(setId));
  return (
    <div className={cn("relative overflow-hidden", cover && "rounded-[8px]", className)}>
      <img
        src={src}
        alt={name ?? setId}
        draggable={false}
        className={cn(
          "h-full w-full",
          cover ? "object-cover" : "object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.45)]",
        )}
        onError={() => setSrc("/boosters/generic.webp?v=st30")}
      />
    </div>
  );
}
