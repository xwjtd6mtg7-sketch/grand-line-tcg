import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCatalog } from "@/components/catalog-provider";
import { BoosterPack, CardFace } from "@/components/card-face";
import { CardZoom } from "@/components/card-zoom";
import { PackOpener } from "@/components/pack-opener";
import { BodyLock } from "@/lib/lock-body";
import { ownedStarterIds, usePlayer } from "@/lib/store";
import { openBoosters, buildStarterList, grantCounts, starterMembers, PITY_LIMIT, packSets } from "@/lib/tcg/packs";
import { sortByColor } from "@/lib/tcg/catalog";
import type { Catalog, TcgCard } from "@/lib/tcg/types";
import { Gift, Package, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import { WalletChips } from "@/components/wallet";
import { BoostMark } from "@/components/boost-mark";
import { ConfirmAsk } from "@/components/confirm-ask";

export const Route = createFileRoute("/shop")({ component: () => null });

const OPEN_MAX = 10;
const BUY_HARD_CAP = 10;

function QtyStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="shop-qty">
      <div className="shop-qty-rail">
        <button type="button" aria-label="Moins" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="shop-step">
          −
        </button>
        <span className="shop-qty-n">{value}</span>
        <button type="button" aria-label="Plus" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="shop-step">
          +
        </button>
      </div>
      <button type="button" className="shop-qty-max" disabled={max < 1} onClick={() => onChange(max)}>
        MAX
      </button>
    </div>
  );
}

function productName(name: string) {
  const dash = name.indexOf(" — ");
  return dash >= 0 ? name.slice(dash + 3) : name;
}

function ProductTitle({ name, hint }: { name: string; hint: string }) {
  const dash = name.indexOf(" — ");
  const title = dash >= 0 ? name.slice(dash + 3) : name;
  const prefix = dash >= 0 ? name.slice(0, dash) : null;
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-display text-fg">{title}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{prefix ? `${prefix} · ${hint}` : hint}</p>
    </div>
  );
}

function ProductRow({
  setId,
  name,
  hint,
  badge,
  onOpen,
  dimmed,
  onPrice,
}: {
  setId: string;
  name: string;
  hint: string;
  badge: ReactNode;
  onOpen?: () => void;
  dimmed?: boolean;
  onPrice?: () => void;
}) {
  const body = (
    <>
      <BoosterPack setId={setId} name={name} cover className="home-feat-pack" />
      <ProductTitle name={name} hint={hint} />
      <span
        className="shop-cta is-badge"
        onClick={(e) => {
          if (!onPrice) return;
          e.preventDefault();
          e.stopPropagation();
          onPrice();
        }}
      >
        {badge}
      </span>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cn("shop-row", dimmed && "is-off")}>
          {body}
        </button>
      ) : (
        <div className={cn("shop-row", dimmed && "is-off")}>{body}</div>
      )}
    </li>
  );
}

type Preview = {
  kind: "booster" | "starter";
  id: string;
  name: string;
  price: number;
  view: "buy" | "contents";
  from?: "home" | "shop";
};

function contentsOf(catalog: Catalog, p: Preview): { card: TcgCard; n: number }[] {
  if (p.kind === "starter") {
    const list = buildStarterList(catalog, p.id);
    const members = starterMembers(catalog, p.id);
    const byId = new Map(members.map((c) => [c.id, c]));
    if (list) {
      const rows: { card: TcgCard; n: number }[] = [];
      const leader = byId.get(list.leaderId) ?? catalog.cards.find((c) => c.id === list.leaderId);
      if (leader) rows.push({ card: leader, n: 1 });
      for (const [id, n] of Object.entries(list.cards)) {
        const card = byId.get(id) ?? catalog.cards.find((c) => c.id === id);
        if (card) rows.push({ card, n });
      }
      return rows;
    }
    return members.map((card) => ({ card, n: 1 }));
  }
  return sortByColor(catalog.cards.filter((c) => packSets(p.id).includes(c.set) && c.type !== "DON!!")).map((card) => ({
    card,
    n: 1,
  }));
}

