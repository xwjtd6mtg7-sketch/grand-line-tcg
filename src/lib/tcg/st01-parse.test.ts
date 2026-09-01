import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, before } from "node:test";
import { parseCard, clearParseCache, type Abilities } from "./parse.ts";
import type { Catalog, TcgCard } from "./types.ts";

function loadSt01(): Map<string, TcgCard> {
  const data = JSON.parse(readFileSync(new URL("../../../public/data/catalog.json", import.meta.url), "utf8")) as Catalog;
  const map = new Map<string, TcgCard>();
  for (const c of data.cards) {
    if (!/^ST01-\d+$/.test(c.id)) continue;
    map.set(c.id, c);
  }
  return map;
}

describe("ST01 parse vs optcg-sim schemas", () => {
  let cards: Map<string, TcgCard>;

  before(() => {
    clearParseCache();
    cards = loadSt01();
    assert.equal(cards.size, 17, "ST01 has 17 unique cards");
  });

  function ab(id: string): Abilities {
    const c = cards.get(id);
    assert.ok(c, id);
    return parseCard(c);
  }

  it("ST01-001 Luffy leader — Activate Main once, give 1 rested DON", () => {
    const a = ab("ST01-001");
    assert.equal(a.oncePerTurn, true);
    assert.equal(a.activateMain.length, 1);
    const e = a.activateMain[0]!;
    assert.equal(e.type, "giveRestedDon");
    if (e.type === "giveRestedDon") {
      assert.equal(e.n, 1);
      assert.equal(e.who, "leaderOrChar");
    }
  });

  it("ST01-002 Usopp — DON x2 when attacking power-filtered blocker ban this battle + trigger play", () => {
    const a = ab("ST01-002");
    assert.equal(a.blocker, false, "mentions [Blocker] but does not have printed Blocker");
    assert.equal(a.rush, false);
    assert.equal(a.triggerPlayThis, true);
    assert.equal(a.whenAttacking.length, 1);
    const e = a.whenAttacking[0]!;
    assert.equal(e.type, "noBlocker");
    assert.equal(e.donReq, 2);
    if (e.type === "noBlocker") {
      assert.equal(e.duration, "battle");
      assert.equal(e.powerMin, 5000);
      assert.equal(e.powerMax, undefined);
      assert.equal(e.who ?? "self", "self");
    }
  });

  it("ST01-003/008/009/010 vanilla — no keywords, no effects", () => {
    for (const id of ["ST01-003", "ST01-008", "ST01-009", "ST01-010"]) {
      const a = ab(id);
      assert.equal(a.blocker, false, id);
      assert.equal(a.rush, false, id);
      assert.equal(a.whenAttacking.length, 0, id);
      assert.equal(a.onPlay.length, 0, id);
      assert.equal(a.activateMain.length, 0, id);
      assert.equal(a.auras.length, 0, id);
    }
  });

  it("ST01-004 Sanji — DON x2 grants Rush, not printed Rush", () => {
    const a = ab("ST01-004");
    assert.equal(a.rush, false);
    assert.equal(a.blocker, false);
    const aura = a.auras.find((x) => x.keyword === "rush");
    assert.ok(aura, "DON-gated Rush aura");
    assert.equal(aura!.don, 2);
    assert.equal(aura!.who, "self");
  });

  it("ST01-005 Jinbe — DON x1 when attacking +1000 to other leader/char", () => {
    const a = ab("ST01-005");
    assert.equal(a.whenAttacking.length, 1);
    const e = a.whenAttacking[0]!;
    assert.equal(e.donReq, 1);
    assert.equal(e.type, "power");
    if (e.type === "power") {
      assert.equal(e.amount, 1000);
      assert.equal(e.duration, "turn");
      assert.equal(e.who, "leaderOrChar");
      assert.equal(e.excludeSelf, true);
    }
  });

  it("ST01-006 Chopper — printed Blocker only", () => {
    const a = ab("ST01-006");
    assert.equal(a.blocker, true);
    assert.equal(a.rush, false);
    assert.equal(a.whenAttacking.length, 0);
    assert.equal(a.auras.length, 0);
  });

  it("ST01-007 Nami — Activate Main once, give 1 rested DON", () => {
    const a = ab("ST01-007");
    assert.equal(a.oncePerTurn, true);
    const e = a.activateMain[0]!;
    assert.equal(e.type, "giveRestedDon");
    if (e.type === "giveRestedDon") {
      assert.equal(e.n, 1);
      assert.equal(e.who, "leaderOrChar");
    }
  });

  it("ST01-011 Brook — On Play give 2 rested DON", () => {
    const a = ab("ST01-011");
    const e = a.onPlay[0]!;
    assert.equal(e.type, "giveRestedDon");
    if (e.type === "giveRestedDon") {
      assert.equal(e.n, 2);
      assert.equal(e.who, "leaderOrChar");
    }
  });

  it("ST01-012 Luffy — printed Rush + DON x2 blanket blocker ban this battle", () => {
    const a = ab("ST01-012");
    assert.equal(a.rush, true);
    assert.equal(a.blocker, false);
    const e = a.whenAttacking[0]!;
    assert.equal(e.donReq, 2);
    assert.equal(e.type, "noBlocker");
    if (e.type === "noBlocker") {
      assert.equal(e.duration, "battle");
      assert.equal(e.powerMin, undefined);
      assert.equal(e.powerMax, undefined);
      assert.equal(e.who ?? "self", "self");
    }
  });

  it("ST01-013 Zoro — DON x1 +1000 power aura", () => {
    const a = ab("ST01-013");
    assert.equal(a.rush, false);
    const aura = a.auras.find((x) => x.power === 1000 && x.who === "self");
    assert.ok(aura);
    assert.equal(aura!.don, 1);
    assert.equal(aura!.yourTurn, false, "always-on while DON attached, not Your Turn only");
  });

  it("ST01-014 Guard Point — Counter +3000 this battle, Trigger +1000 this turn", () => {
    const a = ab("ST01-014");
    assert.equal(a.isCounterEvent, true);
    assert.equal(a.isMainEvent, false);
    const c = a.counterEffects[0]!;
    assert.equal(c.type, "power");
    if (c.type === "power") {
      assert.equal(c.amount, 3000);
      assert.equal(c.duration, "battle");
      assert.equal(c.who, "leaderOrChar");
    }
    const t = a.trigger[0]!;
    assert.equal(t.type, "power");
    if (t.type === "power") {
      assert.equal(t.amount, 1000);
      assert.equal(t.duration, "turn");
      assert.equal(t.who, "leaderOrChar");
    }
  });

  it("ST01-015 Jet Pistol — Main KO power ≤6000, Trigger reuses Main", () => {
    const a = ab("ST01-015");
    assert.equal(a.isMainEvent, true);
    assert.equal(a.triggerActivateMain, true);
    const e = a.mainEffects[0]!;
    assert.equal(e.type, "ko");
    if (e.type === "ko") {
      assert.equal(e.n, 1);
      assert.equal(e.maxPower, 6000);
      assert.equal(e.maxCost, null);
    }
  });

  it("ST01-016 Diable Jambe — targeted blocker ban this turn + trigger KO [Blocker] cost ≤3", () => {
    const a = ab("ST01-016");
    assert.equal(a.isMainEvent, true);
    const main = a.mainEffects[0]!;
    assert.equal(main.type, "noBlocker");
    if (main.type === "noBlocker") {
      assert.equal(main.duration, "turn");
      assert.equal(main.who, "leaderOrChar");
      assert.equal(main.trait, "Straw Hat Crew");
      assert.equal(main.powerMin, undefined);
    }
    const trig = a.trigger.find((e) => e.type === "ko");
    assert.ok(trig);
    if (trig && trig.type === "ko") {
      assert.equal(trig.maxCost, 3);
      assert.equal(trig.keyword, "blocker");
    }
  });

  it("ST01-017 Thousand Sunny — rest this Stage, +1000 to a Straw Hat", () => {
    const a = ab("ST01-017");
    assert.equal(a.activateRest, true);
    const e = a.activateMain[0]!;
    assert.equal(e.type, "power");
    if (e.type === "power") {
      assert.equal(e.amount, 1000);
      assert.equal(e.duration, "turn");
      assert.equal(e.who, "leaderOrChar");
      assert.equal(e.trait, "Straw Hat Crew");
    }
  });

  it("no ST01 card is silently dropped by the parser", () => {
    for (const [id, card] of cards) {
      const a = parseCard(card);
      assert.ok(a, id);
      assert.equal(typeof a.blocker, "boolean", id);
    }
  });

  it("ST01-014 FR-only [Contre] still parses as a Counter event +3000", () => {
    const base = cards.get("ST01-014")!;
    const frOnly = {
      ...base,
      textEn: "",
      text: "[Contre] Jusqu'à 1 de vos Leaders ou Personnages gagne +3000 de puissance pour tout le combat.\n[Déclenchement] Jusqu'à 1 de vos Leaders ou Personnages gagne +1000 de puissance pour tout le tour.",
    };
    clearParseCache();
    const a = parseCard(frOnly);
    assert.equal(a.isCounterEvent, true);
    assert.equal(a.isMainEvent, false);
    const c = a.counterEffects[0]!;
    assert.equal(c.type, "power");
    if (c.type === "power") {
      assert.equal(c.amount, 3000);
      assert.equal(c.duration, "battle");
    }
  });
});
