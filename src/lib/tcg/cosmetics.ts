export type CosmeticKind = "back" | "don" | "mat";

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  src: string;
  price: number;
  wins?: number;
};

export const COSMETICS: Cosmetic[] = [
  { id: "back-official", kind: "back", name: "Officiel", blurb: "Dos officiel One Piece Card Game.", src: "/card-back.png?v=official", price: 0 },
  { id: "back-anniv3", kind: "back", name: "3e anniversaire", blurb: "Chinese 3rd Anniversary — Jewelry Bonney.", src: "/cosmetics/backs/anniv3.jpg", price: 550 },
  { id: "back-grandline", kind: "back", name: "Grand Line", blurb: "Boussole d’or sur marine profonde.", src: "/cosmetics/backs/grandline.jpg", price: 0 },
  { id: "back-strawhat", kind: "back", name: "Chapeau de paille", blurb: "Écarlate, emblème du chapeau.", src: "/cosmetics/backs/strawhat.jpg", price: 350 },
  { id: "back-marine", kind: "back", name: "Marine", blurb: "Justice. Mouette et ancres.", src: "/cosmetics/backs/marine.jpg", price: 350 },
  { id: "back-wano", kind: "back", name: "Pays de Wa", blurb: "Vagues vermillon, or laqué.", src: "/cosmetics/backs/wano.jpg", price: 500 },
  { id: "back-yonko", kind: "back", name: "Empereur", blurb: "Couronne d’or sur nocturne.", src: "/cosmetics/backs/yonko.jpg", price: 700 },
  { id: "back-night", kind: "back", name: "Ciel nocturne", blurb: "Constellations d’or. 8 victoires.", src: "/cosmetics/backs/night.jpg", price: 0, wins: 8 },

  { id: "don-official", kind: "don", name: "Manga", blurb: "Carte DON!! officielle.", src: "/don/front.jpg", price: 0 },
  { id: "don-anniv3", kind: "don", name: "3e anniversaire", blurb: "Chinese 3rd Anniversary — cerisiers.", src: "/cosmetics/don/anniv3.jpg", price: 550 },
  { id: "don-classic", kind: "don", name: "Classique", blurb: "Lettrage blanc, fond sombre.", src: "/don/standard.jpg", price: 200 },
  { id: "don-gold", kind: "don", name: "Or", blurb: "Lettrage métallique premium.", src: "/don/official.jpg", price: 250 },
  { id: "don-wano", kind: "don", name: "Pays de Wa", blurb: "Laqué rouge et or.", src: "/don/wano.jpg", price: 400 },
  { id: "don-egghead", kind: "don", name: "Egghead", blurb: "Futuriste, lueur froide.", src: "/don/egghead.jpg", price: 400 },
  { id: "don-foil", kind: "don", name: "Relief", blurb: "Foil 3D holographique.", src: "/don/3d.jpg", price: 450 },
  { id: "don-manga", kind: "don", name: "Planche", blurb: "Trait manga. 5 victoires.", src: "/don/manga.jpg", price: 0, wins: 5 },

  { id: "mat-felt", kind: "mat", name: "Feutrine", blurb: "Tapis vert, boussole d’or.", src: "/cosmetics/mats/felt.jpg", price: 0 },
  { id: "mat-anniv3", kind: "mat", name: "3e anniversaire", blurb: "Chinese 3rd Anniversary — cerisiers.", src: "/cosmetics/mats/anniv3.jpg?v=ai", price: 650 },
  { id: "mat-sunny", kind: "mat", name: "Pont du navire", blurb: "Teck usé, clous de laiton.", src: "/cosmetics/mats/sunny.jpg", price: 400 },
  { id: "mat-marine", kind: "mat", name: "Quartier général", blurb: "Marbre blanc, sceau marine.", src: "/cosmetics/mats/marine.jpg", price: 400 },
  { id: "mat-ocean", kind: "mat", name: "Grand Line", blurb: "Océan vu du ciel.", src: "/cosmetics/mats/ocean.jpg", price: 500 },
  { id: "mat-wano", kind: "mat", name: "Sanctuaire", blurb: "Laque rouge, vagues d’or.", src: "/cosmetics/mats/wano.jpg", price: 550 },
  { id: "mat-night", kind: "mat", name: "Voûte céleste", blurb: "Velours et constellations. 10 victoires.", src: "/cosmetics/mats/night.jpg", price: 0, wins: 10 },
];

export const DEFAULT_EQUIP = {
  back: "back-official",
  don: "don-official",
  mat: "mat-felt",
} as const;

export function cosmeticsOf(kind: CosmeticKind) {
  return COSMETICS.filter((c) => c.kind === kind);
}

export function cosmeticById(id: string | undefined) {
  return COSMETICS.find((c) => c.id === id);
}

export function freeCosmeticIds() {
  return COSMETICS.filter((c) => c.price === 0 && !c.wins).map((c) => c.id);
}

export function cosmeticUrls() {
  return [...new Set(COSMETICS.map((c) => c.src))];
}
