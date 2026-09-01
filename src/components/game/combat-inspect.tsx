import { BodyLock } from "@/lib/lock-body";
import { COLOR_HEX } from "@/lib/tcg/catalog";
import { cardFxSource, splitEffectBlocks } from "@/lib/tcg/fr-text";
import type { TcgCard } from "@/lib/tcg/types";
import { CardFace } from "@/components/card-face";
import { cn } from "@/lib/utils";

export type CombatAction = {
  id: string;
  tag: string;
  body: string;
  ready: boolean;
  cost?: number;
  onClick?: () => void;
};

export function effectLine(card: TcgCard, key: string): { tag: string; body: string; cost?: number } | null {
  const hit = splitEffectBlocks(cardFxSource(card)).find((b) => b.key === key);
  if (!hit) return null;
  return { tag: hit.tag, body: hit.body, cost: hit.cost };
}

export function PlainZoom({ card, onClose }: { card: TcgCard; onClose: () => void }) {
  return (
    <div className="plain-zoom" onClick={onClose}>
      <BodyLock />
      <button type="button" className="plain-zoom-card" onClick={(e) => e.stopPropagation()}>
        <CardFace card={card} className="w-full" />
      </button>
    </div>
  );
}

export function CombatInspect({
  card,
  power,
  actions,
  onClose,
}: {
  card: TcgCard;
  power?: number | null;
  actions: CombatAction[];
  onClose: () => void;
}) {
  const c0 = COLOR_HEX[card.colors[0] as keyof typeof COLOR_HEX] ?? "#3a3d46";
  const c1 = COLOR_HEX[card.colors[1] as keyof typeof COLOR_HEX] ?? c0;
  return (
    <div className="pocket-root" onClick={onClose}>
      <BodyLock />
      <div className="pocket-stage">
        <div
          className="pocket-hero pocket-tilt"
          style={{ ["--pocket" as string]: c0, ["--pocket2" as string]: c1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pocket-card">
            <CardFace card={card} className="pocket-face" />
            {power != null ? (
              <span className="pocket-power font-display" aria-label={`Puissance ${power}`}>
                {power}
              </span>
            ) : null}
            {actions.length ? (
              <div data-scrolllock-allow className="pocket-pills">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!a.ready}
                    className={cn("pocket-pill", a.ready ? "is-ready" : "is-off")}
                    onClick={() => {
                      if (!a.ready || !a.onClick) return;
                      a.onClick();
                    }}
                  >
                    <span className="pocket-pill-row">
                      <span className="pocket-pill-tag font-display">{a.tag}</span>
                      {a.cost ? <span className="pocket-pill-cost">−{a.cost}</span> : null}
                    </span>
                    {a.body ? <span className="pocket-pill-body">{a.body}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
