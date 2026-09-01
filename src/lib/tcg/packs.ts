import { fisherYates } from "@/lib/utils";
import { cardById } from "./catalog";
import type { Catalog, DeckList, TcgCard } from "./types";

/** Official-ish per-pack hit rates (24-pack JP box). */
const HIT_RATES: Array<[string, number]> = [
  ["R", 33.0],
  ["SR", 33.3],
  ["L", 20.0],
  ["ALT", 8.3],
  ["SEC", 4.2],
  ["SP", 0.8],
  ["TR", 0.4],
];

const CHASE_RATES: Array<[string, number]> = [
  ["SR", 68],
  ["SEC", 16],
  ["ALT", 11],
  ["SP", 3],
  ["TR", 2],
];

const PRB_RATES: Array<[string, number]> = [
  ["ALT", 62],
  ["SR", 14],
  ["R", 10],
  ["SEC", 8],
  ["SP", 4],
  ["L", 2],
];

export const PITY_LIMIT = 10;

function isBoxTopper(c: TcgCard) {
  return /box topper/i.test(c.name);
}

export function isChaseCard(c: TcgCard) {
  if (c.rarity === "SR" || c.rarity === "SEC" || c.rarity === "SP" || c.rarity === "TR") return true;
  if (c.parallel && (c.rarity === "L" || c.rarity === "R")) return true;
  return false;
}

const PACK_BUNDLE: Record<string, string[]> = {
  "OP15-EB04": ["OP-15", "EB-04"],
};

export function packSets(setId: string): string[] {
  return PACK_BUNDLE[setId] ?? [setId];
}

function inSet(c: TcgCard, setId: string) {
  if (c.type === "DON!!") return false;
  return packSets(setId).includes(c.set);
}

function pool(catalog: Catalog, setId: string, kind: string): TcgCard[] {
  const cards = catalog.cards.filter((c) => inSet(c, setId));
  switch (kind) {
    case "C":
      return cards.filter((c) => c.rarity === "C" && !c.parallel);
    case "UC":
      return cards.filter((c) => c.rarity === "UC" && !c.parallel);
    case "R":
      return cards.filter((c) => c.rarity === "R" && !c.parallel);
    case "SR":
      return cards.filter((c) => c.rarity === "SR" && !c.parallel);
    case "SEC":
      return cards.filter((c) => c.rarity === "SEC" && !c.parallel);
    case "L":
      return cards.filter((c) => c.rarity === "L" && !c.parallel);
    case "SP":
      return cards.filter((c) => c.rarity === "SP");
    case "TR":
      return cards.filter((c) => c.rarity === "TR");
    case "PR":
      return cards.filter((c) => c.rarity === "PR" || c.rarity === "P");
    case "ALT":
      return cards.filter(
        (c) =>
          c.parallel &&
          c.rarity !== "SP" &&
          c.rarity !== "TR" &&
          !isBoxTopper(c) &&
          (c.rarity === "R" || c.rarity === "SR" || c.rarity === "SEC" || c.rarity === "L"),
      );
    default:
      return [];
  }
}

function pick(cards: TcgCard[], rand: () => number, used: Set<string>): TcgCard | null {
  const fresh = cards.filter((c) => !used.has(c.id));
  const src = fresh.length ? fresh : cards;
  if (!src.length) return null;
  return src[Math.floor(rand() * src.length)]!;
}

function tableFor(setId: string, chase: boolean): Array<[string, number]> {
  if (chase) return CHASE_RATES;
  if (setId.startsWith("PRB")) return PRB_RATES;
  if (setId === "P") return [["PR", 100]];
  return HIT_RATES;
}

function rollHit(
  catalog: Catalog,
  setId: string,
  rand: () => number,
  used: Set<string>,
  chase: boolean,
): TcgCard | null {
  const table = tableFor(setId, chase).filter(([k]) => pool(catalog, setId, k).length > 0);
  if (!table.length) {
    return (
      pick(pool(catalog, setId, "SR"), rand, used) ||
      pick(pool(catalog, setId, "R"), rand, used) ||
      pick(
        catalog.cards.filter((c) => inSet(c, setId) && !isBoxTopper(c)),
        rand,
        used,
      )
    );
  }
  const total = table.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * total;
  for (const [k, w] of table) {
    roll -= w;
    if (roll <= 0) return pick(pool(catalog, setId, k), rand, used);
  }
  return pick(pool(catalog, setId, table[0]![0]), rand, used);
}

