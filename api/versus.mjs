import { randomBytes } from "node:crypto";
import { getSql } from "./_lib/db.mjs";
import { getSessionUser } from "./_lib/require-admin.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function roomId() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += abc[buf[i] % abc.length];
  return s;
}

function normPass(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
}

function iid(n) {
  return "c" + n;
}

function shuffle(arr, seed) {
  const out = arr.slice();
  let x = seed || Date.now();
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function expandDeck(deck, prefix) {
  const leader = deck?.leader || {};
  const life = Math.max(3, Math.min(8, Number(leader.life) || 5));
  const pile = [];
  let n = 1;
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  for (const c of cards) {
    if (!c || !c.id) continue;
    if (c.type === "Leader" || c.type === "DON!!") continue;
    pile.push({
      iid: prefix + iid(n++),
      id: c.id,
      name: c.name || c.id,
      type: c.type || "Character",
      cost: Number(c.cost) || 0,
      power: Number(c.power) || 0,
      counter: Number(c.counter) || 0,
      image: c.image || "",
      colors: Array.isArray(c.colors) ? c.colors : [],
      rush: /\[(?:Rush|Charge)\]/i.test(String(c.text || c.textEn || c.effect || "")),
      blocker: /\[(?:Blocker|Bloqueur)\]/i.test(String(c.text || c.textEn || c.effect || "")),
      rested: false,
      sick: false,
      don: 0,
    });
    if (pile.length >= 50) break;
  }
  return {
    leader: {
      id: leader.id || "ST01-001",
      name: leader.name || "Leader",
      life,
      power: Number(leader.power) || 5000,
      image: leader.image || "",
      colors: Array.isArray(leader.colors) ? leader.colors : [],
    },
    pile,
  };
}

function makePlayer(userId, name, deck, prefix, seed) {
  const built = expandDeck(deck, prefix);
  const pile = shuffle(built.pile, seed);
  const hand = pile.splice(0, 5);
  const life = [];
  const nLife = built.leader.life;
  for (let i = 0; i < nLife && pile.length; i++) life.push(pile.shift());
  return {
    id: userId,
    name: name || "Pirate",
    leader: Object.assign({}, built.leader, { rested: false, don: 0 }),
    life,
    hand,
    board: [],
    stage: null,
    deck: pile,
    trash: [],
    donDeck: 10,
    donActive: 0,
    donRested: 0,
  };
}

function publicCard(c, hide) {
  if (!c) return null;
  if (hide) return { iid: c.iid, back: true };
  return {
    iid: c.iid,
    id: c.id,
    name: c.name,
    type: c.type,
    cost: c.cost,
    power: c.power,
    image: c.image,
    colors: c.colors,
    rested: !!c.rested,
    sick: !!c.sick,
    don: Number(c.don) || 0,
    counter: Number(c.counter) || 0,
    rush: !!c.rush,
    blocker: !!c.blocker,
  };
}

function remainingShot(state) {
  if (!state || !state.shotAt) return null;
  const ms = Number(state.shotMs) || 90 * 1000;
  return Math.max(0, ms - (Date.now() - Number(state.shotAt)));
}

function remainingClock(state, side) {
  if (!state || !state.clocks) return 0;
  let ms = Number(state.clocks[side]) || 0;
  if (state.clockSide === side && state.clockAt) {
    ms = Math.max(0, ms - (Date.now() - Number(state.clockAt)));
  }
  return ms;
}

function hasWinner(state) {
  if (!state) return false;
  if (state.endedBy === "expired") return true;
  if (state.engine === "solo") return state.winner === 0 || state.winner === 1;
  return !!state.winner;
}

function winnerUserId(row, state) {
  if (!row) return null;
  const st = state || row.state;
  if (st && st.endedBy === "expired") return null;
  if (st && st.engine === "solo") {
    if (st.winner === 0) return st.hostId || row.host_id || null;
    if (st.winner === 1) return st.guestId || row.guest_id || null;
    return null;
  }
  if (st && st.winner && st[st.winner] && st[st.winner].id) return st[st.winner].id;
  return row.winner_id || null;
}

function settleShot(state) {
  if (!state || state.engine !== "solo" || hasWinner(state) || !state.shotAt) return false;
  if (state.bot && state.shotSide === "guest") {
    state.shotSide = "host";
    state.shotMs = 90 * 1000;
    state.shotAt = Date.now();
    if (state.clockSide === "guest") {
      state.clockSide = "host";
      state.clockAt = Date.now();
    }
    return true;
  }
  if (remainingShot(state) > 0) return false;
  const side = state.shotSide;
  if (side !== "host" && side !== "guest") return false;
  const pid = side === "host" ? 0 : 1;
  const seq = state.seq || [];
  const last = seq.length ? seq[seq.length - 1] : null;
  if (last && last.act && last.act.type === "endTurn" && (last.pid | 0) === pid) {
    state.shotSide = otherOf(side);
    state.shotMs = 90 * 1000;
    state.shotAt = Date.now();
    return false;
  }
  state.seq = seq;
  state.seqN = (state.seqN || 0) + 1;
  state.seq.push({ n: state.seqN, pid, act: { type: "endTurn", timeout: true } });
  const next = otherOf(side);
  state.shotSide = next;
  state.shotMs = 90 * 1000;
  state.shotAt = Date.now();
  if (state.clocks) {
    state.clockSide = next;
    state.clockAt = Date.now();
  }
  return true;
}

function settleClock(state) {
  if (!state || !state.clocks) return;
  const now = Date.now();
  if (state.clockSide && state.clockAt) {
    const side = state.clockSide;
    const elapsed = now - Number(state.clockAt);
    state.clocks[side] = Math.max(0, Number(state.clocks[side] || 0) - elapsed);
    if (state.clocks[side] <= 0 && !hasWinner(state)) {
      if (state.engine === "solo") {
        state.winner = side === "host" ? 1 : 0;
      } else {
        state.winner = otherOf(side);
      }
      state.clockSide = null;
      state.log = state.log || [];
      state.log.push((state[side] && state[side].name ? state[side].name : side) + " est à court de temps.");
    }
  }
  state.clockAt = now;
}

function startClock(state, side) {
  settleClock(state);
  if (hasWinner(state)) {
    state.clockSide = null;
    return;
  }
  state.clockSide = side;
  state.clockAt = Date.now();
}

function ensurePresence(state) {
  if (!state) return;
  if (!state.presence || typeof state.presence !== "object") state.presence = {};
  if (!state.awaySince || typeof state.awaySince !== "object") state.awaySince = {};
}

function sideIsAway(state, side, now) {
  if (!state || !side) return false;
  const ts = Number(state.presence && state.presence[side]) || 0;
  if (!ts) return false;
  return now - ts >= AWAY_AFTER;
}

function awayRemaining(state, side, now) {
  const since = Number(state.awaySince && state.awaySince[side]) || 0;
  if (!since) return FORFEIT_AFTER;
  return Math.max(0, FORFEIT_AFTER - (now - since));
}

function markHere(state, side, here, now) {
  if (!state || !side) return;
  now = now || Date.now();
  ensurePresence(state);
  if (here === false) {
    state.presence[side] = now - AWAY_AFTER - 50;
    if (!state.awaySince[side]) state.awaySince[side] = now;
  } else {
    state.presence[side] = now;
    state.awaySince[side] = null;
  }
}

function settlePresence(state, now) {
  now = now || Date.now();
  if (!state || state.engine !== "solo" || hasWinner(state)) return false;
  ensurePresence(state);
  if (state.bot) {
    state.presence.guest = now;
    state.awaySince.guest = null;
  }
  let changed = false;
  for (const side of ["host", "guest"]) {
    const away = sideIsAway(state, side, now);
    if (away) {
      if (!state.awaySince[side]) {
        state.awaySince[side] = now;
        changed = true;
      }
    } else if (state.awaySince[side]) {
      state.awaySince[side] = null;
      changed = true;
    }
  }
  const anyoneAway = sideIsAway(state, "host", now) || sideIsAway(state, "guest", now);
  if (anyoneAway) {
    if (state.clockSide) {
      settleClock(state);
      if (hasWinner(state)) return true;
      state.pausedClockSide = state.clockSide;
      state.clockSide = null;
      changed = true;
    }
  } else if (state.pausedClockSide) {
    state.clockSide = state.pausedClockSide;
    state.pausedClockSide = null;
    state.clockAt = now;
    changed = true;
  }
  const hostAfk = Number(state.awaySince.host) || 0;
  const guestAfk = Number(state.awaySince.guest) || 0;
  const hostOut = hostAfk && now - hostAfk >= FORFEIT_AFTER;
  const guestOut = guestAfk && now - guestAfk >= FORFEIT_AFTER;
  if (hostOut && guestOut) {
    state.winner = null;
    state.endedBy = "expired";
    state.clockSide = null;
    state.pausedClockSide = null;
    return true;
  }
  for (const side of ["host", "guest"]) {
    const since = Number(state.awaySince[side]) || 0;
    if (!since || now - since < FORFEIT_AFTER) continue;
    const pid = side === "host" ? 0 : 1;
    state.winner = pid ^ 1;
    state.clockSide = null;
    state.pausedClockSide = null;
    state.seq = state.seq || [];
    state.seqN = (state.seqN || 0) + 1;
    state.seq.push({ n: state.seqN, pid, act: { type: "concede" } });
    state.endedBy = "forfeit";
    return true;
  }
  return changed;
}

function viewFor(state, meId, row) {
  if (!state) return null;
  if (state.engine === "solo") {
    const pid = state.hostId === meId ? 0 : 1;
    const now = Date.now();
    return {
      engine: "solo",
      seed: state.seed,
      pid,
      seq: state.seq || [],
      winner: hasWinner(state) ? state.winner : null,
      clocks: {
        host: remainingClock(state, "host"),
        guest: remainingClock(state, "guest"),
      },
      clockSide: state.clockSide || null,
      shot: remainingShot(state),
      shotSide: state.shotSide || null,
      hostDeck: state.hostDeck || compactDeck(row && row.host_deck),
      guestDeck: state.guestDeck || compactDeck(row && row.guest_deck),
      hostName: state.hostName,
      guestName: state.guestName,
      endedBy: state.endedBy || null,
      bot: !!state.bot,
      away: {
        host: sideIsAway(state, "host", now),
        guest: sideIsAway(state, "guest", now),
      },
      awayFor: {
        host: awayRemaining(state, "host", now),
        guest: awayRemaining(state, "guest", now),
      },
    };
  }
  const hide = (p) => p.id !== meId;
  const mapP = (p) => ({
    id: p.id,
    name: p.name,
    leader: p.leader
      ? {
          id: p.leader.id,
          name: p.leader.name,
          life: p.leader.life,
          power: p.leader.power,
          image: p.leader.image,
          colors: p.leader.colors,
          rested: !!p.leader.rested,
          don: Number(p.leader.don) || 0,
          powerNow: powerOf(p.leader),
        }
      : null,
    life: (p.life || []).length,
    lifeMax: p.leader && p.leader.life ? p.leader.life : 5,
    donMax: (p.donActive || 0) + (p.donRested || 0) + (p.donDeck || 0),
    donActive: p.donActive || 0,
    donRested: p.donRested || 0,
    donDeck: p.donDeck || 0,
    donFree: p.donActive || 0,
    hand: (p.hand || []).map((c) => publicCard(c, hide(p))),
    handCount: (p.hand || []).length,
    board: (p.board || []).map((c) => publicCard(c, false)),
    stage: publicCard(p.stage, false),
    deckCount: (p.deck || []).length,
    trashCount: (p.trash || []).length,
    me: p.id === meId,
  });
  const pending = state.pendingAttack || null;
  const reactMs = state.phase === "react" && state.reactUntil
    ? Math.max(0, Number(state.reactUntil) - Date.now())
    : 0;
  return {
    turn: state.turn,
    phase: state.phase,
    winner: state.winner || null,
    canAttack: !!state.canAttack && state.phase === "main",
    log: (state.log || []).slice(-8),
    host: mapP(state.host),
    guest: mapP(state.guest),
    me: meId,
    clocks: {
      host: remainingClock(state, "host"),
      guest: remainingClock(state, "guest"),
    },
    clockSide: state.clockSide || null,
    react: pending && state.phase === "react"
      ? {
          remaining: reactMs,
          youDefend: !!(state[otherOf(state.turn)] && state[otherOf(state.turn)].id === meId),
          counter: pending.counter || 0,
          target: pending.target,
          atkName: pending.atkName || "Attaque",
          blocked: !!pending.blockedBy,
        }
      : null,
  };
}

function refreshPlayer(p) {
  for (const c of p.board || []) {
    if (c.don) {
      p.donRested += c.don;
      c.don = 0;
    }
    c.rested = false;
    c.sick = false;
  }
  if (p.stage && p.stage.don) {
    p.donRested += p.stage.don;
    p.stage.don = 0;
  }
  if (p.leader) {
    if (p.leader.don) {
      p.donRested += p.leader.don;
      p.leader.don = 0;
    }
    p.leader.rested = false;
  }
  p.donActive += p.donRested;
  p.donRested = 0;
}

function startTurn(state, who) {
  const p = state[who];
  refreshPlayer(p);
  const extra = who === "guest" && state.firstTurn ? 2 : 1;
  if (who === "guest") state.firstTurn = false;
  const gain = Math.min(extra, p.donDeck);
  p.donDeck -= gain;
  p.donActive += gain;
  if (!p.deck.length) {
    state.winner = otherOf(who);
    state.clockSide = null;
    state.phase = "main";
    state.log.push(p.name + " n'a plus de cartes à piocher.");
    return;
  }
  p.hand.push(p.deck.shift());
  if (p.hand.length > 8) {
    const extraCard = p.hand.pop();
    p.trash.push(extraCard);
    state.log.push(p.name + " défausse (limite 8).");
  }
  state.turn = who;
  state.phase = "main";
  state.pendingAttack = null;
  state.reactUntil = 0;
  state.canAttack = !(who === "host" && state.hostFirstLock);
  if (who === "host") state.hostFirstLock = false;
  state.log.push(p.name + " — Refresh · Pioche · +" + gain + " DON!!");
  startClock(state, who);
}

function compactDeck(d) {
  if (!d) return null;
  const cards = {};
  if (d.leaderId && d.cards && !Array.isArray(d.cards) && typeof d.cards === "object") {
    for (const k of Object.keys(d.cards)) {
      const n = Number(d.cards[k]) || 0;
      if (n > 0) cards[k] = n;
    }
  } else {
    const list = Array.isArray(d.cards) ? d.cards : [];
    for (const c of list) {
      if (!c || !c.id) continue;
      cards[c.id] = (cards[c.id] || 0) + 1;
    }
  }
  const leaderId = (d.leader && d.leader.id) || d.leaderId || "";
  if (!leaderId) return null;
  const sorted = {};
  for (const k of Object.keys(cards).sort()) sorted[k] = cards[k];
  return { leaderId, cards: sorted, name: d.name || "" };
}

const BOT_NAMES = [
  "Capitaine Brume",
  "Jack la Cale",
  "Mousse Silex",
  "Sel le Borgne",
  "Loup des Récifs",
  "Nix le Muet",
  "Ivy Cargaison",
  "Rook le Faux",
  "Basile des Calmes",
  "Tom le Gréement",
  "Mila la Vigie",
  "Otto le Fanal",
  "Pio la Dérive",
  "Hugo Baraterie",
  "Cendre du Port",
  "Nera la Houle",
];

function botName(id) {
  let h = 2166136261;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return BOT_NAMES[(h >>> 0) % BOT_NAMES.length];
}

function beginMatch(room) {
  const CLOCK = 20 * 60 * 1000;
  return {
    engine: "solo",
    seed: String(room.id),
    seq: [],
    seqN: 0,
    hostId: room.host_id,
    guestId: room.guest_id,
    hostName: room.host_name,
    guestName: room.guest_name,
    hostDeck: compactDeck(room.host_deck),
    guestDeck: compactDeck(room.guest_deck),
    winner: null,
    clocks: { host: CLOCK, guest: CLOCK },
    clockSide: null,
    clockAt: Date.now(),
    shotMs: 90 * 1000,
    shotAt: null,
    shotSide: null,
    presence: { host: Date.now(), guest: Date.now() },
    awaySince: { host: null, guest: null },
  };
}

function otherOf(side) {
  return side === "host" ? "guest" : "host";
}

function sideOf(state, userId) {
  if (!state) return null;
  if (state.engine === "solo") {
    if (state.hostId === userId) return "host";
    if (state.guestId === userId) return "guest";
    return null;
  }
  if (state.host && state.host.id === userId) return "host";
  if (state.guest && state.guest.id === userId) return "guest";
  return null;
}

function findCard(list, iid) {
  return (list || []).find((c) => c.iid === iid) || null;
}

function powerOf(c) {
  return (Number(c.power) || 0) + (Number(c.don) || 0) * 1000;
}

function returnDon(owner, card) {
  if (!card || !card.don) return;
  owner.donRested += card.don;
  card.don = 0;
}

function hasReadyBlocker(p) {
  return (p.board || []).some((c) => c.blocker && !c.rested);
}

const REACT_MS = 15000;
const AWAY_AFTER = 12 * 1000;
const FORFEIT_AFTER = 30 * 1000;

function resolveAttack(state) {
  const p = state.pendingAttack;
  state.pendingAttack = null;
  state.phase = "main";
  state.reactUntil = 0;
  if (!p || state.winner) return;
  const me = state[p.side];
  const opp = state[otherOf(p.side)];
  if (!me || !opp) return;
  const atk = p.atkIsLeader ? me.leader : findCard(me.board, p.iid);
  if (!atk) {
    state.log.push("L'attaquant n'est plus en jeu.");
    return;
  }
  const atkP = powerOf(atk);
  if (p.target === "leader") {
    const defP = powerOf(opp.leader) + (Number(p.counter) || 0);
    state.log.push((p.atkName || atk.name) + " (" + atkP + ") vs Leader (" + defP + ")");
    if (atkP < defP) {
      state.log.push("L'attaque échoue.");
      return;
    }
    if (!opp.life.length) {
      state.winner = p.side;
      state.clockSide = null;
      state.log.push(me.name + " remporte le duel !");
      return;
    }
    const taken = opp.life.shift();
    opp.hand.push(taken);
    state.log.push("Dégât — " + opp.name + " : " + opp.life.length + " vies.");
    if (!opp.life.length) {
      state.winner = p.side;
      state.clockSide = null;
      state.log.push(me.name + " remporte le duel !");
    }
    return;
  }
  const def = findCard(opp.board, p.target);
  if (!def) {
    state.log.push("La cible n'est plus en jeu.");
    return;
  }
  const defP = powerOf(def) + (Number(p.counter) || 0);
  state.log.push((p.atkName || atk.name) + " (" + atkP + ") vs " + def.name + " (" + defP + ")");
  if (atkP >= defP) {
    returnDon(opp, def);
    opp.board = opp.board.filter((c) => c.iid !== def.iid);
    opp.trash.push(def);
    state.log.push(def.name + " est K.O.");
  } else {
    state.log.push(def.name + " résiste.");
  }
}

function settleIdle(state) {
  if (!state) return false;
  if (state.engine === "solo") {
    if (hasWinner(state)) return false;
    settleClock(state);
    settlePresence(state);
    const shot = settleShot(state);
    return hasWinner(state) || shot;
  }
  if (hasWinner(state)) return false;
  const hadWinner = hasWinner(state);
  const phase0 = state.phase;
  settleClock(state);
  if (hasWinner(state) && !hadWinner) return true;
  if (state.phase === "react" && state.reactUntil && Date.now() >= Number(state.reactUntil)) {
    state.log.push("Temps de réaction écoulé.");
    resolveAttack(state);
    return true;
  }
  return state.phase !== phase0;
}

function applySoloRelay(state, userId, move) {
  const side = sideOf(state, userId);
  if (!side) return { error: "Tu n'es pas dans ce duel." };
  const pid = side === "host" ? 0 : 1;
  const type = move?.type;
  if (type === "concede") {
    if (!hasWinner(state)) {
      state.winner = pid ^ 1;
      state.clockSide = null;
      state.endedBy = "concede";
      state.seq = state.seq || [];
      state.seq.push({ n: ++state.seqN, pid, act: { type: "concede" } });
    }
    return { ok: true };
  }
  if (type === "result") {
    if (!state.bot) return { error: "Action inconnue." };
    const w = move.winner;
    if (w !== 0 && w !== 1) return { error: "Résultat invalide." };
    if (!hasWinner(state)) {
      state.winner = w;
      state.clockSide = null;
      state.endedBy = "result";
      state.seq = state.seq || [];
      state.seqN = (state.seqN || 0) + 1;
      state.seq.push({ n: state.seqN, pid, act: { type: "vsOver", winner: w } });
    }
    return { ok: true };
  }
  settleClock(state);
  settlePresence(state);
  if (hasWinner(state)) return { ok: true };
  const act = move.act || (type === "act" ? move.action : move);
  if (!act || typeof act !== "object") return { error: "Action inconnue." };
  if (act.type === "kickoff") {
    if (!state.kickoff) {
      state.kickoff = true;
      const firstSide = act.first === 1 ? "guest" : "host";
      state.clockSide = firstSide;
      state.clockAt = Date.now();
      state.shotSide = firstSide;
      state.shotMs = 90 * 1000;
      state.shotAt = Date.now();
    }
    return { ok: true };
  }
  state.seq = state.seq || [];
  state.seqN = (state.seqN || 0) + 1;
  state.seq.push({ n: state.seqN, pid, act });
  if (act.type === "endTurn") {
    const next = otherOf(side);
    state.shotSide = next;
    state.shotMs = 90 * 1000;
    state.shotAt = Date.now();
    if (move.clockSide === "host" || move.clockSide === "guest") {
      state.clockSide = move.clockSide;
    } else {
      state.clockSide = next;
    }
    state.clockAt = Date.now();
  } else if (act.type === "mulligan" || act.type === "vsMull" || act.type === "coinResult") {
    state.clockSide = null;
    state.clockAt = Date.now();
    state.shotAt = null;
    state.shotSide = null;
  } else if (move.clockSide === "host" || move.clockSide === "guest") {
    if (!state.shotAt) {
      state.shotSide = move.clockSide;
      state.shotMs = 90 * 1000;
      state.shotAt = Date.now();
    }
    state.clockSide = move.clockSide;
    state.clockAt = Date.now();
  } else if (move.clockSide === null) {
    state.clockSide = null;
    state.clockAt = Date.now();
  }
  if (act.type === "concede") {
    state.winner = pid ^ 1;
    state.clockSide = null;
    state.endedBy = state.endedBy || "concede";
  }
  return { ok: true };
}

function applyMove(state, userId, move) {
  if (state && state.engine === "solo") return applySoloRelay(state, userId, move);
  if (!state || hasWinner(state)) return { error: "Le duel est terminé." };
  settleIdle(state);
  if (hasWinner(state)) return { ok: true };
  const side = sideOf(state, userId);
  if (!side) return { error: "Tu n'es pas dans ce duel." };
  const type = move?.type;
  if (type === "concede") {
    state.winner = otherOf(side);
    state.clockSide = null;
    state.pendingAttack = null;
    state.phase = "main";
    state.log.push(state[side].name + " abandonne.");
    return { ok: true };
  }

  const me = state[side];
  const opp = state[otherOf(side)];
  const defending = state.phase === "react" && state.turn !== side;

  if (type === "block") {
    if (!defending) return { error: "Pas de fenêtre de réaction." };
    if (state.pendingAttack && state.pendingAttack.blockedBy) {
      return { error: "Un bloqueur est déjà posé." };
    }
    const blk = findCard(me.board, move.iid);
    if (!blk) return { error: "Bloqueur introuvable." };
    if (!blk.blocker) return { error: "Cette carte n'a pas [Bloqueur]." };
    if (blk.rested) return { error: "Ce personnage est reposé." };
    blk.rested = true;
    state.pendingAttack.target = blk.iid;
    state.pendingAttack.blockedBy = blk.iid;
    state.log.push(me.name + " bloque avec " + blk.name + ".");
    return { ok: true };
  }

  if (type === "counter") {
    if (!defending) return { error: "Pas de fenêtre de réaction." };
    const card = findCard(me.hand, move.iid);
    if (!card) return { error: "Carte introuvable." };
    const ctr = Number(card.counter) || 0;
    if (ctr <= 0) return { error: "Cette carte n'a pas de Contre." };
    me.hand = me.hand.filter((c) => c.iid !== card.iid);
    me.trash.push(card);
    state.pendingAttack.counter = (state.pendingAttack.counter || 0) + ctr;
    state.log.push(me.name + " contre +" + ctr + " (" + card.name + ").");
    return { ok: true };
  }

  if (type === "react-pass") {
    if (!defending) return { error: "Pas de fenêtre de réaction." };
    resolveAttack(state);
    return { ok: true };
  }

  if (state.turn !== side) return { error: "Ce n'est pas ton tour." };
  if (state.phase === "react") return { error: "En attente de la réaction adverse." };

  if (type === "play") {
    const card = findCard(me.hand, move.iid);
    if (!card) return { error: "Carte introuvable." };
    if (card.type === "Event") {
      if (card.cost > me.donActive) return { error: "Pas assez de DON!! actifs (" + card.cost + ")." };
      me.donActive -= card.cost;
      me.donRested += card.cost;
      me.hand = me.hand.filter((c) => c.iid !== card.iid);
      me.trash.push(card);
      state.log.push(me.name + " joue l'événement " + card.name + ".");
      return { ok: true };
    }
    if (card.type === "Stage") {
      if (card.cost > me.donActive) return { error: "Pas assez de DON!! actifs (" + card.cost + ")." };
      me.donActive -= card.cost;
      me.donRested += card.cost;
      me.hand = me.hand.filter((c) => c.iid !== card.iid);
      if (me.stage) me.trash.push(me.stage);
      card.sick = false;
      card.rested = false;
      card.don = 0;
      me.stage = card;
      state.log.push(me.name + " pose la scène " + card.name + ".");
      return { ok: true };
    }
    if (card.type !== "Character") return { error: "Tu ne peux jouer que personnages, scènes ou événements." };
    if (me.board.length >= 5) return { error: "Terrain plein (5)." };
    if (card.cost > me.donActive) return { error: "Pas assez de DON!! actifs (" + card.cost + ")." };
    me.donActive -= card.cost;
    me.donRested += card.cost;
    me.hand = me.hand.filter((c) => c.iid !== card.iid);
    card.sick = !card.rush;
    card.rested = false;
    card.don = 0;
    me.board.push(card);
    state.log.push(me.name + " invoque " + card.name + (card.rush ? " [Rush]" : "") + ".");
    return { ok: true };
  }

  if (type === "attach") {
    if (me.donActive < 1) return { error: "Aucun DON!! actif." };
    if (move.iid === "leader" || (me.leader && move.iid === me.leader.id)) {
      me.donActive -= 1;
      me.leader.don = (me.leader.don || 0) + 1;
      state.log.push(me.name + " attache 1 DON!! au Leader.");
      return { ok: true };
    }
    const card = findCard(me.board, move.iid) || (me.stage && me.stage.iid === move.iid ? me.stage : null);
    if (!card) return { error: "Cible introuvable." };
    me.donActive -= 1;
    card.don = (card.don || 0) + 1;
    state.log.push(me.name + " attache 1 DON!! à " + card.name + ".");
    return { ok: true };
  }

  if (type === "attack") {
    if (!state.canAttack) return { error: "Pas d’attaque au premier tour." };
    const atkIsLeader = move.iid === "leader" || (me.leader && move.iid === me.leader.id);
    const atk = atkIsLeader ? me.leader : findCard(me.board, move.iid);
    if (!atk) return { error: "Attaquant introuvable." };
    if (atk.rested) return { error: "Déjà reposé." };
    if (!atkIsLeader && atk.sick) return { error: "Invocable ce tour : il ne peut pas attaquer (sauf [Rush])." };
    let target = move.target;
    if (target !== "leader") {
      const def = findCard(opp.board, target);
      if (!def) return { error: "Cible introuvable." };
    }
    atk.rested = true;
    state.pendingAttack = {
      side,
      iid: atkIsLeader ? "leader" : atk.iid,
      atkIsLeader,
      atkName: atk.name,
      target,
      counter: 0,
      blockedBy: null,
    };
    const tgtName = target === "leader" ? "le Leader" : ((findCard(opp.board, target) || {}).name || "un perso");
    state.log.push(me.name + " attaque " + tgtName + " avec " + atk.name + " (" + powerOf(atk) + ").");
    const canReact = hasReadyBlocker(opp) || (opp.hand || []).some((c) => Number(c.counter) > 0);
    if (canReact) {
      state.phase = "react";
      state.reactUntil = Date.now() + REACT_MS;
      state.log.push(opp.name + " a 15s pour bloquer ou contrer.");
      return { ok: true };
    }
    resolveAttack(state);
    return { ok: true };
  }

  if (type === "end") {
    startTurn(state, otherOf(side));
    return { ok: true };
  }

  return { error: "Action inconnue." };
}

function publicRoom(row, meId) {
  const state = row.state || null;
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    password: row.password || null,
    host: { id: row.host_id, name: row.host_name },
    guest: row.guest_id ? { id: row.guest_id, name: row.guest_name } : null,
    winner: row.winner_id || winnerUserId(row, state) || null,
    version: row.version,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    bot: !!(state && state.bot),
    you: meId === row.host_id ? "host" : meId === row.guest_id ? "guest" : null,
    view: state ? viewFor(state, meId, row) : null,
  };
}

