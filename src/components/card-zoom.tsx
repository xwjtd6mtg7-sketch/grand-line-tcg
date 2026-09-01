import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ATTR_FR, COLOR_FR, RARITY_FR, TYPE_FR } from "@/lib/tcg/catalog";
import { BodyLock } from "@/lib/lock-body";
import { cardFxSource, splitEffect } from "@/lib/tcg/fr-text";
import type { TcgCard } from "@/lib/tcg/types";
import { createPortal } from "react-dom";
import { CardBack, CardFace } from "./card-face";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function EffectCallout({ card }: { card: TcgCard }) {
  const { tag, body } = splitEffect(cardFxSource(card));
  if (!tag && !body) return null;
  return (
    <div className="zoom-callout">
      <div data-scrolllock-allow className="zoom-callout-scroll">
        {tag ? <span className="zoom-tag">{tag}</span> : null}
        {body ? <span className="zoom-body">{body}</span> : null}
      </div>
    </div>
  );
}

function isBackFacing(ry: number) {
  const a = ((ry % 360) + 360) % 360;
  return a > 90 && a < 270;
}

export function CardZoom({
  card,
  count,
  onClose,
  actions,
  inspect = true,
  plain,
}: {
  card: TcgCard;
  count?: number;
  onClose: () => void;
  inspect?: boolean;
  plain?: boolean;
  actions?: { label: string; onClick: () => void; variant?: "primary" | "crimson" | "ghost" | "don" }[];
}) {
  const colors = Array.isArray(card?.colors) ? card.colors : [];
  const bits = [
    TYPE_FR[card?.type] ?? card?.type,
    colors.map((c) => COLOR_FR[c] ?? c).join(" / "),
    card?.cost != null ? `Coût ${card.cost}` : "",
    card?.power != null ? `Puissance ${card.power}` : "",
    card?.counter ? `Contre +${card.counter}` : "",
    card?.life != null ? `Vie ${card.life}` : "",
    card?.attr ? ATTR_FR[card.attr] ?? card.attr : "",
    count != null ? `×${count}` : "",
  ].filter(Boolean);

  const [pose, setPose] = useState({ rx: 0, ry: 0, rest: true });
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const start = useRef<{ x: number; y: number; prx: number; pry: number } | null>(null);
  const moved = useRef(false);
  const lockClose = useRef(false);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspect) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = poseRef.current;
    start.current = { x: e.clientX, y: e.clientY, prx: p.rx, pry: p.ry };
    moved.current = false;
    lockClose.current = true;
    setPose({ ...p, rest: false });
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspect || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > 8) moved.current = true;
    setPose({
      rx: Math.max(-42, Math.min(42, start.current.prx - dy * 0.26)),
      ry: start.current.pry + dx * 0.52,
      rest: false,
    });
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!inspect || !start.current) return;
    e.stopPropagation();
    const p = poseRef.current;
    const facing = Math.round(p.ry / 180) * 180;
    const delta = p.ry - facing;
    const next = Math.abs(delta) >= 88 ? facing + Math.sign(delta || 1) * 180 : facing;
    start.current = null;
    setPose({ rx: 0, ry: next, rest: true });
    window.setTimeout(() => {
      lockClose.current = false;
    }, 220);
  };

  const back = isBackFacing(pose.ry);
  const close = () => {
    if (lockClose.current && moved.current) return;
    onClose();
  };

  const ui = (
    <div className="zoom-root" onClick={close}>
      <BodyLock />
      <div className="zoom-stage">
        <div className={cn("zoom-hero", inspect && "is-inspect")} onClick={(e) => e.stopPropagation()}>
          {inspect ? (
            <div
              className={cn("zoom-inspect", pose.rest && "is-rest")}
              style={{
                transform: `rotateX(${pose.rx}deg) rotateY(${pose.ry}deg)`,
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <div className="zoom-inspect-face zoom-inspect-front">
                <CardFace card={card} className="!aspect-auto h-full w-full rounded-[10px]" />
              </div>
              <div className="zoom-inspect-face zoom-inspect-back">
                <CardBack className="h-full w-full rounded-[10px]" />
              </div>
            </div>
          ) : (
            <div className="zoom-spin">
              <CardFace card={card} className="w-full" />
            </div>
          )}
          {!inspect && !plain ? <EffectCallout card={card} /> : null}
        </div>
        {plain ? null : (
          <>
            <p className="zoom-name font-display">{card.name}</p>
            <p className="zoom-meta">
              [{bits[0]}] {bits.slice(1).join(" · ")}
            </p>
            <p className="zoom-meta zoom-meta-id">
              {card.id} · {RARITY_FR[card.rarity] ?? card.rarity}
            </p>
            {inspect ? <p className="zoom-hint">{back ? "Dos de carte" : "Glisse pour inspecter · retourne pour le dos"}</p> : null}
          </>
        )}
      </div>
      {actions?.length ? (
        <div className="zoom-actions" onClick={(e) => e.stopPropagation()}>
          {actions.map((a) => (
            <Button key={a.label} variant={a.variant ?? "primary"} size="lg" className="w-full" onClick={a.onClick}>
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined" || !document.body || !card) return null;
  return createPortal(ui, document.body);
}
