import type { TcgCard } from "./types";

export type PrintedKeyword = "rush" | "blocker" | "doubleAttack" | "banish";

type EffectBase = { donReq?: number };

export type Effect = EffectBase & (
  | { type: "draw"; n: number; ifLeaderTrait?: string }
  | { type: "search"; n: number; trait?: string }
  | {
      type: "ko";
      n: number;
      maxCost: number | null;
      maxPower: number | null;
      activeOnly?: boolean;
      restedOnly?: boolean;
      keyword?: PrintedKeyword;
    }
  | { type: "rest"; n: number; maxCost: number | null }
  | { type: "bounce"; n: number; maxCost: number | null; whose: "opp" | "yours" }
  | {
      type: "power";
      amount: number;
      duration: "turn" | "battle";
      who: "self" | "yourChars" | "leaderOrChar" | "oppChar";
      trait?: string;
      excludeSelf?: boolean;
    }
  | { type: "don"; n: number; rested?: boolean }
  | { type: "readyDon"; n: number }
  | { type: "cost"; amount: number; whose: "opp" }
  | {
      type: "noBlocker";
      duration?: "turn" | "battle";
      powerMin?: number;
      powerMax?: number;
      who?: "self" | "leaderOrChar";
      trait?: string;
    }
  | { type: "playThis" }
  | { type: "giveRestedDon"; n: number; who: "self" | "leader" | "char" | "leaderOrChar"; trait?: string }
  | { type: "awaken" }
  | { type: "millLife"; n: number; whose: "opp" }
);

export interface Aura {
  don: number;
  yourTurn: boolean;
  oppTurn: boolean;
  who: "self" | "yourChars" | "allYours";
  power: number;
  keyword?: PrintedKeyword;
}

export interface Abilities {
  blocker: boolean;
  rush: boolean;
  rushCharacter: boolean;
  banish: boolean;
  doubleAttack: boolean;
  unblockable: boolean;
  oncePerTurn: boolean;
  triggerKeep: boolean;
  triggerPlayThis: boolean;
  triggerActivateMain: boolean;
  activateRest: boolean;
  activateRestCost: number;
  activateTrashHand: number;
  playDonMinus: number;
  counterPlus: number;
  isCounterEvent: boolean;
  isMainEvent: boolean;
  activateCost: number;
  onPlay: Effect[];
  mainEffects: Effect[];
  whenAttacking: Effect[];
  activateMain: Effect[];
  trigger: Effect[];
  onKo: Effect[];
  counterEffects: Effect[];
  auras: Aura[];
}

const cache = new Map<string, Abilities>();

export function clearParseCache() {
  cache.clear();
}

const KW_ALIAS: Record<string, string[]> = {
  Blocker: ["Blocker", "Bloqueur"],
  Rush: ["Rush", "Initiative"],
  Banish: ["Banish", "Exclusion"],
  "Double Attack": ["Double Attack", "Double attaque", "Double Attaque"],
  Unblockable: ["Unblockable", "Imblocable"],
};

const TAG_TO_KEYWORD: Record<string, PrintedKeyword> = {
  blocker: "blocker",
  bloqueur: "blocker",
  rush: "rush",
  initiative: "rush",
  banish: "banish",
  exclusion: "banish",
  "double attack": "doubleAttack",
  "double attaque": "doubleAttack",
};

export function keywordFromTag(tag: string): PrintedKeyword | undefined {
  return TAG_TO_KEYWORD[tag.trim().toLowerCase()];
}

/** Official effect text: prefer EN, ignore catalog placeholders. */
export function cardEffectText(card: TcgCard): string {
  const clean = (s?: string) => {
    const t = (s || "").trim();
    if (!t || t === "NULL" || t === "-" || t === "—") return "";
    return t;
  };
  return clean(card.textEn) || clean(card.text) || "";
}

