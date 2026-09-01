import { usePlayer } from "@/lib/store";
import { cosmeticById, DEFAULT_EQUIP, type CosmeticKind } from "./cosmetics";

export const DON_SRC = "/don/front.jpg";
export const DON_BACK_SRC = "/don/front.jpg";
export const CARD_BACK_SRC = "/card-back.png?v=official";
export const LOGO_SRC = "/logo-gltcg.png?v=3";
export const LOGO_DARK_SRC = "/logo-gltcg.png?v=3";

export function packSrc(setId: string): string {
  return `/boosters/${setId}.webp?v=st30`;
}

export function useCosmeticSrc(kind: CosmeticKind): string {
  const id = usePlayer((s) => {
    const deck = s.decks.find((d) => d.id === s.activeDeckId);
    return deck?.cosmetics?.[kind] || s.equip?.[kind];
  });
  return cosmeticById(id)?.src ?? cosmeticById(DEFAULT_EQUIP[kind])?.src ?? "";
}
