import { getSql } from "./_lib/db.mjs";
import { getSessionUser } from "./_lib/require-admin.mjs";
import { normalizeRoad } from "./_lib/road.mjs";

const MAX_BYTES = 1_500_000;
const TCG_KEYS = [
  "berries",
  "collection",
  "decks",
  "activeDeckId",
  "packs",
  "wins",
  "losses",
  "opened",
  "lastFreePack",
  "granted",
  "seenRules",
  "ownedCosmetics",
  "equip",
  "pity",
  "bp",
  "bpStock",
  "bpAt",
  "bpDay",
  "bpMade",
  "ladderWins",
  "dailyMissions",
];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) return { __tooBig: true };
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function asInt(v, lo, hi, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function asMapCounts(raw, maxKeys, maxVal) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= maxKeys) break;
    const id = String(k).slice(0, 40);
    if (!id) continue;
    out[id] = asInt(v, 0, maxVal, 0);
    n += 1;
  }
  return out;
}

function asStringArray(raw, max, len) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw) {
    if (out.length >= max) break;
    const s = String(x || "").slice(0, len);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function sanitizeDeck(d) {
  if (!d || typeof d !== "object") return null;
  const id = String(d.id || "").slice(0, 64);
  if (!id) return null;
  const cards =
    d.cards && typeof d.cards === "object" && !Array.isArray(d.cards)
      ? asMapCounts(d.cards, 80, 50)
      : {};
  return {
    id,
    name: String(d.name || "").slice(0, 48),
    leaderId: String(d.leaderId || "").slice(0, 40),
    cards,
    locked: !!d.locked,
    starterId: d.starterId ? String(d.starterId).slice(0, 16) : undefined,
  };
}

function sanitizeTcg(raw) {
  const wrap = raw && typeof raw === "object" ? raw : {};
  const st = wrap.state && typeof wrap.state === "object" ? wrap.state : wrap;
  const state = {};
  state.berries = asInt(st.berries, 0, 99_999_999, 0);
  state.collection = asMapCounts(st.collection, 8000, 99);
  state.packs = asMapCounts(st.packs, 80, 999);
  state.pity = asMapCounts(st.pity, 80, 9999);
  state.wins = asInt(st.wins, 0, 1_000_000, 0);
  state.losses = asInt(st.losses, 0, 1_000_000, 0);
  state.opened = asInt(st.opened, 0, 1_000_000, 0);
  state.bp = asInt(st.bp, 0, 9999, 0);
  state.bpStock = asInt(st.bpStock, 0, 5, 0);
  state.bpAt = asInt(st.bpAt, 0, Number.MAX_SAFE_INTEGER, 0);
  state.bpDay = String(st.bpDay || "").slice(0, 16);
  state.bpMade = asInt(st.bpMade, 0, 99, 0);
  state.lastFreePack = String(st.lastFreePack || "").slice(0, 16);
  state.granted = !!st.granted;
  state.seenRules = !!st.seenRules;
  state.activeDeckId = String(st.activeDeckId || "").slice(0, 64);
  state.ownedCosmetics = asStringArray(st.ownedCosmetics, 80, 40);
  const eq = st.equip && typeof st.equip === "object" ? st.equip : {};
  state.equip = {
    back: String(eq.back || "grandline").slice(0, 40),
    don: String(eq.don || "official").slice(0, 40),
    mat: String(eq.mat || "felt").slice(0, 40),
  };
  const decks = Array.isArray(st.decks) ? st.decks : [];
  state.decks = decks.map(sanitizeDeck).filter(Boolean).slice(0, 40);
  const lw = st.ladderWins && typeof st.ladderWins === "object" ? st.ladderWins : {};
  state.ladderWins = {};
  for (const [tier, ids] of Object.entries(lw)) {
    const key = String(tier).slice(0, 16);
    state.ladderWins[key] = asStringArray(ids, 40, 16);
  }
  const version = asInt(wrap.version, 1, 99, 4) || 4;
  const daily = sanitizeMissions(st.dailyMissions);
  if (daily) state.dailyMissions = daily;
  return { state, version };
}

function sanitizeMissions(raw) {
  if (!raw || typeof raw !== "object") return null;
  const claimed = {};
  if (raw.claimed && typeof raw.claimed === "object" && !Array.isArray(raw.claimed)) {
    for (const [k, v] of Object.entries(raw.claimed)) {
      if (v) claimed[String(k).slice(0, 24)] = true;
    }
  }
  return {
    day: String(raw.day || "").slice(0, 16),
    login: asInt(raw.login, 0, 99, 0),
    open: asInt(raw.open, 0, 99, 0),
    win: asInt(raw.win, 0, 99, 0),
    fight: asInt(raw.fight, 0, 99, 0),
    claimed,
    gaugeTaken: !!raw.gaugeTaken,
  };
}

function mergeClaimed(a, b) {
  const out = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src)) {
      if (v) out[String(k).slice(0, 24)] = true;
    }
  }
  return out;
}

