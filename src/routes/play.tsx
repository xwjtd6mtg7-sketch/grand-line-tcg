import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useCatalog } from "@/components/catalog-provider";
import { Playmat } from "@/components/game/playmat";
import { VersusCinematic } from "@/components/game/cinematic";
import { BoosterPack, CardFace } from "@/components/card-face";
import { DeckPickSheet } from "@/components/deck-pick";
import { DeckStudio } from "@/routes/decks";
import { ErrorBoundary } from "@/components/error-boundary";
import { usePlayer, validateDeck } from "@/lib/store";
import { buildStarterList } from "@/lib/tcg/packs";
import { createMatch } from "@/lib/tcg/engine";
import { cardById, COLOR_HEX } from "@/lib/tcg/catalog";
import { cosmeticById, DEFAULT_EQUIP } from "@/lib/tcg/cosmetics";
import { unlockSfx } from "@/lib/sfx";
import type { GameState } from "@/lib/tcg/engine";
import type { DeckList, TcgCard } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play")({
  component: () => null,
  errorComponent: PlayCrash,
});

function PlayCrash() {
  return (
    <div className="decks-fs grid min-h-[70dvh] place-items-center px-6">
      <div className="coll-hub w-full max-w-sm p-5 text-center">
        <p className="font-display text-xl text-fg">Combat interrompu</p>
        <p className="home-note">Une erreur a stoppé le duel. Reviens au menu pour relancer.</p>
        <Link to="/" className="studio-float-save is-fight home-wide" style={{ width: "100%", margin: "8px 0 0" }}>
          Menu
        </Link>
      </div>
    </div>
  );
}

