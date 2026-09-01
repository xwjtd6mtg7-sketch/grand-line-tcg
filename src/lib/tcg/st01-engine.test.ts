import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, before } from "node:test";
import { hydrateCatalog } from "./catalog.ts";
import {
  applyAction,
  createMatch,
  legalActions,
  currentPower,
  type GameState,
  type Unit,
} from "./engine.ts";
import { clearParseCache } from "./parse.ts";
import type { Catalog, DeckList } from "./types.ts";

function blankUnit(id: string, extra: Partial<Unit> = {}): Unit {
  return {
    iid: `u-${id}-${Math.random().toString(36).slice(2, 7)}`,
    id,
    rested: false,
    sick: false,
    don: 0,
    powerBuff: 0,
    battleBuff: 0,
    usedMain: false,
    costBuff: 0,
    unblockThisTurn: false,
    ...extra,
  };
}

function deck(leaderId: string, ids: string[]): DeckList {
  const cards: Record<string, number> = {};
  for (const id of ids) cards[id] = (cards[id] ?? 0) + 1;
  while (Object.values(cards).reduce((a, n) => a + n, 0) < 50) {
    cards["ST01-003"] = (cards["ST01-003"] ?? 0) + 1;
  }
  return { id: "t", name: "t", leaderId, cards };
}

function boot(): GameState {
  let s = createMatch(deck("ST01-001", ["ST01-003"]), deck("ST01-001", ["ST01-003"]), 0);
  s = applyAction(s, 0, { type: "coinResult", first: 0 });
  s = applyAction(s, 0, { type: "mulligan", redraw: false });
  s.players[0].turnsStarted = 2;
  s.players[1].turnsStarted = 2;
  s.turn = 0;
  s.step = { kind: "main" };
  s.players[0].donActive = 8;
  s.players[0].donRested = 2;
  s.players[0].leader.rested = false;
  s.players[1].leader.rested = false;
  s.players[0].chars = [];
  s.players[1].chars = [];
  return s;
}

