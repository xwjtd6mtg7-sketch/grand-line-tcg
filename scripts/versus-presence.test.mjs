import assert from "node:assert/strict";
import {
  beginMatch,
  settlePresence,
  settleIdle,
  hasWinner,
  sideIsAway,
  markHere,
  viewFor,
  applyMove,
  winnerUserId,
  AWAY_AFTER,
  FORFEIT_AFTER,
} from "../api/versus.mjs";

const room = {
  id: "TESTROOM",
  host_id: "host-1",
  guest_id: "guest-1",
  host_name: "Nami",
  guest_name: "Baggy",
  host_deck: { leaderId: "ST01-001", cards: { "ST01-002": 50 } },
  guest_deck: { leaderId: "ST01-001", cards: { "ST01-002": 50 } },
};

const t0 = Date.now();
const st = beginMatch(room);
st.presence = { host: t0, guest: t0 };
st.clockSide = "host";
st.clockAt = t0;

assert.equal(sideIsAway(st, "guest", t0), false);
assert.equal(sideIsAway(st, "guest", t0 + AWAY_AFTER - 100), false);

st.presence.guest = t0 - AWAY_AFTER - 10;
const changed = settlePresence(st, t0);
assert.equal(changed, true);
assert.equal(sideIsAway(st, "guest", t0), true);
assert.ok(st.awaySince.guest);
assert.equal(st.clockSide, null);
assert.equal(st.pausedClockSide, "host");

st.presence.host = Date.now();
const v = viewFor(st, "host-1", room);
assert.equal(v.away.host, false);
assert.equal(v.away.guest, true);
assert.ok(v.awayFor.guest > 0);
assert.ok(v.awayFor.guest <= FORFEIT_AFTER);

st.awaySince.guest = t0 - FORFEIT_AFTER;
const forfeited = settlePresence(st, t0);
assert.equal(forfeited, true);
assert.equal(hasWinner(st), true);
assert.equal(st.winner, 0);
assert.equal(st.endedBy, "forfeit");
assert.equal(st.seq[st.seq.length - 1].act.type, "concede");
assert.equal(st.seq[st.seq.length - 1].pid, 1);

const st2 = beginMatch(room);
st2.presence = { host: t0, guest: t0 };
markHere(st2, "guest", false, t0);
assert.equal(sideIsAway(st2, "guest", t0), true);
markHere(st2, "guest", true, t0);
settlePresence(st2, t0);
assert.equal(sideIsAway(st2, "guest", t0), false);
assert.equal(st2.awaySince.guest, null);

// Late reconnect must NOT undo a 30s forfeit: settle first, then markHere.
const now = Date.now();
const st3 = beginMatch(room);
st3.presence = { host: now, guest: now - FORFEIT_AFTER - 2000 };
st3.awaySince = { host: null, guest: now - FORFEIT_AFTER - 2000 };
st3.clockSide = "host";
st3.clockAt = now;
settleIdle(st3);
assert.equal(hasWinner(st3), true, "30s away forfeits before reconnect");
assert.equal(st3.winner, 0);
assert.equal(st3.endedBy, "forfeit");
markHere(st3, "guest", true, now);
settlePresence(st3, now);
assert.equal(hasWinner(st3), true, "reconnect after forfeit keeps the result");
assert.equal(st3.winner, 0);

const v3 = viewFor(st3, "guest-1", room);
assert.equal(v3.winner, 0);
assert.equal(v3.endedBy, "forfeit");
assert.equal(v3.pid, 1);

// Both AFK 30s → expired, no winner (not a free win for the guest).
const now4 = Date.now();
const st4 = beginMatch(room);
st4.presence = { host: now4 - FORFEIT_AFTER - 3000, guest: now4 - FORFEIT_AFTER - 3000 };
st4.awaySince = { host: now4 - FORFEIT_AFTER - 3000, guest: now4 - FORFEIT_AFTER - 3000 };
const expired = settlePresence(st4, now4);
assert.equal(expired, true);
assert.equal(st4.endedBy, "expired");
assert.equal(st4.winner, null);
assert.equal(hasWinner(st4), true);
assert.equal(winnerUserId(room, st4), null);
const v4h = viewFor(st4, "host-1", room);
const v4g = viewFor(st4, "guest-1", room);
assert.equal(v4h.winner, null);
assert.equal(v4g.winner, null);
assert.equal(v4h.endedBy, "expired");

// Concede while the opponent is already AFK past 30s: explicit abandon wins.
const now5 = Date.now();
const st5 = beginMatch(room);
st5.presence = { host: now5, guest: now5 - FORFEIT_AFTER - 2000 };
st5.awaySince = { host: null, guest: now5 - FORFEIT_AFTER - 2000 };
st5.seq = [];
st5.seqN = 0;
const r5 = applyMove(st5, "host-1", { type: "concede" });
assert.equal(r5.ok, true);
assert.equal(st5.endedBy, "concede");
assert.equal(st5.winner, 1, "host concede → guest wins, even if guest was AFK");
settlePresence(st5, now5);
assert.equal(st5.endedBy, "concede", "presence must not overwrite a concede");
assert.equal(st5.winner, 1);

console.log("presence ok");