function mergeMissions(a, b) {
  const left = sanitizeMissions(a);
  const right = sanitizeMissions(b);
  if (!left) return right;
  if (!right) return left;
  const da = left.day || "";
  const db = right.day || "";
  if (da && db && da !== db) return da >= db ? left : right;
  return {
    day: da || db,
    login: Math.max(left.login, right.login),
    open: Math.max(left.open, right.open),
    win: Math.max(left.win, right.win),
    fight: Math.max(left.fight, right.fight),
    claimed: mergeClaimed(left.claimed, right.claimed),
    gaugeTaken: !!(left.gaugeTaken || right.gaugeTaken),
  };
}

function mergeRoad(a, b) {
  if (!a && !b) return null;
  const left = normalizeRoad(a);
  const right = normalizeRoad(b);
  const claimed = { ...left.claimed, ...right.claimed };
  const settled = [...new Set([...(left.settled || []), ...(right.settled || [])])].slice(-40);
  return normalizeRoad({
    points: Math.max(left.points, right.points),
    highestPoints: Math.max(left.highestPoints, right.highestPoints),
    winStreak: Math.max(left.winStreak, right.winStreak),
    bestStreak: Math.max(left.bestStreak, right.bestStreak),
    wins: Math.max(left.wins, right.wins),
    losses: Math.max(left.losses, right.losses),
    draws: Math.max(left.draws, right.draws),
    claimed,
    settled,
    introSeen: !!(left.introSeen || right.introSeen),
  });
}

function mergeProfile(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  const nameA = String(left.name || "").trim();
  const nameB = String(right.name || "").trim();
  const pickB = nameB && !/^pirate$/i.test(nameB);
  const name = (pickB ? nameB : nameA || nameB).slice(0, 14);
  const favs = asStringArray((right.favs && right.favs.length ? right.favs : left.favs) || [], 3, 40);
  return {
    name,
    motto: String(right.motto || left.motto || "").slice(0, 80),
    favs,
  };
}

function sanitizeBlob(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const blob = { v: 1 };
  blob.tcg = sanitizeTcg(src.tcg || src.save || src);
  const missions = mergeMissions(
    sanitizeMissions(src.missions),
    sanitizeMissions(blob.tcg && blob.tcg.state && blob.tcg.state.dailyMissions),
  );
  if (missions) {
    blob.missions = missions;
    blob.tcg.state.dailyMissions = missions;
  }
  if (src.mailClaimed && typeof src.mailClaimed === "object") blob.mailClaimed = src.mailClaimed;
  if (src.profile && typeof src.profile === "object") {
    blob.profile = {
      name: String(src.profile.name || "").slice(0, 14),
      motto: String(src.profile.motto || "").slice(0, 80),
      favs: asStringArray(src.profile.favs, 3, 40),
    };
  }
  if (src.portrait && typeof src.portrait === "object" && src.portrait.cardId) {
    blob.portrait = {
      cardId: String(src.portrait.cardId).slice(0, 40),
      name: String(src.portrait.name || "").slice(0, 48),
      x: asInt(src.portrait.x, 0, 100, 50),
      y: asInt(src.portrait.y, 0, 100, 16),
      s: Math.max(1, Math.min(3, Number(src.portrait.s) || 1.8)),
      at: asInt(src.portrait.at, 0, Number.MAX_SAFE_INTEGER, 0),
    };
  }
  if (src.social && typeof src.social === "object") {
    blob.social = {
      myId: String(src.social.myId || "").slice(0, 40),
      friends: Array.isArray(src.social.friends) ? src.social.friends.slice(0, 80) : [],
      history: Array.isArray(src.social.history) ? src.social.history.slice(0, 40) : [],
      lastShare: src.social.lastShare && typeof src.social.lastShare === "object" ? src.social.lastShare : {},
    };
  }
  if (src.road && typeof src.road === "object") blob.road = normalizeRoad(src.road);
  return blob;
}

function isEmptyTcg(blob) {
  const st = blob?.tcg?.state;
  if (!st) return true;
  const cards = Object.values(st.collection || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  const packs = Object.values(st.packs || {}).reduce((a, n) => a + (Number(n) || 0), 0);
  return cards === 0 && packs === 0 && (Number(st.berries) || 0) === 0 && (Number(st.wins) || 0) === 0 && !(st.decks || []).length;
}

function isStarterPacks(packs) {
  const p = packs || {};
  return (Number(p["OP-01"]) || 0) >= 5 && (Number(p["OP-02"]) || 0) >= 2;
}

function mergePacks(cs, ls) {
  const co = Number(cs.opened) || 0;
  const lo = Number(ls.opened) || 0;
  if (lo > co) return { ...(ls.packs || {}) };
  if (co > lo) return { ...(cs.packs || {}) };
  if (isStarterPacks(ls.packs) && !isStarterPacks(cs.packs)) return { ...(cs.packs || {}) };
  if (isStarterPacks(cs.packs) && !isStarterPacks(ls.packs)) return { ...(ls.packs || {}) };
  return mergeMaps(cs.packs, ls.packs);
}

function mergeMaps(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = Math.max(Number(out[k]) || 0, Number(v) || 0);
  }
  return out;
}