async function loadRoom(sql, id) {
  const rows = await sql.query("select * from versus_rooms where id = $1", [id]);
  return rows[0] || null;
}

function parseState(row) {
  if (!row) return null;
  let st = row.state;
  if (typeof st === "string") {
    try { st = JSON.parse(st); } catch { st = null; }
  }
  row.state = st;
  if (typeof row.host_deck === "string") {
    try { row.host_deck = JSON.parse(row.host_deck); } catch {}
  }
  if (typeof row.guest_deck === "string") {
    try { row.guest_deck = JSON.parse(row.guest_deck); } catch {}
  }
  return row;
}

async function saveState(sql, row, extra) {
  extra = extra || {};
  const status = extra.status || row.status;
  const winner = extra.winner_id || row.winner_id || null;
  await sql.query(
    `update versus_rooms
        set state = $2::jsonb, status = $3, winner_id = $4, version = version + 1, updated_at = now()
      where id = $1`,
    [row.id, JSON.stringify(row.state || null), status, winner],
  );
}

async function touchState(sql, row) {
  await sql.query(
    `update versus_rooms set state = $2::jsonb, updated_at = now() where id = $1`,
    [row.id, JSON.stringify(row.state || null)],
  );
}

async function bumpWins(sql, winnerId, loserId) {
  try {
    if (winnerId) await sql.query("update profiles set wins = coalesce(wins,0) + 1, updated_at = now() where user_id = $1", [winnerId]);
    if (loserId) await sql.query("update profiles set losses = coalesce(losses,0) + 1, updated_at = now() where user_id = $1", [loserId]);
  } catch {}
}

