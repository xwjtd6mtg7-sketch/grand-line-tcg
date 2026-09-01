import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useCatalog } from "@/components/catalog-provider";
import { BoosterPack, CardFace } from "@/components/card-face";
import { CardDossier } from "@/components/card-dossier";
import { CardZoom } from "@/components/card-zoom";
import { CardCount, FilterSheet } from "@/components/filter-sheet";
import { StyleStudio } from "@/components/style-studio";
import { asOwned, isLockedDeck, newEmptyDeck, starterIdOf, usePlayer, validateDeck } from "@/lib/store";
import { cardById, colorsOk, deckSize, baseCardId, COLOR_HEX, COLOR_FR, COLOR_ORDER } from "@/lib/tcg/catalog";
import { cosmeticById, DEFAULT_EQUIP, type CosmeticKind } from "@/lib/tcg/cosmetics";
import { applyCardFilter, EMPTY_FILTER, type CardFilter } from "@/lib/tcg/filters";
import type { ColorName, DeckList, TcgCard } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";
import { BodyLock } from "@/lib/lock-body";
import { Bookmark, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ConfirmAsk } from "@/components/confirm-ask";

export const Route = createFileRoute("/decks")({ component: () => null });

export function Decks() {
  const player = usePlayer();
  const [editing, setEditing] = useState<DeckList | null>(null);
  const [mode, setMode] = useState<"studio" | "picker">("studio");
  const [rearrange, setRearrange] = useState(false);
  const [askDel, setAskDel] = useState<DeckList | null>(null);
  const [askEdit, setAskEdit] = useState(false);

  if (editing) {
    return (
      <DeckStudio
        initial={editing}
        mode={mode}
        onMode={setMode}
        onClose={() => {
          setEditing(null);
          setMode("studio");
        }}
        onSave={(d) => {
          player.saveDeck(d);
          setEditing(null);
          setMode("studio");
        }}
      />
    );
  }

  const customN = player.decks.filter((d) => !isLockedDeck(d)).length;

  return (
    <main className="decks-fs relative flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Mes decks</h2>
          <button type="button" className="gl-edit is-gold" onClick={() => {
            if (rearrange) setRearrange(false);
            else setAskEdit(true);
          }}>
            {rearrange ? "OK" : "Modifier"}
          </button>
        </div>
        <div className="gl-rule" />
        <span className="coll-hub-count">{player.decks.length} {player.decks.length > 1 ? "decks" : "deck"}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-0 [-webkit-overflow-scrolling:touch]">
        <div className="deck-grid">
          <button
            type="button"
            className="deck-tile is-new"
            onClick={() => {
              setEditing({ ...newEmptyDeck(), name: `Nouveau deck ${customN + 1}` });
              setMode("studio");
            }}
          >
            <span className="deck-tile-stage is-new-plus">
              <Plus className="deck-new-plus" strokeWidth={1.6} />
            </span>
            <span className="deck-tile-name">Nouveau</span>
          </button>
          {[...player.decks].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite)).map((d, i) => {
            const leader = cardById(d.leaderId);
            const locked = isLockedDeck(d);
            const starterId = locked ? starterIdOf(d) : undefined;
            const hue = leader?.colors[0] ? COLOR_HEX[leader.colors[0]] : "#c9a227";
            const active = player.activeDeckId === d.id;
            const skins = d.cosmetics ?? DEFAULT_EQUIP;
            const back = cosmeticById(skins.back);
            const don = cosmeticById(skins.don);
            const mat = cosmeticById(skins.mat);
            return (
              <div key={d.id} className={cn("deck-tile", active && "is-active")}>
                <button
                  type="button"
                  className="deck-tile-hit"
                  onClick={() => {
                    if (rearrange && !locked) return;
                    player.setActiveDeck(d.id);
                    setEditing(d);
                    setMode("studio");
                  }}
                >
                  <span className="deck-tile-banner" style={{ background: `linear-gradient(180deg, ${hue}, ${hue}66 70%, transparent)` }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="deck-tile-stage">
                    <div className="deck-tile-hero">
                      {starterId ? (
                        <BoosterPack setId={starterId} name={d.name} cover className="deck-tile-pack" />
                      ) : leader ? (
                        <CardFace card={leader} className="deck-tile-pack" />
                      ) : (
                        <Plus className="size-5 text-muted" />
                      )}
                    </div>
                    <div className="deck-tile-skins">
                      <span className="deck-tile-skin">{back ? <img src={back.src} alt="" draggable={false} /> : null}</span>
                      <span className="deck-tile-skin">{don ? <img src={don.src} alt="" draggable={false} /> : null}</span>
                      <span className="deck-tile-skin is-mat">{mat ? <img src={mat.src} alt="" draggable={false} /> : null}</span>
                    </div>
                  </div>
                  <p className="deck-tile-name">
                    {d.favorite ? <Bookmark className="deck-tile-fav" /> : null}
                    {d.name}
                  </p>
                </button>
                {rearrange && !locked ? (
                  <button type="button" className="deck-tile-del" onClick={() => setAskDel(d)} aria-label="Supprimer">
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="list-end-pad" aria-hidden />
      </div>
      <div className="studio-float">
        <Link to="/collection" className="studio-float-save" aria-label="Retour">
          Retour
        </Link>
      </div>
      {askEdit ? (
        <ConfirmAsk
          kicker="Deck"
          title="Modifier"
          copy="Passer en mode modification pour supprimer un deck ?"
          confirm="Modifier"
          onNo={() => setAskEdit(false)}
          onYes={() => {
            setAskEdit(false);
            setRearrange(true);
          }}
        />
      ) : null}
      {askDel ? (
        <ConfirmAsk
          kicker="Supprimer"
          title={askDel.name}
          copy="Ce deck sera retiré définitivement. Continuer ?"
          confirm="Supprimer"
          danger
          onNo={() => setAskDel(null)}
          onYes={() => {
            player.deleteDeck(askDel.id);
            setAskDel(null);
          }}
        />
      ) : null}
    </main>
  );
}

function expandDeck(d: DeckList): string[] {
  const ids: string[] = [];
  for (const [id, n] of Object.entries(d.cards)) {
    for (let i = 0; i < n; i++) ids.push(id);
  }
  return ids;
}

export function DeckStudio({
  initial,
  mode,
  onMode,
  onClose,
  onSave,
}: {
  initial: DeckList;
  mode: "studio" | "picker";
  onMode: (m: "studio" | "picker") => void;
  onClose: () => void;
  onSave: (d: DeckList) => void;
}) {
  const catalog = useCatalog();
  const raw = usePlayer((s) => s.collection);
  const infinite = usePlayer((s) => s.devInfinite);
  const collection = useMemo(() => asOwned(raw, catalog.cards, infinite), [raw, catalog.cards, infinite]);
  const known = usePlayer((s) => s.decks.some((d) => d.id === initial.id));
  const [draft, setDraft] = useState<DeckList>(initial);
  const [skin, setSkin] = useState<CosmeticKind | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [info, setInfo] = useState<TcgCard | null>(null);
  const [askSave, setAskSave] = useState(false);
  const locked = isLockedDeck(draft);
  const leader = cardById(draft.leaderId);
  const size = deckSize(draft.cards);
  const errs = validateDeck(draft);
  const uniques = Object.entries(draft.cards);

  const add = (c: TcgCard) => {
    if (locked) return;
    if (c.type === "Leader") {
      setDraft({ ...draft, leaderId: c.id });
      return;
    }
    if (leader && !colorsOk(leader, c)) return;
    if (size >= 50) return;
    const n = draft.cards[c.id] ?? 0;
    const copies = Object.entries(draft.cards).reduce((acc, [id, q]) => acc + (baseCardId(id) === baseCardId(c.id) ? q : 0), 0);
    if (n >= (collection[c.id] ?? 0) || copies >= 4) return;
    setDraft({ ...draft, cards: { ...draft.cards, [c.id]: n + 1 } });
  };

  const sub = (c: TcgCard) => {
    if (locked) return;
    if (c.type === "Leader" && draft.leaderId === c.id) {
      setDraft({ ...draft, leaderId: "" });
      return;
    }
    const n = draft.cards[c.id] ?? 0;
    if (n <= 1) {
      const next = { ...draft.cards };
      delete next[c.id];
      setDraft({ ...draft, cards: next });
    } else {
      setDraft({ ...draft, cards: { ...draft.cards, [c.id]: n - 1 } });
    }
  };

  const removeAll = (c: TcgCard) => {
    if (locked) return;
    if (c.type === "Leader" && draft.leaderId === c.id) {
      setDraft({ ...draft, leaderId: "" });
      return;
    }
    const next = { ...draft.cards };
    delete next[c.id];
    setDraft({ ...draft, cards: next });
  };

  const autoFill = (color: ColorName) => {
    if (locked) return;
    const leaders = catalog.cards.filter((c) => c.type === "Leader" && c.colors.includes(color) && (collection[c.id] ?? 0) > 0);
    const lead = leaders[0];
    if (!lead) return;
    const pool = catalog.cards.filter((c) => c.type !== "Leader" && c.type !== "DON!!" && colorsOk(lead, c) && (collection[c.id] ?? 0) > 0);
    pool.sort((a, b) => (a.type === "Character" ? -1 : 1) - (b.type === "Character" ? -1 : 1));
    const cards: Record<string, number> = {};
    let n = 0;
    for (const c of pool) {
      const have = collection[c.id] ?? 0;
      const take = Math.min(4, have, 50 - n);
      if (take <= 0) continue;
      cards[c.id] = take;
      n += take;
      if (n >= 50) break;
    }
    setDraft({ ...draft, leaderId: lead.id, cards });
  };

  if (mode === "picker") {
    return (
      <CardPicker
        catalogCards={catalog.cards}
        draft={draft}
        locked={locked}
        focusId={focusId}
        onAdd={add}
        onSub={sub}
        onRemoveAll={removeAll}
        onClear={() => setDraft({ ...draft, cards: {} })}
        onAuto={autoFill}
        onDone={() => onMode("studio")}
      />
    );
  }

  return (
    <main className="decks-fs relative flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <input
            value={draft.name}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="gl-name"
          />
          <button
            type="button"
            className={cn("deck-fav", draft.favorite && "is-on")}
            onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}
            aria-label="Favori"
          >
            <Bookmark className="size-4" fill={draft.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="gl-rule" />
      </div>
      <div className="shrink-0 px-3 pb-2">
        <div className="deck-hero">
          {leader ? (
            <Holdable className="deck-hero-card" onTap={() => setInfo(leader)} onHold={() => setInfo(leader)}>
              <CardFace card={leader} className="w-full" />
            </Holdable>
          ) : (
            <button type="button" className="deck-hero-empty" onClick={() => { setFocusId(null); onMode("picker"); }}>
              <Plus className="size-5" />
              <span>Leader</span>
            </button>
          )}
        </div>
        <div
          className={cn("coll-hub", leader && "is-tint")}
          style={
            leader
              ? ({
                  ["--g1" as string]: leader.colors[0] === "Black" ? "#8b909c" : COLOR_HEX[leader.colors[0]],
                  ["--g2" as string]: (leader.colors[1] ?? leader.colors[0]) === "Black"
                    ? "#8b909c"
                    : COLOR_HEX[leader.colors[1] ?? leader.colors[0]],
                } as CSSProperties)
              : undefined
          }
        >
          <div className="coll-hub-tiles is-3">
            {(["back", "don", "mat"] as const).map((kind) => {
              const item = cosmeticById(draft.cosmetics?.[kind] ?? DEFAULT_EQUIP[kind]);
              return (
                <button key={kind} type="button" className="coll-hub-tile" onClick={() => setSkin(kind)}>
                  {item ? <img src={item.src} alt="" className="deck-slot-skin" draggable={false} /> : <Plus className="size-4" />}
                  <span>{kind === "back" ? "Dos" : kind === "don" ? "DON!!" : "Tapis"}</span>
                </button>
              );
            })}
          </div>
          <div className="coll-hub-bar">
            <span className="coll-hub-count">{size}/50</span>
            <span className="flex-1" />
            <button type="button" className="gl-edit" onClick={() => { setFocusId(null); onMode("picker"); }}>
              Modifier
            </button>
          </div>
        </div>
        {errs.map((e) => (
          <p key={e} className="mt-2 text-xs text-crimson">{e}</p>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-0 [-webkit-overflow-scrolling:touch]">
        <div className="deck-cells">
          {uniques.map(([id, n]) => {
            const card = cardById(id);
            return (
              <Holdable
                key={id}
                className="deck-cell"
                onTap={() => card && setInfo(card)}
                onHold={() => card && setInfo(card)}
              >
                {card ? <CardFace card={card} className="w-full" /> : <Plus className="size-3 text-muted" />}
                <span className="card-qty">{n}/4</span>
              </Holdable>
            );
          })}
          <button
            type="button"
            className="deck-cell"
            onClick={() => {
              setFocusId(null);
              onMode("picker");
            }}
          >
            <Plus className="size-3 text-muted" />
          </button>
        </div>
        <div className="list-end-pad" aria-hidden />
      </div>
      <div className="studio-float">
        <button type="button" className="studio-float-cancel" onClick={onClose}>Annuler</button>
        <button type="button" className="studio-float-save" disabled={!locked && errs.length > 0} onClick={() => setAskSave(true)}>Sauvegarder</button>
      </div>
      {skin ? (
        <StyleStudio
          initialKind={skin}
          equipped={draft.cosmetics ?? DEFAULT_EQUIP}
          onEquip={(kind, id) =>
            setDraft({ ...draft, cosmetics: { ...(draft.cosmetics ?? DEFAULT_EQUIP), [kind]: id } })
          }
          onClose={() => setSkin(null)}
        />
      ) : null}
      {info ? <CardDossier card={info} onClose={() => setInfo(null)} onPick={setInfo} /> : null}
      {askSave ? (
        <ConfirmAsk
          kicker="Deck"
          title={draft.name}
          copy={known ? "Enregistrer les modifications de ce deck ?" : "Créer ce deck dans ta collection ?"}
          confirm="Sauvegarder"
          onNo={() => setAskSave(false)}
          onYes={() => {
            setAskSave(false);
            onSave(draft);
          }}
        />
      ) : null}
    </main>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  if (!arr.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function CardPicker({
  catalogCards,
  draft,
  locked,
  focusId,
  onAdd,
  onSub,
  onRemoveAll,
  onClear,
  onAuto,
  onDone,
}: {
  catalogCards: TcgCard[];
  draft: DeckList;
  locked: boolean;
  focusId: string | null;
  onAdd: (c: TcgCard) => void;
  onSub: (c: TcgCard) => void;
  onRemoveAll: (c: TcgCard) => void;
  onClear: () => void;
  onAuto: (c: ColorName) => void;
  onDone: () => void;
}) {
  const raw = usePlayer((s) => s.collection);
  const infinite = usePlayer((s) => s.devInfinite);
  const collection = useMemo(() => asOwned(raw, catalogCards, infinite), [raw, catalogCards, infinite]);
  const [filter, setFilter] = useState<CardFilter>({ ...EMPTY_FILTER, setId: "owned" });
  const [sheet, setSheet] = useState(false);
  const [zoom, setZoom] = useState<TcgCard | null>(null);
  const [info, setInfo] = useState<TcgCard | null>(null);
  const [askColor, setAskColor] = useState(false);
  const [cols, setCols] = useState<3 | 5>(3);
  const [scale, setScale] = useState<25 | 50 | 100>(50);
  const [watchId, setWatchId] = useState<string | null>(focusId);
  const poolRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sets = useMemo(() => {
    const ids = new Set(catalogCards.map((c) => c.set));
    return ["owned", "all", "alt", "manga", "promo", ...[...ids].sort()];
  }, [catalogCards]);

  const pool = useMemo(
    () => applyCardFilter(catalogCards, collection, filter, { ownedOnly: filter.setId === "owned" || filter.setId === "" }),
    [catalogCards, collection, filter],
  );

  useEffect(() => {
    if (!watchId) return;
    if (!pool.some((c) => c.id === watchId)) {
      setFilter({ ...EMPTY_FILTER, setId: "owned" });
    }
  }, [watchId]);

  useEffect(() => {
    if (!watchId) return;
    const el = cardRefs.current[watchId];
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [watchId, pool, cols]);

  const watch = (id: string) => setWatchId((cur) => (cur === id ? null : id));

  const trayCols = scale === 25 ? 10 : scale === 50 ? 5 : 3;
  const pageSize = scale === 25 ? 20 : scale === 50 ? 10 : 6;
  const uniques = Object.entries(draft.cards);
  const pages = chunk(uniques, pageSize);
  const trayPages = pages.length ? pages : [[]] as [string, number][][];
  const size = deckSize(draft.cards);

  const trayCard = (id: string | undefined, qty: number, key: string) => {
    const card = id ? cardById(id) : null;
    return (
      <Holdable
        key={key}
        className={cn("picker-page-card", !card && "is-empty", card && watchId === card.id && "is-watch")}
        onTap={() => {
          if (card) watch(card.id);
        }}
        onHold={() => card && setInfo(card)}
      >
        {card ? <CardFace card={card} className="w-full" /> : <Plus className="size-3 text-muted" />}
        {card ? <span className="card-qty">{qty}/4</span> : null}
        {card && watchId === card.id && !locked ? (
          <span
            className="picker-drop"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAll(card);
              setWatchId(null);
            }}
          >
            <Minus className="size-2.5" strokeWidth={2.8} /> Retirer
          </span>
        ) : null}
      </Holdable>
    );
  };

  const ui = (
    <div className="picker-fs">
      <BodyLock />
      <div className="picker-top">
        <button type="button" className="picker-clear" disabled={locked} onClick={onClear}>
          <Minus className="size-3.5" strokeWidth={2.4} /> Tout retirer
        </button>
        <button type="button" className="picker-auto" disabled={locked} onClick={() => setAskColor(true)}>
          Auto
        </button>
        <div className="picker-zoom">
          <button type="button" className="picker-zoom-btn" disabled={scale <= 25} onClick={() => setScale((s) => (s === 100 ? 50 : 25))}>−</button>
          <span className="picker-zoom-sep" />
          {scale} %
          <span className="picker-zoom-sep" />
          <button type="button" className="picker-zoom-btn" disabled={scale >= 100} onClick={() => setScale((s) => (s === 25 ? 50 : 100))}>+</button>
        </div>
      </div>
      <div className={cn("picker-pages", `is-${scale}`)} data-scrolllock-allow>
        {scale === 100
          ? uniques.map(([id, n]) => trayCard(id, n, id))
          : trayPages.map((page, pi) => (
              <div key={pi} className="picker-page" style={{ gridTemplateColumns: `repeat(${trayCols}, 1fr)` }}>
                {Array.from({ length: pageSize }).map((_, i) => {
                  const pair = page[i];
                  return trayCard(pair?.[0], pair?.[1] ?? 0, `${pair?.[0] ?? "e"}-${pi}-${i}`);
                })}
              </div>
            ))}
      </div>
      <div className="picker-mid">
        <span className="coll-hub-count">{size}/50</span>
        <button type="button" className={cn("picker-cols", cols === 3 && "is-on")} onClick={() => setCols((c) => (c === 3 ? 5 : 3))}>
          {cols} colonnes
        </button>
        <span className="flex-1" />
        <button type="button" className="coll-hub-search" onClick={() => setSheet(true)} aria-label="Filtres">
          <Search className="size-4" />
        </button>
      </div>
      <div className="picker-pool" ref={poolRef}>
        <div className="picker-pool-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {pool.map((c) => {
            const n = collection[c.id] ?? 0;
            const inDeck = c.type === "Leader" ? (draft.leaderId === c.id ? 1 : 0) : (draft.cards[c.id] ?? 0);
            const watching = watchId === c.id;
            const max = c.type === "Leader" ? 1 : 4;
            return (
              <div
                key={c.id}
                ref={(el) => {
                  cardRefs.current[c.id] = el;
                }}
                className={cn("relative", watching && "picker-watch")}
              >
                <Holdable onTap={() => watch(c.id)} onHold={() => setInfo(c)}>
                  <CardFace card={c} dimmed={n === 0} className="w-full" />
                </Holdable>
                <CardCount n={n} />
                {watching && !locked ? (
                  <>
                    {inDeck > 0 ? (
                      <button
                        type="button"
                        className="picker-kill"
                        onClick={() => {
                          onRemoveAll(c);
                          setWatchId(c.id);
                        }}
                        aria-label="Retirer toutes les copies"
                      >
                        <Minus className="size-3" strokeWidth={3} />
                      </button>
                    ) : null}
                    {inDeck > 0 ? <span className="picker-ratio">{inDeck}/{max}</span> : null}
                    <div className="picker-step">
                      <button type="button" disabled={inDeck <= 0} onClick={() => onSub(c)} aria-label="Moins">
                        <Minus className="size-3.5" strokeWidth={2.4} />
                      </button>
                      <span />
                      <button type="button" disabled={inDeck >= max || n <= inDeck} onClick={() => onAdd(c)} aria-label="Plus">
                        <Plus className="size-3.5" strokeWidth={2.4} />
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="list-end-pad" aria-hidden />
      </div>
      <div className="studio-float">
        <button type="button" className="studio-float-save" onClick={onDone}>OK</button>
      </div>
      {askColor ? (
        <div className="filter-sheet" onClick={() => setAskColor(false)}>
          <div className="filter-sheet-panel" onClick={(e) => e.stopPropagation()}>
            <div className="filter-sheet-handle" />
            <p className="filter-label">Couleur du deck auto</p>
            <div className="flex flex-wrap gap-2 pb-4">
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="filter-chip"
                  style={{ background: COLOR_HEX[c], color: c === "Yellow" || c === "Green" ? "#111" : "#f4ead4" }}
                  onClick={() => {
                    onAuto(c);
                    setAskColor(false);
                  }}
                >
                  {COLOR_FR[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {sheet ? (
        <FilterSheet
          value={filter}
          sets={sets}
          onClose={() => setSheet(false)}
          onApply={(next) => setFilter(next)}
        />
      ) : null}
      {zoom ? (
        <CardZoom
          card={zoom}
          count={collection[zoom.id]}
          onClose={() => setZoom(null)}
          actions={
            locked
              ? []
              : [{ label: zoom.type === "Leader" ? "Choisir comme Leader" : "Ajouter", onClick: () => { onAdd(zoom); setZoom(null); } }]
          }
        />
      ) : null}
      {info ? <CardDossier card={info} onClose={() => setInfo(null)} onPick={setInfo} /> : null}
    </div>
  );

  return createPortal(ui, document.body);
}

function Holdable({
  onHold,
  onTap,
  className,
  children,
}: {
  onHold: () => void;
  onTap?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useRef<number | null>(null);
  const fired = useRef(false);
  const o = useRef<{ x: number; y: number } | null>(null);
  const clear = () => {
    if (t.current) {
      window.clearTimeout(t.current);
      t.current = null;
    }
  };
  return (
    <div
      className={className}
      onPointerDown={(e) => {
        fired.current = false;
        o.current = { x: e.clientX, y: e.clientY };
        t.current = window.setTimeout(() => {
          fired.current = true;
          t.current = null;
          try {
            navigator.vibrate?.(10);
          } catch {
            /* ignore */
          }
          onHold();
        }, 480);
      }}
      onPointerMove={(e) => {
        const p = o.current;
        if (p && t.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onTap?.();
      }}
    >
      {children}
    </div>
  );
}
