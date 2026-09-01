import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Catalog, DeckList } from "@/lib/tcg/types";
import { buildStarterList, grantCounts } from "@/lib/tcg/packs";
import { colorsOk, deckSize, cardById, baseCardId } from "@/lib/tcg/catalog";
import { uid } from "@/lib/utils";
import { COSMETICS, DEFAULT_EQUIP, freeCosmeticIds } from "@/lib/tcg/cosmetics";
import { BP_MAX, syncBoost, type BoostState } from "@/lib/boost-pts";

export interface PlayerSave {
  berries: number;
  collection: Record<string, number>;
  decks: DeckList[];
  activeDeckId: string;
  packs: Record<string, number>;
  wins: number;
  losses: number;
  opened: number;
  lastFreePack: string;
  granted: boolean;
  seenRules: boolean;
  devInfinite: boolean;
  ownedCosmetics: string[];
  equip: { back: string; don: string; mat: string };
  pity: Record<string, number>;
  bp: number;
  bpStock: number;
  bpAt: number;
  bpDay: string;
  bpMade: number;
}

interface PlayerApi extends PlayerSave {
  hydrate: (catalog: Catalog) => void;
  addCards: (ids: string[]) => void;
  spend: (n: number) => boolean;
  gain: (n: number) => void;
  addPacks: (setId: string, n: number) => void;
  consumePack: (setId: string) => boolean;
  consumePacks: (setId: string, n: number) => boolean;
  saveDeck: (deck: DeckList) => void;
  deleteDeck: (id: string) => void;
  setActiveDeck: (id: string) => void;
  recordMatch: (win: boolean) => void;
  claimDaily: () => boolean;
  markRules: () => void;
  toggleDevInfinite: () => void;
  equipCosmetic: (id: string) => void;
  buyCosmetic: (id: string) => boolean;
  setPity: (setId: string, n: number) => void;
  tickBoost: () => BoostState;
  claimBoost: () => number;
  spendBoost: (n: number) => boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

const empty: PlayerSave = {
  berries: 0,
  collection: {},
  decks: [],
  activeDeckId: "",
  packs: {},
  wins: 0,
  losses: 0,
  opened: 0,
  lastFreePack: "",
  granted: false,
  seenRules: false,
  devInfinite: false,
  ownedCosmetics: freeCosmeticIds(),
  equip: { ...DEFAULT_EQUIP },
  pity: {},
  bp: 0,
  bpStock: 0,
  bpAt: 0,
  bpDay: "",
  bpMade: 0,
};

export const usePlayer = create<PlayerApi>()(
  persist(
    (set, get) => ({
      ...empty,
      hydrate: (catalog) => {
        try {
        const decks = Array.isArray(get().decks) ? get().decks : [];
        const tagged = decks.map(tagStarter);
        const dirty = tagged.some((d, i) => d.locked !== decks[i]?.locked || d.starterId !== decks[i]?.starterId);
        if (dirty) set({ decks: tagged });
        if (get().granted) {
          const owned = grantCosmetics(get().ownedCosmetics, get().wins);
          if (owned.length !== get().ownedCosmetics.length) set({ ownedCosmetics: owned });
          return;
        }
        const list = catalog.cards.length
          ? (buildStarterList(catalog, "ST-01") ?? buildStarterList(catalog, catalog.starters[0]?.id ?? ""))
          : null;
        if (!list) {
          set({
            berries: Math.max(get().berries, 900),
            packs: get().packs && typeof get().packs === "object" && Object.keys(get().packs).length ? get().packs : { "OP-01": 5, "OP-02": 2 },
          });
          return;
        }
        const collection = grantCounts(list);
        set({
          granted: true,
          berries: Math.max(get().berries, 900),
          collection,
          decks: decks.length
            ? decks.map(tagStarter)
            : [{ ...list, id: "starter_ST-01", locked: true, starterId: "ST-01", name: list.name }],
          activeDeckId: get().activeDeckId || "starter_ST-01",
          packs: get().packs && typeof get().packs === "object" && Object.keys(get().packs).length ? get().packs : { "OP-01": 5, "OP-02": 2 },
        });
        } catch {
          /* keep last good save */
        }
      },
      addCards: (ids) => {
        const collection = { ...get().collection };
        for (const id of ids) collection[id] = (collection[id] ?? 0) + 1;
        set({ collection, opened: get().opened + 1 });
      },
      spend: (n) => {
        if (get().devInfinite) return true;
        if (get().berries < n) return false;
        set({ berries: get().berries - n });
        return true;
      },
      gain: (n) => set({ berries: get().berries + n }),
      addPacks: (setId, n) => {
        const packs = { ...get().packs };
        packs[setId] = (packs[setId] ?? 0) + n;
        set({ packs });
      },
      consumePack: (setId) => get().consumePacks(setId, 1),
      consumePacks: (setId, n) => {
        if (n <= 0) return false;
        const have = get().packs[setId] ?? 0;
        if (have < n) return false;
        const packs = { ...get().packs, [setId]: have - n };
        if (packs[setId] === 0) delete packs[setId];
        set({ packs });
        return true;
      },
      saveDeck: (deck) => {
        const decks = get().decks.slice();
        const i = decks.findIndex((d) => d.id === deck.id);
        const prev = i >= 0 ? decks[i] : undefined;
        const next = prev && isLockedDeck(prev) ? { ...deck, locked: true, starterId: prev.starterId ?? starterIdOf(prev) } : deck;
        if (i >= 0) decks[i] = next;
        else decks.push(next);
        set({ decks, activeDeckId: next.id });
      },
      deleteDeck: (id) => {
        const target = get().decks.find((d) => d.id === id);
        if (target && isLockedDeck(target)) return;
        const decks = get().decks.filter((d) => d.id !== id);
        set({
          decks,
          activeDeckId: get().activeDeckId === id ? (decks[0]?.id ?? "") : get().activeDeckId,
        });
      },
      setActiveDeck: (id) => set({ activeDeckId: id }),
      recordMatch: (win) =>
        set({
          wins: get().wins + (win ? 1 : 0),
          losses: get().losses + (win ? 0 : 1),
          berries: get().berries + (win ? 120 : 40),
          ownedCosmetics: grantCosmetics(get().ownedCosmetics, get().wins + (win ? 1 : 0)),
        }),
      claimDaily: () => {
        const d = today();
        if (get().lastFreePack === d) return false;
        const packs = { ...get().packs };
        packs["OP-17"] = (packs["OP-17"] ?? 0) + 1;
        set({ lastFreePack: d, packs });
        return true;
      },
      markRules: () => set({ seenRules: true }),
      toggleDevInfinite: () => set({ devInfinite: !get().devInfinite }),
      equipCosmetic: (id) => {
        const item = COSMETICS.find((c) => c.id === id);
        if (!item) return;
        if (!get().ownedCosmetics.includes(id)) return;
        set({ equip: { ...get().equip, [item.kind]: id } });
      },
      buyCosmetic: (id) => {
        const item = COSMETICS.find((c) => c.id === id);
        if (!item) return false;
        if (get().ownedCosmetics.includes(id)) {
          set({ equip: { ...get().equip, [item.kind]: id } });
          return true;
        }
        if (item.wins && get().wins < item.wins) return false;
        if (item.price > 0 && !get().spend(item.price)) return false;
        const owned = grantCosmetics([...get().ownedCosmetics, id], get().wins);
        set({ ownedCosmetics: owned, equip: { ...get().equip, [item.kind]: id } });
        return true;
      },
      setPity: (setId, n) => {
        const pity = { ...(get().pity ?? {}) };
        pity[setId] = Math.max(0, n);
        set({ pity });
      },
      tickBoost: () => {
        const cur = get();
        const next = syncBoost({
          bp: cur.bp ?? 0,
          bpStock: cur.bpStock ?? 0,
          bpAt: cur.bpAt || Date.now() - 5 * 60 * 60 * 1000,
          bpDay: cur.bpDay ?? "",
          bpMade: cur.bpMade ?? 0,
        });
        if (
          next.bp !== cur.bp ||
          next.bpStock !== cur.bpStock ||
          next.bpAt !== cur.bpAt ||
          next.bpDay !== cur.bpDay ||
          next.bpMade !== cur.bpMade
        ) {
          set(next);
        }
        return next;
      },
      claimBoost: () => {
        const t = get().tickBoost();
        const room = BP_MAX - t.bp;
        const n = Math.min(t.bpStock, room);
        if (n <= 0) return 0;
        set({ bp: t.bp + n, bpStock: t.bpStock - n });
        return n;
      },
      spendBoost: (n) => {
        if (n <= 0) return true;
        const t = get().tickBoost();
        if (t.bp < n) return false;
        set({ bp: t.bp - n });
        return true;
      },
    }),
    { name: "gl-tcg-save", version: 3, migrate: (persisted) => {
      const p = (persisted ?? {}) as Record<string, unknown>;
      return {
        ...p,
        pity: p.pity && typeof p.pity === "object" ? p.pity : {},
        bp: typeof p.bp === "number" ? p.bp : 0,
        bpStock: typeof p.bpStock === "number" ? p.bpStock : 0,
        bpAt: typeof p.bpAt === "number" ? p.bpAt : 0,
        bpDay: typeof p.bpDay === "string" ? p.bpDay : "",
        bpMade: typeof p.bpMade === "number" ? p.bpMade : 0,
      };
    }, storage: createJSONStorage(() => ({
      getItem: (name) => {
        try {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          JSON.parse(raw);
          return raw;
        } catch {
          try {
            localStorage.removeItem(name);
          } catch {
            /* ignore */
          }
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          localStorage.setItem(name, value);
        } catch {
          /* quota */
        }
      },
      removeItem: (name) => {
        try {
          localStorage.removeItem(name);
        } catch {
          /* ignore */
        }
      },
    })), merge: (persisted, current) => {
      try {
      const p = (persisted ?? {}) as Partial<PlayerSave>;
      const eq = (p.equip && typeof p.equip === "object" ? p.equip : {}) as Partial<PlayerSave["equip"]>;
      return {
        ...current,
        ...p,
        berries: Number.isFinite(Number(p.berries)) ? Number(p.berries) : current.berries,
        collection: p.collection && typeof p.collection === "object" && !Array.isArray(p.collection) ? p.collection : current.collection,
        packs: p.packs && typeof p.packs === "object" && !Array.isArray(p.packs) ? p.packs : current.packs,
        decks: Array.isArray(p.decks) ? p.decks : current.decks,
        wins: Number(p.wins) || 0,
        losses: Number(p.losses) || 0,
        seenRules: Boolean(p.seenRules),
        devInfinite: Boolean(p.devInfinite),
        ownedCosmetics: grantCosmetics(Array.isArray(p.ownedCosmetics) ? p.ownedCosmetics : current.ownedCosmetics, Number(p.wins) || 0),
        equip: {
          back: eq.back ?? current.equip.back,
          don: eq.don ?? current.equip.don,
          mat: eq.mat ?? current.equip.mat,
        },
        pity: p.pity && typeof p.pity === "object" && !Array.isArray(p.pity) ? p.pity : current.pity,
      };
      } catch {
        return current;
      }
    } },
  ),
);

function grantCosmetics(owned: string[] | undefined, wins: number) {
  const set = new Set(owned ?? []);
  for (const id of freeCosmeticIds()) set.add(id);
  for (const c of COSMETICS) {
    if (c.wins && wins >= c.wins) set.add(c.id);
  }
  return [...set];
}

export function isLockedDeck(d: DeckList): boolean {
  return Boolean(d.locked || d.starterId || d.id === "deck_starter" || /^(starter_|deck_ST-)/.test(d.id));
}

export function starterIdOf(d: DeckList): string | undefined {
  if (d.starterId) return d.starterId;
  if (d.id === "deck_starter") return "ST-01";
  const m = d.id.match(/^(?:starter_|deck_)(ST-\d+)/);
  return m?.[1];
}

export function ownedStarterIds(decks: DeckList[]): Set<string> {
  const set = new Set<string>();
  for (const d of decks) {
    const id = starterIdOf(d);
    if (id) set.add(id);
  }
  return set;
}

function tagStarter(d: DeckList): DeckList {
  const sid = starterIdOf(d);
  if (!sid) return d;
  return { ...d, locked: true, starterId: sid };
}

export function asOwned(
  collection: Record<string, number>,
  cards: { id: string; type?: string }[],
  infinite?: boolean,
): Record<string, number> {
  if (!infinite) return collection;
  const out: Record<string, number> = { ...collection };
  for (const c of cards) {
    if (c.type === "DON!!") continue;
    out[c.id] = 4;
  }
  return out;
}

export function ownedCount(id: string): number {
  const s = usePlayer.getState();
  if (s.devInfinite) return 4;
  return s.collection[id] ?? 0;
}

export function validateDeck(deck: DeckList): string[] {
  const errs: string[] = [];
  const leader = cardById(deck.leaderId);
  if (!leader || leader.type !== "Leader") errs.push("Choisis un Leader.");
  const n = deckSize(deck.cards);
  if (n !== 50) errs.push(`Le deck doit contenir 50 cartes (actuellement ${n}).`);
  const col = usePlayer.getState().devInfinite
    ? null
    : usePlayer.getState().collection;
  if (leader && !usePlayer.getState().devInfinite && (col?.[leader.id] ?? 0) < 1) errs.push("Leader absent de la collection.");
  const copies: Record<string, number> = {};
  for (const [id, q] of Object.entries(deck.cards)) {
    copies[baseCardId(id)] = (copies[baseCardId(id)] ?? 0) + q;
    if (!usePlayer.getState().devInfinite && (col?.[id] ?? 0) < q) errs.push(`Pas assez de ${cardById(id)?.name ?? id}`);
    const c = cardById(id);
    if (c?.type === "Leader") errs.push("Le Leader ne va pas dans les 50 cartes.");
    if (leader && c && !colorsOk(leader, c)) errs.push(`Couleur illégale : ${c.name}`);
  }
  for (const [bid, q] of Object.entries(copies)) {
    if (q > 4) {
      const sample = Object.keys(deck.cards).find((id) => baseCardId(id) === bid);
      errs.push(`Max 4 copies : ${cardById(sample ?? bid)?.name ?? bid}`);
    }
  }
  return errs;
}

export function newEmptyDeck(): DeckList {
  return { id: uid("deck"), name: "Nouveau deck", leaderId: "", cards: {}, cosmetics: { ...DEFAULT_EQUIP } };
}
