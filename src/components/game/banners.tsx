import { Link } from "@tanstack/react-router";
import { CardFace } from "@/components/card-face";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TcgCard } from "@/lib/tcg/types";

export type BannerKind = "player" | "cpu" | "block" | "counter";

const COPY: Record<BannerKind, { title: string; sub: string }> = {
  player: { title: "VOTRE TOUR", sub: "PHASE PRINCIPALE" },
  cpu: { title: "TOUR ADVERSE", sub: "L’ADVERSAIRE JOUE" },
  block: { title: "BLOQUEUR", sub: "PHASE DE COMBAT" },
  counter: { title: "CONTRE", sub: "PHASE DE COMBAT" },
};

export function TurnBanner({ kind }: { kind: BannerKind }) {
  const copy = COPY[kind];
  return (
    <div className={cn("turn-banner", `is-${kind}`)} aria-hidden>
      <div className="turn-veil" />
      <div className="turn-flash" />
      <div className="turn-lines" />
      <div className="turn-slash" />
      <div className="turn-copy">
        <p className="turn-kicker font-display">{copy.title}</p>
        <span className="turn-rule" />
        <p className="turn-sub font-display">{copy.sub}</p>
      </div>
    </div>
  );
}

export function MatchOver({
  win,
  leader,
}: {
  win: boolean;
  leader?: TcgCard;
}) {
  return (
    <div className={cn("over-root", win ? "over-win" : "over-lose")}>
      <div className="over-veil" />
      <div className="over-rays" />
      {leader ? (
        <div className="over-card">
          <CardFace card={leader} className="w-[168px] rarity-l" />
        </div>
      ) : null}
      <p className="over-title font-display">{win ? "Victoire" : "Défaite"}</p>
      <p className="over-sub">
        {win ? "Ton Leader tient encore le terrain." : "Ton Leader n’a plus de vie."}
      </p>
      <Link to="/" className="over-cta">
        <Button size="lg" variant={win ? "primary" : "crimson"}>
          Accueil
        </Button>
      </Link>
    </div>
  );
}
