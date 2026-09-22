import assert from "node:assert/strict";
import { sanitizeBlob, mergeGuest, isEmptyTcg } from "../api/progress.mjs";

const guest = sanitizeBlob({
  tcg: {
    version: 4,
    state: {
      berries: 1200,
      collection: { "ST01-001": 1, "OP01-001": 4 },
      packs: { "OP-01": 2 },
      decks: [{ id: "starter_ST-01", name: "Straw Hat", leaderId: "ST01-001", cards: { "ST01-002": 4 } }],
      wins: 3,
      losses: 1,
      opened: 5,
      granted: true,
      activeDeckId: "starter_ST-01",
    },
  },
  missions: { day: "2026-09-14", login: 1, open: 1, win: 0, fight: 1, claimed: { login: true }, gaugeTaken: false },
  profile: { name: "Luffy", motto: "Je serai le Roi des Pirates !", favs: ["ST01-001"] },
});

assert.equal(guest.tcg.state.berries, 1200);
assert.equal(guest.tcg.state.collection["OP01-001"], 4);
assert.equal(guest.profile.name, "Luffy");
assert.equal(isEmptyTcg(guest), false);
assert.equal(isEmptyTcg(sanitizeBlob({})), true);

const cloud = sanitizeBlob({
  tcg: {
    version: 4,
    state: {
      berries: 400,
      collection: { "ST01-001": 1, "OP02-016": 2 },
      packs: { "OP-02": 1 },
      decks: [{ id: "deck_2", name: "Navy", leaderId: "OP02-001", cards: {} }],
      wins: 10,
      granted: true,
    },
  },
});

const merged = mergeGuest(cloud, guest);
assert.equal(merged.tcg.state.collection["OP01-001"], 4, "keeps guest cards");
assert.equal(merged.tcg.state.collection["OP02-016"], 2, "keeps cloud cards");
assert.equal(merged.tcg.state.berries, 1200, "keeps the higher berry count");
assert.equal(merged.tcg.state.wins, 10, "keeps the higher win count");
assert.equal(merged.tcg.state.decks.length, 2, "unions decks");
assert.equal(merged.profile.name, "Luffy");

const dirty = sanitizeBlob({
  tcg: { state: { berries: -5, collection: { x: 999 }, decks: [{ id: "a" }, { id: "a" }] } },
});
assert.equal(dirty.tcg.state.berries, 0);
assert.equal(dirty.tcg.state.collection.x, 99);

console.log("progress-save ok");