/** Mention of another card's keyword vs this card's own printed/granted keyword. */
export function keywordRole(text: string, index: number): "own" | "mention" | "self-gain" | "other-gain" {
  const before = text.slice(0, index);
  const after = text.slice(index);
  const afterTag = after.replace(/^\[[^\]]+\]/, "");
  if (/^\s*(Characters?|Personnages?|Leaders?)\b/i.test(afterTag)) return "mention";
  if (
    /(?:cannot\s+activate|n(?:e|')?\s*peut pas activer)\s+(?:a\s+|the\s+|un\s+|le\s+|up to \s*\d+\s+|jusqu['’]à\s+\d+\s+)?$/i.test(
      before,
    )
  ) {
    return "mention";
  }
  if (/\bactivates?\s+(?:a\s+|the\s+|un\s+|le\s+)?$/i.test(before)) return "mention";
  if (/\ba\s+$/i.test(before) && /^\[[^\]]+\]\s*(Character|Personnage)/i.test(after)) return "mention";
  if (/gains?\s+$/i.test(before) || /gagnent?\s+$/i.test(before)) {
    const selfEn = /\bthis (?:Character|card|Leader) gains?\s+$/i.test(before);
    const selfFr = /\bce(?:tte)? (?:Personnage|Leader|carte) gagnent?\s+$/i.test(before);
    const except = /\b(?:other than|except|autre que)\s+this (?:Character|card|Leader) gains?\s+$/i.test(before);
    if ((selfEn || selfFr) && !except) return "self-gain";
    return "other-gain";
  }
  return "own";
}

