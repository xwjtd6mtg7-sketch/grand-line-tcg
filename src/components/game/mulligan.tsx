import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CardBack, CardFace } from "@/components/card-face";
import { applyAction, engineCard, type GameState } from "@/lib/tcg/engine";
import { sfx, unlockSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

type Stage = "idle" | "collect" | "shuffle" | "deal" | "reveal";

export function MulliganScreen({
  state,
  onKeep,
  onCommit,
  onInspect,
}: {
  state: GameState;
  onKeep: () => void;
  onCommit: (next: GameState) => void;
  onInspect: (id: string) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [oldHand] = useState(() => state.players[0].hand.slice());
  const [newHand, setNewHand] = useState<string[] | null>(null);
  const pending = useRef<GameState | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [flies, setFlies] = useState<{ x: number; y: number; r: number }[]>([]);
  const busy = stage !== "idle";
  const shown = stage === "deal" || stage === "reveal" ? (newHand ?? oldHand) : oldHand;
  const faceUp = stage === "idle" || stage === "reveal";

  useEffect(() => {
    if (stage === "idle") return;
    const waits: Record<Stage, number> = { idle: 0, collect: 860, shuffle: 780, deal: 900, reveal: 640 };
    const t = window.setTimeout(() => {
      if (stage === "collect") {
        sfx("pack");
        setStage("shuffle");
      } else if (stage === "shuffle") {
        sfx("draw");
        setStage("deal");
      } else if (stage === "deal") {
        sfx("draw");
        setStage("reveal");
      } else if (stage === "reveal" && pending.current) {
        onCommit(pending.current);
      }
    }, waits[stage]);
    return () => window.clearTimeout(t);
  }, [stage, onCommit]);

  const redraw = () => {
    if (busy) return;
    unlockSfx();
    sfx("ui");
    const deck = deckRef.current?.getBoundingClientRect();
    if (deck) {
      const cx = deck.left + deck.width / 2;
      const cy = deck.top + deck.height / 2;
      setFlies(
        slotRefs.current.map((el, i) => {
          if (!el) return { x: 0, y: -160, r: 8 };
          const b = el.getBoundingClientRect();
          return {
            x: cx - (b.left + b.width / 2),
            y: cy - (b.top + b.height / 2),
            r: (i - 2) * 10,
          };
        }),
      );
    }
    const next = applyAction(state, 0, { type: "mulligan", redraw: true });
    pending.current = next;
    setNewHand(next.players[0].hand.slice());
    setStage("collect");
  };

  return (
    <div className="mul-root">
      <div className="mul-head">
        <p className="mul-title font-display">Mulligan</p>
        <span className="mul-rule" />
        <p className="mul-copy">
          {stage === "idle"
            ? "Échange ta main une fois. Les vies sont posées ensuite, depuis le dessus du deck."
            : stage === "collect"
              ? "La main retourne dans le deck…"
              : stage === "shuffle"
                ? "Mélange du deck…"
                : stage === "deal"
                  ? "Nouvelle main…"
                  : "Révélation"}
        </p>
      </div>

      <div className="mul-body">
        <div ref={deckRef} className={cn("mul-deck", stage === "shuffle" && "is-riffle")}>
          {[0, 1, 2].map((i) => (
            <CardBack
              key={i}
              className="mul-deck-card"
              style={{ transform: `translate(${i * 2}px, ${-i * 2}px) rotate(${(i - 1) * 2.4}deg)` }}
            />
          ))}
        </div>

        <div className="mul-hand">
          {shown.map((id, i) => {
            const fly = flies[i];
            const delay =
              stage === "collect" ? i * 55 : stage === "deal" ? i * 90 : stage === "reveal" ? i * 70 : 0;
            return (
              <div
                key={`${id}-${i}`}
                ref={(el) => {
                  slotRefs.current[i] = el;
                }}
                className={cn(
                  "mul-slot",
                  stage === "collect" && "is-collect",
                  stage === "shuffle" && "is-parked",
                  stage === "deal" && "is-deal",
                )}
                style={
                  {
                    animationDelay: `${delay}ms`,
                    ["--mx"]: `${fly?.x ?? 0}px`,
                    ["--my"]: `${fly?.y ?? -180}px`,
                    ["--mr"]: `${fly?.r ?? 0}deg`,
                  } as CSSProperties
                }
              >
                <div
                  className={cn("mul-flip", faceUp ? "is-up" : "is-down")}
                  style={{
                    transitionDelay:
                      stage === "reveal" ? `${i * 70}ms` : stage === "collect" ? `${i * 30}ms` : "0ms",
                  }}
                >
                  <div className="mul-face mul-front">
                    <CardFace
                      card={engineCard(id)}
                      className="w-full"
                      onClick={stage === "idle" ? () => onInspect(id) : undefined}
                    />
                  </div>
                  <div className="mul-face mul-back">
                    <CardBack className="h-full w-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mul-bar">
        <button type="button" className="studio-float-save" disabled={busy} onClick={onKeep}>
          Garder cette main
        </button>
        <button type="button" className="studio-float-cancel" disabled={busy} onClick={redraw}>
          Changer de main
        </button>
      </div>
    </div>
  );
}