async function closeIfWon(sql, row) {
  if (!row || !row.state || !hasWinner(row.state)) return false;
  const winnerId = winnerUserId(row, row.state);
  if (row.state.endedBy === "expired" || !winnerId) {
    await saveState(sql, row, { status: "done", winner_id: null });
    return true;
  }
  const loserId = winnerId === row.host_id ? row.guest_id : row.host_id;
  await bumpWins(sql, winnerId, loserId);
  await saveState(sql, row, { status: "done", winner_id: winnerId });
  return true;
}

/** Apply clocks + 30s forfeit BEFORE marking the requester present, so a
 *  late reconnect cannot resurrect a duel that already timed out. */
async function settlePlayRoom(sql, row, opts = {}) {
  if (!row || row.status !== "play" || !row.state) return row;
  const now = opts.now || Date.now();
  const changed = settleIdle(row.state);
  if (await closeIfWon(sql, row)) {
    return parseState(await loadRoom(sql, row.id)) || row;
  }
  if (opts.markHere && opts.userId) {
    const side = sideOf(row.state, opts.userId);
    if (side) markHere(row.state, side, opts.here !== false, now);
    settlePresence(row.state, now);
    if (await closeIfWon(sql, row)) {
      return parseState(await loadRoom(sql, row.id)) || row;
    }
    await touchState(sql, row);
  } else if (changed) {
    await touchState(sql, row);
  }
  return row;
}

