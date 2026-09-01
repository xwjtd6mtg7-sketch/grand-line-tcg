import { useEffect, useState } from "react";
import { sfx, unlockSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import type { PlayerId } from "@/lib/tcg/engine";

const RIM = Array.from({ length: 16 }, (_, i) => i);

export function CoinFlip({ onDone }: { onDone: (first: PlayerId) => void }) {
  const [phase, setPhase] = useState<"idle" | "spin" | "land">("idle");
  const [first, setFirst] = useState<PlayerId>(0);

  useEffect(() => {
    unlockSfx();
    const kick = window.setTimeout(() => {
      const f: PlayerId = Math.random() < 0.5 ? 0 : 1;
      setFirst(f);
      setPhase("spin");
      sfx("ui");
    }, 420);
    const land = window.setTimeout(() => {
      setPhase("land");
      sfx("hit");
    }, 1880);
    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(land);
    };
  }, []);

  const you = first === 0;

  return (
    <div className="coin-root">
      <p className="coin-kicker font-display">PILE OU FACE</p>
      <p className="coin-sub">Qui commence le duel ?</p>
      <div className={cn("coin-stage", phase)}>
        <div className={cn("coin-3d", you ? "is-tails" : "is-heads")}>
          {RIM.map((i) => (
            <span key={i} className="coin-thick" style={{ ["--z" as string]: `${i - 7.5}px` }} />
          ))}
          <div className="coin-face coin-heads">
            <span className="font-display">PILE</span>
          </div>
          <div className="coin-face coin-tails">
            <span className="font-display">FACE</span>
          </div>
        </div>
      </div>
      {phase === "land" ? (
        <div className="coin-result">
          <p className="font-display">{you ? "Vous commencez" : "L’adversaire commence"}</p>
          <p className="text-sm text-muted">
            {you
              ? "1 DON!! · pas de pioche · pas d’attaque ce tour"
              : "L’adversaire pose le premier DON!!"}
          </p>
          <button type="button" className="studio-float-save gl-coin-btn" onClick={() => onDone(first)}>
            Continuer
          </button>
        </div>
      ) : (
        <p className="coin-wait font-display">{phase === "idle" ? "La pièce s’envole…" : "…"}</p>
      )}
    </div>
  );
}