export function hasOwnKeyword(text: string, kw: string): boolean {
  const names = KW_ALIAS[kw] ?? [kw];
  for (const name of names) {
    const re = new RegExp(`\\[${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "ig");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const role = keywordRole(text, m.index);
      if (role === "own") return true;
    }
  }
  return false;
}

export function parseCard(card: TcgCard): Abilities {
  const hit = cache.get(card.id);
  if (hit) return hit;
  try {
    const a = parseText(card);
    cache.set(card.id, a);
    return a;
  } catch {
    const empty = parseText({ ...card, text: "", textEn: "" } as TcgCard);
    cache.set(card.id, empty);
    return empty;
  }
}

function parseText(card: TcgCard): Abilities {
  const t = cardEffectText(card);
  const blocker = hasOwnKeyword(t, "Blocker");
  const rushCharacter = /\[Rush:\s*Character\]/i.test(t);
  const rush = hasOwnKeyword(t, "Rush") && !rushCharacter;
  const banish = hasOwnKeyword(t, "Banish");
  const doubleAttack = hasOwnKeyword(t, "Double Attack");
  const unblockable = hasOwnKeyword(t, "Unblockable");
  const oncePerTurn = /\[Once Per Turn\]/i.test(t);
  const isCounterEvent = card.type === "Event" && /\[(?:Counter|Contre)\]/i.test(t);
  const isMainEvent = card.type === "Event" && /\[(?:Main|Principal|Principale)\]/i.test(t);
  let counterPlus = card.counter && card.counter > 0 ? card.counter : 0;
  const cm = t.match(/\[Counter\s*\+(\d+)\]/i);
  if (cm) counterPlus = Math.max(counterPlus, Number(cm[1]));

  const actCost = t.match(/\[Activate:\s*Main\][^\n[]{0,90}DON!!\s*-(\d+)/i);
  const activateCost = actCost ? Number(actCost[1]) : 0;
  const mainText = section(t, "Main");
  const triggerText = section(t, "Trigger");
  const activateText = section(t, "Activate: Main");
  const counterText = section(t, "Counter");
  const playDonMinus = Number((mainText.match(/DON!!\s*-(\d+)/i) || counterText.match(/DON!!\s*-(\d+)/i) || [])[1] || 0);

  return {
    blocker,
    rush,
    rushCharacter,
    banish,
    doubleAttack,
    unblockable,
    oncePerTurn,
    triggerKeep: /add (?:this card|it) to (?:your|the) hand/i.test(triggerText),
    triggerPlayThis: /Play this card/i.test(triggerText),
    triggerActivateMain: /Activate this card's \[Main\]/i.test(triggerText),
    activateRest: /rest this (?:Stage|card|Character)/i.test(activateText),
    activateRestCost: Number((activateText.match(/\((\d+)\)\s*\(You may rest the specified number of DON!! cards/i) || [])[1] || 0),
    activateTrashHand: Number((activateText.match(/You may trash (\d+) cards? from your hand/i) || [])[1] || 0),
    playDonMinus,
    counterPlus,
    isCounterEvent,
    isMainEvent,
    activateCost,
    onPlay: parseSection(t, "On Play"),
    mainEffects: parseSection(t, "Main"),
    whenAttacking: parseSection(t, "When Attacking"),
    activateMain: parseSection(t, "Activate: Main"),
    trigger: parseSection(t, "Trigger"),
    onKo: parseSection(t, "On K.O."),
    counterEffects: parseSection(t, "Counter"),
    auras: parseAuras(t),
  };
}

function section(text: string, name: string): string {
  return sectionChunks(text, name)
    .map((c) => c.body)
    .join(" ");
}

function parseSection(text: string, name: string): Effect[] {
  return sectionChunks(text, name).flatMap(({ body, donReq }) =>
    parseEffects(body).map((e) => (donReq != null ? { ...e, donReq } : e)),
  );
}

function sectionPattern(name: string): string {
  const aliases: Record<string, string> = {
    Counter: "Counter|Contre",
    Main: "Principale|Principal|Main",
    Trigger: "Trigger|D[ée]clenchement",
    "On Play": "On Play|Jou[ée]e",
    "When Attacking": "When Attacking|En attaquant",
    "Activate: Main": "Activate:\\s*Main|Activation\\s*:\\s*Principale?",
  };
  return aliases[name] ?? name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*");
}

function sectionChunks(text: string, name: string): { body: string; donReq?: number }[] {
  const pat = sectionPattern(name);
  const open = new RegExp(`\\[${pat}\\]`, "ig");
  const parts: { body: string; donReq?: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = open.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
    const next = rest.match(
      /\[(?:On Play|Jou[ée]e|When Attacking|En attaquant|On K\.O\.|Activate:\s*Main|Activation\s*:\s*Principale?|Principale|Principal|Main|Counter|Contre|Trigger|D[ée]clenchement)\]/i,
    );
    let end = rest.length;
    if (next && next.index != null) {
      const beforeNext = rest.slice(Math.max(0, next.index - 14), next.index);
      if (!/card'?s\s*$/i.test(beforeNext)) end = next.index;
    }
    const body = rest.slice(0, end);
    const before = text.slice(0, m.index);
    const fromBefore = before.match(/\[DON!!\s*x(\d+)\]\s*(?:\[[^\]]*\]\s*)*$/i);
    const fromBody = body.match(/^\s*\[DON!!\s*x(\d+)\]/i);
    const donReq = fromBefore ? Number(fromBefore[1]) : fromBody ? Number(fromBody[1]) : undefined;
    parts.push({ body, donReq });
  }
  return parts;
}

function parseEffects(chunk: string): Effect[] {
  if (!chunk.trim()) return [];
  const out: Effect[] = [];

  const draw = chunk.match(/Draw (\d+) cards?/i);
  if (draw) {
    const lead = chunk.match(/If your Leader has the ["“'{]?([^"”'}]+)["”'}]? type/i);
    out.push({ type: "draw", n: Number(draw[1]), ifLeaderTrait: lead?.[1]?.trim() });
  }

  const search = chunk.match(
    /Look at (\d+) cards? from the top of your deck;\s*reveal up to 1 ([^.]+?)(?: type)? card and add it to your hand/i,
  );
  if (search) {
    const raw = search[2]!.replace(/type$/i, "").trim();
    const trait = raw.match(/\{([^}]+)\}/)?.[1] || raw.replace(/^\[/, "").replace(/\]$/, "").replace(/^["“']|["”']$/g, "");
    out.push({ type: "search", n: Number(search[1]), trait: trait || undefined });
  }

  const ko = chunk.match(
    /K\.?O\.? up to (\d+) of your opponent's (active |rested )?(?:\[([^\]]+)\]\s+)?Characters?(?: with (?:a cost of (\d+) or less|(\d+)(?: base)? power or less))?/i,
  );
  if (ko) {
    out.push({
      type: "ko",
      n: Number(ko[1]),
      maxCost: ko[4] ? Number(ko[4]) : null,
      maxPower: ko[5] ? Number(ko[5]) : null,
      activeOnly: /active/i.test(ko[2] || ""),
      restedOnly: /rested/i.test(ko[2] || ""),
      keyword: ko[3] ? keywordFromTag(ko[3]) : undefined,
    });
  }

  const rest = chunk.match(
    /Rest up to (\d+) of your opponent's Characters?(?: with a cost of (\d+) or less)?/i,
  );
  if (rest) out.push({ type: "rest", n: Number(rest[1]), maxCost: rest[2] ? Number(rest[2]) : null });

  const bounce = chunk.match(
    /Return up to (\d+) (?:of your opponent's )?(?:of your )?Characters?(?: with a cost of (\d+) or less)? to (?:its|their|the) owner's hand/i,
  );
  if (bounce) {
    const yours = /of your Characters/i.test(chunk) && !/opponent's/i.test(chunk);
    out.push({
      type: "bounce",
      n: Number(bounce[1]),
      maxCost: bounce[2] ? Number(bounce[2]) : null,
      whose: yours ? "yours" : "opp",
    });
  }

  const donAdd = chunk.match(/Add up to (\d+) DON!! card/i) || chunk.match(/Add (?:up to )?(\d+) DON/i);
  if (donAdd) out.push({ type: "don", n: Number(donAdd[1]), rested: /and rest/i.test(chunk) });

  const ready = chunk.match(/set up to (\d+) of your DON!! cards as active/i);
  if (ready) out.push({ type: "readyDon", n: Number(ready[1]) });

  const powMinus = chunk.match(
    /Give up to 1 of your opponent's (?:Leader or )?Characters? -(\d+) power/i,
  );
  if (powMinus) out.push({ type: "power", amount: -Number(powMinus[1]), duration: "turn", who: "oppChar" });

  const costMinus = chunk.match(
    /Give up to 1 of your opponent's Characters? -(\d+) cost/i,
  );
  if (costMinus) out.push({ type: "cost", amount: -Number(costMinus[1]), whose: "opp" });

  const pow = chunk.match(/gains? \+(\d+) power/i) || chunk.match(/gagne \+(\d+) de puissance/i);
  if (pow) {
    const duration: "turn" | "battle" = /this battle|ce combat|pour tout le combat/i.test(chunk) ? "battle" : "turn";
    let who: "self" | "yourChars" | "leaderOrChar" = "self";
    if (/all of your characters|tous (?:tes|vos) personnages/i.test(chunk)) who = "yourChars";
    else if (
      /Leader or Character/i.test(chunk) ||
      /Leaders? ou Personnages?/i.test(chunk) ||
      /up to \d+ of your (?:\{[^}]+\} type |\[?[^\].]+\]? type )?Leader/i.test(chunk) ||
      /up to \d+ of your Characters/i.test(chunk) ||
      /type Leader or Character/i.test(chunk)
    )
      who = "leaderOrChar";
    const trait = chunk.match(/\{([^}]+)\}/)?.[1];
    const excludeSelf = /other than this (?:card|Character|Leader)|sauf (?:cette carte|ce Personnage|ce Leader)/i.test(
      chunk,
    );
    out.push({ type: "power", amount: Number(pow[1]), duration, who, trait, excludeSelf });
  }

  if (
    /cannot activate (?:a |the )?\[(?:Blocker|Bloqueur)\]/i.test(chunk) ||
    /ne peut pas activer(?: un Personnage)? \[(?:Blocker|Bloqueur)\]/i.test(chunk)
  ) {
    const duration: "turn" | "battle" = /this battle|ce combat|pour tout le combat/i.test(chunk)
      ? "battle"
      : "turn";
    const more = chunk.match(/(\d+)\s*(?:or more power|de puissance ou plus|ou plus de puissance)/i);
    const less = chunk.match(
      /(?:power of |de puissance )??(\d+)\s*(?:or less power|power or less|de puissance ou moins|ou moins)/i,
    );
    const targeted =
      /if that (?:Leader or Character|Leader|Character|card)s? attacks/i.test(chunk) ||
      (/Select up to \d+ of your/i.test(chunk) && /attacks/i.test(chunk));
    const trait = chunk.match(/\{([^}]+)\}/)?.[1];
    out.push({
      type: "noBlocker",
      duration,
      powerMin: more ? Number(more[1]) : undefined,
      powerMax: less && !more ? Number(less[1]) : undefined,
      who: targeted ? "leaderOrChar" : "self",
      trait: targeted ? trait : undefined,
    });
  }
  if (/Play this card/i.test(chunk)) out.push({ type: "playThis" });
  if (/Set this (?:Leader|Character|card) as active/i.test(chunk)) out.push({ type: "awaken" });
  const mill = chunk.match(/Trash up to (\d+) of your opponent's Life cards/i);
  if (mill) out.push({ type: "millLife", n: Number(mill[1]), whose: "opp" });

  const giveA = chunk.match(
    /Give (?:this Leader or 1 of your Characters |your Leader or 1 of your Characters )?up to (\d+) rested DON!!/i,
  );
  const giveB = chunk.match(/Give up to (\d+) rested DON!! cards? to ([^.:[]+)/i);
  if (giveA || giveB) {
    const n = Number((giveA || giveB)![1]);
    const blob = chunk.toLowerCase();
    const tail = (giveB?.[2] || chunk).toLowerCase();
    let who: "self" | "leader" | "char" | "leaderOrChar" = "leaderOrChar";
    if (/this leader or 1 of your characters/.test(blob) || /your leader or 1 of your characters/.test(blob))
      who = "leaderOrChar";
    else if (/\bcharacters?\b/.test(tail) && !/leader/.test(tail)) who = "char";
    else if (/leader/.test(tail) && !/character/.test(tail)) who = "leader";
    const trait = chunk.match(/\{([^}]+)\}/)?.[1];
    out.push({ type: "giveRestedDon", n, who, trait });
  }

  return out;
}

function parseAuras(text: string): Aura[] {
  const auras: Aura[] = [];
  const push = (don: number, yourTurn: boolean, oppTurn: boolean, who: Aura["who"], power: number) => {
    auras.push({ don, yourTurn, oppTurn, who, power });
  };
  let m: RegExpExecArray | null;
  const reChars =
    /\[DON!! x(\d+)\]\s*(?:\[(?:Your Turn|Opponent's Turn)\]\s*)?All of your Characters gain \+(\d+) power/gi;
  while ((m = reChars.exec(text))) {
    push(Number(m[1]), /Your Turn/i.test(m[0]), /Opponent's Turn/i.test(m[0]), "yourChars", Number(m[2]));
  }
  const reSelf =
    /\[DON!! x(\d+)\]\s*(?:\[Your Turn\]\s*)?this (?:Leader|Character) gains \+(\d+) power/gi;
  while ((m = reSelf.exec(text))) {
    push(Number(m[1]), /Your Turn/i.test(m[0]), false, "self", Number(m[2]));
  }
  const reTurnSelf = /\[Your Turn\]\s*this (?:Leader|Character|Stage) gains \+(\d+) power/gi;
  while ((m = reTurnSelf.exec(text))) {
    if (/DON!! x/i.test(text.slice(Math.max(0, (m.index ?? 0) - 18), m.index))) continue;
    push(0, true, false, "self", Number(m[1]));
  }
  const reOppAll = /\[Opponent's Turn\][^[]{0,80}All of your Characters[^[]{0,40}gain \+(\d+) power/gi;
  while ((m = reOppAll.exec(text))) {
    push(0, false, true, "yourChars", Number(m[1]));
  }
  const reYourAll = /\[Your Turn\][^[]{0,120}(?:all your Characters|all of your Characters)[^[]{0,40}gain \+(\d+) power/gi;
  while ((m = reYourAll.exec(text))) {
    push(0, true, false, "yourChars", Number(m[1]));
  }
  const reDonKw =
    /\[DON!! x(\d+)\]\s*This (?:Character|Leader) gains \[([^\]]+)\]/gi;
  while ((m = reDonKw.exec(text))) {
    const keyword = keywordFromTag(m[2] || "");
    if (!keyword) continue;
    auras.push({
      don: Number(m[1]),
      yourTurn: false,
      oppTurn: false,
      who: "self",
      power: 0,
      keyword,
    });
  }
  return auras;
}

export function eventPlayableInMain(card: TcgCard): boolean {
  if (card.type !== "Event") return false;
  return parseCard(card).isMainEvent;
}

export function eventPlayableInCounter(card: TcgCard): boolean {
  if (card.type !== "Event") return false;
  return parseCard(card).isCounterEvent;
}