describe("ST01 engine mechanics (optcg-sim aligned)", () => {
  before(() => {
    clearParseCache();
    const data = JSON.parse(readFileSync(new URL("../../../public/data/catalog.json", import.meta.url), "utf8")) as Catalog;
    hydrateCatalog(data);
  });

  it("ST01-006 printed Blocker can block; vanilla cannot", () => {
    const s = boot();
    const atk = blankUnit("ST01-003");
    const blk = blankUnit("ST01-006");
    const vanilla = blankUnit("ST01-008");
    s.players[0].chars = [atk];
    s.players[1].chars = [blk, vanilla];
    let n = applyAction(s, 0, { type: "attack", attackerIid: atk.iid, target: { kind: "leader" } });
    assert.equal(n.step.kind, "block");
    const acts = legalActions(n, 1);
    const blockIds = acts.filter((a) => a.type === "block").map((a) => (a.type === "block" ? a.iid : null));
    assert.ok(blockIds.includes(blk.iid), "Chopper can block");
    assert.ok(!blockIds.includes(vanilla.iid), "Robin (no Blocker) cannot block");
    assert.ok(blockIds.includes(null), "may decline");
  });

  it("ST01-004 Sanji Rush only after DON x2", () => {
    const s = boot();
    const sanji = blankUnit("ST01-004", { sick: true, don: 0 });
    s.players[0].chars = [sanji];
    const no = legalActions(s, 0).filter((a) => a.type === "attack" && a.attackerIid === sanji.iid);
    assert.equal(no.length, 0, "sick Sanji without DON cannot attack");
    sanji.don = 2;
    const yes = legalActions(s, 0).filter((a) => a.type === "attack" && a.attackerIid === sanji.iid);
    assert.ok(yes.length > 0, "Sanji with 2 DON gains Rush and can attack");
  });

  it("ST01-012 printed Rush can attack while sick", () => {
    const s = boot();
    const luffy = blankUnit("ST01-012", { sick: true, don: 0 });
    s.players[0].chars = [luffy];
    const yes = legalActions(s, 0).filter((a) => a.type === "attack" && a.attackerIid === luffy.iid);
    assert.ok(yes.length > 0);
  });

  it("ST01-002 DON x2 bans only blockers with 5000+ power this battle", () => {
    const s = boot();
    const usopp = blankUnit("ST01-002", { don: 2 });
    const cheap = blankUnit("ST01-006"); // 1000 power blocker
    const fat = blankUnit("ST01-006", { powerBuff: 4000 }); // 5000 power blocker
    s.players[0].chars = [usopp];
    s.players[1].chars = [cheap, fat];
    const n = applyAction(s, 0, { type: "attack", attackerIid: usopp.iid, target: { kind: "leader" } });
    assert.equal(n.step.kind, "block", "power-filtered ban still offers the block step");
    const acts = legalActions(n, 1);
    const ids = acts.filter((a) => a.type === "block").map((a) => (a.type === "block" ? a.iid : null));
    assert.ok(ids.includes(cheap.iid), "1000-power blocker may still block");
    assert.ok(!ids.includes(fat.iid), "5000-power blocker is prohibited this battle");
  });

  it("ST01-002 without DON x2 does not apply the prohibition", () => {
    const s = boot();
    const usopp = blankUnit("ST01-002", { don: 0 });
    const fat = blankUnit("ST01-006", { powerBuff: 4000 });
    s.players[0].chars = [usopp];
    s.players[1].chars = [fat];
    const n = applyAction(s, 0, { type: "attack", attackerIid: usopp.iid, target: { kind: "leader" } });
    assert.equal(n.step.kind, "block");
    const ids = legalActions(n, 1)
      .filter((a) => a.type === "block")
      .map((a) => (a.type === "block" ? a.iid : null));
    assert.ok(ids.includes(fat.iid), "no DON attached → no prohibition");
  });

  it("ST01-012 DON x2 skips the block step entirely", () => {
    const s = boot();
    const luffy = blankUnit("ST01-012", { don: 2 });
    const blk = blankUnit("ST01-006");
    s.players[0].chars = [luffy];
    s.players[1].chars = [blk];
    const n = applyAction(s, 0, { type: "attack", attackerIid: luffy.iid, target: { kind: "leader" } });
    assert.equal(n.step.kind, "counter", "blanket CANNOT_ACTIVATE_BLOCKER skips block");
  });

  it("ST01-012 without DON x2 still allows blockers", () => {
    const s = boot();
    const luffy = blankUnit("ST01-012", { don: 0 });
    const blk = blankUnit("ST01-006");
    s.players[0].chars = [luffy];
    s.players[1].chars = [blk];
    const n = applyAction(s, 0, { type: "attack", attackerIid: luffy.iid, target: { kind: "leader" } });
    assert.equal(n.step.kind, "block");
    const ids = legalActions(n, 1)
      .filter((a) => a.type === "block")
      .map((a) => (a.type === "block" ? a.iid : null));
    assert.ok(ids.includes(blk.iid));
  });

  it("ST01-015 Jet Pistol KOs only characters with 6000 power or less", () => {
    const s = boot();
    s.players[0].hand = ["ST01-015"];
    const weak = blankUnit("ST01-003"); // 3000
    const strong = blankUnit("ST01-012"); // 6000 + 0 don = 6000, still legal
    const huge = blankUnit("ST01-012", { powerBuff: 1000 }); // 7000
    s.players[1].chars = [weak, strong, huge];
    const n = applyAction(s, 0, { type: "play", handIndex: 0 });
    assert.equal(n.step.kind, "choose");
    if (n.step.kind !== "choose") return;
    const ids = n.step.effect.type === "ko" ? legalActions(n, 0) : [];
    const charIds = ids
      .filter((a) => a.type === "chooseTarget" && a.target.kind === "char")
      .map((a) => (a.type === "chooseTarget" && a.target.kind === "char" ? a.target.iid : ""));
    assert.ok(charIds.includes(weak.iid));
    assert.ok(charIds.includes(strong.iid), "6000 exactly is legal");
    assert.ok(!charIds.includes(huge.iid), "7000 is above the cap");
  });

  it("ST01-016 trigger KO only [Blocker] characters cost ≤ 3", () => {
    const s = boot();
    const chopper = blankUnit("ST01-006"); // blocker cost 1
    const nami = blankUnit("ST01-007"); // not blocker, cost 1
    const luffy = blankUnit("ST01-012"); // not blocker, cost 5
    s.players[1].chars = [chopper, nami, luffy];
    s.step = {
      kind: "choose",
      pid: 0,
      sourceIid: null,
      effect: { type: "ko", n: 1, maxCost: 3, maxPower: null, keyword: "blocker" },
      rest: [],
      battle: false,
      optional: true,
      prompt: "ko",
    };
    const ids = legalActions(s, 0)
      .filter((a) => a.type === "chooseTarget" && a.target.kind === "char")
      .map((a) => (a.type === "chooseTarget" && a.target.kind === "char" ? a.target.iid : ""));
    assert.deepEqual(ids, [chopper.iid]);
  });

  it("ST01-013 Zoro DON x1 aura adds +1000 on top of attached DON", () => {
    const s = boot();
    const zoro = blankUnit("ST01-013", { don: 1 });
    s.players[0].chars = [zoro];
    // base 5000 + 1000 attached DON (your turn) + 1000 aura
    assert.equal(currentPower(s, 0, zoro), 7000);
  });

  it("ST01-017 / ST01-016 trait filter matches French concatenated Straw Hat traits", () => {
    const s = boot();
    s.players[0].hand = ["ST01-016"];
    const nami = blankUnit("ST01-007");
    const vivi = blankUnit("ST01-009"); // Alabasta, not Straw Hat
    s.players[0].chars = [nami, vivi];
    const n = applyAction(s, 0, { type: "play", handIndex: 0 });
    assert.equal(n.step.kind, "choose");
    const ids = legalActions(n, 0)
      .filter((a) => a.type === "chooseTarget")
      .map((a) => {
        if (a.type !== "chooseTarget") return "";
        return a.target.kind === "leader" ? n.players[0].leader.iid : a.target.iid;
      });
    assert.ok(ids.includes(n.players[0].leader.iid), "Luffy leader is Straw Hat");
    assert.ok(ids.includes(nami.iid), "Nami is Straw Hat");
    assert.ok(!ids.includes(vivi.iid), "Vivi is not Straw Hat");
  });

  it("ST01-016 main: selected Straw Hat's attack bans all blockers this turn", () => {
    const s = boot();
    const nami = blankUnit("ST01-007");
    const chopper = blankUnit("ST01-006");
    s.players[0].chars = [nami];
    s.players[1].chars = [chopper];
    s.players[0].hand = ["ST01-016"];
    let n = applyAction(s, 0, { type: "play", handIndex: 0 });
    assert.equal(n.step.kind, "choose");
    n = applyAction(n, 0, { type: "chooseTarget", target: { kind: "char", iid: nami.iid } });
    assert.equal(n.step.kind, "main");
    assert.ok(nami.iid);
    const after = applyAction(n, 0, { type: "attack", attackerIid: nami.iid, target: { kind: "leader" } });
    assert.equal(after.step.kind, "counter", "blanket blocker ban skips the block step");
  });

  it("ST01-002 trigger Play this card puts Usopp on the field unpaid", () => {
    const s = boot();
    s.step = { kind: "trigger", pid: 0, cardId: "ST01-002", remaining: 0, banish: false };
    const n = applyAction(s, 0, { type: "triggerYes" });
    assert.ok(
      n.players[0].chars.some((c) => c.id === "ST01-002"),
      "Usopp enters from trigger",
    );
    assert.ok(!n.players[0].trash.includes("ST01-002"), "not trashed");
    assert.ok(!n.players[0].hand.includes("ST01-002"), "not added to hand");
  });

  it("second player may attack on their first turn (official 6-6)", () => {
    let s = createMatch(deck("ST01-001", ["ST01-003"]), deck("ST01-001", ["ST01-003"]), 1);
    s = applyAction(s, 0, { type: "coinResult", first: 1 });
    s = applyAction(s, 0, { type: "mulligan", redraw: false });
    s.turn = 1;
    s.step = { kind: "main" };
    s = applyAction(s, 1, { type: "endTurn" });
    assert.equal(s.turn, 0);
    assert.equal(s.players[0].turnsStarted, 1);
    const atk = legalActions(s, 0).filter((a) => a.type === "attack" && a.attackerIid === s.players[0].leader.iid);
    assert.ok(atk.length > 0, "second player can attack with leader on their first turn");
  });

  it("ST01-014 Guard Point counter gives +3000 this battle to the defender", () => {
    const s = boot();
    const atk = blankUnit("ST01-003");
    s.players[0].chars = [atk];
    s.players[1].hand = ["ST01-014"];
    s.players[1].donActive = 2;
    let n = applyAction(s, 0, { type: "attack", attackerIid: atk.iid, target: { kind: "leader" } });
    if (n.step.kind === "block") n = applyAction(n, 1, { type: "block", iid: null });
    assert.equal(n.step.kind, "counter");
    const acts = legalActions(n, 1);
    assert.ok(acts.some((a) => a.type === "counterCard"), "Guard Point is a legal Counter event");
    const idx = acts.find((a) => a.type === "counterCard")?.handIndex ?? 0;
    n = applyAction(n, 1, { type: "counterCard", handIndex: idx });
    assert.equal(n.combatBuff.player, 1);
    assert.equal(n.combatBuff.amount, 3000);
    assert.ok(n.players[1].trash.includes("ST01-014"));
    const defP = currentPower(n, 1, n.players[1].leader);
    assert.equal(defP, 8000, "5000 leader + 3000 Guard Point this battle");
  });
});
