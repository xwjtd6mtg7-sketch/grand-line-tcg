import { keywordRole } from "./parse";

const KEYWORDS: Record<string, string> = {
  Blocker: "Bloqueur",
  Bloqueur: "Bloqueur",
  Rush: "Initiative",
  Initiative: "Initiative",
  "Rush: Character": "Initiative : Personnage",
  "Initiative: Personnage": "Initiative : Personnage",
  Banish: "Exclusion",
  "Double Attack": "Double attaque",
  "Double attaque": "Double attaque",
  Unblockable: "Imblocable",
  Trigger: "Trigger",
  Counter: "Contre",
  Main: "Principal",
  "On Play": "Jouée",
  Jouée: "Jouée",
  "When Attacking": "En attaquant",
  "En attaquant": "En attaquant",
  "On K.O.": "En cas de KO",
  "On KO": "En cas de KO",
  "En cas de KO": "En cas de KO",
  "Activate: Main": "Activation : Principale",
  "Activate:Main": "Activation : Principale",
  "Activation : Principale": "Activation : Principale",
  "Activer : Principal": "Activation : Principale",
  "Activer : Principale": "Activation : Principale",
  "Once Per Turn": "Une fois par tour",
  "Une fois par tour": "Une fois par tour",
  "Your Turn": "Pendant votre tour",
  "Pendant votre tour": "Pendant votre tour",
  "Opponent's Turn": "Pendant le tour de l'adversaire",
  "Pendant le tour de l'adversaire": "Pendant le tour de l'adversaire",
  "End of Your Turn": "Fin de votre tour",
  "On Your Opponent's Attack": "Lors de l'attaque adverse",
  "When Blocking": "En bloquant",
  "On Block": "En bloquant",
};

