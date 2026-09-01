export type CardType = "Leader" | "Character" | "Event" | "Stage" | "DON!!";
export type Rarity = "C" | "UC" | "R" | "SR" | "SEC" | "L" | "TR" | "PR" | "P" | "SP" | string;
export type ColorName = "Red" | "Green" | "Blue" | "Purple" | "Black" | "Yellow";

export interface TcgCard {
  id: string;
  name: string;
  set: string;
  setName: string;
  rarity: Rarity;
  colors: ColorName[];
  type: CardType;
  life: number | null;
  cost: number | null;
  power: number | null;
  counter: number | null;
  traits: string[];
  attr: string | null;
  text: string;
  textEn?: string;
  image: string;
  parallel: boolean;
  src: string;
}

export interface BoosterSet {
  id: string;
  name: string;
  kind: "booster";
  size: number;
  slots: Record<string, number>;
  price: number;
  counts: Record<string, number>;
  cardCount: number;
  art: string;
}

export interface StarterSet {
  id: string;
  name: string;
  kind: "starter";
  price: number;
  cardCount: number;
  art: string;
  leaderId: string | null;
}

export interface Catalog {
  version: number;
  cards: TcgCard[];
  boosters: BoosterSet[];
  starters: StarterSet[];
  don: TcgCard | null;
}

export interface DeckList {
  id: string;
  name: string;
  leaderId: string;
  cards: Record<string, number>;
  locked?: boolean;
  starterId?: string;
  cosmetics?: { back: string; don: string; mat: string };
  favorite?: boolean;
}
