import { useEffect } from "react";
import { CardFace } from "@/components/card-face";
import { BrandLockup, CompassMark } from "@/components/brand";
import { COLOR_HEX } from "@/lib/tcg/catalog";
import { sfx, unlockSfx } from "@/lib/sfx";
import type { TcgCard } from "@/lib/tcg/types";

export function VersusCinematic({
  left,
  right,
  onDone,
}: {
  left: TcgCard;
  right: TcgCard;
  onDone: () => void;
}) {
  useEffect(() => {
    unlockSfx();
    sfx("attack");
    const a = window.setTimeout(() => sfx("hit"), 720);
    const t = window.setTimeout(onDone, 3800);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(a);
    };
  }, []);

  const l = COLOR_HEX[left.colors[0] as keyof typeof COLOR_HEX] ?? "#c4453c";
  const r = COLOR_HEX[right.colors[0] as keyof typeof COLOR_HEX] ?? "#2f8f5b";

  return (
    <button
      type="button"
      className="vs-root"
      style={{ ["--vs-l" as string]: l, ["--vs-r" as string]: r }}
      onClick={onDone}
    >
      <span className="vs-wash" aria-hidden />
      <CompassMark className="vs-compass" />
      <BrandLockup size="cine" className="vs-brand" />
      <div className="vs-stage">
        <div className="vs-card is-left">
          <span className="vs-aura" />
          <CardFace card={left} className="w-full rarity-l" />
        </div>
        <span className="vs-mark font-display">VS</span>
        <div className="vs-card is-right">
          <span className="vs-aura" />
          <CardFace card={right} className="w-full rarity-l" />
        </div>
      </div>
      <p className="vs-kicker font-display">DUEL</p>
    </button>
  );
}