export default async function handler(req, res) {
  const user = await getSessionUser(req);
  if (!user) return json(res, 401, { error: "auth", message: "Connecte-toi pour un match privé." });
  const sql = await getSql();
  const url = new URL(req.url || "/", "http://local");
  const id = (url.searchParams.get("id") || "").toUpperCase();

  if (req.method === "GET") {
    if (url.searchParams.get("mine") === "1") {
      const rows = await sql.query(
        `select * from versus_rooms
          where status = 'play' and (host_id = $1 or guest_id = $1)
          order by updated_at desc limit 1`,
        [user.id],
      );
      let row = parseState(rows[0] || null);
      if (row) row = await settlePlayRoom(sql, row);
      if (!row || row.status !== "play" || !row.state || hasWinner(row.state)) {
        return json(res, 200, { ok: true, room: row && row.status === "done" ? publicRoom(row, user.id) : null });
      }
      return json(res, 200, { ok: true, room: publicRoom(row, user.id) });
    }
    if (!id) return json(res, 400, { error: "id" });
    let row = parseState(await loadRoom(sql, id));
    if (!row) return json(res, 404, { error: "not_found", message: "Salon introuvable." });
    if (row.host_id !== user.id && row.guest_id !== user.id) {
      return json(res, 403, { error: "forbidden", message: "Ce salon n'est pas à toi." });
    }
    if (row.status === "play" && row.state) {
      row = await settlePlayRoom(sql, row);
    }
    return json(res, 200, publicRoom(row, user.id));
  }

  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const body = await readJsonBody(req);
  const action = body.action;

  if (action === "open") {
    const mode = body.mode === "qr" ? "qr" : "password";
    const password = mode === "password" ? normPass(body.password) : null;
    if (mode === "password" && password.length < 2) {
      return json(res, 400, { error: "password", message: "Mot de passe : 2 à 10 caractères." });
    }
    const deck = body.deck;
    if (!deck || !deck.leader) return json(res, 400, { error: "deck", message: "Choisis un deck." });

    if (password) {
      const existing = parseState((
        await sql.query(
          `select * from versus_rooms
            where password = $1 and status = 'wait' and created_at > now() - interval '30 minutes'
            order by created_at asc limit 1`,
          [password],
        )
      )[0]);
      if (existing && existing.host_id !== user.id) {
        existing.guest_id = user.id;
        existing.guest_name = user.name || "Pirate";
        existing.guest_deck = deck;
        if (!compactDeck(existing.host_deck) || !compactDeck(existing.guest_deck)) {
          return json(res, 400, { error: "deck", message: "Impossible de lire un des decks." });
        }
        existing.state = beginMatch(existing);
        existing.status = "play";
        await sql.query(
          `update versus_rooms
              set guest_id = $2, guest_name = $3, guest_deck = $4::jsonb,
                  state = $5::jsonb, status = 'play', version = version + 1, updated_at = now()
            where id = $1 and status = 'wait'`,
          [existing.id, user.id, existing.guest_name, JSON.stringify(deck), JSON.stringify(existing.state)],
        );
        const fresh = parseState(await loadRoom(sql, existing.id));
        return json(res, 200, publicRoom(fresh, user.id));
      }
      if (existing && existing.host_id === user.id) {
        return json(res, 200, publicRoom(existing, user.id));
      }
    }

    let idNew = roomId();
    for (let i = 0; i < 6; i++) {
      try {
        await sql.query(
          `insert into versus_rooms (id, password, mode, status, host_id, host_name, host_deck)
           values ($1,$2,$3,'wait',$4,$5,$6::jsonb)`,
          [idNew, password, mode, user.id, user.name || "Pirate", JSON.stringify(deck)],
        );
        break;
      } catch (e) {
        idNew = roomId();
        if (i === 5) throw e;
      }
    }
    const row = parseState(await loadRoom(sql, idNew));
    return json(res, 200, publicRoom(row, user.id));
  }

  if (action === "join") {
    const password = normPass(body.password);
    const joinId = String(body.id || "").toUpperCase();
    const deck = body.deck;
    if (!deck || !deck.leader) return json(res, 400, { error: "deck", message: "Choisis un deck." });
    let row = null;
    if (joinId) row = parseState(await loadRoom(sql, joinId));
    else if (password) {
      row = parseState((
        await sql.query(
          `select * from versus_rooms
            where password = $1 and status = 'wait' and created_at > now() - interval '30 minutes'
            order by created_at asc limit 1`,
          [password],
        )
      )[0]);
    }
    if (!row) return json(res, 404, { error: "not_found", message: "Aucun salon en attente avec ce code." });
    if (row.host_id === user.id) return json(res, 200, publicRoom(row, user.id));
    if (row.status !== "wait") return json(res, 409, { error: "busy", message: "Ce salon a déjà commencé." });
    row.guest_id = user.id;
    row.guest_name = user.name || "Pirate";
    row.guest_deck = deck;
    if (!compactDeck(row.host_deck) || !compactDeck(row.guest_deck)) {
      return json(res, 400, { error: "deck", message: "Impossible de lire un des decks." });
    }
    row.state = beginMatch(row);
    row.status = "play";
    const upd = await sql.query(
      `update versus_rooms
          set guest_id = $2, guest_name = $3, guest_deck = $4::jsonb,
              state = $5::jsonb, status = 'play', version = version + 1, updated_at = now()
        where id = $1 and status = 'wait'
        returning id`,
      [row.id, user.id, row.guest_name, JSON.stringify(deck), JSON.stringify(row.state)],
    );
    if (!upd[0]) return json(res, 409, { error: "busy", message: "Quelqu'un a rejoint juste avant." });
    const fresh = parseState(await loadRoom(sql, row.id));
    return json(res, 200, publicRoom(fresh, user.id));
  }

  if (action === "here") {
    const rid = String(body.id || id || "").toUpperCase();
    let row = parseState(await loadRoom(sql, rid));
    if (!row) return json(res, 404, { error: "not_found" });
    if (row.host_id !== user.id && row.guest_id !== user.id) return json(res, 403, { error: "forbidden" });
    if (row.status !== "play" || !row.state || hasWinner(row.state)) {
      return json(res, 200, { ok: true, room: publicRoom(row, user.id) });
    }
    row = await settlePlayRoom(sql, row, {
      markHere: true,
      userId: user.id,
      here: body.here !== false,
    });
    return json(res, 200, publicRoom(row, user.id));
  }

  if (action === "active") {
    const rows = await sql.query(
      `select * from versus_rooms
        where status = 'play' and (host_id = $1 or guest_id = $1)
        order by updated_at desc limit 1`,
      [user.id],
    );
    let row = parseState(rows[0] || null);
    if (row) row = await settlePlayRoom(sql, row);
    if (!row || !row.state) {
      return json(res, 200, { ok: true, room: null });
    }
    return json(res, 200, { ok: true, room: publicRoom(row, user.id) });
  }

  if (action === "cancel") {
    const rid = String(body.id || id || "").toUpperCase();
    let row = parseState(await loadRoom(sql, rid));
    if (!row) return json(res, 404, { error: "not_found" });
    if (row.host_id !== user.id && row.guest_id !== user.id) return json(res, 403, { error: "forbidden" });
    if (row.status === "wait" && row.host_id === user.id) {
      await sql.query("delete from versus_rooms where id = $1 and status = 'wait'", [rid]);
      return json(res, 200, { ok: true, cancelled: true, room: null });
    }
    if (row.status === "play" && row.state && !hasWinner(row.state)) {
      const move = applyMove(row.state, user.id, { type: "concede" });
      if (!move.error) {
        await closeIfWon(sql, row);
        row = parseState(await loadRoom(sql, rid)) || row;
      }
    }
    return json(res, 200, { ok: true, room: publicRoom(row, user.id) });
  }

  if (action === "move") {
    const rid = String(body.id || id || "").toUpperCase();
    const row = parseState(await loadRoom(sql, rid));
    if (!row) return json(res, 404, { error: "not_found" });
    if (row.status !== "play" || !row.state) return json(res, 409, { error: "not_play" });
    const result = applyMove(row.state, user.id, body.move || {});
    if (result.error) return json(res, 400, { error: "move", message: result.error });
    let status = "play";
    let winnerId = null;
    if (hasWinner(row.state)) {
      status = "done";
      winnerId = winnerUserId(row, row.state);
      const loserId = winnerId === row.host_id ? row.guest_id : row.host_id;
      await bumpWins(sql, winnerId, loserId);
    }
    await saveState(sql, row, { status, winner_id: winnerId });
    const fresh = parseState(await loadRoom(sql, rid));
    return json(res, 200, publicRoom(fresh, user.id));
  }

  if (action === "queue") {
    const deck = body.deck;
    if (!deck || !deck.leader) return json(res, 400, { error: "deck", message: "Choisis un deck." });
    const active = parseState((
      await sql.query(
        `select * from versus_rooms
          where status = 'play' and mode = 'road' and (host_id = $1 or guest_id = $1)
          order by updated_at desc limit 1`,
        [user.id],
      )
    )[0]);
    if (active && active.state && !hasWinner(active.state)) {
      return json(res, 200, publicRoom(active, user.id));
    }
    const other = parseState((
      await sql.query(
        `select * from versus_rooms
          where mode = 'road' and status = 'wait' and host_id <> $1
            and created_at > now() - interval '10 minutes'
          order by created_at asc limit 1`,
        [user.id],
      )
    )[0]);
    if (other) {
      await sql.query(
        "delete from versus_rooms where host_id = $1 and status = 'wait' and mode = 'road'",
        [user.id],
      );
      other.guest_id = user.id;
      other.guest_name = user.name || "Pirate";
      other.guest_deck = deck;
      if (!compactDeck(other.host_deck) || !compactDeck(deck)) {
        return json(res, 400, { error: "deck", message: "Impossible de lire un des decks." });
      }
      other.state = beginMatch(other);
      const upd = await sql.query(
        `update versus_rooms
            set guest_id = $2, guest_name = $3, guest_deck = $4::jsonb,
                state = $5::jsonb, status = 'play', version = version + 1, updated_at = now()
          where id = $1 and status = 'wait'
          returning id`,
        [other.id, user.id, other.guest_name, JSON.stringify(deck), JSON.stringify(other.state)],
      );
      if (upd[0]) {
        const fresh = parseState(await loadRoom(sql, other.id));
        return json(res, 200, publicRoom(fresh, user.id));
      }
    }
    const mine = parseState((
      await sql.query(
        `select * from versus_rooms
          where host_id = $1 and status = 'wait' and mode = 'road'
          order by created_at desc limit 1`,
        [user.id],
      )
    )[0]);
    if (mine) return json(res, 200, publicRoom(mine, user.id));
    let idNew = roomId();
    for (let i = 0; i < 6; i++) {
      try {
        await sql.query(
          `insert into versus_rooms (id, password, mode, status, host_id, host_name, host_deck)
           values ($1, null, 'road', 'wait', $2, $3, $4::jsonb)`,
          [idNew, user.id, user.name || "Pirate", JSON.stringify(deck)],
        );
        break;
      } catch (e) {
        idNew = roomId();
        if (i === 5) throw e;
      }
    }
    const created = parseState(await loadRoom(sql, idNew));
    return json(res, 200, publicRoom(created, user.id));
  }

  if (action === "bot") {
    const rid = String(body.id || id || "").toUpperCase().slice(0, 16);
    if (!rid) return json(res, 400, { error: "id" });
    const row = parseState(await loadRoom(sql, rid));
    if (!row) return json(res, 404, { error: "not_found", message: "Salon introuvable." });
    if (row.host_id !== user.id) return json(res, 403, { error: "forbidden" });
    if (row.mode !== "road") return json(res, 409, { error: "mode" });
    if (row.status === "play" && row.guest_id) {
      return json(res, 200, publicRoom(row, user.id));
    }
    if (row.status !== "wait" || row.guest_id) {
      return json(res, 409, { error: "busy", message: "Ce duel n'attend plus." });
    }
    const deck = row.host_deck;
    if (!compactDeck(deck)) return json(res, 400, { error: "deck", message: "Impossible de lire le deck." });
    const name = botName(row.id);
    const guestId = "bot-" + row.id;
    const guestDeck = JSON.parse(JSON.stringify(deck));
    row.guest_id = guestId;
    row.guest_name = name;
    row.guest_deck = guestDeck;
    const state = beginMatch(row);
    state.bot = true;
    const upd = await sql.query(
      `update versus_rooms
          set guest_id = $2, guest_name = $3, guest_deck = $4::jsonb,
              state = $5::jsonb, status = 'play', version = version + 1, updated_at = now()
        where id = $1 and status = 'wait' and guest_id is null and host_id = $6
          and created_at <= now() - interval '45 seconds'
        returning id`,
      [row.id, guestId, name, JSON.stringify(guestDeck), JSON.stringify(state), user.id],
    );
    if (!upd[0]) {
      const fresh = parseState(await loadRoom(sql, rid));
      if (fresh && fresh.host_id === user.id && fresh.status === "play") {
        return json(res, 200, publicRoom(fresh, user.id));
      }
      return json(res, 409, { error: "early", message: "Encore un instant." });
    }
    const fresh = parseState(await loadRoom(sql, rid));
    return json(res, 200, publicRoom(fresh, user.id));
  }

  return json(res, 400, { error: "action" });
}

export { applyMove, beginMatch, settleIdle, settlePresence, remainingClock, viewFor, compactDeck, hasWinner, winnerUserId, sideIsAway, markHere, AWAY_AFTER, FORFEIT_AFTER, botName };
