import { statSync } from "node:fs";
import { getSql } from "./_lib/db.mjs";
import { getSessionUser } from "./_lib/require-admin.mjs";

async function roadLib() {
  const libUrl = new URL("./_lib/road.mjs", import.meta.url);
  return import(libUrl.href + "?t=" + statSync(libUrl).mtimeMs);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function parseBlob(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return raw;
}

async function loadBlob(sql, userId) {
  const rows = await sql.query("select blob from player_saves where user_id = $1", [userId]);
  return parseBlob(rows[0] && rows[0].blob);
}

async function saveRoad(sql, userId, road, blob) {
  const next = { ...(blob || {}), v: 1, road };
  await sql.query(
    `insert into player_saves (user_id, blob, rev, updated_at)
     values ($1, $2::jsonb, 1, now())
     on conflict (user_id) do update
       set blob = jsonb_set(coalesce(player_saves.blob, '{}'::jsonb), '{road}', $3::jsonb, true),
           updated_at = now()`,
    [userId, JSON.stringify(next), JSON.stringify(road)],
  );
}

function outcomeFor(row, userId) {
  const state = row.state || {};
  if (state.endedBy === "expired" && !row.winner_id) return "skip";
  const winner = row.winner_id || null;
  if (!winner) {
    if (row.status === "done") return "draw";
    return null;
  }
  return winner === userId ? "win" : "loss";
}

async function grantBerries(sql, userId, amount) {
  if (!amount) return;
  const blob = await loadBlob(sql, userId);
  const tcg = blob.tcg && typeof blob.tcg === "object" ? blob.tcg : { state: {}, version: 4 };
  const st = tcg.state && typeof tcg.state === "object" ? tcg.state : {};
  st.berries = Math.max(0, Math.min(99_999_999, (Number(st.berries) || 0) + amount));
  tcg.state = st;
  blob.tcg = tcg;
  await sql.query(
    `update player_saves set blob = jsonb_set(coalesce(blob, '{}'::jsonb), '{tcg}', $2::jsonb, true), updated_at = now()
      where user_id = $1`,
    [userId, JSON.stringify(tcg)],
  );
  try {
    const raw = JSON.stringify(st);
    // Mirror into the local key is the client's job after the response.
  } catch { /* ignore */ }
  return st.berries;
}

export default async function handler(req, res) {
  const { ROAD_CONFIG, applyRoadResult, claimReward, normalizeRoad, publicConfig, viewModel } = await roadLib();
  const user = await getSessionUser(req);
  if (!user) return json(res, 401, { error: "auth", message: "Connecte-toi pour prendre la mer." });
  const sql = await getSql();
  if (req.method === "GET") {
    const blob = await loadBlob(sql, user.id);
    const road = normalizeRoad(blob.road);
    return json(res, 200, { ok: true, config: publicConfig(), view: viewModel(road) });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const body = await readJson(req);
  const blob = await loadBlob(sql, user.id);
  let road = normalizeRoad(blob.road);

  if (body.action === "intro") {
    road.introSeen = true;
    await saveRoad(sql, user.id, road, blob);
    return json(res, 200, { ok: true, view: viewModel(road) });
  }

  if (body.action === "claim") {
    const result = claimReward(road, String(body.rewardId || ""));
    if (!result.ok) return json(res, 409, { error: result.reason, view: viewModel(road) });
    road = result.state;
    await saveRoad(sql, user.id, road, blob);
    let berries = null;
    if (result.reward.kind === "berries") {
      berries = await grantBerries(sql, user.id, result.reward.amount || 0);
    }
    return json(res, 200, { ok: true, reward: result.reward, berries, view: viewModel(road) });
  }

  if (body.action === "settle") {
    const id = String(body.roomId || "").toUpperCase().slice(0, 16);
    if (!id) return json(res, 400, { error: "id" });
    const rows = await sql.query("select * from versus_rooms where id = $1", [id]);
    const row = rows[0];
    if (!row) return json(res, 404, { error: "not_found" });
    if (row.host_id !== user.id && row.guest_id !== user.id) return json(res, 403, { error: "forbidden" });
    if (row.mode !== "road") return json(res, 409, { error: "mode" });
    let state = row.state;
    if (typeof state === "string") {
      try { state = JSON.parse(state); } catch { state = null; }
    }
    row.state = state;
    if (row.status !== "done" && !(state && (state.winner === 0 || state.winner === 1 || state.winner))) {
      return json(res, 409, { error: "live" });
    }
    const outcome = outcomeFor(row, user.id);
    const applied = applyRoadResult(road, outcome === "skip" ? "skip" : outcome, id, ROAD_CONFIG);
    if (applied.applied) {
      road = applied.state;
      await saveRoad(sql, user.id, road, blob);
    }
    return json(res, 200, {
      ok: true,
      result: {
        applied: applied.applied,
        reason: applied.reason || null,
        outcome: applied.outcome || outcome,
        base: applied.base || 0,
        bonus: applied.bonus || 0,
        total: applied.total || 0,
        before: applied.before ?? road.points,
        after: applied.after ?? road.points,
        newly: applied.newly || [],
      },
      view: viewModel(applied.applied ? road : normalizeRoad(road)),
    });
  }

  return json(res, 400, { error: "action" });
}