export function openBooster(
  catalog: Catalog,
  setId: string,
  rand: () => number = Math.random,
  opts: { forceChase?: boolean } = {},
): TcgCard[] {
  const booster = catalog.boosters.find((b) => b.id === setId);
  const slots = booster?.slots ?? { C: 6, UC: 3, R: 2, HIT: 1 };
  const pulled: TcgCard[] = [];
  const used = new Set<string>();

  const take = (kind: string, n: number) => {
    const source = pool(catalog, setId, kind);
    for (let i = 0; i < n; i++) {
      const card = pick(source, rand, used);
      if (!card) continue;
      pulled.push(card);
      used.add(card.id);
    }
  };

  take("C", slots.C ?? 0);
  take("UC", slots.UC ?? 0);
  take("R", slots.R ?? 0);
  take("PR", slots.PR ?? 0);

  const hits = slots.HIT ?? 0;
  for (let i = 0; i < hits; i++) {
    const hit = rollHit(catalog, setId, rand, used, Boolean(opts.forceChase) && i === 0);
    if (hit) {
      pulled.push(hit);
      used.add(hit.id);
    }
  }

  if (pulled.length === 0) {
    const fallback = catalog.cards.filter((c) => inSet(c, setId) && !c.parallel);
    return fisherYates(fallback, rand).slice(0, booster?.size ?? 12);
  }
  return pulled;
}

export function openBoosters(
  catalog: Catalog,
  setId: string,
  qty: number,
  pityStart = 0,
): { cards: TcgCard[]; pity: number } {
  const cards: TcgCard[] = [];
  let pity = Math.max(0, pityStart);
  for (let i = 0; i < qty; i++) {
    const force = pity >= PITY_LIMIT;
    const pack = openBooster(catalog, setId, Math.random, { forceChase: force });
    cards.push(...pack);
    pity = pack.some(isChaseCard) ? 0 : Math.min(PITY_LIMIT, pity + 1);
  }
  return { cards, pity };
}

export function starterMembers(catalog: Catalog, starterId: string): TcgCard[] {
  const prefix = `${starterId.replace(/-/g, "")}-`;
  return catalog.cards.filter(
    (c) => c.id.startsWith(prefix) && !c.parallel && c.type !== "DON!!",
  );
}

export function buildStarterList(catalog: Catalog, starterId: string): DeckList | null {
  const meta = catalog.starters.find((s) => s.id === starterId);
  const members = starterMembers(catalog, starterId);
  const leader = members.find((c) => c.type === "Leader") ?? (meta?.leaderId ? cardById(meta.leaderId) : undefined);
  if (!leader) return null;
  const rest = members.filter((c) => c.type !== "Leader" && c.id !== leader.id);
  const counts: Record<string, number> = {};
  for (const c of rest) {
    counts[c.id] = c.rarity === "SR" || c.rarity === "SEC" ? 2 : 4;
  }
  const total = () => Object.values(counts).reduce((a, b) => a + b, 0);

  const byCost = [...rest].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
  while (total() > 50) {
    let trimmed = false;
    for (const c of byCost) {
      const n = counts[c.id] ?? 0;
      if (n > 2) {
        counts[c.id] = n - 1;
        trimmed = true;
        if (total() <= 50) break;
      }
    }
    if (!trimmed) {
      for (const c of byCost) {
        const n = counts[c.id] ?? 0;
        if (n > 1) {
          counts[c.id] = n - 1;
          if (total() <= 50) break;
        }
      }
      break;
    }
  }
  const cheap = [...rest].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  let guard = 0;
  while (total() < 50 && cheap.length && guard++ < 80) {
    for (const c of cheap) {
      const n = counts[c.id] ?? 0;
      if (n < 4) {
        counts[c.id] = n + 1;
        if (total() >= 50) break;
      }
    }
  }

  return {
    id: `deck_${starterId}`,
    name: meta?.name.replace(/^Starter Deck(?: \d+)?: /, "") ?? starterId,
    leaderId: leader.id,
    cards: counts,
  };
}

export function grantCounts(list: DeckList): Record<string, number> {
  const out: Record<string, number> = { [list.leaderId]: 1 };
  for (const [id, n] of Object.entries(list.cards)) {
    out[id] = (out[id] ?? 0) + n;
  }
  return out;
}