function PackSwipe({
  items,
  currentId,
  onChange,
}: {
  items: { id: string; name: string }[];
  currentId: string;
  onChange: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [on, setOn] = useState(currentId);

  const go = (i: number, smooth = true) => {
    const el = scroller.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  };

  const nearest = () => {
    const el = scroller.current;
    if (!el) return 0;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((node, i) => {
      const c = node as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const settle = () => {
    const i = nearest();
    const id = items[i]?.id;
    dragging.current = false;
    if (!id) return;
    setOn(id);
    if (id !== currentId) onChange(id);
    go(i, true);
  };

  useEffect(() => {
    if (dragging.current) return;
    const i = Math.max(0, items.findIndex((x) => x.id === currentId));
    setOn(currentId);
    const a = window.requestAnimationFrame(() => go(i, false));
    const b = window.setTimeout(() => go(i, false), 80);
    return () => {
      window.cancelAnimationFrame(a);
      window.clearTimeout(b);
    };
  }, [currentId, items]);

  return (
    <div
      ref={scroller}
      className="buy-swipe"
      data-scrolllock-allow
      onPointerDown={() => {
        dragging.current = true;
      }}
      onPointerUp={settle}
      onTouchEnd={settle}
      onScroll={() => {
        if (!dragging.current) return;
        const i = nearest();
        const id = items[i]?.id;
        if (id && id !== on) setOn(id);
      }}
    >
      {items.map((b) => (
        <div key={b.id} className={cn("buy-swipe-item", b.id === on && "is-on")}>
          <BoosterPack setId={b.id} name={b.name} className="buy-swipe-art" />
        </div>
      ))}
    </div>
  );
}

function BuyPreview({
  preview,
  catalog,
  berries,
  owned,
  infinite,
  onClose,
  onBuy,
  onBuyBp,
  bp = 0,
  onView,
  onSwitch,
}: {
  preview: Preview;
  catalog: Catalog;
  berries: number;
  owned?: boolean;
  infinite?: boolean;
  onClose: () => void;
  onBuy: (qty: number) => void;
  onBuyBp?: (qty: number) => void;
  bp?: number;
  onView: (view: Preview["view"]) => void;
  onSwitch?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState<TcgCard | null>(null);
  const [qty, setQty] = useState(1);
  const [ask, setAsk] = useState<"berries" | "bp" | null>(null);
  useEffect(() => setQty(1), [preview.id]);
  useEffect(() => setAsk(null), [preview.id]);
  const cards = useMemo(() => contentsOf(catalog, preview), [catalog, preview]);
  const title = productName(preview.name);
  const affordable = preview.price <= 0 || infinite ? BUY_HARD_CAP : Math.max(1, Math.floor(berries / preview.price));
  const maxQty = Math.min(BUY_HARD_CAP, affordable);
  useEffect(() => {
    if (qty > maxQty && maxQty >= 1) setQty(maxQty);
  }, [maxQty, qty]);
  const total = preview.price * (preview.kind === "booster" ? qty : 1);
  const canBuy = owned ? false : infinite || berries >= total;
  const payBp = preview.kind === "booster" && bp > 0;
  const ui = (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-none decks-fs">
      <BodyLock />
      <div className="app-safe mx-auto flex h-full w-full max-w-lg flex-col">
        <div className="gl-head">
          <div className="gl-head-row">
            <h2 className="gl-head-title">{preview.view === "contents" ? (preview.kind === "booster" ? "Contenus possibles" : "Contenus du pack") : "Boutique"}</h2>
          </div>
          <div className="gl-rule" />
        </div>

        {preview.view === "buy" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {onSwitch ? (
                <PackSwipe
                  items={
                    preview.kind === "starter"
                      ? catalog.starters.filter((s) => s.leaderId).map((s) => ({ id: s.id, name: s.name }))
                      : catalog.boosters.map((b) => ({ id: b.id, name: b.name }))
                  }
                  currentId={preview.id}
                  onChange={onSwitch}
                />
              ) : (
                <BoosterPack
                  setId={preview.id}
                  name={preview.name}
                  className="aspect-square h-full max-h-[min(62dvh,380px)] w-auto max-w-[92vw]"
                />
              )}
            </div>
            <div className="flex shrink-0 flex-col items-center gap-3 px-4 pb-3">
              {preview.kind === "booster" && !owned && !payBp ? (
                <QtyStepper value={qty} min={1} max={Math.max(1, maxQty)} onChange={setQty} />
              ) : null}
              <button type="button" className="shop-link" onClick={() => onView("contents")}>
                {preview.kind === "booster" ? "Contenus possibles" : "Contenus du pack"}
              </button>
            </div>
            <div className="shop-bar">
              <button type="button" className="studio-float-cancel" onClick={onClose}>
                {owned ? "Fermer" : "Non"}
              </button>
              {owned ? null : payBp && onBuyBp ? (
                <button type="button" className="studio-float-save is-bp" onClick={() => setAsk("bp")}>
                  <BoostMark />
                  <span>Utiliser 1 BP</span>
                </button>
              ) : (
                <button type="button" className="studio-float-save" disabled={!canBuy} onClick={() => setAsk("berries")}>
                  Oui · {total} B
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="px-4 pb-2 text-sm text-muted">
              {title} · {cards.reduce((a, r) => a + r.n, 0)} cartes
              {preview.kind === "starter" ? ` · ${cards.length} uniques` : ""}
            </p>
            <div data-scrolllock-allow className="pack-contents-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4">
              <div className="grid grid-cols-4 gap-2">
                {cards.map(({ card, n }) => (
                  <button key={card.id} type="button" className="relative min-w-0" onClick={() => setZoom(card)}>
                    <CardFace card={card} className="w-full" />
                    {n > 1 ? (
                      <span className="pointer-events-none absolute right-1 bottom-1 z-10 rounded-full bg-foam px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink shadow-[0_1px_4px_rgb(0_0_0/0.45)]">
                        ×{n}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="studio-float">
              <button type="button" className="studio-float-save" onClick={() => onView("buy")}>
                Retour
              </button>
            </div>
          </>
        )}
      </div>
      {zoom ? <CardZoom card={zoom} inspect plain onClose={() => setZoom(null)} /> : null}
      {ask ? (
        <ConfirmAsk
          kicker="Confirmer l’achat"
          title={title}
          copy={
            ask === "bp"
              ? "Échanger 1 point booster contre ce pack ?"
              : preview.kind === "starter"
                ? `Acheter ce starter pour ${preview.price} B ?`
                : qty > 1
                  ? `Acheter ${qty} boosters pour ${total} B ?`
                  : `Acheter ce booster pour ${preview.price} B ?`
          }
          bp={ask === "bp"}
          confirm={ask === "bp" ? (<><BoostMark /><span>Oui · 1 BP</span></>) : `Oui · ${total} B`}
          onNo={() => setAsk(null)}
          onYes={() => {
            const how = ask;
            setAsk(null);
            if (how === "bp") onBuyBp?.(1);
            else onBuy(qty);
          }}
        />
      ) : null}
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}

export function Shop() {
  const catalog = useCatalog();
  const player = usePlayer();
  const nav = useNavigate();
  const [opening, setOpening] = useState<{ id: string; name: string; cards: TcgCard[]; packs: number } | null>(null);
  const [purchase, setPurchase] = useState<{ id: string; name: string; kind: "booster" | "starter"; qty: number } | null>(null);
  const [tab, setTab] = useState<"packs" | "buy" | "starters">("buy");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [quick, setQuick] = useState<{
    kind: "booster" | "starter";
    id: string;
    name: string;
    price: number;
    via: "bp" | "berries";
  } | null>(null);
  const [qQty, setQQty] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const goTab = (id: "packs" | "buy" | "starters") => {
    if (id !== tab) setTab(id);
    window.requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  useEffect(() => {
    const reset = () => {
      setTab("buy");
      setPreview(null);
      setQuick(null);
      window.requestAnimationFrame(() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    };
    const onTab = (e: Event) => {
      if ((e as CustomEvent<string>).detail === "/shop") reset();
    };
    window.addEventListener("gl-tab", onTab);
    return () => window.removeEventListener("gl-tab", onTab);
  }, []);

  useEffect(() => {
    const openBuy = (id: string, from: "home" | "shop" = "home") => {
      const b = catalog.boosters.find((x) => x.id === id);
      if (!b) return;
      setTab("buy");
      setPreview({ kind: "booster", id: b.id, name: b.name, price: b.price, view: "buy", from });
    };
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent<{ id?: string; from?: "home" | "shop" }>).detail;
      if (d?.id) openBuy(d.id, d.from ?? "home");
    };
    window.addEventListener("gl-shop-buy", onEvt);
    try {
      const id = sessionStorage.getItem("gl-shop-buy");
      const from = sessionStorage.getItem("gl-shop-from") === "shop" ? "shop" : "home";
      if (id) {
        sessionStorage.removeItem("gl-shop-buy");
        sessionStorage.removeItem("gl-shop-from");
        openBuy(id, from);
      }
    } catch {
      /* ignore */
    }
    return () => window.removeEventListener("gl-shop-buy", onEvt);
  }, [catalog.boosters]);

  const gotStarters = ownedStarterIds(player.decks);
  const ownedPacks = useMemo(
    () => catalog.boosters.filter((b) => (player.packs[b.id] ?? 0) > 0),
    [catalog.boosters, player.packs],
  );

  const rip = (setId: string, name: string, qty = 1) => {
    if (!player.consumePacks(setId, qty)) return;
    const { cards, pity } = openBoosters(catalog, setId, qty, player.pity?.[setId] ?? 0);
    const pulled = cards.filter((c): c is TcgCard => Boolean(c?.id));
    if (!pulled.length) return;
    player.setPity(setId, pity);
    setOpening({ id: setId, name, cards: pulled, packs: qty });
  };

  const askRip = (setId: string, name: string) => {
    const have = player.packs[setId] ?? 0;
    if (have <= 0) return;
    rip(setId, name, Math.min(OPEN_MAX, have));
  };

  const confirmBuy = (qty: number) => {
    if (!preview) return;
    if (preview.kind === "booster") {
      const n = Math.max(1, Math.min(OPEN_MAX, qty));
      if (!player.spend(preview.price * n)) return;
      player.addPacks(preview.id, n);
      setPreview(null);
      setPurchase({ id: preview.id, name: preview.name, kind: "booster", qty: n });
      return;
    }
    if (preview.kind === "starter") {
      if (ownedStarterIds(player.decks).has(preview.id)) return;
      const st = catalog.starters.find((s) => s.id === preview.id);
      if (!st) return;
      if (!player.spend(st.price)) return;
      const list = buildStarterList(catalog, preview.id);
      if (!list) return;
      player.addCards(
        Object.entries(grantCounts(list)).flatMap(([cid, n]) => Array.from({ length: n }, () => cid)),
      );
      player.saveDeck({ ...list, id: `starter_${preview.id}`, locked: true, starterId: preview.id });
      setPreview(null);
      setPurchase({ id: preview.id, name: preview.name, kind: "starter", qty: 1 });
    }
  };

  const commitQuick = () => {
    if (!quick) return;
    if (quick.via === "bp") {
      if (!player.spendBoost(1)) return;
      player.addPacks(quick.id, 1);
      setQuick(null);
      setPurchase({ id: quick.id, name: quick.name, kind: "booster", qty: 1 });
      return;
    }
    if (quick.kind === "starter") {
      if (ownedStarterIds(player.decks).has(quick.id)) return;
      const st = catalog.starters.find((s) => s.id === quick.id);
      if (!st) return;
      if (!player.spend(st.price)) return;
      const list = buildStarterList(catalog, quick.id);
      if (!list) return;
      player.addCards(
        Object.entries(grantCounts(list)).flatMap(([cid, n]) => Array.from({ length: n }, () => cid)),
      );
      player.saveDeck({ ...list, id: `starter_${quick.id}`, locked: true, starterId: quick.id });
      setQuick(null);
      setPurchase({ id: quick.id, name: quick.name, kind: "starter", qty: 1 });
      return;
    }
    const n = Math.max(1, Math.min(OPEN_MAX, qQty));
    if (!player.spend(quick.price * n)) return;
    player.addPacks(quick.id, n);
    setQuick(null);
    setPurchase({ id: quick.id, name: quick.name, kind: "booster", qty: n });
  };

  return (
    <main className="decks-fs shop-page flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Boutique</h2>
          <WalletChips />
        </div>
        <div className="gl-rule" />
        <div className="coll-hub">
          <div className="coll-hub-tiles is-3">
            <HubTile icon={Package} label="À ouvrir" active={tab === "packs"} mark="packs" onClick={() => goTab("packs")} />
            <HubTile icon={Gift} label="Boosters" active={tab === "buy"} onClick={() => goTab("buy")} />
            <HubTile icon={Swords} label="Starters" active={tab === "starters"} onClick={() => goTab("starters")} />
          </div>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]" data-scrolllock-allow>
        {tab === "packs" ? (
          <ul className="flex flex-col gap-3">
            {ownedPacks.length === 0 ? (
              <p className="text-sm text-muted">Aucun booster en stock. Achète-en dans l’onglet Boosters.</p>
            ) : (
              ownedPacks.map((b) => (
                <ProductRow
                  key={b.id}
                  setId={b.id}
                  name={b.name}
                  hint={`×${player.packs[b.id]} · ${b.size} cartes${(player.pity?.[b.id] ?? 0) >= PITY_LIMIT ? " · SR+ garanti" : ""}`}
                  badge="Ouvrir"
                  onOpen={() => askRip(b.id, b.name)}
                />
              ))
            )}
          </ul>
        ) : null}

        {tab === "buy" ? (
          <ul className="flex flex-col gap-3">
            {catalog.boosters.map((b) => (
              <ProductRow
                key={b.id}
                setId={b.id}
                name={b.name}
                hint={`${b.id} · ${b.size} cartes · ${b.price} B`}
                badge={`${b.price} B`}
                onOpen={() => setPreview({ kind: "booster", id: b.id, name: b.name, price: b.price, view: "buy", from: "shop" })}
                onPrice={() => {
                  setQQty(1);
                  setQuick({
                    kind: "booster",
                    id: b.id,
                    name: b.name,
                    price: b.price,
                    via: (player.bp ?? 0) > 0 ? "bp" : "berries",
                  });
                }}
              />
            ))}
          </ul>
        ) : null}

        {tab === "starters" ? (
          <ul className="flex flex-col gap-3">
            {catalog.starters.filter((s) => s.leaderId).map((s) => {
              const got = gotStarters.has(s.id);
              return (
                <ProductRow
                  key={s.id}
                  setId={s.id}
                  name={s.name}
                  hint={got ? `${s.id} · Obtenu` : `${s.id} · 50 cartes + Leader`}
                  badge={got ? "Obtenu" : `${s.price} B`}
                  dimmed={got}
                  onOpen={() =>
                    setPreview({ kind: "starter", id: s.id, name: s.name, price: s.price, view: "buy", from: "shop" })
                  }
                  onPrice={
                    got
                      ? undefined
                      : () =>
                          setQuick({
                            kind: "starter",
                            id: s.id,
                            name: s.name,
                            price: s.price,
                            via: "berries",
                          })
                  }
                />
              );
            })}
          </ul>
        ) : null}
      </div>

      {preview ? (
        <BuyPreview
          preview={preview}
          catalog={catalog}
          berries={player.berries}
          owned={preview.kind === "starter" && gotStarters.has(preview.id)}
          infinite={player.devInfinite}
          onClose={() => {
            const from = preview.from;
            setPreview(null);
            if (from === "home") void nav({ to: "/" });
          }}
          onBuy={confirmBuy}
          onBuyBp={() => {
            if (!preview || preview.kind !== "booster") return;
            if (!player.spendBoost(1)) return;
            player.addPacks(preview.id, 1);
            setPreview(null);
            setPurchase({ id: preview.id, name: preview.name, kind: "booster", qty: 1 });
          }}
          bp={player.bp ?? 0}
          onView={(view) => setPreview({ ...preview, view })}
          onSwitch={(id) => {
            if (preview.kind === "starter") {
              const s = catalog.starters.find((x) => x.id === id);
              if (!s) return;
              setPreview((p) =>
                p ? { ...p, kind: "starter", id: s.id, name: s.name, price: s.price, view: "buy" } : p,
              );
              return;
            }
            const b = catalog.boosters.find((x) => x.id === id);
            if (!b) return;
            setPreview((p) =>
              p ? { ...p, kind: "booster", id: b.id, name: b.name, price: b.price, view: "buy" } : p,
            );
          }}
        />
      ) : null}

      {quick ? (
        <ConfirmAsk
          kicker="Confirmer l’achat"
          title={productName(quick.name)}
          copy={
            quick.via === "bp"
              ? "Échanger 1 point booster contre ce pack ?"
              : quick.kind === "starter"
                ? `Acheter ce starter pour ${quick.price} B ?`
                : qQty > 1
                  ? `Acheter ${qQty} boosters pour ${quick.price * qQty} B ?`
                  : `Acheter ce booster pour ${quick.price} B ?`
          }
          bp={quick.via === "bp"}
          confirm={
            quick.via === "bp" ? (
              <>
                <BoostMark />
                <span>Oui · 1 BP</span>
              </>
            ) : (
              `Oui · ${quick.price * (quick.kind === "starter" ? 1 : qQty)} B`
            )
          }
          onNo={() => setQuick(null)}
          onYes={commitQuick}
        >
          {quick.kind === "booster" && quick.via === "berries" ? (
            <div className="buy-ask-qty">
              <QtyStepper
                value={qQty}
                min={1}
                max={Math.max(
                  1,
                  Math.min(
                    OPEN_MAX,
                    player.devInfinite ? OPEN_MAX : Math.max(1, Math.floor(player.berries / Math.max(1, quick.price))),
                  ),
                )}
                onChange={setQQty}
              />
            </div>
          ) : null}
        </ConfirmAsk>
      ) : null}

      {purchase ? (
        <PurchaseCine
          setId={purchase.id}
          name={purchase.name}
          kind={purchase.kind}
          qty={purchase.qty}
          onDone={() => {
            if (purchase.kind === "booster") setTab("packs");
            setPurchase(null);
          }}
        />
      ) : null}

      {opening ? (
        <PackOpener
          setId={opening.id}
          setName={opening.name}
          cards={opening.cards}
          packs={opening.packs}
          onDone={() => {
            player.addCards(opening.cards.map((c) => c.id));
            setOpening(null);
          }}
        />
      ) : null}
    </main>
  );
}

function HubTile({
  icon: Icon,
  label,
  active,
  mark,
  onClick,
}: {
  icon: typeof Package;
  label: string;
  active?: boolean;
  mark?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} data-shop-tab={mark} className={cn("coll-hub-tile", active && "is-on")}>
      <Icon className="size-5" strokeWidth={1.7} />
      <span>{label}</span>
    </button>
  );
}

function PurchaseCine({
  setId,
  name,
  kind,
  qty,
  onDone,
}: {
  setId: string;
  name: string;
  kind: "booster" | "starter";
  qty: number;
  onDone: () => void;
}) {
  const n = Math.max(1, Math.min(10, qty));
  const stackRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [gone, setGone] = useState(-1);
  const title = productName(name);

  useEffect(() => {
    sfx("win");
    const sel = kind === "booster" ? "[data-shop-tab=packs]" : "[data-nav=collection]";
    let stop = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    const aimI = (i: number) => {
      const dest = document.querySelector<HTMLElement>(sel);
      const fan = stackRef.current?.querySelectorAll<HTMLElement>(".buy-cine-fan")[i];
      const stack = stackRef.current;
      if (!fan || !dest || !stack) return dest;
      const t = dest.getBoundingClientRect();
      const s = stack.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (s.left + s.width / 2);
      const dy = t.top + t.height / 2 - (s.top + s.height / 2);
      const sc = Math.min(t.width, t.height) * 0.52 / Math.max(1, s.width);
      fan.animate(
        [
          { transform: getComputedStyle(fan).transform, opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 1, offset: 0.78 },
          { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0 },
        ],
        { duration: 260, easing: "cubic-bezier(.22,.75,.2,1)", fill: "forwards" },
      );
      return dest;
    };

    const run = async () => {
      await wait(920);
      for (let i = 0; i < n; i++) {
        if (stop) return;
        const dest = aimI(i);
        dest?.classList.add("is-catch");
        setGone(i);
        sfx("hit");
        await wait(190);
        dest?.classList.remove("is-catch");
      }
      await wait(80);
      if (!stop) doneRef.current();
    };
    void run();
    return () => {
      stop = true;
      timers.forEach((id) => window.clearTimeout(id));
      document.querySelector(sel)?.classList.remove("is-catch");
    };
  }, [kind, n]);

  const ui = (
    <div className="buy-cine">
      <BodyLock />
      <div className="buy-cine-glow" aria-hidden />
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="buy-cine-spark"
          style={{
            ["--a" as string]: `${(i / 18) * 360}deg`,
            ["--d" as string]: `${0.08 + (i % 6) * 0.04}s`,
          }}
        />
      ))}
      <div className="buy-cine-burst" aria-hidden />
      <div ref={stackRef} className="buy-cine-stack">
        {Array.from({ length: n }, (_, i) => {
          const off = i - (n - 1) / 2;
          return (
            <div
              key={i}
              className="buy-cine-fan"
              style={{
                ["--fx" as string]: `${off * 26}px`,
                ["--fr" as string]: `${off * 7}deg`,
                ["--i" as string]: `${i}`,
                zIndex: n - i,
              }}
            >
              <div className="buy-cine-pack">
                <BoosterPack setId={setId} name={name} className="h-full w-full" />
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn("buy-cine-seal", gone >= 0 && "is-out")}>
        <span>Obtenu</span>
        <p>{title}</p>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}
