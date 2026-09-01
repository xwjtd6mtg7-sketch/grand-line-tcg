import { BodyLock } from "@/lib/lock-body";
import { isLockedDeck, starterIdOf, validateDeck } from "@/lib/store";
import { cardById, deckSize } from "@/lib/tcg/catalog";
import { cosmeticById, DEFAULT_EQUIP } from "@/lib/tcg/cosmetics";
import type { DeckList } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";
import { Bookmark, Check } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { BoosterPack, CardFace } from "./card-face";

export function DeckPickSheet({
  decks,
  activeId,
  onPick,
  onEdit,
  onClose,
}: {
  decks: DeckList[];
  activeId: string;
  onPick: (id: string) => void;
  onEdit?: (deck: DeckList) => void;
  onClose: () => void;
}) {
  const metricsRef = useRef({ maxH: 640 });
  const hRef = useRef(0);
  const [drag, setDrag] = useState(false);
  const [live, setLive] = useState(false);
  const start = useRef<{ y: number; base: number } | null>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const boot = useRef(true);
  const closed = useRef(false);

  const sorted = [...decks].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite));

  const paint = (h: number, animate: boolean) => {
    hRef.current = h;
    const { maxH } = metricsRef.current;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
    sheet.style.transform = `translate3d(0,${Math.max(0, maxH - h)}px,0)`;
  };

  useEffect(() => {
    boot.current = true;
    closed.current = false;
    setLive(false);
    const calc = () => {
      const maxH = Math.round(window.innerHeight * 0.88);
      metricsRef.current = { maxH };
      if (sheetRef.current) sheetRef.current.style.height = `${maxH}px`;
      if (boot.current) {
        boot.current = false;
        paint(0, false);
        requestAnimationFrame(() => {
          setLive(true);
          requestAnimationFrame(() => paint(maxH, true));
        });
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const dismiss = () => {
    if (closed.current) return;
    closed.current = true;
    setDrag(false);
    paint(0, true);
    window.setTimeout(onClose, 380);
  };

  const onGrabDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (closed.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, base: hRef.current };
    setDrag(true);
  };
  const onGrabMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!start.current || closed.current) return;
    const { maxH } = metricsRef.current;
    const h = Math.max(80, Math.min(maxH + 28, start.current.base - (e.clientY - start.current.y)));
    paint(h, false);
    if (h < maxH * 0.42) {
      start.current = null;
      dismiss();
    }
  };
  const onGrabUp = () => {
    if (!start.current || closed.current) return;
    start.current = null;
    setDrag(false);
    const { maxH } = metricsRef.current;
    if (hRef.current < maxH * 0.78) dismiss();
    else paint(maxH, true);
  };

  const choose = (id: string) => {
    onPick(id);
    dismiss();
  };

  const holdRef = useRef<number | null>(null);
  const longRef = useRef(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const clearHold = () => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };
  const armHold = (d: DeckList, e: ReactPointerEvent) => {
    clearHold();
    longRef.current = false;
    originRef.current = { x: e.clientX, y: e.clientY };
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      longRef.current = true;
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
      onEdit?.(d);
    }, 500);
  };

  const ui = (
    <div className="filter-sheet" onClick={dismiss}>
      <BodyLock />
      <div
        ref={sheetRef}
        className={cn("dossier-sheet filter-panel", drag && "is-drag", live && "is-live")}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="dossier-grab"
          data-scrolllock-allow
          ref={grabRef}
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >
          <div className="dossier-handle">
            <span />
          </div>
          <p className="play-kicker" style={{ margin: "4px 4px 10px", textAlign: "center" }}>
            Choisir un deck
          </p>
        </div>
        <div className="dossier-extra filter-sheet-body" data-scrolllock-allow>
          <ul className="deck-pick-list">
            {sorted.map((d) => {
              const leader = cardById(d.leaderId);
              const locked = isLockedDeck(d);
              const starterId = locked ? starterIdOf(d) : undefined;
              const errs = validateDeck(d);
              const n = deckSize(d.cards);
              const on = d.id === activeId;
              const skins = d.cosmetics ?? DEFAULT_EQUIP;
              const back = cosmeticById(skins.back);
              const don = cosmeticById(skins.don);
              const mat = cosmeticById(skins.mat);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={cn("deck-pick-row", on && "is-on")}
                    onPointerDown={(e) => armHold(d, e)}
                    onPointerMove={(e) => {
                      const o = originRef.current;
                      if (!o || !holdRef.current) return;
                      if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > 12) clearHold();
                    }}
                    onPointerUp={clearHold}
                    onPointerCancel={clearHold}
                    onClick={() => {
                      if (longRef.current) {
                        longRef.current = false;
                        return;
                      }
                      choose(d.id);
                    }}
                  >
                    <span className="deck-pick-art">
                      {starterId ? (
                        <BoosterPack setId={starterId} name={d.name} cover className="deck-pick-pack" />
                      ) : leader ? (
                        <CardFace card={leader} className="deck-pick-pack" />
                      ) : (
                        <span className="deck-pick-pack is-empty" />
                      )}
                    </span>
                    <span className="deck-pick-meta">
                      <span className="deck-pick-name">
                        {d.favorite ? <Bookmark className="size-3.5" fill="currentColor" /> : null}
                        {d.name}
                      </span>
                      <span className={cn("deck-pick-stat", errs.length && "is-bad")}>
                        {n}/50 · {errs.length ? errs[0] : "Prêt"}
                      </span>
                    </span>
                    <span className="deck-pick-skins" aria-hidden>
                      <span className="deck-pick-skin">{back ? <img src={back.src} alt="" draggable={false} /> : null}</span>
                      <span className="deck-pick-skin">{don ? <img src={don.src} alt="" draggable={false} /> : null}</span>
                      <span className="deck-pick-skin is-mat">{mat ? <img src={mat.src} alt="" draggable={false} /> : null}</span>
                    </span>
                    {on ? (
                      <span className="deck-pick-check">
                        <Check className="size-4" strokeWidth={2.6} />
                      </span>
                    ) : (
                      <span className="deck-pick-check is-off" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="list-end-pad" aria-hidden />
        </div>
      </div>
      <div className="filter-float" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="studio-float-save" onClick={dismiss}>
          OK
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}