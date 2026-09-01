import {
  applyAction,
  currentPower,
  engineCard,
  findUnit,
  legalActions,
  type Action,
  type GameState,
  type PlayerId,
} from "./engine";
import { parseCard } from "./parse";

const CPU: PlayerId = 1;

function scoreAction(state: GameState, action: Action): number {
  const me = state.players[CPU];
  const you = state.players[0];
  if (action.type === "play") {
    const id = me.hand[action.handIndex];
    if (!id) return -999;
    const c = engineCard(id);
    const abs = parseCard(c);
    let s = (c.power ?? 0) / 10 + (c.type === "Character" ? 80 : 20) - (c.cost ?? 0) * 8;
    if (abs.onPlay.some((e) => e.type === "ko")) s += 90;
    if (abs.onPlay.some((e) => e.type === "draw")) s += 40;
    if (abs.rush) s += 50;
    if (abs.blocker) s += 25;
    if (c.type === "Event") s += 15;
    return s;
  }
  if (action.type === "attachDon") {
    const u = findUnit(me, action.iid);
    if (!u) return -1;
    const power = currentPower(state, CPU, u);
    const canHit = you.chars.some((ch) => ch.rested && power + 1000 >= currentPower(state, 0, ch));
    return 40 + power / 100 + (u === me.leader ? 8 : 0) + (canHit ? 30 : 0);
  }
  if (action.type === "activateMain") {
    const u = findUnit(me, action.iid);
    if (!u) return 0;
    const abs = parseCard(engineCard(u.id));
    let s = 35;
    if (abs.activateMain.some((e) => e.type === "ko")) s += 70;
    if (abs.activateMain.some((e) => e.type === "draw")) s += 30;
    if (abs.activateMain.some((e) => e.type === "bounce")) s += 40;
    return s;
  }
  if (action.type === "chooseTarget") {
    const t = action.target;
    if (t.kind === "leader") return 60;
    const mine = me.chars.find((c) => c.iid === t.iid);
    if (mine) return 40 + currentPower(state, CPU, mine) / 80;
    const yours = you.chars.find((c) => c.iid === t.iid);
    if (yours) return 55 + currentPower(state, 0, yours) / 60;
    return 10;
  }
  if (action.type === "skipChoose") return 0;
  if (action.type === "attack") {
    const u = me.leader.iid === action.attackerIid ? me.leader : me.chars.find((c) => c.iid === action.attackerIid);
    if (!u) return -1;
    const atk = currentPower(state, CPU, u);
    const target = action.target;
    if (target.kind === "leader") {
      return 50 + atk / 80 + (you.life.length <= 2 ? 80 : 0);
    }
    const t = you.chars.find((c) => c.iid === target.iid);
    if (!t) return 0;
    const def = currentPower(state, 0, t);
    if (atk >= def) return 70 + def / 40;
    return -20;
  }
  if (action.type === "block") {
    if (!action.iid) return 10;
    const ch = me.chars.find((c) => c.iid === action.iid);
    if (!ch) return 0;
    return 20 - (engineCard(ch.id).cost ?? 0) * 3;
  }
  if (action.type === "counterCard") {
    const id = me.hand[action.handIndex];
    if (!id) return -1;
    const c = engineCard(id);
    const step = state.step;
    if (step.kind !== "counter") return 5;
    const atkU =
      state.players[0].leader.iid === step.attackerIid
        ? state.players[0].leader
        : state.players[0].chars.find((x) => x.iid === step.attackerIid);
    const tgt = step.target;
    const def = tgt.kind === "leader" ? me.leader : me.chars.find((x) => x.iid === tgt.iid);
    if (!atkU || !def) return 5;
    const atk = currentPower(state, 0, atkU);
    const dp = currentPower(state, CPU, def);
    const plus = c.type === "Event" ? 2000 : c.counter || 1000;
    if (dp < atk && dp + plus >= atk) return 120;
    if (step.target.kind === "leader" && me.life.length <= 2) return 60;
    return 5;
  }
  if (action.type === "passCounter") return 8;
  if (action.type === "endTurn") return 1;
  if (action.type === "triggerYes") {
    const step = state.step;
    if (step.kind !== "trigger") return 0;
    const abs = parseCard(engineCard(step.cardId));
    if (abs.trigger.some((e) => e.type === "draw" || e.type === "ko" || e.type === "don" || e.type === "bounce")) return 80;
    return 15;
  }
  if (action.type === "triggerNo") return 10;
  return 0;
}

export function pickCpuAction(state: GameState): Action | null {
  const acts = legalActions(state, CPU);
  if (!acts.length) return null;
  let best = acts[0]!;
  let bestS = -Infinity;
  for (const a of acts) {
    const s = scoreAction(state, a);
    if (s > bestS) {
      bestS = s;
      best = a;
    }
  }
  return best;
}

export function runCpuBurst(state: GameState, max = 12): GameState {
  let s = state;
  for (let i = 0; i < max; i++) {
    if (s.step.kind === "over" || s.step.kind === "mulligan") break;
    if (s.step.kind === "trigger" && s.step.pid !== CPU) break;
    if (s.step.kind === "main" && s.turn !== CPU) break;
    if ((s.step.kind === "block" || s.step.kind === "counter") && s.turn === CPU) break;
    const a = pickCpuAction(s);
    if (!a) break;
    const next = applyAction(s, CPU, a);
    if (JSON.stringify(next) === JSON.stringify(s)) break;
    s = next;
    if (a.type === "endTurn" || a.type === "passCounter" || a.type === "block" || a.type === "triggerYes" || a.type === "triggerNo") break;
  }
  return s;
}
