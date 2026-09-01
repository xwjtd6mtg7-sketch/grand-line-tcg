import { useEffect, useState, type CSSProperties } from "react";
import { CardBack, CardFace } from "@/components/card-face";
import { DonFace } from "@/components/game/tokens";
import { engineCard } from "@/lib/tcg/engine";

export type TableFx = {
  id: number;
  kind: "play" | "event" | "stage" | "don" | "donGive" | "discard" | "draw" | "oppPlay";
  cardId?: string;
  toIid?: string;
  side?: 0 | 1;
  from?: "deck" | "life";
};

export function TableFxLayer({ items, onDone }: { items: TableFx[]; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-visible">
      {items.map((fx) => (
        <FxBurst key={fx.id} fx={fx} onDone={onDone} />
      ))}
    </div>
  );
}

function FxBurst({ fx, onDone }: { fx: TableFx; onDone: (id: number) => void }) {
  const ms =
    fx.kind === "play" || fx.kind === "event" || fx.kind === "stage"
      ? 1680
      : fx.kind === "oppPlay"
        ? 680
        : fx.kind === "donGive"
          ? 980
          : fx.kind === "draw"
            ? 920
            : 780;
  useEffect(() => {
    const t = window.setTimeout(() => onDone(fx.id), ms);
    return () => window.clearTimeout(t);
  }, [fx.id, ms, onDone]);

  const card = fx.cardId ? engineCard(fx.cardId) : null;

  if (fx.kind === "donGive") {
    return <DonGiveBurst toIid={fx.toIid} side={fx.side ?? 0} />;
  }

  if (fx.kind === "oppPlay") {
    return <OppPlayBurst cardId={fx.cardId} toIid={fx.toIid} />;
  }

  if (fx.kind === "don") {
    return (
      <div className="fx-don">
        <DonFace className="fx-don-card aspect-[63/88] w-[72px]" />
        <p className="fx-don-label font-display">DON!!</p>
        <span className="fx-spark fx-spark-a" />
        <span className="fx-spark fx-spark-b" />
        <span className="fx-spark fx-spark-c" />
      </div>
    );
  }

  if (fx.kind === "draw") {
    return <DrawBurst cardId={fx.cardId} side={fx.side ?? 0} from={fx.from ?? "deck"} />;
  }

  if (!card) return null;

  if (fx.kind === "discard") {
    return (
      <div className="fx-play fx-discard">
        <div className="fx-card-wrap">
          <CardFace card={card} className="w-[132px]" />
          <span className="fx-ring" />
        </div>
        <p className="fx-stamp font-display">DÉFAUSSE</p>
      </div>
    );
  }

  return (
    <div className={`fx-play fx-reveal fx-${fx.kind}`}>
      <div className="fx-veil" />
      <div className="fx-reveal-card">
        <div className="zoom-spin">
          <CardFace card={card} className="w-full" />
        </div>
      </div>
      <p className="fx-reveal-name font-display">{card.name}</p>
    </div>
  );
}

function OppPlayBurst({ cardId, toIid }: { cardId?: string; toIid?: string }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const card = cardId ? engineCard(cardId) : null;
  useEffect(() => {
    try {
      const from = document.querySelector('[data-hand="opp"]')?.getBoundingClientRect();
      const to =
        (toIid ? document.querySelector(`[data-unit="${toIid}"]`) : null)?.getBoundingClientRect() ||
        document.querySelector('[data-drop="opp-field"]')?.getBoundingClientRect();
      if (!from || !to) {
        setStyle({});
        return;
      }
      const x0 = from.left + from.width / 2;
      const y0 = from.top + from.height / 2;
      const x1 = to.left + to.width / 2;
      const y1 = to.top + to.height / 2;
      setStyle({
        ["--don-x0" as string]: `${x0}px`,
        ["--don-y0" as string]: `${y0}px`,
        ["--don-dx" as string]: `${x1 - x0}px`,
        ["--don-dy" as string]: `${y1 - y0}px`,
      });
    } catch {
      setStyle({});
    }
  }, [toIid]);
  if (!style) return null;
  return (
    <div className="fx-opp-play" style={style}>
      <div className="fx-opp-play-fly">
        {card ? <CardFace card={card} className="aspect-[63/88] w-[50px]" /> : <CardBack className="aspect-[63/88] w-[50px]" />}
      </div>
    </div>
  );
}

function DonGiveBurst({ toIid, side }: { toIid?: string; side?: 0 | 1 }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useEffect(() => {
    const who = side === 1 ? "opp" : "me";
    const from = document.querySelector(`[data-don-stack="${who}"]`)?.getBoundingClientRect();
    const to =
      (toIid ? document.querySelector(`[data-unit="${toIid}"]`) : null)?.getBoundingClientRect() ||
      document.querySelector(side === 1 ? '[data-drop="opp-leader"]' : '[data-drop="my-leader"]')?.getBoundingClientRect();
    if (!from || !to) {
      setStyle({});
      return;
    }
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const x1 = to.left + to.width / 2;
    const y1 = to.top + to.height / 2;
    setStyle({
      ["--don-x0" as string]: `${x0}px`,
      ["--don-y0" as string]: `${y0}px`,
      ["--don-dx" as string]: `${x1 - x0}px`,
      ["--don-dy" as string]: `${y1 - y0}px`,
    });
  }, [toIid, side]);
  if (!style) return null;
  return (
    <div className="fx-don-give" style={style}>
      <div className="fx-don-give-fly">
        <DonFace className="aspect-[63/88] w-[54px]" />
      </div>
      <span className="fx-don-give-plus font-display">+1000</span>
      <span className="fx-don-give-burst" />
    </div>
  );
}

function DrawBurst({ cardId, side, from }: { cardId?: string; side: 0 | 1; from: "deck" | "life" }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const card = cardId ? engineCard(cardId) : null;
  const mine = side === 0;
  useEffect(() => {
    const who = mine ? "me" : "opp";
    const origin = from === "life" ? `[data-life="${who}"]` : `[data-deck="${who}"]`;
    const start = document.querySelector(origin)?.getBoundingClientRect();
    const to = document.querySelector(`[data-hand="${who}"]`)?.getBoundingClientRect();
    if (!start || !to) {
      setStyle({});
      return;
    }
    const x0 = start.left + start.width / 2;
    const y0 = start.top + start.height / 2;
    const x1 = to.left + to.width / 2;
    const y1 = to.top + to.height / 2;
    setStyle({
      ["--don-x0" as string]: `${x0}px`,
      ["--don-y0" as string]: `${y0}px`,
      ["--don-dx" as string]: `${x1 - x0}px`,
      ["--don-dy" as string]: `${y1 - y0}px`,
    });
  }, [mine, from]);
  if (!style) return null;
  return (
    <div className="fx-draw-give" style={style}>
      <div className="fx-draw-give-fly">
        {mine && card ? <CardFace card={card} className="aspect-[63/88] w-[58px]" /> : <CardBack className="aspect-[63/88] w-[58px]" />}
      </div>
    </div>
  );
}