export function Play() {
  const catalog = useCatalog();
  const player = usePlayer();
  const [game, setGame] = useState<GameState | null>(null);
  const [cine, setCine] = useState<{ left: TcgCard; right: TcgCard } | null>(null);
  const [cpuId, setCpuId] = useState("ST-02");
  const [mounted, setMounted] = useState(false);
  const [pickDeck, setPickDeck] = useState(false);
  const [editDeck, setEditDeck] = useState<DeckList | null>(null);
  const [studioMode, setStudioMode] = useState<"studio" | "picker">("studio");
  useEffect(() => setMounted(true), []);
  const myDeck = player.decks.find((d) => d.id === player.activeDeckId) ?? player.decks[0];
  const errs = myDeck ? validateDeck(myDeck) : ["Aucun deck"];
  const cpuOptions = useMemo(
    () => catalog.starters.filter((s) => s.leaderId),
    [catalog.starters],
  );

  const [fail, setFail] = useState("");

  const start = () => {
    setFail("");
    if (!catalog.cards.length) {
      setFail("Catalogue encore en chargement. Réessaie dans un instant.");
      return;
    }
    if (!myDeck) {
      setFail("Aucun deck sélectionné.");
      return;
    }
    if (errs.length) {
      setFail(errs[0] ?? "Deck invalide.");
      return;
    }
    try {
      const cpuDeck: DeckList | null =
        buildStarterList(catalog, cpuId) ?? buildStarterList(catalog, "ST-01");
      if (!cpuDeck) {
        setFail("Impossible de préparer le deck adverse.");
        return;
      }
      const left = cardById(myDeck.leaderId);
      const right = cardById(cpuDeck.leaderId);
      unlockSfx();
      const match = createMatch(myDeck, cpuDeck, 0);
      setGame(match);
      if (left && right) setCine({ left, right });
    } catch (e) {
      setFail(e instanceof Error ? e.message : "Le combat n’a pas pu démarrer.");
    }
  };

  if (game && cine) {
    const cineUi = (
      <ErrorBoundary onReset={() => setCine(null)} fallbackTitle="Cinématique">
        <VersusCinematic left={cine.left} right={cine.right} onDone={() => setCine(null)} />
      </ErrorBoundary>
    );
    return typeof document !== "undefined" ? createPortal(cineUi, document.body) : cineUi;
  }

  if (game) {
    const table = (
      <ErrorBoundary
        onReset={() => {
          setGame(null);
          setCine(null);
        }}
        fallbackTitle="Combat interrompu"
      >
        <div className="fight-fs">
          <Playmat
            initial={game}
            onExit={() => {
              setGame(null);
              setCine(null);
            }}
            onOver={(win) => player.recordMatch(win)}
          />
        </div>
      </ErrorBoundary>
    );
    return typeof document !== "undefined" ? createPortal(table, document.body) : table;
  }

  if (editDeck) {
    return (
      <DeckStudio
        initial={editDeck}
        mode={studioMode}
        onMode={setStudioMode}
        onClose={() => {
          setEditDeck(null);
          setStudioMode("studio");
        }}
        onSave={(d) => {
          player.saveDeck(d);
          setEditDeck(null);
          setStudioMode("studio");
        }}
      />
    );
  }

  const leader = mounted && myDeck ? cardById(myDeck.leaderId) : undefined;
  const cpuLeaderId = catalog.starters.find((s) => s.id === cpuId)?.leaderId;
  const cpuLeader = mounted && cpuLeaderId ? cardById(cpuLeaderId) : undefined;
  const skins = myDeck?.cosmetics ?? DEFAULT_EQUIP;
  const back = cosmeticById(skins.back);
  const don = cosmeticById(skins.don);
  const mat = cosmeticById(skins.mat);

  const hue = (card?: TcgCard) => {
    const c = card?.colors?.[0];
    if (!c) return undefined;
    return c === "Black" ? "#8b909c" : COLOR_HEX[c];
  };
  const meHue = hue(leader);
  const cpuHue = hue(cpuLeader);

  return (
    <main className="decks-fs relative flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Combat</h2>
        </div>
        <div className="gl-rule" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-0 [-webkit-overflow-scrolling:touch]">
        <section
          className="coll-hub is-plain is-edge play-deck-hub"
          style={meHue ? ({ ["--g1" as string]: meHue } as CSSProperties) : undefined}
        >
          <div className="play-deck-bar">
            <p className="play-kicker" style={{ margin: 0 }}>Ton deck</p>
            <span className="flex-1" />
            <button type="button" className="gl-edit" onClick={() => setPickDeck(true)}>
              Changer
            </button>
          </div>
          <div className="play-deck">
            {leader ? <CardFace card={leader} className="play-deck-card" /> : <span className="play-deck-card is-empty" />}
            <div className="play-deck-copy">
              <p className="font-display text-fg">{myDeck?.name ?? "—"}</p>
              {errs.length ? (
                <p className="mt-1 text-xs text-crimson">{errs[0]}</p>
              ) : (
                <p className="mt-1 text-xs text-ok">Prêt</p>
              )}
            </div>
            <div className="play-loadout" aria-hidden>
              <span className="play-loadout-mat">{mat ? <img src={mat.src} alt="" draggable={false} /> : null}</span>
              <span className="play-loadout-back">{back ? <img src={back.src} alt="" draggable={false} /> : null}</span>
              <span className="play-loadout-don">{don ? <img src={don.src} alt="" draggable={false} /> : null}</span>
            </div>
          </div>
        </section>

        <section
          className="coll-hub is-plain is-edge mt-3"
          style={cpuHue ? ({ ["--g1" as string]: cpuHue } as CSSProperties) : undefined}
        >
          <p className="play-kicker">Adversaire CPU</p>
          <div className="play-cpu">
            {cpuOptions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCpuId(s.id)}
                className={cn("play-cpu-tile", cpuId === s.id && "is-on")}
              >
                <BoosterPack setId={s.id} name={s.name} cover className="play-cpu-pack" />
                <span>{s.id}</span>
              </button>
            ))}
          </div>
          {cpuLeader ? <p className="play-cpu-name">{cpuLeader.name}</p> : null}
        </section>

        {leader && cpuLeader ? (
          <div
            className="play-vs"
            style={{
              ["--g1" as string]: meHue ?? "#c9a227",
              ["--g2" as string]: cpuHue ?? "#c9a227",
            }}
          >
            <span className="play-vs-glow" aria-hidden />
            <CardFace card={leader} className="play-vs-card is-left" />
            <span>VS</span>
            <CardFace card={cpuLeader} className="play-vs-card is-right" />
          </div>
        ) : null}

        {fail ? <p className="mt-3 text-center text-sm text-crimson">{fail}</p> : null}
        <div className="list-end-pad" aria-hidden />
      </div>

      <div className="studio-float">
        <Link to="/" className="studio-float-cancel">
          Retour
        </Link>
        <button
          type="button"
          className="studio-float-save is-leader"
          style={
            leader
              ? {
                  ["--g1" as string]: leader.colors[0] === "Black" ? "#8b909c" : COLOR_HEX[leader.colors[0] ?? "Red"],
                }
              : undefined
          }
          disabled={errs.length > 0 || !catalog.cards.length}
          onClick={start}
        >
          Lancer le duel
        </button>
      </div>
      {pickDeck ? (
        <DeckPickSheet
          decks={player.decks}
          activeId={player.activeDeckId}
          onPick={(id) => player.setActiveDeck(id)}
          onEdit={(d) => {
            setPickDeck(false);
            setStudioMode("studio");
            setEditDeck(d);
          }}
          onClose={() => setPickDeck(false)}
        />
      ) : null}
    </main>
  );
}
