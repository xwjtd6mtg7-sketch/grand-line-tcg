import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useCatalog } from "@/components/catalog-provider";
import { CardFace } from "@/components/card-face";
import { CardDossier } from "@/components/card-dossier";
import { CardCount, FilterSheet } from "@/components/filter-sheet";
import { asOwned, usePlayer } from "@/lib/store";
import { applyCardFilter, EMPTY_FILTER, type CardFilter } from "@/lib/tcg/filters";
import type { TcgCard } from "@/lib/tcg/types";
import { BookOpen, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldSwitch } from "@/components/gold-switch";

export const Route = createFileRoute("/collection")({ component: () => null });

export function Collection() {
  const catalog = useCatalog();
  const raw = usePlayer((s) => s.collection);
  const infinite = usePlayer((s) => s.devInfinite);
  const collection = useMemo(
    () => asOwned(raw, catalog.cards, infinite),
    [raw, catalog.cards, infinite],
  );
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER);
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();
  const [sheet, setSheet] = useState(false);
  const [zoom, setZoom] = useState<TcgCard | null>(null);
  const [shown, setShown] = useState(48);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onTab = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/collection") return;
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("gl-tab", onTab);
    return () => window.removeEventListener("gl-tab", onTab);
  }, []);

  const sets = useMemo(() => {
    const ids = new Set(catalog.cards.map((c) => c.set));
    return ["owned", "all", "alt", "manga", "promo", ...[...ids].sort()];
  }, [catalog.cards]);

  const cards = useMemo(
    () =>
      applyCardFilter(
        catalog.cards,
        collection,
        {
          ...filter,
          setId: filter.setId === "owned" || filter.setId === "all" ? "all" : filter.setId,
        },
        { ownedOnly: !showAll },
      ),
    [catalog.cards, collection, filter, showAll],
  );

  useEffect(() => {
    setShown(48);
  }, [showAll, filter]);

  const onListScroll = () => {
    const el = listRef.current;
    if (!el || shown >= cards.length) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 900) {
      setShown((n) => Math.min(cards.length, n + 36));
    }
  };

  const stats = useMemo(() => {
    const filtered = applyCardFilter(
      catalog.cards,
      collection,
      {
        ...filter,
        setId: filter.setId === "owned" || filter.setId === "all" ? "all" : filter.setId,
      },
      { ownedOnly: false },
    );
    const have = filtered.reduce((n, c) => n + ((collection[c.id] ?? 0) > 0 ? 1 : 0), 0);
    return { have, total: filtered.length };
  }, [catalog.cards, collection, filter]);
  const visible = cards.slice(0, shown);

  return (
    <main className="decks-fs flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Collection</h2>
        </div>
        <div className="gl-rule" />
        <div className="coll-hub">
          <div className="coll-hub-tiles is-2">
            <HubTile icon={BookOpen} label="Cartes" active />
            <HubTile icon={Layers} label="Decks" onClick={() => navigate({ to: "/decks" })} />
          </div>
          <div className="coll-hub-bar">
            <span className="coll-hub-count">
              <BookOpen className="size-3.5 opacity-80" />
              {showAll
                ? `${stats.have.toLocaleString("fr-FR")}/${stats.total.toLocaleString("fr-FR")}`
                : stats.have.toLocaleString("fr-FR")}
            </span>
            <span className="flex-1" />
            <GoldSwitch
              on={showAll}
              onChange={() => startTransition(() => setShowAll((v) => !v))}
              label={showAll ? "Toutes les cartes" : "Cartes possédées"}
            />
            <span className="coll-hub-sep" />
            <button type="button" className="coll-hub-search" onClick={() => setSheet(true)} aria-label="Filtres">
              <Search className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">
        <div className="coll-grid">
          {visible.map((c) => {
            const n = collection[c.id] ?? 0;
            return (
              <div key={c.id} className="relative">
                <CardFace card={c} dimmed={n === 0} onClick={() => setZoom(c)} className="w-full" />
                <CardCount n={n} />
              </div>
            );
          })}
        </div>
        {cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Aucune carte ne correspond aux filtres.</p>
        ) : null}
      </div>

      {sheet ? (
        <FilterSheet
          value={filter}
          sets={sets}
          onClose={() => setSheet(false)}
          onApply={(next) => setFilter(next)}
        />
      ) : null}
      {zoom ? (
        <CardDossier
          card={zoom}
          count={collection[zoom.id] ?? 0}
          onClose={() => setZoom(null)}
          onPick={setZoom}
        />
      ) : null}
    </main>
  );
}

function HubTile({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn("coll-hub-tile", active && "is-on")}>
      <Icon className="size-5" strokeWidth={1.7} />
      <span>{label}</span>
    </button>
  );
}
