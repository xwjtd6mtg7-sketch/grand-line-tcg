import { fisherYates, uid } from "@/lib/utils";
import { cardById, colorsOk } from "./catalog";
import { parseCard, type Effect } from "./parse";
import type { DeckList, TcgCard } from "./types";

export type PlayerId = 0 | 1;

export interface Unit {
  iid: string;
  id: string;
  rested: boolean;
  sick: boolean;
  don: number;
  powerBuff: number;
  battleBuff: number;
  usedMain: boolean;
  costBuff: number;
  unblockThisTurn: boolean;
  /** Opponent blocker prohibition while this unit is attacking (optcg APPLY_PROHIBITION). */
  blockerBan?: { duration: "turn" | "battle"; powerMin?: number; powerMax?: number };
  slot?: number;
}

export interface Side {
  leader: Unit;
  life: string[];
  deck: string[];
  hand: string[];
  trash: string[];
  chars: Unit[];
  stage: Unit | null;
  donRemain: number;
  donActive: number;
  donRested: number;
  turnsStarted: number;
}

export type TargetRef = { kind: "leader" } | { kind: "char"; iid: string };

export type Step =
  | { kind: "coin" }
  | { kind: "mulligan" }
  | { kind: "main" }
  | { kind: "block"; attackerIid: string; target: TargetRef }
  | { kind: "counter"; attackerIid: string; target: TargetRef }
  | { kind: "trigger"; pid: PlayerId; cardId: string; remaining: number; banish: boolean }
  | {
      kind: "choose";
      pid: PlayerId;
      sourceIid: string | null;
      effect: Effect;
      rest: Effect[];
      battle: boolean;
      optional: boolean;
      prompt: string;
    }
  | { kind: "over"; winner: PlayerId };

export type Action =
  | { type: "coinResult"; first: PlayerId }
  | { type: "mulligan"; redraw: boolean }
  | { type: "play"; handIndex: number; replaceIid?: string; slot?: number }
  | { type: "attachDon"; iid: string; n: number }
  | { type: "activateMain"; iid: string }
  | { type: "attack"; attackerIid: string; target: TargetRef }
  | { type: "block"; iid: string | null }
  | { type: "counterCard"; handIndex: number }
  | { type: "passCounter" }
  | { type: "triggerYes" }
  | { type: "triggerNo" }
  | { type: "chooseTarget"; target: TargetRef }
  | { type: "skipChoose" }
  | { type: "endTurn" };

export interface GameState {
  players: [Side, Side];
  turn: PlayerId;
  first: PlayerId;
  turnNumber: number;
  turnSeq: number;
  step: Step;
  log: string[];
  combatBuff: { player: PlayerId; amount: number };
}

const MAX_DON = 10;
const MAX_CHARS = 5;