function mergeGuest(cloud, local) {
  if (isEmptyTcg(cloud)) return local;
  if (isEmptyTcg(local)) return cloud;
  const cs = cloud.tcg?.state || {};
  const ls = local.tcg?.state || {};
  const state = { ...cs, ...ls };
  state.collection = mergeMaps(cs.collection, ls.collection);
  state.packs = mergePacks(cs, ls);
  state.pity = mergeMaps(cs.pity, ls.pity);
  state.berries = Math.max(Number(cs.berries) || 0, Number(ls.berries) || 0);
  state.wins = Math.max(Number(cs.wins) || 0, Number(ls.wins) || 0);
  state.losses = Math.max(Number(cs.losses) || 0, Number(ls.losses) || 0);
  state.opened = Math.max(Number(cs.opened) || 0, Number(ls.opened) || 0);
  state.bp = Math.max(Number(cs.bp) || 0, Number(ls.bp) || 0);
  state.bpStock = Math.max(Number(cs.bpStock) || 0, Number(ls.bpStock) || 0);
  const decks = [];
  const seen = new Set();
  for (const d of [...(ls.decks || []), ...(cs.decks || [])]) {
    if (!d || !d.id || seen.has(d.id)) continue;
    seen.add(d.id);
    decks.push(d);
  }
  state.decks = decks.slice(0, 40);
  state.ownedCosmetics = [...new Set([...(cs.ownedCosmetics || []), ...(ls.ownedCosmetics || [])])].slice(0, 80);
  state.granted = !!(cs.granted || ls.granted);
  state.seenRules = !!(cs.seenRules || ls.seenRules);
  state.activeDeckId = ls.activeDeckId || cs.activeDeckId || "";
  const lw = {};
  for (const src of [cs.ladderWins || {}, ls.ladderWins || {}]) {
    for (const [tier, ids] of Object.entries(src)) {
      lw[tier] = [...new Set([...(lw[tier] || []), ...(Array.isArray(ids) ? ids : [])])];
    }
  }
  state.ladderWins = lw;
  const out = { ...cloud, ...local, v: 1, tcg: { state, version: local.tcg?.version || cloud.tcg?.version || 4 } };
  out.missions = mergeMissions(
    cloud.missions || cs.dailyMissions,
    local.missions || ls.dailyMissions,
  );
  if (out.missions) state.dailyMissions = out.missions;
  out.tcg = { state, version: local.tcg?.version || cloud.tcg?.version || 4 };
  out.profile = mergeProfile(cloud.profile, local.profile);
  out.portrait = (local.portrait && local.portrait.cardId) ? local.portrait : (cloud.portrait || local.portrait);
  out.mailClaimed = { ...(cloud.mailClaimed || {}), ...(local.mailClaimed || {}) };
  out.road = mergeRoad(cloud.road, local.road) || undefined;
  if (!out.social) out.social = local.social || cloud.social;
  return sanitizeBlob(out);
}

export { sanitizeBlob, mergeGuest, mergeMissions, isEmptyTcg, TCG_KEYS };

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) return json(res, 401, { error: "auth_required" });
    const sql = await getSql();

    if (req.method === "GET") {
      const rows = await sql.query(
        "select blob, rev, extract(epoch from updated_at)*1000 as updated_at from player_saves where user_id = $1",
        [user.id],
      );
      const row = rows[0];
      if (!row) return json(res, 200, { ok: true, blob: null, rev: 0, updatedAt: 0 });
      let blob = row.blob;
      if (typeof blob === "string") {
        try { blob = JSON.parse(blob); } catch { blob = null; }
      }
      return json(res, 200, {
        ok: true,
        blob: blob ? sanitizeBlob(blob) : null,
        rev: Number(row.rev) || 0,
        updatedAt: Number(row.updated_at) || 0,
      });
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJsonBody(req);
      if (body.__tooBig) return json(res, 413, { error: "too_large" });
      const blob = sanitizeBlob(body.blob || body);
      const packed = JSON.stringify(blob);
      if (packed.length > MAX_BYTES) return json(res, 413, { error: "too_large" });
      const clientRev = asInt(body.rev, 0, Number.MAX_SAFE_INTEGER, 0);
      const existing = await sql.query(
        "select blob, rev from player_saves where user_id = $1",
        [user.id],
      );
      const row = existing[0];
      let nextBlob = blob;
      let nextRev = clientRev + 1;
      if (row) {
        const serverRev = Number(row.rev) || 0;
        const serverBlob = sanitizeBlob(row.blob);
        nextBlob = mergeGuest(serverBlob, blob);
        nextRev = Math.max(serverRev, clientRev) + 1;
      }
      await sql.query(
        `insert into player_saves (user_id, blob, rev, updated_at)
         values ($1, $2::jsonb, $3, now())
         on conflict (user_id) do update
           set blob = excluded.blob, rev = excluded.rev, updated_at = now()`,
        [user.id, JSON.stringify(nextBlob), nextRev],
      );
      return json(res, 200, { ok: true, rev: nextRev, blob: nextBlob });
    }

    res.statusCode = 405;
    res.end("Method Not Allowed");
  } catch (err) {
    json(res, 500, { error: "internal_error", message: err?.message || String(err) });
  }
}