const REPL: [RegExp, string][] = [
  [
    /Your opponent cannot activate a \[Bloqueur\] Character that has (\d+) or more power during this battle/gi,
    "Votre adversaire ne peut pas activer un Personnage [Bloqueur] de $1 de puissance ou plus pendant ce combat",
  ],
  [
    /Your opponent cannot activate a \[Blocker\] Character that has (\d+) or more power during this battle/gi,
    "Votre adversaire ne peut pas activer un Personnage [Bloqueur] de $1 de puissance ou plus pendant ce combat",
  ],
  [/a \[Bloqueur\] Character that has (\d+) or more power/gi, "un Personnage [Bloqueur] de $1 de puissance ou plus"],
  [/a \[Blocker\] Character that has (\d+) or more power/gi, "un Personnage [Bloqueur] de $1 de puissance ou plus"],
  [/Your opponent cannot activate \[Bloqueur\] during this battle/gi, "Votre adversaire ne peut pas activer [Bloqueur] pendant ce combat"],
  [/Your opponent cannot activate \[Blocker\] during this battle/gi, "Votre adversaire ne peut pas activer [Bloqueur] pendant ce combat"],
  [/cannot activate \[Bloqueur\]/gi, "ne peut pas activer [Bloqueur]"],
  [/cannot activate \[Blocker\]/gi, "ne peut pas activer [Bloqueur]"],
  [/This card can attack on the turn in which it is played\./gi, "Cette carte peut attaquer le tour où elle est mise en jeu."],
  [/This card deals 2 damage\./gi, "Cette carte inflige 2 dégâts."],
  [
    /When this card deals damage, the target card is trashed without activating its Trigger\./gi,
    "Quand cette carte inflige des dégâts, la carte ciblée est défaussée sans activer son Trigger.",
  ],
  [
    /After your opponent declares an attack, you may rest this card to make it the new target of the attack\./gi,
    "Après que votre adversaire a déclaré une attaque, vous pouvez reposer cette carte pour en faire la nouvelle cible de l'attaque.",
  ],
  [/This card cannot be blocked\./gi, "Cette carte ne peut pas être bloquée."],
  [/Play this card\./gi, "Jouez cette carte."],
  [/Draw (\d+) cards?/gi, "Piochez $1 carte(s)"],
  [/trash (\d+) cards? from your hand/gi, "défaussez $1 carte(s) de votre main"],
  [/Trash (\d+) cards? from your hand/g, "Défaussez $1 carte(s) de votre main"],
  [/from the top of your deck/gi, "du dessus de votre deck"],
  [/from your trash/gi, "de votre poubelle"],
  [/to your hand/gi, "à votre main"],
  [/to the owner's hand/gi, "dans la main de son propriétaire"],
  [/during this battle/gi, "pendant ce combat"],
  [/during this turn/gi, "pendant ce tour"],
  [/until the end of your opponent's next turn/gi, "jusqu'à la fin du prochain tour de l'adversaire"],
  [/until the start of your next turn/gi, "jusqu'au début de votre prochain tour"],
  [/your opponent's Characters?/gi, "Personnage(s) de votre adversaire"],
  [/your opponent's Leader/gi, "le Leader de votre adversaire"],
  [/your opponent/gi, "votre adversaire"],
  [/this Character/gi, "ce Personnage"],
  [/This Character/g, "Ce Personnage"],
  [/this Leader/gi, "ce Leader"],
  [/This Leader/g, "Ce Leader"],
  [/this card/gi, "cette carte"],
  [/This card/g, "Cette carte"],
  [/your hand/gi, "votre main"],
  [/your deck/gi, "votre deck"],
  [/your field/gi, "votre terrain"],
  [/Life cards?/gi, "carte(s) Vie"],
  [/DON!! cards?/gi, "carte(s) DON!!"],
  [/Character cards?/gi, "carte(s) Personnage"],
  [/You may/g, "Vous pouvez"],
  [/you may/g, "vous pouvez"],
  [/If you have/g, "Si vous avez"],
  [/if you have/g, "si vous avez"],
  [/Up to/g, "Jusqu'à"],
  [/up to/g, "jusqu'à"],
  [/gains? \+(\d+) power/gi, "gagne(nt) +$1 de puissance"],
  [/gains? \[([^\]]+)\]/gi, "gagne [$1]"],
  [/\brested\b/gi, "reposé(e)"],
  [/\bRest\b/g, "Reposez"],
  [/\brest\b/g, "reposez"],
  [/Give this Leader or 1 of your Characters up to (\d+) rested DON!! cards?/gi, "Donnez jusqu'à $1 carte DON!! reposée à ce Leader ou à 1 de vos Personnages"],
  [/Give up to (\d+) rested DON!! cards? to (?:your|this) Leader or 1 of your Characters/gi, "Donnez jusqu'à $1 carte DON!! reposée à votre Leader ou à 1 de vos Personnages"],
  [/All of your Characters gain \+(\d+) power/gi, "Tous vos Personnages gagnent +$1 de puissance"],
  [/All de vos Personnages gagnent/gi, "Tous vos Personnages gagnent"],
  [/\ball de vos\b/gi, "tous vos"],
  [/Donnez ce Leader or 1 de vos Personnages jusqu'à (\d+) reposé(?:e)? carte DON!!/gi, "Donnez jusqu'à $1 carte DON!! reposée à ce Leader ou à 1 de vos Personnages"],
  [/Donnez ce Leader ou 1 de vos Personnages jusqu'à (\d+) reposé(?:e)? carte DON!!/gi, "Donnez jusqu'à $1 carte DON!! reposée à ce Leader ou à 1 de vos Personnages"],
  [/this Leader or 1 de vos/gi, "ce Leader ou 1 de vos"],
  [/ce Leader or 1 de vos/gi, "ce Leader ou 1 de vos"],
  [/Leader or 1 de vos/gi, "Leader ou 1 de vos"],
  [/Up to (\d+) of your Leader or Character cards other than this card gains? \+(\d+) power/gi, "Jusqu'à $1 de vos Leaders ou Personnages autre que cette carte gagne +$2 de puissance"],
  [/\bGive\b/g, "Donnez"],
  [/\bgive\b/g, "donnez"],
  [/\bThen,\b/g, "Puis,"],
  [/\band draw\b/gi, "et piochez"],
  [/\band rest\b/gi, "et reposez"],
  [/the specified number of/gi, "le nombre indiqué de"],
  [/to this Leader/gi, "à ce Leader"],
  [/to your Leader/gi, "à votre Leader"],
  [/or 1 de vos/g, "ou 1 de vos"],
  [/\bK\.O\.\b/g, "K.O."],
  [/Look at (\d+) cards?/gi, "Regardez $1 carte(s)"],
  [/add it to your hand/gi, "ajoutez-la à votre main"],
  [/place them at the top or bottom of the deck in any order/gi, "placez-les au-dessus ou en dessous du deck dans l'ordre de votre choix"],
  [/return the specified number of DON!! cards from your field to your DON!! deck/gi, "renvoyez le nombre indiqué de cartes DON!! de votre terrain dans votre deck DON!!"],
];

export function toFrEffect(raw: string): string {
  let s = raw || "";
  s = s.replace(/\[([^\]]+)\]/g, (_, tag: string) => `[${KEYWORDS[tag] ?? tag}]`);
  for (const [re, out] of REPL) s = s.replace(re, out);
  return s.replace(/  +/g, " ").replace(/\s+\./g, ".").trim();
}

export function cardFxSource(card: { text?: string; textEn?: string }): string {
  const fr = (card.text || "").trim();
  if (fr) return fr;
  return toFrEffect(card.textEn || "");
}

export function splitEffect(raw: string) {
  const text = toFrEffect(raw || "");
  const m = text.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
  if (m) return { tag: m[1], body: m[2].trim() };
  return { tag: "", body: text.trim() };
}

export type EffectBlock = {
  tag: string;
  body: string;
  key: string;
  cost?: number;
};

const TAG_KEY: Record<string, string> = {
  "Activate: Main": "activateMain",
  "Activate:Main": "activateMain",
  "Activation : Principale": "activateMain",
  "Activation: Principale": "activateMain",
  "Activer : Principal": "activateMain",
  "Activer : Principale": "activateMain",
  Main: "main",
  Principal: "main",
  Principale: "main",
  Counter: "counter",
  Contre: "counter",
  Trigger: "trigger",
  "On Play": "onPlay",
  Jouée: "onPlay",
  "When Attacking": "whenAttacking",
  "En attaquant": "whenAttacking",
  "When Blocking": "whenBlocking",
  "On Block": "whenBlocking",
  "En bloquant": "whenBlocking",
  "On K.O.": "onKo",
  "On KO": "onKo",
  "En cas de KO": "onKo",
  Blocker: "blocker",
  Bloqueur: "blocker",
  Rush: "rush",
  Initiative: "rush",
  "Rush: Character": "rush",
  "Initiative : Personnage": "rush",
  Banish: "banish",
  Exclusion: "banish",
  "Double Attack": "doubleAttack",
  "Double attaque": "doubleAttack",
  Unblockable: "unblockable",
  Imblocable: "unblockable",
  "Once Per Turn": "once",
  "Une fois par tour": "once",
  "Your Turn": "aura",
  "Pendant votre tour": "aura",
  "Opponent's Turn": "aura",
  "Pendant le tour de l'adversaire": "aura",
  "On Your Opponent's Attack": "onOppAttack",
  "Lors de l'attaque adverse": "onOppAttack",
  "Attaque adverse": "onOppAttack",
};

function tagKey(tag: string) {
  if (TAG_KEY[tag]) return TAG_KEY[tag];
  if (/^DON!!/i.test(tag)) return "don";
  return "static";
}

export function splitEffectBlocks(raw: string): EffectBlock[] {
  const text = (raw || "").replace(/Disclaimer:[\s\S]*/gi, "").trim();
  if (!text) return [];
  const re = /\[([^\]]+)\]/g;
  const hits: { tag: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tag = m[1].trim();
    const kw = /^(Blocker|Rush|Banish|Double Attack|Unblockable|Bloqueur|Initiative|Double attaque|Exclusion|Imblocable)$/i.test(tag);
    if (kw && keywordRole(text, m.index) !== "own") continue;
    hits.push({ tag, index: m.index, end: m.index + m[0].length });
  }
  if (!hits.length) {
    const body = toFrEffect(text);
    return body ? [{ tag: "", body, key: "static" }] : [];
  }
  const rawBlocks: { tags: string[]; body: string }[] = [];
  if (hits[0]!.index > 0) {
    const pre = text.slice(0, hits[0]!.index).trim();
    if (pre) rawBlocks.push({ tags: [], body: pre });
  }
  for (let i = 0; i < hits.length; i++) {
    const next = hits[i + 1]?.index ?? text.length;
    const body = text.slice(hits[i]!.end, next).trim();
    if (!body && hits[i + 1]) {
      hits[i + 1] = { ...hits[i + 1]!, tag: `${hits[i]!.tag} · ${hits[i + 1]!.tag}` };
      continue;
    }
    rawBlocks.push({ tags: hits[i]!.tag.split(" · "), body });
  }
  return rawBlocks
    .map((b) => {
      const main = [...b.tags].reverse().find((t) => tagKey(t) !== "once" && tagKey(t) !== "static") ?? b.tags[0] ?? "";
      const tagFr = b.tags.map((t) => KEYWORDS[t] ?? t).filter(Boolean).join(" · ");
      const bodyFr = toFrEffect(b.body.replace(/^:\s*/, ""));
      const costM = `${b.tags.join(" ")} ${b.body}`.match(/DON!!\s*-(\d+)/i);
      return {
        tag: tagFr,
        body: bodyFr,
        key: tagKey(main),
        cost: costM ? Number(costM[1]) : undefined,
      };
    })
    .filter((b) => b.tag || b.body);
}

export function tagHue(tag: string): { bg: string; fg: string } {
  const t = tag.toLowerCase();
  if (/don!!|don x/.test(t)) return { bg: "#141414", fg: "#f4ead4" };
  if (/une fois|once per turn/.test(t)) return { bg: "#c44d8a", fg: "#fff" };
  if (/activation|activer|activate/.test(t)) return { bg: "#1aa3c4", fg: "#fff" };
  if (/principal|^main$/.test(t)) return { bg: "#2e7de8", fg: "#fff" };
  if (/jouée|on play/.test(t)) return { bg: "#3ba55d", fg: "#fff" };
  if (/attaquant|when attacking/.test(t)) return { bg: "#e8892d", fg: "#fff" };
  if (/bloquant|when blocking|on block/.test(t)) return { bg: "#4a90d9", fg: "#fff" };
  if (/\bko\b/.test(t)) return { bg: "#c4456a", fg: "#fff" };
  if (/contre|counter/.test(t)) return { bg: "#d4453c", fg: "#fff" };
  if (/trigger/.test(t)) return { bg: "#e0b125", fg: "#1a1408" };
  if (/bloqueur|blocker/.test(t)) return { bg: "#2e7de8", fg: "#fff" };
  if (/initiative|rush/.test(t)) return { bg: "#d4453c", fg: "#fff" };
  if (/exclusion|banish|exil/.test(t)) return { bg: "#6b5b95", fg: "#fff" };
  if (/double/.test(t)) return { bg: "#e07030", fg: "#fff" };
  if (/imblocable|unblockable/.test(t)) return { bg: "#5a6a80", fg: "#fff" };
  if (/adversaire|opponent/.test(t)) return { bg: "#8b4a9e", fg: "#fff" };
  if (/votre tour|your turn/.test(t)) return { bg: "#2e9a4f", fg: "#fff" };
  if (/fin de/.test(t)) return { bg: "#5a6a80", fg: "#fff" };
  return { bg: "#5c6570", fg: "#fff" };
}


