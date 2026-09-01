import type { Catalog, ColorName, TcgCard } from "./types";
import meta from "./meta.json";
import { CATALOG_VER, idbGet, idbSet } from "@/lib/cache";
import { listCardOverrides, type CardOverrideRow } from "@/lib/admin/cards";

let cached: Catalog | null = null;
let cachedVer = "";
let index: Map<string, TcgCard> | null = null;
let inflight: Promise<Catalog> | null = null;

function applyArt(data: Catalog): Catalog {
  for (const b of data.boosters) b.art = `/boosters/${b.id}.webp`;
  for (const s of data.starters) s.art = `/boosters/${s.id}.webp`;
  return data;
}

function stubCatalog(cards: TcgCard[] = []): Catalog {
  const src = meta as unknown as Omit<Catalog, "version" | "cards">;
  return applyArt({
    version: 1,
    cards,
    boosters: src.boosters.map((b) => ({ ...b })),
    starters: src.starters.map((s) => ({ ...s })),
    don: src.don,
  });
}

cached = stubCatalog();

function commit(data: Catalog): Catalog {
  const next = applyArt(data);
  cached = next;
  cachedVer = CATALOG_VER;
  index = new Map(next.cards.map((c) => [c.id, c]));
  return next;
}

/** Load a catalog in-memory (tests / node). Does not fetch. */
export function hydrateCatalog(data: Catalog): Catalog {
  return commit(data);
}

/** Cards an admin added, edited or removed — layered over the static catalog. */
async function fetchOverrides(): Promise<CardOverrideRow[]> {
  try {
    return await listCardOverrides();
  } catch {
    return [];
  }
}

/** Apply admin overrides (add/edit/remove by id) on top of the static catalog. */
function applyOverrides(data: Catalog, overrides: CardOverrideRow[]): Catalog {
  if (!overrides.length) return data;
  const byId = new Map(data.cards.map((c) => [c.id, c] as const));
  for (const o of overrides) {
    if (o.action === "delete") byId.delete(o.id);
    else byId.set(o.id, o.card);
  }
  return { ...data, cards: Array.from(byId.values()) };
}

function fetchCatalog(): Promise<Catalog> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? window.setTimeout(() => ctrl.abort(), 25000) : 0;
  return fetch(`/data/catalog.json?v=${CATALOG_VER}`, ctrl ? { signal: ctrl.signal } : undefined).then(async (r) => {
    if (t) window.clearTimeout(t);
    if (!r.ok) throw new Error("Catalogue introuvable");
    const [base, overrides] = await Promise.all([r.json() as Promise<Catalog>, fetchOverrides()]);
    const data = commit(applyOverrides(base, overrides));
    void idbSet(`catalog:${CATALOG_VER}`, data);
    return data;
  });
}

if (typeof window !== "undefined") {
  inflight = (async () => {
    const local = await idbGet<Catalog>(`catalog:${CATALOG_VER}`);
    if (local?.cards?.length) {
      commit(local);
      fetchCatalog().catch(() => undefined);
      return local;
    }
    return fetchCatalog();
  })().finally(() => {
    inflight = null;
  });
}

export async function loadMeta(): Promise<Catalog> {
  return cached ?? stubCatalog();
}

export async function loadCatalog(): Promise<Catalog> {
  if (cached?.cards.length && cachedVer === CATALOG_VER) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const local = await idbGet<Catalog>(`catalog:${CATALOG_VER}`);
    if (local?.cards?.length) {
      commit(local);
      fetchCatalog().catch(() => undefined);
      return local;
    }
    return fetchCatalog();
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function getCatalogSync(): Catalog | null {
  return cached;
}

export function cardById(id: string): TcgCard | undefined {
  if (!index && cached) index = new Map(cached.cards.map((c) => [c.id, c]));
  return index?.get(id);
}

export function mustCard(id: string): TcgCard {
  const c = cardById(id);
  if (!c) throw new Error(`Carte inconnue: ${id}`);
  return c;
}

export function deckSize(cards: Record<string, number>): number {
  return Object.values(cards).reduce((a, n) => a + n, 0);
}

export function colorsOk(leader: TcgCard, card: TcgCard): boolean {
  if (!leader.colors.length || !card.colors.length) return true;
  return card.colors.every((c) => leader.colors.includes(c));
}

export function baseCardId(id: string): string {
  return id.replace(/_(?:p|pr|r)\d+$/i, "");
}

export function isMangaCard(card: TcgCard): boolean {
  return card.rarity === "SP";
}

export function isAltCard(card: TcgCard): boolean {
  return Boolean(card.parallel) && card.rarity !== "SP";
}

export function isPromoCard(card: TcgCard): boolean {
  return card.src === "promo" || card.set === "P" || card.id.startsWith("P-");
}

export const COLOR_ORDER: ColorName[] = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"];

export const COLOR_FR: Record<ColorName, string> = {
  Red: "Rouge",
  Green: "Vert",
  Blue: "Bleu",
  Purple: "Violet",
  Black: "Noir",
  Yellow: "Jaune",
};

export function matchesColors(card: TcgCard, colors: ColorName[]): boolean {
  if (!colors.length) return true;
  if (colors.length === 1) return card.colors.includes(colors[0]!);
  if (card.colors.length !== colors.length) return false;
  return colors.every((c) => card.colors.includes(c));
}

export function sortByColor<T extends { colors: ColorName[]; type: string; id: string }>(cards: T[]): T[] {
  return cards.slice().sort((a, b) => {
    const ai = COLOR_ORDER.indexOf(a.colors[0] as ColorName);
    const bi = COLOR_ORDER.indexOf(b.colors[0] as ColorName);
    const ac = ai < 0 ? 9 : ai;
    const bc = bi < 0 ? 9 : bi;
    if (ac !== bc) return ac - bc;
    if (a.type === "Leader" && b.type !== "Leader") return -1;
    if (b.type === "Leader" && a.type !== "Leader") return 1;
    return a.id.localeCompare(b.id);
  });
}

export const COLOR_HEX: Record<ColorName, string> = {
  Red: "#c4453c",
  Green: "#2f8f5b",
  Blue: "#3b6ea8",
  Purple: "#7a5ea8",
  Black: "#3a3d46",
  Yellow: "#c9a227",
};

export const RARITY_FR: Record<string, string> = {
  C: "Commune",
  UC: "Peu commune",
  R: "Rare",
  SR: "Super rare",
  SEC: "Secret rare",
  L: "Leader",
  TR: "Treasure",
  PR: "Promo",
  SP: "Manga rare",
};

export const TYPE_FR: Record<string, string> = {
  Leader: "Leader",
  Character: "Personnage",
  Event: "Événement",
  Stage: "Terrain",
  "DON!!": "DON!!",
};

export const ATTR_FR: Record<string, string> = {
  Strike: "Frappe",
  Slash: "Tranchant",
  Special: "Spécial",
  Wisdom: "Sagesse",
  Ranged: "Tir",
  Frappe: "Frappe",
  Tranchant: "Tranchant",
  Spécial: "Spécial",
  Sagesse: "Sagesse",
  Tir: "Tir",
  Tranche: "Tranchant",
};
