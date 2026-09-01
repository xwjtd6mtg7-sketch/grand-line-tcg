import { isAltCard, isMangaCard, isPromoCard, matchesColors, sortByColor } from "./catalog";
import type { ColorName, TcgCard } from "./types";

export type CardFilter = {
  q: string;
  colors: ColorName[];
  kind: "all" | TcgCard["type"];
  rarity: string;
  setId: string;
};

export const EMPTY_FILTER: CardFilter = {
  q: "",
  colors: [],
  kind: "all",
  rarity: "",
  setId: "owned",
};

export function applyCardFilter(
  cards: TcgCard[],
  collection: Record<string, number>,
  f: CardFilter,
  opts?: { ownedOnly?: boolean },
): TcgCard[] {
  const ql = f.q.trim().toLowerCase();
  const filtered = cards.filter((c) => {
    if (c.type === "DON!!") return false;
    const have = collection[c.id] ?? 0;
    if (opts?.ownedOnly && have <= 0) return false;
    if (f.setId === "owned" && have <= 0) return false;
    if (f.setId === "alt") {
      if (!isAltCard(c)) return false;
    } else if (f.setId === "manga") {
      if (!isMangaCard(c)) return false;
    } else if (f.setId === "promo") {
      if (!isPromoCard(c)) return false;
    } else if (f.setId && f.setId !== "owned" && f.setId !== "all" && c.set !== f.setId) {
      return false;
    }
    if (f.kind !== "all" && c.type !== f.kind) return false;
    if (f.rarity && c.rarity !== f.rarity) return false;
    if (!matchesColors(c, f.colors)) return false;
    if (!ql) return true;
    const hay = [c.name, c.id, c.text, c.textEn ?? "", c.set, c.setName, c.traits.join(" "), c.attr ?? ""].join(" ").toLowerCase();
    return hay.includes(ql);
  });
  return sortByColor(filtered);
}
