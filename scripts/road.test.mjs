import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRoadResult,
  blankRoad,
  checkpointFloor,
  claimReward,
  destinationProgress,
  destinationState,
  getCurrentDestination,
  getNextDestination,
  normalizeRoad,
  rewardCatalog,
  streakBonus,
} from "../api/_lib/road.mjs";
import { applyMove, beginMatch, botName, settleIdle } from "../api/versus.mjs";

test("a new sailor starts at Foosha", () => {
  const road = normalizeRoad(undefined);
  assert.equal(road.points, 0);
  assert.equal(getCurrentDestination(0).id, "foosha");
  assert.equal(getNextDestination(0).name, "Repaire d’Alvida");
});

test("win, draw and loss use the config and never drop under a checkpoint", () => {
  let road = blankRoad();
  let r = applyRoadResult(road, "win", "M1");
  assert.equal(r.after, 30);
  r = applyRoadResult(r.state, "draw", "M2");
  assert.equal(r.after, 35);
  assert.equal(r.state.winStreak, 1);
  r = applyRoadResult(r.state, "loss", "M3");
  assert.equal(r.after, 25);
  assert.equal(r.state.winStreak, 0);
  r = applyRoadResult(r.state, "loss", "M3");
  assert.equal(r.applied, false);
});

test("streak bonus and destination unlocks", () => {
  let road = blankRoad();
  road.points = 170;
  road.highestPoints = 170;
  road.winStreak = 4;
  const r = applyRoadResult(road, "win", "M9");
  assert.equal(streakBonus(5), 15);
  assert.equal(r.base, 30);
  assert.equal(r.bonus, 15);
  assert.equal(r.after, 215);
  assert.deepEqual(r.newly, ["alvida"]);
  assert.equal(getCurrentDestination(215).id, "alvida");
});

test("Shell Town checkpoint holds after losses and the road continues", () => {
  let road = blankRoad();
  road.points = 500;
  road.highestPoints = 500;
  const loss = applyRoadResult(road, "loss", "L1");
  assert.equal(loss.after, 500);
  assert.equal(checkpointFloor(500), 500);
  assert.equal(getCurrentDestination(735).id, "shells");
  assert.equal(getNextDestination(735).id, "orange");
  assert.equal(getCurrentDestination(3800).id, "loguetown");
  assert.equal(getNextDestination(3800).id, "twins");
  assert.equal(getCurrentDestination(5000).id, "twins");
  assert.equal(getCurrentDestination(5000).regionName, "Entrée de Grand Line");
  assert.equal(getNextDestination(5000), null);
  const progress = destinationProgress(5000);
  assert.equal(progress.ratio, 1);
  assert.equal(progress.next, null);
});

test("a destination reward can be claimed only once, after the island is finished", () => {
  const road = blankRoad();
  road.points = 500;
  road.highestPoints = 500;
  const early = claimReward(road, "shell_berries");
  assert.equal(early.ok, false);
  assert.equal(early.reason, "locked");
  road.points = 900;
  road.highestPoints = 900;
  const first = claimReward(road, "shell_berries");
  assert.equal(first.ok, true);
  const again = claimReward(first.state, "shell_berries");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "claimed");
  const locked = claimReward(blankRoad(), "alvida_berries");
  assert.equal(locked.reason, "locked");
  assert.match(rewardCatalog().find((r) => r.id === "foosha_berries").label, /Berries/);
  assert.equal(rewardCatalog().some((r) => /Baies/.test(r.label)), false);
});

test("a road bot can finish the duel and does not forfeit while it plays", () => {
  const room = {
    id: "ROADBOT1",
    host_id: "user-1",
    guest_id: "bot-ROADBOT1",
    host_name: "Luffy",
    guest_name: botName("ROADBOT1"),
    host_deck: { leaderId: "ST01-001", cards: { "ST01-002": 4 }, name: "East" },
    guest_deck: { leaderId: "ST01-001", cards: { "ST01-002": 4 }, name: "East" },
  };
  assert.equal(typeof room.guest_name, "string");
  assert.ok(room.guest_name.length > 2);
  const state = beginMatch(room);
  state.bot = true;
  state.kickoff = true;
  state.shotSide = "guest";
  state.shotAt = Date.now() - 120000;
  state.shotMs = 90000;
  state.clockSide = "guest";
  state.clockAt = Date.now();
  state.presence.guest = Date.now() - 120000;
  state.awaySince.guest = Date.now() - 60000;
  settleIdle(state);
  assert.equal(state.winner, null);
  assert.equal(state.shotSide, "host");
  assert.equal(state.seq.some((it) => it.act && it.act.timeout), false);
  assert.equal(state.awaySince.guest, null);
  const denied = applyMove(state, "user-1", { type: "result", winner: 0 });
  assert.equal(denied.ok, true);
  assert.equal(state.winner, 0);
  assert.equal(state.endedBy, "result");
  const again = applyMove(state, "user-1", { type: "result", winner: 1 });
  assert.equal(again.ok, true);
  assert.equal(state.winner, 0);
  state.bot = false;
  state.winner = null;
  const human = applyMove(state, "user-1", { type: "result", winner: 0 });
  assert.equal(human.ok, undefined);
  assert.equal(human.error, "Action inconnue.");
});

test("dev-style unlock label stays distinct from a reached stop", () => {
  const road = blankRoad();
  road.points = 0;
  road.highestPoints = 0;
  assert.equal(destinationState({ id: "alvida", requiredPoints: 200 }, road), "locked");
});