export function engineCard(id: string): TcgCard {
  const c = cardById(id);
  if (!c) {
    return {
      id,
      name: id,
      set: "?",
      setName: "",
      rarity: "C",
      colors: [],
      type: "Character",
      life: null,
      cost: 0,
      power: 0,
      counter: null,
      traits: [],
      attr: null,
      text: "",
      image: "",
      parallel: false,
      src: "?",
    };
  }
  return c;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function unitFrom(id: string, extra: Partial<Unit> = {}): Unit {
  return {
    iid: uid("u"),
    id,
    rested: false,
    sick: false,
    don: 0,
    powerBuff: 0,
    battleBuff: 0,
    usedMain: false,
    costBuff: 0,
    unblockThisTurn: false,
    blockerBan: undefined,
    ...extra,
  };
}

export function totalDon(s: Side): number {
  return (
    s.donActive +
    s.donRested +
    s.leader.don +
    s.chars.reduce((a, c) => a + c.don, 0) +
    (s.stage?.don ?? 0)
  );
}

function draw(s: Side, n: number, logs: string[], who: string): boolean {
  for (let i = 0; i < n; i++) {
    const top = s.deck.shift();
    if (!top) {
      logs.push(`${who} ne peut plus piocher.`);
      return false;
    }
    s.hand.push(top);
  }
  return true;
}

export function findUnit(side: Side, iid: string): Unit | null {
  if (side.leader.iid === iid) return side.leader;
  if (side.stage?.iid === iid) return side.stage;
  return side.chars.find((c) => c.iid === iid) ?? null;
}

function returnDon(side: Side, unit: Unit) {
  // 6-5-5-4: DON!! given to a card that leaves return to the cost area RESTED.
  side.donRested += unit.don;
  unit.don = 0;
}

function returnAllAttachedDon(side: Side) {
  returnDon(side, side.leader);
  for (const ch of side.chars) returnDon(side, ch);
  if (side.stage) returnDon(side, side.stage);
}

function logName(id: string): string {
  return engineCard(id).name;
}

export function currentPower(state: GameState, pid: PlayerId, unit: Unit): number {
  const c = engineCard(unit.id);
  let p = c.power ?? 0;
  // 6-5-5-2: +1000 per given DON!! only during that player's turn.
  if (state.turn === pid) p += unit.don * 1000;
  p += unit.powerBuff + unit.battleBuff;
  const side = state.players[pid];
  const sources = [side.leader, ...side.chars, ...(side.stage ? [side.stage] : [])];
  for (const src of sources) {
    const abs = parseCard(engineCard(src.id));
    for (const aura of abs.auras) {
      if (src.don < aura.don) continue;
      if (aura.yourTurn && state.turn !== pid) continue;
      if (aura.oppTurn && state.turn === pid) continue;
      if (aura.who === "yourChars" && unit === side.leader) continue;
      if (aura.who === "self" && src.iid !== unit.iid) continue;
      const add = Number(aura.power);
      if (Number.isFinite(add)) p += add;
    }
  }
  if (state.combatBuff.amount && state.combatBuff.player === pid) {
    const def = defendingUnit(state);
    if (def && def.pid === pid && def.unit.iid === unit.iid) p += state.combatBuff.amount;
  }
  return Number.isFinite(p) ? p : 0;
}

function unitCost(u: Unit): number {
  return Math.max(0, (engineCard(u.id).cost ?? 0) + u.costBuff);
}

function bestFriendly(state: GameState, pid: PlayerId): Unit {
  const me = state.players[pid];
  const units = [me.leader, ...me.chars];
  return units.sort((a, b) => currentPower(state, pid, b) - currentPower(state, pid, a))[0] ?? me.leader;
}

function traitKey(s: string) {
  return s
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[_/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TRAIT_ALIAS: Record<string, string> = {
  "equipage de chapeau de paille": "straw hat crew",
  "chapeau de paille": "straw hat crew",
  "straw hat": "straw hat crew",
  supernovas: "supernovas",
  "the four emperors": "the four emperors",
  "quatre empereurs": "the four emperors",
  "whitebeard pirates": "whitebeard pirates",
  "pirates de barbe blanche": "whitebeard pirates",
  "red-haired pirates": "red-haired pirates",
  "pirates du roux": "red-haired pirates",
  "animal kingdom pirates": "animal kingdom pirates",
  "beast pirates": "animal kingdom pirates",
};

function canonTrait(s: string) {
  const k = traitKey(s);
  return TRAIT_ALIAS[k] ?? k;
}

function hasTrait(id: string, trait?: string) {
  if (!trait) return true;
  const needle = canonTrait(trait.replace(/[{}]/g, ""));
  if (!needle) return true;
  const c = engineCard(id);
  const hay = [c.name, ...c.traits].flatMap((raw) => {
    const k = traitKey(raw);
    const out = new Set<string>([TRAIT_ALIAS[k] ?? k, k]);
    for (const [alias, mapped] of Object.entries(TRAIT_ALIAS)) {
      if (k === alias || k.includes(alias)) {
        out.add(mapped);
        out.add(alias);
      }
    }
    return [...out];
  });
  return hay.some((t) => t === needle || t.includes(needle) || needle.includes(t));
}

function choosePrompt(e: Effect): string {
  if (e.type === "giveRestedDon") return "Choisis qui reçoit le DON!!";
  if (e.type === "power") return e.amount < 0 ? "Choisis la cible de la perte de puissance" : "Choisis qui gagne en puissance";
  if (e.type === "ko") return "Choisis le personnage à mettre K.O.";
  if (e.type === "rest") return "Choisis le personnage à reposer";
  if (e.type === "bounce") return "Choisis le personnage à renvoyer en main";
  if (e.type === "cost") return "Choisis le personnage";
  if (e.type === "noBlocker") return "Choisis qui ignore les Blockers";
  return "Choisis une cible";
}

function effectNeedsChoice(e: Effect): boolean {
  if (e.type === "giveRestedDon") return e.who === "leaderOrChar" || e.who === "char";
  if (e.type === "power") return e.who === "leaderOrChar" || e.who === "oppChar";
  if (e.type === "noBlocker") return e.who === "leaderOrChar";
  if (e.type === "ko" || e.type === "rest" || e.type === "bounce" || e.type === "cost") return true;
  return false;
}

export function chooseTargets(state: GameState, pid: PlayerId, e: Effect, sourceIid?: string | null): TargetRef[] {
  const me = state.players[pid];
  const opp = state.players[(pid ^ 1) as PlayerId];
  const out: TargetRef[] = [];
  const pushMe = (leader: boolean, chars: boolean, trait?: string) => {
    if (leader && hasTrait(me.leader.id, trait) && !(e.type === "power" && e.excludeSelf && me.leader.iid === sourceIid)) {
      out.push({ kind: "leader" });
    }
    if (chars) {
      for (const ch of me.chars) {
        if (e.type === "power" && e.excludeSelf && ch.iid === sourceIid) continue;
        if (hasTrait(ch.id, trait)) out.push({ kind: "char", iid: ch.iid });
      }
    }
  };
  if (e.type === "giveRestedDon") {
    if (e.who === "leader") pushMe(true, false, e.trait);
    else if (e.who === "char") pushMe(false, true, e.trait);
    else pushMe(true, true, e.trait);
    return out;
  }
  if (e.type === "noBlocker") {
    if (e.who === "leaderOrChar") pushMe(true, true, e.trait);
    return out;
  }
  if (e.type === "power") {
    if (e.who === "oppChar") {
      for (const ch of opp.chars) out.push({ kind: "char", iid: ch.iid });
      if (/leader/i.test("")) out.push({ kind: "leader" });
    } else pushMe(true, true, e.trait);
    return out;
  }
  if (e.type === "ko") {
    const oppPid = (pid ^ 1) as PlayerId;
    for (const ch of opp.chars) {
      if (e.activeOnly && ch.rested) continue;
      if (e.restedOnly && !ch.rested) continue;
      if (e.maxCost != null && unitCost(ch) > e.maxCost) continue;
      if (e.maxPower != null && currentPower(state, oppPid, ch) > e.maxPower) continue;
      if (e.keyword && !hasKeyword(state, oppPid, ch, e.keyword)) continue;
      out.push({ kind: "char", iid: ch.iid });
    }
    return out;
  }
  if (e.type === "rest") {
    for (const ch of opp.chars) {
      if (ch.rested) continue;
      if (e.maxCost != null && unitCost(ch) > e.maxCost) continue;
      out.push({ kind: "char", iid: ch.iid });
    }
    return out;
  }
  if (e.type === "bounce") {
    const side = e.whose === "opp" ? opp : me;
    for (const ch of side.chars) {
      if (e.maxCost != null && unitCost(ch) > e.maxCost) continue;
      out.push({ kind: "char", iid: ch.iid });
    }
    return out;
  }
  if (e.type === "cost") {
    for (const ch of opp.chars) out.push({ kind: "char", iid: ch.iid });
  }
  return out;
}

function resolveTarget(state: GameState, pid: PlayerId, t: TargetRef | null, oppSide = false): Unit | null {
  const side = state.players[(oppSide ? (pid ^ 1) : pid) as PlayerId];
  if (!t) return null;
  if (t.kind === "leader") return side.leader;
  return findUnit(side, t.iid);
}

function autoPick(state: GameState, pid: PlayerId, e: Effect, sourceIid?: string | null): TargetRef | null {
  const opts = chooseTargets(state, pid, e, sourceIid);
  if (!opts.length) return null;
  if (e.type === "giveRestedDon" || (e.type === "power" && e.amount > 0) || e.type === "noBlocker") {
    const leader = opts.find((o) => o.kind === "leader");
    return leader ?? opts[0]!;
  }
  return opts[0]!;
}

function applyPowerTo(unit: Unit, amount: number, battle: boolean, duration: "turn" | "battle") {
  if (battle || duration === "battle") unit.battleBuff += amount;
  else unit.powerBuff += amount;
}

function resolveEffect(state: GameState, pid: PlayerId, source: Unit | null, e: Effect, battle: boolean, chosen: TargetRef | null) {
  const me = state.players[pid];
  const opp = state.players[(pid ^ 1) as PlayerId];
  const who = pid === 0 ? "Vous" : "CPU";
  if (e.type === "draw") {
    if (e.ifLeaderTrait && !hasTrait(me.leader.id, e.ifLeaderTrait)) {
      /* skip */
    } else if (!draw(me, e.n, state.log, who)) {
      state.step = { kind: "over", winner: (pid ^ 1) as PlayerId };
    } else {
      state.log.push(`${who} pioche ${e.n}.`);
    }
  } else if (e.type === "search") {
    const n = Math.min(e.n, me.deck.length);
    const top = me.deck.splice(0, n);
    const hit = e.trait ? top.find((id) => hasTrait(id, e.trait)) : top[0];
    if (hit) {
      me.hand.push(hit);
      const i = top.indexOf(hit);
      if (i >= 0) top.splice(i, 1);
      state.log.push(`${who} ajoute ${logName(hit)} (recherche).`);
    }
    me.deck.push(...top);
  } else if (e.type === "don") {
    const space = MAX_DON - totalDon(me);
    const n = Math.min(e.n, me.donRemain, space);
    me.donRemain -= n;
    if (e.rested) me.donRested += n;
    else me.donActive += n;
    if (n) state.log.push(`${who} ajoute ${n} DON!!${e.rested ? " (reposé)" : ""}.`);
  } else if (e.type === "power") {
    if (e.who === "yourChars") {
      for (const ch of me.chars) applyPowerTo(ch, e.amount, battle, e.duration);
    } else if (e.who === "oppChar") {
      const pick = chosen ?? autoPick(state, pid, e, source?.iid);
      const t = resolveTarget(state, pid, pick, true);
      if (t) {
        applyPowerTo(t, e.amount, battle, e.duration);
        state.log.push(`${logName(t.id)} ${e.amount > 0 ? "+" : ""}${e.amount} puiss.`);
      }
    } else if (e.who === "leaderOrChar") {
      const pick = chosen ?? autoPick(state, pid, e, source?.iid);
      const t = resolveTarget(state, pid, pick);
      if (t) {
        applyPowerTo(t, e.amount, battle, e.duration);
        state.log.push(`${logName(t.id)} ${e.amount > 0 ? "+" : ""}${e.amount} puiss.`);
      }
    } else if (source) {
      applyPowerTo(source, e.amount, battle, e.duration);
    }
  } else if (e.type === "ko") {
    const t = chosen ?? autoPick(state, pid, e, source?.iid);
    if (t && t.kind === "char") {
      const name = logName(findUnit(opp, t.iid)?.id ?? t.iid);
      koChar(state, (pid ^ 1) as PlayerId, t.iid);
      state.log.push(`${who} K.O. ${name}.`);
    }
  } else if (e.type === "rest") {
    const t = chosen ?? autoPick(state, pid, e, source?.iid);
    const u = t ? resolveTarget(state, pid, t, true) : null;
    if (u) {
      u.rested = true;
      state.log.push(`${who} repose ${logName(u.id)}.`);
    }
  } else if (e.type === "bounce") {
    const t = chosen ?? autoPick(state, pid, e, source?.iid);
    const oppSide = e.whose === "opp";
    const u = t ? resolveTarget(state, pid, t, oppSide) : null;
    const target = oppSide ? opp : me;
    if (u) {
      const idx = target.chars.findIndex((c) => c.iid === u.iid);
      if (idx >= 0) {
        const [gone] = target.chars.splice(idx, 1);
        if (gone) {
          returnDon(target, gone);
          target.hand.push(gone.id);
          state.log.push(`${logName(gone.id)} retourne en main.`);
        }
      }
    }
  } else if (e.type === "readyDon") {
    const n = Math.min(e.n, me.donRested);
    me.donRested -= n;
    me.donActive += n;
    if (n) state.log.push(`${who} redresse ${n} DON!!.`);
  } else if (e.type === "cost") {
    const u = chosen ? resolveTarget(state, pid, chosen, true) : null;
    if (u) {
      u.costBuff += e.amount;
      state.log.push(`${logName(u.id)} coût ${e.amount}.`);
    }
  } else if (e.type === "noBlocker") {
    const duration = e.duration ?? "turn";
    const host =
      e.who === "leaderOrChar"
        ? chosen
          ? resolveTarget(state, pid, chosen)
          : resolveTarget(state, pid, autoPick(state, pid, e, source?.iid))
        : source;
    if (host) {
      host.blockerBan = { duration, powerMin: e.powerMin, powerMax: e.powerMax };
      if (e.powerMin == null && e.powerMax == null) host.unblockThisTurn = true;
      const filter =
        e.powerMin != null ? ` (≥${e.powerMin})` : e.powerMax != null ? ` (≤${e.powerMax})` : "";
      state.log.push(
        `${logName(host.id)} : pas de Blocker ${duration === "battle" ? "ce combat" : "ce tour"}${filter}.`,
      );
    }
  } else if (e.type === "giveRestedDon") {
    const n = Math.min(e.n, me.donRested);
    if (n > 0) {
      const t =
        (chosen ? resolveTarget(state, pid, chosen) : null) ??
        (e.who === "leader" ? me.leader : e.who === "self" && source ? source : source ?? me.leader);
      if (t) {
        me.donRested -= n;
        t.don += n;
        state.log.push(`${n} DON!! reposé(s) donnés à ${logName(t.id)}.`);
      }
    }
  } else if (e.type === "awaken" && source) {
    source.rested = false;
    state.log.push(`${logName(source.id)} se redresse.`);
  } else if (e.type === "millLife") {
    const target = e.whose === "opp" ? opp : me;
    for (let i = 0; i < e.n; i++) {
      const id = target.life.shift();
      if (!id) break;
      target.trash.push(id);
      state.log.push(`Vie défaussée : ${logName(id)}.`);
    }
  }
}

function applyEffects(
  state: GameState,
  pid: PlayerId,
  source: Unit | null,
  effects: Effect[],
  battle: boolean,
) {
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i]!;
    if (e.donReq && (source?.don ?? 0) < e.donReq) continue;
    if (e.type === "giveRestedDon" && state.players[pid].donRested <= 0) continue;
    if (effectNeedsChoice(e)) {
      const opts = chooseTargets(state, pid, e, source?.iid);
      if (!opts.length) continue;
      if (pid === 0 && !battle) {
        state.step = {
          kind: "choose",
          pid,
          sourceIid: source?.iid ?? null,
          effect: e,
          rest: effects.slice(i + 1),
          battle,
          optional: true,
          prompt: choosePrompt(e),
        };
        return;
      }
      resolveEffect(state, pid, source, e, battle, autoPick(state, pid, e, source?.iid));
      continue;
    }
    resolveEffect(state, pid, source, e, battle, null);
  }
}

function finishChoose(state: GameState, target: TargetRef | null) {
  const st = state.step;
  if (st.kind !== "choose") return;
  const side = state.players[st.pid];
  const source = st.sourceIid ? findUnit(side, st.sourceIid) : null;
  state.step = { kind: "main" };
  if (target) resolveEffect(state, st.pid, source, st.effect, st.battle, target);
  applyEffects(state, st.pid, source, st.rest, st.battle);
  checkDefeat(state);
}

function koChar(state: GameState, pid: PlayerId, iid: string) {
  const side = state.players[pid];
  const idx = side.chars.findIndex((c) => c.iid === iid);
  if (idx < 0) return;
  const [u] = side.chars.splice(idx, 1);
  if (!u) return;
  returnDon(side, u);
  const abs = parseCard(engineCard(u.id));
  side.trash.push(u.id);
  if (abs.onKo.length) applyEffects(state, pid, null, abs.onKo, false);
}

function trashCharNoKo(state: GameState, pid: PlayerId, iid: string) {
  const side = state.players[pid];
  const idx = side.chars.findIndex((c) => c.iid === iid);
  if (idx < 0) return;
  const [u] = side.chars.splice(idx, 1);
  if (!u) return;
  returnDon(side, u);
  side.trash.push(u.id);
  state.log.push(`${logName(u.id)} est défaussé (limite 5 persos).`);
}

function checkDefeat(state: GameState) {
  if (state.step.kind === "over") return;
  for (const pid of [0, 1] as PlayerId[]) {
    if (state.players[pid].deck.length === 0) {
      state.step = { kind: "over", winner: (pid ^ 1) as PlayerId };
      state.log.push(`${pid === 0 ? "Vous" : "CPU"} n'a plus de deck.`);
      return;
    }
  }
}

function dealLeaderDamage(state: GameState, defPid: PlayerId, n: number, banish: boolean) {
  applyLifeHit(state, defPid, n, banish);
}

function applyLifeHit(state: GameState, defPid: PlayerId, remaining: number, banish: boolean) {
  const side = state.players[defPid];
  const who = defPid === 0 ? "Vous" : "CPU";
  while (remaining > 0) {
    if (side.life.length === 0) {
      state.step = { kind: "over", winner: (defPid ^ 1) as PlayerId };
      state.log.push(`${who} prend des dégâts à 0 vie.`);
      return;
    }
    const id = side.life.shift()!;
    remaining -= 1;
    if (banish) {
      side.trash.push(id);
      state.log.push(`Banish : ${logName(id)} va à la poubelle (pas de Trigger).`);
      continue;
    }
    const abs = parseCard(engineCard(id));
    if (abs.trigger.length) {
      state.step = { kind: "trigger", pid: defPid, cardId: id, remaining, banish };
      state.log.push(`Trigger possible : ${logName(id)}.`);
      return;
    }
    side.hand.push(id);
    state.log.push(`${who} perd 1 vie (${logName(id)}).`);
  }
  if (state.step.kind !== "over") state.step = { kind: "main" };
}

function resolveTrigger(state: GameState, activate: boolean) {
  if (state.step.kind !== "trigger") return;
  const { pid, cardId, remaining, banish } = state.step;
  const side = state.players[pid];
  const abs = parseCard(engineCard(cardId));
  const who = pid === 0 ? "Vous" : "CPU";
  if (activate) {
    state.log.push(`${who} active le Trigger de ${logName(cardId)}.`);
    const card = engineCard(cardId);
    if (abs.triggerActivateMain) applyEffects(state, pid, null, abs.mainEffects, false);
    else applyEffects(state, pid, null, abs.trigger, false);
    if (abs.triggerPlayThis && card.type === "Stage") {
      if (side.stage) {
        returnDon(side, side.stage);
        side.trash.push(side.stage.id);
      }
      side.stage = unitFrom(cardId);
      state.log.push(`${card.name} entre en Terrain (Trigger).`);
    } else if (abs.triggerPlayThis && card.type === "Character") {
      if (side.chars.length >= MAX_CHARS) {
        const first = side.chars[0];
        if (first) trashCharNoKo(state, pid, first.iid);
      }
      const u = unitFrom(cardId, {
        sick: !abs.rush && !abs.rushCharacter,
        slot: nextCharSlot(side),
      });
      side.chars.push(u);
      state.log.push(`${card.name} entre (Trigger).`);
      applyEffects(state, pid, u, abs.onPlay, false);
    } else if (abs.triggerKeep) side.hand.push(cardId);
    else side.trash.push(cardId);
  } else {
    side.hand.push(cardId);
    state.log.push(`${who} garde ${logName(cardId)} en main (Trigger non activé).`);
  }
  if (state.step.kind !== "trigger") return;
  applyLifeHit(state, pid, remaining, banish);
}

function payDonMinus(side: Side, n: number, prefer: Unit | null): boolean {
  if (n <= 0) return true;
  if (totalDon(side) < n) return false;
  let need = n;
  const takeUnit = (u: Unit) => {
    const k = Math.min(need, u.don);
    u.don -= k;
    need -= k;
    side.donRemain += k;
  };
  if (prefer) takeUnit(prefer);
  takeUnit(side.leader);
  for (const ch of side.chars) takeUnit(ch);
  if (side.stage) takeUnit(side.stage);
  const a = Math.min(need, side.donActive);
  side.donActive -= a;
  need -= a;
  side.donRemain += a;
  const r = Math.min(need, side.donRested);
  side.donRested -= r;
  need -= r;
  side.donRemain += r;
  return need === 0;
}

function payCost(side: Side, cost: number): boolean {
  if (cost > side.donActive) return false;
  side.donActive -= cost;
  side.donRested += cost;
  return true;
}

function beginTurn(state: GameState) {
  const p = state.players[state.turn];
  const who = state.turn === 0 ? "Vous" : "CPU";
  p.turnsStarted += 1;
  state.turnSeq += 1;

  // 6-2 Refresh: return given DON!! (rested), then set all rested cards/DON!! active.
  returnAllAttachedDon(p);
  p.leader.rested = false;
  p.leader.battleBuff = 0;
  p.leader.usedMain = false;
  for (const ch of p.chars) {
    ch.rested = false;
    ch.battleBuff = 0;
    ch.usedMain = false;
  }
  if (p.stage) {
    p.stage.rested = false;
    p.stage.usedMain = false;
  }
  p.donActive += p.donRested;
  p.donRested = 0;

  const goingFirstFirstTurn = p.turnsStarted === 1 && state.turn === state.first;

  // 6-3 Draw — player going first skips on their first turn.
  if (!goingFirstFirstTurn) {
    if (!draw(p, 1, state.log, who)) {
      state.step = { kind: "over", winner: (state.turn ^ 1) as PlayerId };
      return;
    }
  }

  // 6-4 DON!! — +2, or +1 on the first player's first turn.
  const gain = goingFirstFirstTurn ? 1 : 2;
  const n = Math.min(gain, p.donRemain, MAX_DON - totalDon(p));
  p.donRemain -= n;
  p.donActive += n;
  state.step = { kind: "main" };
  const noAtk = p.turnsStarted === 1 ? " · pas d'attaque (1er tour)" : "";
  state.log.push(
    `${who} · Refresh · ${goingFirstFirstTurn ? "pas de pioche" : "pioche"} · +${n} DON!! (${p.donActive} actifs)${noAtk}.`,
  );
}

function endTurn(state: GameState) {
  // End Phase — "during this turn" effects expire for both players.
  for (const side of state.players) {
    side.leader.powerBuff = 0;
    side.leader.battleBuff = 0;
    side.leader.costBuff = 0;
    side.leader.unblockThisTurn = false;
    side.leader.blockerBan = undefined;
    for (const ch of side.chars) {
      ch.powerBuff = 0;
      ch.battleBuff = 0;
      ch.costBuff = 0;
      ch.unblockThisTurn = false;
      ch.blockerBan = undefined;
    }
  }
  for (const ch of state.players[state.turn].chars) ch.sick = false;
  state.combatBuff = { player: 0, amount: 0 };
  state.turn = (state.turn ^ 1) as PlayerId;
  state.turnNumber += 1;
  beginTurn(state);
}

function resolveBattle(state: GameState) {
  if (state.step.kind !== "counter") return;
  const atkPid = state.turn;
  const defPid = (atkPid ^ 1) as PlayerId;
  const attacker = findUnit(state.players[atkPid], state.step.attackerIid);
  const targetRef = state.step.target;
  if (!attacker) {
    state.step = { kind: "main" };
    return;
  }
  const targetUnit =
    targetRef.kind === "leader"
      ? state.players[defPid].leader
      : findUnit(state.players[defPid], targetRef.iid);
  if (!targetUnit) {
    state.step = { kind: "main" };
    return;
  }
  const atkP = currentPower(state, atkPid, attacker);
  const defP = currentPower(state, defPid, targetUnit);
  state.log.push(`Combat ${logName(attacker.id)} ${atkP} vs ${logName(targetUnit.id)} ${defP}`);
  const abs = parseCard(engineCard(attacker.id));
  const hitLeader = targetRef.kind === "leader" || targetUnit === state.players[defPid].leader;
  if (atkP >= defP) {
    if (hitLeader) {
      const dmg = abs.doubleAttack ? 2 : 1;
      dealLeaderDamage(state, defPid, dmg, abs.banish);
    } else {
      koChar(state, defPid, targetUnit.iid);
      state.log.push(`${logName(targetUnit.id)} est K.O.`);
      if (state.step.kind === "counter") state.step = { kind: "main" };
    }
  } else {
    state.log.push(`${logName(attacker.id)} n'a pas assez de puissance.`);
    state.step = { kind: "main" };
  }
  attacker.battleBuff = 0;
  targetUnit.battleBuff = 0;
  if (attacker.blockerBan?.duration === "battle") {
    attacker.blockerBan = undefined;
    attacker.unblockThisTurn = false;
  }
  state.combatBuff = { player: 0, amount: 0 };
}

export function createMatch(p0: DeckList, p1: DeckList, first: PlayerId = 0): GameState {
  const makeSide = (d: DeckList): Side => {
    const shuffled = fisherYates(
      Object.entries(d.cards).flatMap(([id, n]) => Array.from({ length: n }, () => id)),
    );
    // 5-2-1-6: draw 5 FIRST. Life is placed after mulligan (5-2-1-7).
    const hand = shuffled.slice(0, 5);
    const deck = shuffled.slice(5);
    return {
      leader: unitFrom(d.leaderId),
      life: [],
      deck,
      hand,
      trash: [],
      chars: [],
      stage: null,
      donRemain: MAX_DON,
      donActive: 0,
      donRested: 0,
      turnsStarted: 0,
    };
  };
  const state: GameState = {
    players: [makeSide(p0), makeSide(p1)],
    turn: first,
    first,
    turnNumber: 1,
    turnSeq: 0,
    step: { kind: "coin" },
    log: ["Main de 5 cartes. Mulligan, puis les vies sont placées."],
    combatBuff: { player: 0, amount: 0 },
  };
  return state;
}

function placeLife(side: Side) {
  const n = engineCard(side.leader.id).life ?? 5;
  for (let i = 0; i < n; i++) {
    const top = side.deck.shift();
    if (!top) break;
    // top of deck becomes the BOTTOM of the life pile (5-2-1-7).
    side.life.unshift(top);
  }
}

function nextCharSlot(side: Side): number {
  const used = new Set(side.chars.map((c, i) => c.slot ?? i));
  for (let s = 0; s < MAX_CHARS; s++) if (!used.has(s)) return s;
  return 0;
}

function playFromHand(state: GameState, pid: PlayerId, handIndex: number, replaceIid?: string, slot?: number): boolean {
  const side = state.players[pid];
  const id = side.hand[handIndex];
  if (!id) return false;
  const c = engineCard(id);
  const cost = c.cost ?? 0;
  const abs = parseCard(c);
  const who = pid === 0 ? "Vous jouez" : "CPU joue";
  const leader = engineCard(side.leader.id);
  if (c.type !== "Leader" && c.colors.length && leader.colors.length && !colorsOk(leader, c)) return false;
  if (c.type === "Character") {
    if (side.chars.length >= MAX_CHARS) {
      const occupant = slot != null ? side.chars.find((ch, i) => (ch.slot ?? i) === slot) : null;
      const rid = replaceIid ?? occupant?.iid ?? side.chars[0]?.iid;
      if (!rid) return false;
      trashCharNoKo(state, pid, rid);
    } else if (slot != null) {
      const occupant = side.chars.find((ch, i) => (ch.slot ?? i) === slot);
      if (occupant) slot = nextCharSlot(side);
    }
    if (!payCost(side, cost)) return false;
    side.hand.splice(handIndex, 1);
    const u = unitFrom(id, { sick: !abs.rush && !abs.rushCharacter, slot: slot ?? nextCharSlot(side) });
    side.chars.push(u);
    state.log.push(`${who} ${c.name}.`);
    applyEffects(state, pid, u, abs.onPlay, false);
    return true;
  }
  if (c.type === "Stage") {
    if (!payCost(side, cost)) return false;
    side.hand.splice(handIndex, 1);
    if (side.stage) {
      returnDon(side, side.stage);
      side.trash.push(side.stage.id);
    }
    side.stage = unitFrom(id);
    state.log.push(`${c.name} entre en Terrain.`);
    applyEffects(state, pid, side.stage, abs.onPlay, false);
    return true;
  }
  if (c.type === "Event") {
    if (!abs.isMainEvent) return false;
    if (abs.playDonMinus && totalDon(side) < abs.playDonMinus) return false;
    if (!payCost(side, cost)) return false;
    if (abs.playDonMinus && !payDonMinus(side, abs.playDonMinus, null)) return false;
    side.hand.splice(handIndex, 1);
    side.trash.push(id);
    state.log.push(`${who} ${c.name}.`);
    applyEffects(state, pid, side.leader, [...abs.mainEffects, ...abs.onPlay], false);
    return true;
  }
  return false;
}

function auraGrants(
  state: GameState,
  pid: PlayerId,
  unit: Unit,
  keyword: "rush" | "blocker" | "doubleAttack" | "banish",
): boolean {
  const side = state.players[pid];
  const sources = [side.leader, ...side.chars, ...(side.stage ? [side.stage] : [])];
  for (const src of sources) {
    const abs = parseCard(engineCard(src.id));
    for (const aura of abs.auras) {
      if (aura.keyword !== keyword) continue;
      if (src.don < aura.don) continue;
      if (aura.yourTurn && state.turn !== pid) continue;
      if (aura.oppTurn && state.turn === pid) continue;
      if (aura.who === "yourChars" && unit === side.leader) continue;
      if (aura.who === "self" && src.iid !== unit.iid) continue;
      return true;
    }
  }
  return false;
}

function hasKeyword(
  state: GameState,
  pid: PlayerId,
  unit: Unit,
  keyword: "rush" | "blocker" | "rushCharacter" | "doubleAttack" | "banish",
): boolean {
  const abs = parseCard(engineCard(unit.id));
  if (keyword === "rush" && abs.rush) return true;
  if (keyword === "rushCharacter" && abs.rushCharacter) return true;
  if (keyword === "blocker" && abs.blocker) return true;
  if (keyword === "doubleAttack" && abs.doubleAttack) return true;
  if (keyword === "banish" && abs.banish) return true;
  if (keyword === "rushCharacter") return false;
  return auraGrants(state, pid, unit, keyword);
}

/** optcg CANNOT_ACTIVATE_BLOCKER: filter opponent blockers by power, this battle or this turn. */
function isBlockerProhibited(
  state: GameState,
  attacker: Unit,
  candidate: Unit,
  defPid: PlayerId,
): boolean {
  const ban = attacker.blockerBan;
  if (!ban && attacker.unblockThisTurn) return true;
  if (!ban) return false;
  const p = currentPower(state, defPid, candidate);
  if (ban.powerMin != null && p < ban.powerMin) return false;
  if (ban.powerMax != null && p > ban.powerMax) return false;
  return true;
}

function bansAllBlockers(attacker: Unit): boolean {
  if (attacker.unblockThisTurn && !attacker.blockerBan) return true;
  const ban = attacker.blockerBan;
  if (!ban) return false;
  return ban.powerMin == null && ban.powerMax == null;
}

function canAttack(state: GameState, pid: PlayerId, unit: Unit, isLeader: boolean): boolean {
  // Official 6-4 / 6-6: only the player going first cannot attack on their first turn.
  if (state.players[pid].turnsStarted <= 1 && pid === state.first) return false;
  if (unit.rested) return false;
  if (isLeader) return true;
  const abs = parseCard(engineCard(unit.id));
  if (unit.sick && !hasKeyword(state, pid, unit, "rush") && !abs.rushCharacter) return false;
  return true;
}

function legalTargets(state: GameState, defPid: PlayerId, attacker: Unit, isLeader: boolean): TargetRef[] {
  const def = state.players[defPid];
  const abs = parseCard(engineCard(attacker.id));
  const t: TargetRef[] = [];
  const onlyChars =
    attacker.sick && abs.rushCharacter && !hasKeyword(state, state.turn, attacker, "rush") && !isLeader;
  if (!onlyChars) t.push({ kind: "leader" });
  for (const ch of def.chars) if (ch.rested) t.push({ kind: "char", iid: ch.iid });
  return t;
}

function doMulligan(side: Side) {
  const n = side.hand.length;
  side.deck.push(...side.hand);
  side.hand = [];
  side.deck = fisherYates(side.deck);
  for (let i = 0; i < n; i++) {
    const top = side.deck.shift();
    if (top) side.hand.push(top);
  }
}

export function legalActions(state: GameState, pid: PlayerId): Action[] {
  if (state.step.kind === "over") return [];
  if (state.step.kind === "coin") {
    if (pid !== 0) return [];
    return [
      { type: "coinResult", first: 0 },
      { type: "coinResult", first: 1 },
    ];
  }
  if (state.step.kind === "mulligan") {
    if (pid !== 0) return [];
    return [
      { type: "mulligan", redraw: false },
      { type: "mulligan", redraw: true },
    ];
  }
  if (state.step.kind === "trigger") {
    if (pid !== state.step.pid) return [];
    return [{ type: "triggerYes" }, { type: "triggerNo" }];
  }
  if (state.step.kind === "block") {
    if (pid === state.turn) return [];
    const acts: Action[] = [{ type: "block", iid: null }];
    const attacker = findUnit(state.players[state.turn], state.step.attackerIid);
    for (const ch of state.players[pid].chars) {
      if (ch.rested) continue;
      if (!hasKeyword(state, pid, ch, "blocker")) continue;
      if (attacker && isBlockerProhibited(state, attacker, ch, pid)) continue;
      acts.push({ type: "block", iid: ch.iid });
    }
    const leader = state.players[pid].leader;
    if (
      !leader.rested &&
      hasKeyword(state, pid, leader, "blocker") &&
      !(attacker && isBlockerProhibited(state, attacker, leader, pid))
    ) {
      acts.push({ type: "block", iid: leader.iid });
    }
    return acts;
  }
  if (state.step.kind === "counter") {
    if (pid === state.turn) return [];
    const acts: Action[] = [{ type: "passCounter" }];
    const side = state.players[pid];
    side.hand.forEach((id, i) => {
      const c = engineCard(id);
      const abs = parseCard(c);
      if (c.type === "Event" && abs.isCounterEvent && (c.cost ?? 0) <= side.donActive) {
        if (!abs.playDonMinus || totalDon(side) >= abs.playDonMinus) {
          acts.push({ type: "counterCard", handIndex: i });
        }
      }
      if (c.type === "Character" && (abs.counterPlus > 0 || (c.counter ?? 0) > 0)) {
        acts.push({ type: "counterCard", handIndex: i });
      }
    });
    return acts;
  }
  if (state.step.kind === "choose") {
    if (pid !== state.step.pid) return [];
    const acts: Action[] = chooseTargets(state, pid, state.step.effect, state.step.sourceIid).map((target) => ({
      type: "chooseTarget" as const,
      target,
    }));
    if (state.step.optional) acts.push({ type: "skipChoose" });
    return acts;
  }
  if (state.step.kind !== "main" || state.turn !== pid) return [];
  const side = state.players[pid];
  const acts: Action[] = [{ type: "endTurn" }];
  side.hand.forEach((id, i) => {
    const c = engineCard(id);
    const cost = c.cost ?? 0;
    if (cost > side.donActive) return;
    const leader = engineCard(side.leader.id);
    if (c.type !== "Leader" && c.colors.length && leader.colors.length && !colorsOk(leader, c)) return;
    if (c.type === "Character") {
      if (side.chars.length < MAX_CHARS) acts.push({ type: "play", handIndex: i });
      else for (const ch of side.chars) acts.push({ type: "play", handIndex: i, replaceIid: ch.iid });
    }
    if (c.type === "Stage") acts.push({ type: "play", handIndex: i });
    if (c.type === "Event" && parseCard(c).isMainEvent) {
      const extra = parseCard(c).playDonMinus;
      if (!extra || totalDon(side) >= extra) acts.push({ type: "play", handIndex: i });
    }
  });
  if (side.donActive > 0) {
    acts.push({ type: "attachDon", iid: side.leader.iid, n: 1 });
    for (const ch of side.chars) acts.push({ type: "attachDon", iid: ch.iid, n: 1 });
  }
  const maybeActivate = (u: Unit) => {
    const card = engineCard(u.id);
    const abs = parseCard(card);
    if (!abs.activateMain.length) return;
    if (abs.oncePerTurn && u.usedMain) return;
    if (abs.activateRest && u.rested) return;
    if (abs.activateRestCost > 0 && side.donActive < abs.activateRestCost) return;
    if (abs.activateTrashHand > 0 && side.hand.length < abs.activateTrashHand) return;
    if (abs.activateCost > 0 && totalDon(side) < abs.activateCost) return;
    if (!abs.activateMain.some((e) => !e.donReq || u.don >= e.donReq)) return;
    const give = abs.activateMain.find((e) => e.type === "giveRestedDon");
    if (give && give.type === "giveRestedDon" && side.donRested < give.n) return;
    if (/rested DON!!/i.test(card.text) && !give && side.donRested <= 0) return;
    acts.push({ type: "activateMain", iid: u.iid });
  };
  maybeActivate(side.leader);
  for (const ch of side.chars) maybeActivate(ch);
  if (side.stage) maybeActivate(side.stage);
  if (canAttack(state, pid, side.leader, true)) {
    for (const t of legalTargets(state, (pid ^ 1) as PlayerId, side.leader, true)) {
      acts.push({ type: "attack", attackerIid: side.leader.iid, target: t });
    }
  }
  for (const ch of side.chars) {
    if (!canAttack(state, pid, ch, false)) continue;
    for (const t of legalTargets(state, (pid ^ 1) as PlayerId, ch, false)) {
      acts.push({ type: "attack", attackerIid: ch.iid, target: t });
    }
  }
  return acts;
}

export function applyAction(state: GameState, pid: PlayerId, action: Action): GameState {
  const s = clone(state);
  if (s.step.kind === "over") return s;
  const legal = legalActions(s, pid);
  const ok = legal.some((a) => {
    if (JSON.stringify(a) === JSON.stringify(action)) return true;
    if (a.type === "play" && action.type === "play" && a.handIndex === action.handIndex) {
      if (a.replaceIid && action.replaceIid && a.replaceIid !== action.replaceIid) return false;
      return true;
    }
    return false;
  });
  if (!ok) return s;

  if (s.step.kind === "coin") {
    if (action.type !== "coinResult") return s;
    s.first = action.first;
    s.turn = action.first;
    s.step = { kind: "mulligan" };
    s.log.push(action.first === 0 ? "Pile ou face : vous commencez." : "Pile ou face : l'adversaire commence.");
    return s;
  }

  if (s.step.kind === "mulligan") {
    if (action.type !== "mulligan") return s;
    if (action.redraw) {
      doMulligan(s.players[0]);
      s.log.push("Mulligan.");
    } else {
      s.log.push("Main conservée.");
    }
    const cpu = s.players[1];
    const cheap = cpu.hand.filter((id) => (engineCard(id).cost ?? 99) <= 3).length;
    if (cheap < 2) {
      doMulligan(cpu);
      s.log.push("CPU change de main.");
    }
    placeLife(s.players[0]);
    placeLife(s.players[1]);
    s.log.push("Vies placées depuis le dessus du deck.");
    beginTurn(s);
    return s;
  }

  if (s.step.kind === "trigger") {
    if (action.type === "triggerYes") resolveTrigger(s, true);
    else if (action.type === "triggerNo") resolveTrigger(s, false);
    checkDefeat(s);
    return s;
  }

  if (s.step.kind === "block") {
    if (action.type !== "block") return s;
    if (action.iid) {
      const u = findUnit(s.players[pid], action.iid);
      if (u) {
        u.rested = true;
        s.step = { kind: "counter", attackerIid: s.step.attackerIid, target: { kind: "char", iid: u.iid } };
        s.log.push(`${logName(u.id)} bloque.`);
      }
    } else {
      s.step = { kind: "counter", attackerIid: s.step.attackerIid, target: s.step.target };
      s.log.push("Pas de bloqueur.");
    }
    return s;
  }

  if (s.step.kind === "counter") {
    if (action.type === "passCounter") {
      resolveBattle(s);
      return s;
    }
    if (action.type === "counterCard") {
      const side = s.players[pid];
      const id = side.hand[action.handIndex];
      if (!id) return s;
      const c = engineCard(id);
      const abs = parseCard(c);
      if (c.type === "Event") {
        if (!payCost(side, c.cost ?? 0)) return s;
        if (abs.playDonMinus && !payDonMinus(side, abs.playDonMinus, null)) return s;
        side.hand.splice(action.handIndex, 1);
        side.trash.push(id);
        const m =
          (c.textEn || c.text).match(/\+(\d{3,5})\s*(?:power|de puissance)/i) ||
          c.text.match(/\+(\d{3,5})/);
        const parsedPow = abs.counterEffects.find((e) => e.type === "power");
        const gain = parsedPow && parsedPow.type === "power" ? parsedPow.amount : m ? Number(m[1]) : 0;
        if (gain) {
          s.combatBuff = {
            player: pid,
            amount: s.combatBuff.player === pid ? s.combatBuff.amount + gain : gain,
          };
          s.log.push(`Counter ${c.name} +${gain}`);
        } else {
          s.log.push(`Counter ${c.name}`);
        }
        const extras = abs.counterEffects.filter((e) => e.type !== "power");
        if (extras.length) applyEffects(s, pid, defendingUnit(s)?.unit ?? s.players[pid].leader, extras, true);
      } else {
        const plus = abs.counterPlus || c.counter || 0;
        side.hand.splice(action.handIndex, 1);
        side.trash.push(id);
        s.combatBuff = {
          player: pid,
          amount: s.combatBuff.player === pid ? s.combatBuff.amount + plus : plus,
        };
        s.log.push(`Counter ${c.name} +${plus}`);
      }
      return s;
    }
    return s;
  }

  if (action.type === "chooseTarget") {
    if (s.step.kind !== "choose" || s.step.pid !== pid) return s;
    finishChoose(s, action.target);
    return s;
  }
  if (action.type === "skipChoose") {
    if (s.step.kind !== "choose" || s.step.pid !== pid) return s;
    finishChoose(s, null);
    return s;
  }
  if (action.type === "endTurn") {
    endTurn(s);
    return s;
  }
  if (action.type === "play") {
    playFromHand(s, pid, action.handIndex, action.replaceIid, action.slot);
    checkDefeat(s);
    return s;
  }
  if (action.type === "attachDon") {
    const side = s.players[pid];
    const n = Math.min(action.n, side.donActive);
    const u = findUnit(side, action.iid);
    if (!u || n <= 0) return s;
    side.donActive -= n;
    u.don += n;
    s.log.push(`DON!! ×${n} sur ${logName(u.id)}.`);
    return s;
  }
  if (action.type === "activateMain") {
    const side = s.players[pid];
    const u = findUnit(side, action.iid);
    if (!u) return s;
    const abs = parseCard(engineCard(u.id));
    if (!abs.activateMain.length) return s;
    if (abs.oncePerTurn && u.usedMain) return s;
    if (abs.activateRestCost && !payCost(side, abs.activateRestCost)) return s;
    if (abs.activateCost && !payDonMinus(side, abs.activateCost, u)) return s;
    if (abs.activateTrashHand) {
      for (let i = 0; i < abs.activateTrashHand; i++) {
        const idx = side.hand.length - 1;
        if (idx < 0) return s;
        const dumped = side.hand.splice(idx, 1)[0]!;
        side.trash.push(dumped);
        s.log.push(`Défausse ${logName(dumped)}.`);
      }
    }
    if (abs.activateRest) {
      if (u.rested) return s;
      u.rested = true;
    }
    if (abs.oncePerTurn) u.usedMain = true;
    s.log.push(`Activate: Main — ${logName(u.id)}${abs.activateCost ? ` (DON!! −${abs.activateCost})` : ""}.`);
    applyEffects(s, pid, u, abs.activateMain, false);
    checkDefeat(s);
    return s;
  }
  if (action.type === "attack") {
    const side = s.players[pid];
    const u = findUnit(side, action.attackerIid);
    if (!u) return s;
    u.rested = true;
    const abs = parseCard(engineCard(u.id));
    applyEffects(s, pid, u, abs.whenAttacking, true);
    if (s.step.kind !== "main") return s;
    const tName =
      action.target.kind === "leader"
        ? logName(s.players[(pid ^ 1) as PlayerId].leader.id)
        : logName(findUnit(s.players[(pid ^ 1) as PlayerId], action.target.iid)?.id ?? "");
    s.log.push(`${logName(u.id)} attaque ${tName}.`);
    if (abs.unblockable || bansAllBlockers(u)) {
      s.step = { kind: "counter", attackerIid: u.iid, target: action.target };
      s.log.push("Pas de Blocker (Unblockable).");
    } else {
      s.step = { kind: "block", attackerIid: u.iid, target: action.target };
    }
    checkDefeat(s);
    return s;
  }
  return s;
}

export function defendingUnit(state: GameState): { pid: PlayerId; unit: Unit } | null {
  if (state.step.kind !== "block" && state.step.kind !== "counter") return null;
  const pid = (state.turn ^ 1) as PlayerId;
  const u =
    state.step.target.kind === "leader"
      ? state.players[pid].leader
      : findUnit(state.players[pid], state.step.target.iid);
  if (!u) return null;
  return { pid, unit: u };
}

export function attackerUnit(state: GameState): Unit | null {
  if (state.step.kind !== "block" && state.step.kind !== "counter") return null;
  return findUnit(state.players[state.turn], state.step.attackerIid);
}

export { MAX_DON, MAX_CHARS };
