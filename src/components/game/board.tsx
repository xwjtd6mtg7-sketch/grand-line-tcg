import { useEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { createPortal } from "react-dom";
import { CardFace } from "@/components/card-face";
import { CombatInspect, PlainZoom, effectLine, type CombatAction } from "@/components/game/combat-inspect";
import { ConfirmAsk } from "@/components/confirm-ask";
import { Button } from "@/components/ui/button";
import { CombatOverlay, snapBattle, type ClashSnap } from "@/components/game/combat";
import { TableFxLayer, type TableFx } from "@/components/game/fx";
import { MulliganScreen } from "@/components/game/mulligan";
import { CoinFlip } from "@/components/game/coinflip";
import { RestWrap, SickAura } from "@/components/game/rest";
import { MatchOver, TurnBanner, type BannerKind } from "@/components/game/banners";
import { DeckPile, DonAttach, DonFace, DonStack, LifeRow, OppHand, TrashPile } from "@/components/game/tokens";
import { TrashView } from "@/components/game/trash";
import { BrandLockup } from "@/components/brand";
import {
  applyAction,
  currentPower,
  engineCard,
  findUnit,
  legalActions,
  type Action,
  type GameState,
  type Unit,
} from "@/lib/tcg/engine";
import { pickCpuAction } from "@/lib/tcg/ai";
import { parseCard } from "@/lib/tcg/parse";
import { COLOR_HEX, colorsOk } from "@/lib/tcg/catalog";
import { useCosmeticSrc } from "@/lib/tcg/art";
import { sfx, unlockSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import type { TcgCard } from "@/lib/tcg/types";

type Drag =
  | { kind: "hand"; i: number; x: number; y: number; startX: number; startY: number; moved: boolean }
  | { kind: "don"; x: number; y: number; startX: number; startY: number; moved: boolean }
  | { kind: "unit"; iid: string; x: number; y: number; startX: number; startY: number; moved: boolean };

type Sel = { kind: "unit"; iid: string } | { kind: "attack"; iid: string } | { kind: "don" } | null;

function safePower(state: GameState, pid: 0 | 1, unit: Unit) {
  try {
    return currentPower(state, pid, unit);
  } catch {
    return engineCard(unit.id).power ?? 0;
  }
}

function donSnap(state: GameState) {
  const out: { iid: string; n: number; side: 0 | 1 }[] = [];
  for (const side of [0, 1] as const) {
    const p = state.players[side];
    out.push({ iid: p.leader.iid, n: p.leader.don, side });
    for (const c of p.chars) out.push({ iid: c.iid, n: c.don, side });
  }
  return out;
}

export function Playmat({
  initial,
  onExit,
  onOver,
}: {
  initial: GameState;
  onExit: () => void;
  onOver: (win: boolean) => void;
}) {
  const [state, setState] = useState(initial);
  const [sel, setSel] = useState<Sel>(null);
  const [inspect, setInspect] = useState<TcgCard | null>(null);
  const [viewCard, setViewCard] = useState<TcgCard | null>(null);
  const [trashSide, setTrashSide] = useState<0 | 1 | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [peek, setPeek] = useState<number | null>(null);
  const [pwa, setPwa] = useState(false);
  const [turnBanner, setTurnBanner] = useState<BannerKind | null>(null);
  const [flash, setFlash] = useState("");
  const [coach, setCoach] = useState(true);
  const [fx, setFx] = useState<TableFx[]>([]);
  const [aftermath, setAftermath] = useState<ClashSnap | null>(null);
  const [leave, setLeave] = useState(false);
  const matSrc = useCosmeticSrc("mat");
  const fxN = useRef(0);
  const reported = useRef(false);
  const handRef = useRef<HTMLDivElement>(null);
  const [railW, setRailW] = useState(240);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const selRef = useRef<Sel>(null);
  selRef.current = sel;
  const lastTurn = useRef<0 | 1 | null>(null);

  const me = state.players[0];
  const opp = state.players[1];
  const legal = useMemo(() => {
    try {
      return legalActions(state, 0);
    } catch (err) {
      console.error("[legal]", err);
      return [];
    }
  }, [state]);
  const cpuTurn =
    (state.step.kind === "main" && state.turn === 1) ||
    (state.step.kind === "choose" && state.step.pid === 1) ||
    ((state.step.kind === "block" || state.step.kind === "counter") && state.turn === 0) ||
    (state.step.kind === "trigger" && state.step.pid === 1);

  const showCombat = state.step.kind === "block" || state.step.kind === "counter" || Boolean(aftermath);

  useEffect(() => {
    const el = handRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRailW(el.clientWidth));
    ro.observe(el);
    setRailW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pushFx = (kind: TableFx["kind"], cardId?: string, toIid?: string, side?: 0 | 1, from?: TableFx["from"]) => {
    const id = ++fxN.current;
    setFx((list) => [...list, { id, kind, cardId, toIid, side, from }]);
  };

  const fxSnap = useRef({
    meH: initial.players[0].hand.length,
    oppH: initial.players[1].hand.length,
    meDeck: initial.players[0].deck.length,
    oppDeck: initial.players[1].deck.length,
    meLife: initial.players[0].life.length,
    oppLife: initial.players[1].life.length,
    dons: donSnap(initial),
    oppChars: initial.players[1].chars.map((c) => c.iid),
    oppStage: initial.players[1].stage?.iid ?? null,
  });

  useEffect(() => {
    if (state.step.kind === "mulligan" || state.step.kind === "coin") {
      fxSnap.current = {
        meH: me.hand.length,
        oppH: opp.hand.length,
        meDeck: me.deck.length,
        oppDeck: opp.deck.length,
        meLife: me.life.length,
        oppLife: opp.life.length,
        dons: donSnap(state),
        oppChars: opp.chars.map((c) => c.iid),
        oppStage: opp.stage?.iid ?? null,
      };
      return;
    }
    const prev = fxSnap.current;
    const meDraws = Math.max(0, Math.min(me.hand.length - prev.meH, prev.meDeck - me.deck.length));
    const oppDraws = Math.max(0, Math.min(opp.hand.length - prev.oppH, prev.oppDeck - opp.deck.length));
    const meLifeGain = Math.max(0, Math.min(me.hand.length - prev.meH - meDraws, prev.meLife - me.life.length));
    const oppLifeGain = Math.max(0, Math.min(opp.hand.length - prev.oppH - oppDraws, prev.oppLife - opp.life.length));
    if (meDraws > 0) {
      me.hand.slice(-meDraws).forEach((id, i) => {
        window.setTimeout(() => pushFx("draw", id, undefined, 0, "deck"), i * 130);
      });
    }
    if (oppDraws > 0) {
      for (let i = 0; i < oppDraws; i++) window.setTimeout(() => pushFx("draw", undefined, undefined, 1, "deck"), i * 130);
    }
    if (meLifeGain > 0) {
      me.hand.slice(-meLifeGain).forEach((id, i) => {
        window.setTimeout(() => pushFx("draw", id, undefined, 0, "life"), i * 130);
      });
    }
    if (oppLifeGain > 0) {
      for (let i = 0; i < oppLifeGain; i++) {
        window.setTimeout(() => pushFx("draw", undefined, undefined, 1, "life"), i * 130);
      }
    }
    const now = donSnap(state);
    for (const cur of now) {
      const old = prev.dons.find((d) => d.iid === cur.iid);
      if (cur.n > (old?.n ?? 0)) {
        pushFx("donGive", undefined, cur.iid, cur.side);
        sfx("don");
      }
    }
    for (const c of opp.chars) {
      if (!(prev.oppChars ?? []).includes(c.iid)) {
        pushFx("oppPlay", c.id, c.iid, 1);
        sfx("play");
      }
    }
    if (opp.stage && opp.stage.iid !== prev.oppStage) {
      pushFx("oppPlay", opp.stage.id, opp.stage.iid, 1);
      sfx("play");
    }
    fxSnap.current = {
      meH: me.hand.length,
      oppH: opp.hand.length,
      meDeck: me.deck.length,
      oppDeck: opp.deck.length,
      meLife: me.life.length,
      oppLife: opp.life.length,
      dons: now,
      oppChars: opp.chars.map((c) => c.iid),
      oppStage: opp.stage?.iid ?? null,
    };
  }, [state]);

  useEffect(() => {
    if (state.step.kind === "over" && !reported.current) {
      reported.current = true;
      onOver(state.step.winner === 0);
      sfx(state.step.winner === 0 ? "win" : "lose");
    }
  }, [state.step, onOver]);

  const isLegal = (a: Action) => {
    if (legal.some((x) => JSON.stringify(x) === JSON.stringify(a))) return true;
    if (a.type === "play") return legal.some((x) => x.type === "play" && x.handIndex === a.handIndex);
    return false;
  };

  const act = (a: Action, keep = false) => {
    if (cpuTurn && a.type !== "block" && a.type !== "counterCard" && a.type !== "passCounter") return;
    if (!keep) setSel(null);
    if (!isLegal(a) && a.type !== "mulligan") {
      const live = legalActions(stateRef.current, 0);
      const hit =
        live.some((x) => JSON.stringify(x) === JSON.stringify(a)) ||
        (a.type === "play" && live.some((x) => x.type === "play" && x.handIndex === a.handIndex));
      if (!hit) return;
    }
    unlockSfx();
    if (a.type === "passCounter") {
      const snap = snapBattle(stateRef.current);
      const s = stateRef.current;
      const defPid = (s.turn ^ 1) as 0 | 1;
      setState(applyAction(s, defPid, a));
      if (snap) setAftermath(snap);
      sfx("hit");
      return;
    }
    const hand = stateRef.current.players[0].hand;
    if (a.type === "play") {
      const cid = hand[a.handIndex];
      const card = cid ? engineCard(cid) : null;
      sfx("play");
      if (card?.type === "Event") pushFx("event", cid);
      else if (card?.type === "Stage") pushFx("stage", cid);
      else pushFx("play", cid);
    } else if (a.type === "attack") sfx("attack");
    else if (a.type === "block") sfx("block");
    else if (a.type === "counterCard") {
      sfx("hit");
      pushFx("discard", hand[a.handIndex]);
    } else if (a.type !== "attachDon") sfx("ui");
    setFlash(a.type);
    window.setTimeout(() => setFlash(""), 380);
    setState((s) => applyAction(s, 0, a));
    if (a.type === "attachDon" || a.type === "attack") setCoach(false);
    if (a.type === "attachDon") setSel(null);
  };

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)");
    const sync = () => setPwa(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (state.step.kind === "over" || state.step.kind === "mulligan" || state.step.kind === "coin") return;
    if (aftermath) return;
    if (state.step.kind === "block" && state.turn === 0) {
      const t = window.setTimeout(() => {
        const s = stateRef.current;
        const a = pickCpuAction(s);
        if (!a) return;
        setState(applyAction(s, 1, a));
      }, 1080);
      return () => window.clearTimeout(t);
    }
    if (cpuTurn && state.step.kind === "choose") {
      const t = window.setTimeout(() => {
        const s = stateRef.current;
        const a = pickCpuAction(s);
        if (a) setState(applyAction(s, s.step.kind === "choose" ? s.step.pid : 1, a));
      }, 520);
      return () => window.clearTimeout(t);
    }
    if (cpuTurn && state.step.kind === "main") {
      const t = window.setTimeout(() => {
        const s = stateRef.current;
        const a = pickCpuAction(s);
        if (a) setState(applyAction(s, 1, a));
      }, 900);
      return () => window.clearTimeout(t);
    }
    if (cpuTurn && (state.step.kind === "counter" || state.step.kind === "trigger")) {
      const t = window.setTimeout(() => {
        const s = stateRef.current;
        const a = pickCpuAction(s);
        if (a) {
          const pid = s.step.kind === "trigger" ? s.step.pid : 1;
          setState(applyAction(s, pid, a));
        }
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [state.step, legal, cpuTurn, aftermath]);

  useEffect(() => {
    if (state.step.kind === "over" || state.step.kind === "mulligan" || state.step.kind === "coin") {
      setTurnBanner(null);
      return;
    }
    if (state.step.kind === "block") {
      setTurnBanner("block");
      sfx("block");
      const t = window.setTimeout(() => setTurnBanner(null), 1600);
      return () => window.clearTimeout(t);
    }
    if (state.step.kind === "counter") {
      setTurnBanner("counter");
      sfx("ui");
      const t = window.setTimeout(() => setTurnBanner(null), 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.step.kind]);

  useEffect(() => {
    if (state.step.kind !== "main") return;
    if (lastTurn.current === state.turn) return;
    lastTurn.current = state.turn;
    setTurnBanner(state.turn === 0 ? "player" : "cpu");
    sfx("ui");
    const t = window.setTimeout(() => setTurnBanner(null), 2400);
    return () => window.clearTimeout(t);
  }, [state.turn, state.turnSeq, state.step.kind]);

  const dropAt = (x: number, y: number) => {
    const rail = handRef.current?.closest(".me-rail") as HTMLElement | null;
    if (rail) {
      const rr = rail.getBoundingClientRect();
      if (y >= rr.top - 6) return "hand";
    }
    const seen = new Set<string>();
    const hits: string[] = [];
    for (const el of document.elementsFromPoint(x, y)) {
      const n = (el as Element).closest?.("[data-drop]") as HTMLElement | null;
      const drop = n?.dataset.drop;
      if (!drop || seen.has(drop)) continue;
      seen.add(drop);
      hits.push(drop);
    }
    const precise = hits.find((d) => /^(field:\d+|my-char:|opp-char:|stage$|my-leader|opp-leader)/.test(d));
    if (precise) return precise;
    if (hits[0]) return hits[0];

    const nodes = [...document.querySelectorAll<HTMLElement>("[data-drop]")];
    let best: string | null = null;
    let bestDist = 56;
    for (const n of nodes) {
      const drop = n.dataset.drop;
      if (!drop || drop === "hand" || drop === "opp-field") continue;
      const r = n.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const pad = /^(field:\d+|my-char:|stage$)/.test(drop) ? 28 : 18;
      if (dist < bestDist && dist < Math.max(pad, Math.min(r.width, r.height) * 0.7)) {
        bestDist = dist;
        best = drop;
      }
    }
    return best;
  };

  const resolveDrop = (d: Drag, zone: string | null, live: GameState) => {
    const ok = (a: Action) =>
      legalActions(live, 0).some((x) => JSON.stringify(x) === JSON.stringify(a)) ||
      (a.type === "play" && legalActions(live, 0).some((x) => x.type === "play" && x.handIndex === a.handIndex));
    if (!d.moved) {
      if (d.kind === "unit") {
        setSel({ kind: "unit", iid: d.iid });
        const u = findUnit(live.players[0], d.iid) ?? (live.players[0].leader.iid === d.iid ? live.players[0].leader : live.players[0].stage);
        if (u) setInspect(engineCard(u.id));
      }
      if (d.kind === "don") {
        setSel((s) => (s?.kind === "don" ? null : { kind: "don" }));
      }
      return;
    }
    if (!zone || zone === "hand") return;
    if (d.kind === "hand") {
      const id = live.players[0].hand[d.i];
      const card = id ? engineCard(id) : null;
      const play: Action = { type: "play", handIndex: d.i };
      const counter: Action = { type: "counterCard", handIndex: d.i };
      const slot = (() => {
        if (zone.startsWith("field:")) {
          const n = Number(zone.slice(6));
          return Number.isFinite(n) ? n : undefined;
        }
        if (zone.startsWith("my-char:")) {
          const iid = zone.slice(8);
          const chs = live.players[0].chars;
          const u = chs.find((ch) => ch.iid === iid);
          if (!u) return undefined;
          return u.slot ?? chs.indexOf(u);
        }
        return undefined;
      })();
      const onMine =
        zone === "field" ||
        zone.startsWith("field:") ||
        zone === "stage" ||
        zone === "my-leader" ||
        zone.startsWith("my-char");
      if (card && (card.type === "Event" || card.type === "Stage") && (onMine || zone === "opp-field")) {
        if (ok(play)) return act(play);
        if (ok(counter)) return act(counter);
      }
      if (onMine && card?.type === "Character" && ok(play)) {
        if (live.players[0].chars.length >= 5) {
          const replaceIid = zone.startsWith("my-char:")
            ? zone.slice(8)
            : Number.isFinite(slot)
              ? live.players[0].chars.find((ch, i) => (ch.slot ?? i) === slot)?.iid
              : live.players[0].chars[0]?.iid;
          return act({ type: "play", handIndex: d.i, replaceIid, slot });
        }
        return act({ type: "play", handIndex: d.i, slot });
      }
      if (onMine && ok(play)) return act(play);
      if (ok(counter) && onMine) return act(counter);
    }
    if (d.kind === "don") {
      if (zone === "my-leader") {
        const a: Action = { type: "attachDon", iid: live.players[0].leader.iid, n: 1 };
        if (ok(a)) return act(a, true);
      }
      if (zone.startsWith("my-char:")) {
        const a: Action = { type: "attachDon", iid: zone.slice(8), n: 1 };
        if (ok(a)) return act(a, true);
      }
      if (zone.startsWith("field:")) {
        const slot = Number(zone.slice(6));
        const u = live.players[0].chars.find((ch, i) => (ch.slot ?? i) === slot);
        if (u) {
          const a: Action = { type: "attachDon", iid: u.iid, n: 1 };
          if (ok(a)) return act(a, true);
        }
      }
    }
    if (d.kind === "unit") {
      if (zone.startsWith("opp-char:")) {
        const a: Action = { type: "attack", attackerIid: d.iid, target: { kind: "char", iid: zone.slice(9) } };
        if (ok(a)) return act(a);
      }
      if (zone === "opp-leader" || zone === "opp-field") {
        const a: Action = { type: "attack", attackerIid: d.iid, target: { kind: "leader" } };
        if (ok(a)) return act(a);
      }
    }
  };

  const startPointer = (e: PE<HTMLElement>, next: Drag) => {
    e.preventDefault();
    e.stopPropagation();
    unlockSfx();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    dragRef.current = next;
    setDrag(next);
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) > 8;
      const n = { ...d, x: ev.clientX, y: ev.clientY, moved } as Drag;
      dragRef.current = n;
      setDrag(n);
      setHover(dropAt(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const d = dragRef.current;
      setDrag(null);
      setHover(null);
      if (d) resolveDrop(d, dropAt(ev.clientX, ev.clientY), stateRef.current);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const handIndexAt = (x: number, y?: number) => {
    const el = handRef.current;
    const n = stateRef.current.players[0].hand.length;
    if (!el || n <= 1) return 0;
    const cards = [...el.querySelectorAll<HTMLElement>("[data-hand-i]")];
    if (!cards.length) return Math.max(0, Math.min(n - 1, 0));
    const rects = cards.map((c) => {
      const i = Number(c.dataset.handI);
      return { i: Number.isFinite(i) ? i : 0, r: c.getBoundingClientRect() };
    });
    rects.sort((a, b) => a.i - b.i);
    for (let k = rects.length - 1; k >= 0; k--) {
      const { i, r } = rects[k];
      const next = rects[k + 1]?.r;
      const left = r.left;
      const right = k === rects.length - 1 ? r.right : next ? next.left : r.right;
      const top = r.top - 28;
      const bottom = r.bottom + 18;
      if (x >= left && x <= right && (y == null || (y >= top && y <= bottom))) return i;
    }
    let best = rects[0]?.i ?? 0;
    let bestD = Infinity;
    for (const { i, r } of rects) {
      const d = Math.abs(x - (r.left + r.width * 0.35));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const startHand = (e: PE<HTMLElement>, index: number) => {
    if (cpuTurn && state.step.kind === "main") return;
    e.preventDefault();
    e.stopPropagation();
    unlockSfx();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    let mode: "down" | "peek" | "drag" = "down";
    let idx = handIndexAt(e.clientX, e.clientY);
    if (idx < 0 || idx >= stateRef.current.players[0].hand.length) idx = index;
    setPeek(idx);
    let done = false;
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dist = Math.hypot(dx, dy);
      if (mode === "down" && dist > 8) {
        const rail = handRef.current?.getBoundingClientRect();
        mode = (rail ? ev.clientY < rail.top - 4 : dy < -18) || dy < -18 ? "drag" : "peek";
      }
      if (mode === "peek") {
        const rail = handRef.current?.getBoundingClientRect();
        if ((rail && ev.clientY < rail.top - 8) || dy < -28) mode = "drag";
      }
      if (mode === "peek") {
        idx = handIndexAt(ev.clientX, ev.clientY);
        setPeek(idx);
        setDrag(null);
        return;
      }
      if (mode === "down") {
        setPeek(idx);
        return;
      }
      setPeek(null);
      const n: Drag = {
        kind: "hand",
        i: idx,
        x: ev.clientX,
        y: ev.clientY,
        startX,
        startY,
        moved: true,
      };
      dragRef.current = n;
      setDrag(n);
      setHover(dropAt(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => {
      if (done) return;
      done = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const wasPeek = mode !== "drag";
      setPeek(null);
      setHover(null);
      if (wasPeek) {
        setDrag(null);
        return;
      }
      const d = dragRef.current;
      setDrag(null);
      if (d) resolveDrop(d, dropAt(ev.clientX, ev.clientY), stateRef.current);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const tryAttack = (attackerIid: string, target: { kind: "leader" } | { kind: "char"; iid: string }) => {
    const hit = legal.find(
      (a) =>
        a.type === "attack" &&
        a.attackerIid === attackerIid &&
        a.target.kind === target.kind &&
        (target.kind === "leader" || (a.target.kind === "char" && a.target.iid === target.iid)),
    );
    if (!hit) return false;
    act(hit);
    return true;
  };

  const tapUnit = (iid: string, e: PE<HTMLElement>) => {
    if (state.step.kind === "choose" && state.step.pid === 0) {
      const hit = legal.find(
        (a) =>
          a.type === "chooseTarget" &&
          ((a.target.kind === "char" && a.target.iid === iid) ||
            (a.target.kind === "leader" && iid === me.leader.iid)),
      );
      if (hit) return act(hit);
    }
    if (sel?.kind === "don") {
      act({ type: "attachDon", iid, n: 1 }, true);
      return;
    }
    startPointer(e, {
      kind: "unit",
      iid,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    });
  };

  const canPlay = (i: number) => {
    if (state.step.kind !== "main" || state.turn !== 0) return false;
    if (legal.some((a) => a.type === "play" && a.handIndex === i)) return true;
    const id = me.hand[i];
    if (!id) return false;
    const c = engineCard(id);
    if ((c.cost ?? 99) > me.donActive) return false;
    const leader = engineCard(me.leader.id);
    if (c.colors.length && leader.colors.length && !colorsOk(leader, c)) return false;
    if (c.type === "Character" || c.type === "Stage") return true;
    if (c.type === "Event") return parseCard(c).isMainEvent;
    return false;
  };
  const canCounter = (i: number) => legal.some((a) => a.type === "counterCard" && a.handIndex === i);
  const effectReady = (iid: string) =>
    state.step.kind === "main" &&
    state.turn === 0 &&
    legal.some((a) => a.type === "activateMain" && a.iid === iid);

  const inspectIid = sel?.kind === "unit" || sel?.kind === "attack" ? sel.iid : undefined;
  const inspectUnit = inspectIid
    ? findUnit(me, inspectIid) ?? (me.leader.iid === inspectIid ? me.leader : me.stage)
    : null;
  const inspectPower =
    inspect && inspectUnit && engineCard(inspectUnit.id).id === inspect.id
      ? currentPower(state, 0, inspectUnit)
      : inspect?.power ?? null;
  const inspectActions: CombatAction[] = inspect
    ? (() => {
        const iid = inspectIid;
        const mine = Boolean(inspectUnit && engineCard(inspectUnit.id).id === inspect.id);
        if (!mine || !iid) return [];
        const abs = parseCard(inspect);
        const out: CombatAction[] = [];
        if (abs.activateMain.length) {
          const line = effectLine(inspect, "activateMain");
          const canAct = legal.some((a) => a.type === "activateMain" && a.iid === iid);
          out.push({
            id: "activate",
            tag: "Activer",
            body: line?.body || "Active l’effet de cette carte.",
            ready: canAct,
            cost: line?.cost || abs.activateCost || undefined,
            onClick: canAct
              ? () => {
                  act({ type: "activateMain", iid });
                  setInspect(null);
                  setSel(null);
                }
              : undefined,
          });
        }
        return out;
      })()
    : [];

  const attackerIid = sel?.kind === "attack" || sel?.kind === "unit" ? sel.iid : drag?.kind === "unit" ? drag.iid : null;
  const targets = legal
    .filter((a) => a.type === "attack" && (!attackerIid || a.attackerIid === attackerIid))
    .map((a) => (a.type === "attack" ? a.target : null))
    .filter(Boolean) as { kind: "leader" | "char"; iid?: string }[];
  const draggingUnit = drag?.kind === "unit";
  const draggingDon = drag?.kind === "don";
  const choosing = state.step.kind === "choose" && state.step.pid === 0;
  const chooseHot = (iid: string, asLeader = false) =>
    choosing &&
    legal.some(
      (a) =>
        a.type === "chooseTarget" &&
        (asLeader ? a.target.kind === "leader" && iid === me.leader.iid : a.target.kind === "char" && a.target.iid === iid),
    );

  const arriving = (iid: string) => fx.some((f) => f.kind === "oppPlay" && f.toIid === iid);

  const hole = (drop: string, mine = false) => (
    <div className={cn("char-hole", mine ? "is-me" : "is-opp", hover === drop && "drop-hot")} data-drop={drop}>
      CHAR
    </div>
  );

  const renderChar = (side: 0 | 1, i: number) => {
    const p = state.players[side];
    const u = p.chars.find((c, idx) => (c.slot ?? idx) === i);
    const dropField = side === 1 ? "opp-field" : `field:${i}`;
    const mine = side === 0;
    if (!u) return hole(dropField, mine);
    return (
      <FieldChar
        unit={u}
        mine={mine}
        power={safePower(state, side, u)}
        drop={side === 1 ? `opp-char:${u.iid}` : `my-char:${u.iid}`}
        summoning={arriving(u.iid)}
        effectReady={mine && effectReady(u.iid)}
        hot={
          chooseHot(u.iid) ||
          hover === `${side === 1 ? "opp" : "my"}-char:${u.iid}` ||
          hover === dropField ||
          (side === 1 && (targets.some((t) => t.kind === "char" && t.iid === u.iid) || Boolean(draggingUnit && u.rested))) ||
          (side === 0 &&
            ((sel?.kind === "unit" && sel.iid === u.iid) ||
              (sel?.kind === "don" && me.donActive > 0) ||
              Boolean(draggingDon)))
        }
        onPointerDown={
          side === 1
            ? () => {
                if (choosing) {
                  const hit = legal.find((a) => a.type === "chooseTarget" && a.target.kind === "char" && a.target.iid === u.iid);
                  if (hit) return act(hit);
                }
                const attacker = sel?.kind === "unit" || sel?.kind === "attack" ? sel.iid : null;
                if (attacker && tryAttack(attacker, { kind: "char", iid: u.iid })) return;
                setViewCard(engineCard(u.id));
              }
            : (e) => tapUnit(u.iid, e)
        }
      />
    );
  };

  const nHand = me.hand.length;

  const oppStage = opp.stage ? (
    <button
      type="button"
      className={cn("stage-mini is-opp is-filled edge-right", arriving(opp.stage.iid) && "is-arriving")}
      data-unit={opp.stage.iid}
      onClick={() => setViewCard(engineCard(opp.stage!.id))}
    >
      <RestWrap rested={opp.stage.rested} className="h-full w-full">
        <StageArt card={engineCard(opp.stage.id)} />
      </RestWrap>
    </button>
  ) : (
    <div className="stage-mini is-opp edge-right">STAGE</div>
  );

  const meStage = me.stage ? (
    <div data-drop="stage" data-unit={me.stage.iid} className={cn("stage-mini is-me is-filled edge-left", effectReady(me.stage.iid) && "fx-ready")}>
      <RestWrap rested={me.stage.rested} className="h-full w-full">
        <StageArt card={engineCard(me.stage.id)} onPointerDown={(e) => tapUnit(me.stage!.iid, e)} />
      </RestWrap>
    </div>
  ) : (
    <div data-drop="stage" className={cn("stage-mini is-me edge-left", hover === "stage" && "drop-hot")}>
      STAGE
    </div>
  );

  return (
    <div
      className={cn("playmat-grid relative text-foam", (flash === "attack" || flash === "hit") && "shake-hit")}
      style={{ ["--mat-image" as string]: `url("${matSrc}")` }}
    >
      <BrandLockup size="mat" className={cn("mat-logo", showCombat && "invisible")} />
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-end gap-3 px-3 pt-[max(0.35rem,env(safe-area-inset-top))]">
        <span className="ink-stroke font-display text-[12px] tabular-nums tracking-wider text-foam">T{state.turnNumber}</span>
        <button
          type="button"
          className="pointer-events-auto rounded-full border border-line-strong/70 bg-ink/55 px-3 py-1 font-display text-[10px] tracking-[0.22em] text-foam/80"
          onClick={() => setLeave(true)}
        >
          QUITTER
        </button>
      </header>

      <div className="opp-rail relative z-10 px-2 pr-16 pt-[max(1.55rem,calc(env(safe-area-inset-top)+1.05rem))]">
        <div className="justify-self-start">
          <DonStack active={opp.donActive} rested={opp.donRested} remain={opp.donRemain} turnActive={state.turn === 1 && state.step.kind !== "over"} />
        </div>
        <OppHand n={opp.hand.length} />
        <div className="justify-self-end">
          <LifeRow n={opp.life.length} side="opp" />
        </div>
      </div>

      <div className="mat-board">
        <div className="mat-piles is-opp">
          <TrashPile ids={opp.trash} onOpen={() => setTrashSide(1)} />
          <DeckPile n={opp.deck.length} label="DECK" side="opp" />
        </div>

        <div className="mat-center">
          <div className="mat-field is-opp">
            <div className="mat-cell" data-drop="opp-field">
              {renderChar(1, 0)}
            </div>
            <div className="mat-cell" data-drop="opp-field">
              {renderChar(1, 1)}
            </div>
            <div className="mat-cell" data-drop="opp-field">
              {renderChar(1, 2)}
            </div>
            <div className="mat-flank" data-drop="opp-field">
              {renderChar(1, 3)}
              <div className="stage-mini is-opp invisible pointer-events-none" aria-hidden />
            </div>
            <div className="mat-cell">
              <FieldLeader
                unit={opp.leader}
                mine={false}
                power={safePower(state, 1, opp.leader)}
                drop="opp-leader"
                hot={hover === "opp-leader" || targets.some((t) => t.kind === "leader") || Boolean(draggingUnit)}
                onPointerDown={() => {
                  if (choosing) {
                    const hit = legal.find((a) => a.type === "chooseTarget" && a.target.kind === "leader");
                    if (hit) return act(hit);
                  }
                  const attacker = sel?.kind === "unit" || sel?.kind === "attack" ? sel.iid : null;
                  if (attacker && tryAttack(attacker, { kind: "leader" })) return;
                  setViewCard(engineCard(opp.leader.id));
                }}
              />
            </div>
            <div className="mat-flank" data-drop="opp-field">
              {renderChar(1, 4)}
              {oppStage}
            </div>
          </div>

          <div className="mat-field is-me">
            <div className="mat-flank" data-drop="field:4">
              {meStage}
              {renderChar(0, 4)}
            </div>
            <div className="mat-cell">
              <FieldLeader
                unit={me.leader}
                mine
                power={safePower(state, 0, me.leader)}
                drop="my-leader"
                effectReady={effectReady(me.leader.iid)}
                hot={chooseHot(me.leader.iid, true) || hover === "my-leader"}
                onPointerDown={(e) => tapUnit(me.leader.iid, e)}
              />
            </div>
            <div className="mat-flank" data-drop="field:3">
              {state.step.kind === "main" && state.turn === 0 ? (
                <button type="button" className="wait-orb edge-right" onClick={() => act({ type: "endTurn" })}>
                  FIN
                </button>
              ) : cpuTurn && state.step.kind === "main" ? (
                <div className="wait-orb is-wait edge-right">…</div>
              ) : (
                <div className="edge-right h-[46px] w-[46px]" />
              )}
              {renderChar(0, 3)}
            </div>
            <div className="mat-cell" data-drop="field:2">
              {renderChar(0, 2)}
            </div>
            <div className="mat-cell" data-drop="field:1">
              {renderChar(0, 1)}
            </div>
            <div className="mat-cell" data-drop="field:0">
              {renderChar(0, 0)}
            </div>
          </div>
        </div>

        <div className="mat-piles is-me">
          <DeckPile n={me.deck.length} label="DECK" side="me" />
          <TrashPile ids={me.trash} onOpen={() => setTrashSide(0)} />
        </div>
      </div>

      <div className="me-rail relative z-20 overflow-visible px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div className="justify-self-start">
          <LifeRow n={me.life.length} side="me" />
        </div>
        <div ref={handRef} className="hand-rail" data-hand="me">
          {me.hand.map((id, i) => {
            const card = engineCard(id);
            const n = nHand;
            const w = pwa ? (n > 8 ? 74 : n > 6 ? 84 : 92) : n > 8 ? 66 : n > 6 ? 74 : 80;
            const step = n <= 1 ? w : Math.max(pwa ? 28 : 26, Math.min(pwa ? 38 : 34, Math.round(w * 0.42)));
            const mid = (n - 1) / 2;
            const peeked = peek === i;
            const rot = peek == null ? (n <= 1 ? 0 : (i - mid) * Math.min(4.2, 18 / n)) : (i - (peek ?? mid)) * 2.2;
            const hide = drag?.kind === "hand" && drag.moved && (drag.i === i || peek === i);
            const abs = parseCard(card);
            const counter = card.counter || abs.counterPlus || 0;
            const showCounter = (card.type === "Event" || card.type === "Character") && counter > 0;
            return (
              <div
                key={`${id}-${i}`}
                data-hand-i={i}
                className={cn("relative shrink-0", canPlay(i) && "is-playable")}
                style={{
                  width: w,
                  marginLeft: i === 0 ? 0 : step - w,
                  zIndex: peeked ? 40 : i,
                  pointerEvents: "none",
                  transform: `rotate(${peeked ? 0 : rot}deg) translateY(${peeked ? -18 : Math.abs(i - mid) * 3}px) scale(${peeked ? 1.18 : peek == null ? 1 : 0.94})`,
                  opacity: hide ? 0 : 1,
                  transition: "transform 140ms ease, opacity 80ms linear",
                }}
              >
                <CostPip card={card} className="hand-cost" />
                {showCounter ? (
                  <span className="hand-counter">
                    <span>
                      <svg className="counter-bolt" viewBox="0 0 12 16" aria-hidden>
                        <path
                          fill="#ffd24a"
                          stroke="#fff"
                          strokeWidth="0.7"
                          strokeLinejoin="round"
                          d="M7.4.6 1.5 8.3h3.5L3.1 15.4 10.9 7H7.2z"
                        />
                      </svg>
                      {counter}
                    </span>
                  </span>
                ) : null}
                <button
                  type="button"
                  className="aspect-[63/88] w-full touch-none overflow-hidden rounded-[8px]"
                  tabIndex={-1}
                >
                  <CardFace card={card} className="w-full" />
                </button>
                {canPlay(i) ? <span className="hand-halo" aria-hidden /> : null}
                <div
                  className="hand-hit"
                  style={{ width: i === n - 1 ? "100%" : Math.max(22, step + 4) }}
                  onPointerDown={(e) => startHand(e, i)}
                />
              </div>
            );
          })}
        </div>
        <div className="justify-self-end">
          <DonStack
            active={me.donActive}
            rested={me.donRested}
            remain={me.donRemain}
            mine
            glow={coach && state.step.kind === "main" && state.turn === 0 && me.donActive > 0}
            turnActive={state.turn === 0 && state.step.kind !== "over"}
            onPointerDown={
              me.donActive > 0 && state.step.kind === "main" && state.turn === 0
                ? (e) =>
                    startPointer(e, {
                      kind: "don",
                      x: e.clientX,
                      y: e.clientY,
                      startX: e.clientX,
                      startY: e.clientY,
                      moved: false,
                    })
                : undefined
            }
          />
        </div>
      </div>

      <TableFxLayer items={fx} onDone={(id) => setFx((list) => list.filter((x) => x.id !== id))} />

      {peek != null && me.hand[peek] && !drag?.moved && typeof document !== "undefined"
        ? createPortal(
            <div className="hand-peek-hero" key={me.hand[peek]}>
              <CardFace card={engineCard(me.hand[peek]!)} className="w-full" />
            </div>,
            document.body,
          )
        : null}

      {drag?.moved ? (
        <div
          className="pointer-events-none fixed z-[70] w-[76px] -translate-x-1/2 -translate-y-[90%] drop-shadow-2xl"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.kind === "hand" && me.hand[drag.i] ? <CardFace card={engineCard(me.hand[drag.i]!)} className="w-full" /> : null}
          {drag.kind === "don" ? <DonFace className="aspect-[63/88] w-full" /> : null}
          {drag.kind === "unit" ? (
            <CardFace card={engineCard(findUnit(me, drag.iid)?.id ?? me.leader.id)} className="w-full" />
          ) : null}
        </div>
      ) : null}

      {turnBanner ? <TurnBanner key={`${turnBanner}-${state.turnSeq}`} kind={turnBanner} /> : null}
      {choosing ? (
        <div className="choose-bar">
          <p className="choose-bar-copy font-display">{state.step.kind === "choose" ? state.step.prompt : ""}</p>
          {legal.some((a) => a.type === "skipChoose") ? (
            <button type="button" className="choose-skip" onClick={() => act({ type: "skipChoose" })}>
              Passer
            </button>
          ) : null}
        </div>
      ) : null}
      {sel?.kind === "don" ? (
        <div className="choose-bar">
          <p className="choose-bar-copy font-display">Choisis qui reçoit le DON!!</p>
          <button type="button" className="choose-skip" onClick={() => setSel(null)}>
            Annuler
          </button>
        </div>
      ) : null}

      {flash === "attachDon" ? (
        <div className="power-pop pointer-events-none absolute inset-x-0 top-[52%] z-30 text-center">+1000</div>
      ) : null}

      {showCombat ? (
        <CombatOverlay
          state={state}
          legal={legal}
          spectator={cpuTurn && !aftermath}
          aftermath={aftermath}
          onBlock={(iid) => act({ type: "block", iid })}
          onPassBlock={() => act({ type: "block", iid: null })}
          onCounter={(i) => act({ type: "counterCard", handIndex: i })}
          onPassCounter={() => act({ type: "passCounter" })}
          onAftermathDone={() => setAftermath(null)}
        />
      ) : null}

      {state.step.kind === "coin" ? <CoinFlip onDone={(first) => act({ type: "coinResult", first })} /> : null}
      {state.step.kind === "mulligan" ? (
        <MulliganScreen
          state={state}
          onKeep={() => act({ type: "mulligan", redraw: false })}
          onCommit={(next) => setState(next)}
          onInspect={(id) => setViewCard(engineCard(id))}
        />
      ) : null}
      {state.step.kind === "trigger" && state.step.pid === 0 ? (
        <div className="trigger-overlay">
          <p className="font-display text-[11px] tracking-[0.28em] text-don">TRIGGER</p>
          <div className="trigger-card">
            <CardFace card={engineCard(state.step.cardId)} className="w-full" />
          </div>
          <p className="max-w-[16rem] text-center text-sm text-foam/80">
            Activer le Trigger de {engineCard(state.step.cardId).name} ou garder la carte en main ?
          </p>
          <div className="flex w-full max-w-xs gap-2 px-2">
            <Button className="flex-1" size="lg" variant="crimson" onClick={() => act({ type: "triggerYes" })}>
              Activer
            </Button>
            <Button className="flex-1" size="lg" variant="ghost" onClick={() => act({ type: "triggerNo" })}>
              Garder en main
            </Button>
          </div>
        </div>
      ) : null}

      {inspect ? <CombatInspect card={inspect} power={inspectPower} actions={inspectActions} onClose={() => setInspect(null)} /> : null}
      {viewCard ? <PlainZoom card={viewCard} onClose={() => setViewCard(null)} /> : null}
      {trashSide != null ? (
        <TrashView
          ids={state.players[trashSide].trash}
          mine={trashSide === 0}
          onClose={() => setTrashSide(null)}
          onCard={(id) => setViewCard(engineCard(id))}
        />
      ) : null}
      {leave ? (
        <ConfirmAsk
          kicker="Combat"
          title="Quitter le combat ?"
          copy="La partie sera perdue."
          confirm="Oui"
          cancel="Non"
          onNo={() => setLeave(false)}
          onYes={onExit}
        />
      ) : null}
      {state.step.kind === "over" ? (
        <MatchOver win={state.step.winner === 0} leader={engineCard(state.players[state.step.winner].leader.id)} />
      ) : null}
    </div>
  );
}

function CostPip({ card, className }: { card: TcgCard; className?: string }) {
  if (card.cost == null) return null;
  const cols = card.colors;
  const a = cols[0] ? COLOR_HEX[cols[0]] : "#e10600";
  const b = cols[1] ? COLOR_HEX[cols[1]] : a;
  const bg = cols.length > 1 ? `linear-gradient(135deg, ${a} 49%, ${b} 51%)` : a;
  const yellow = cols[0] === "Yellow" && cols.length === 1;
  return (
    <span className={className} style={{ background: bg, color: yellow ? "#1a1408" : "#fff" }}>
      {card.cost}
    </span>
  );
}

function FieldLeader({
  unit,
  power,
  drop,
  glow,
  hot,
  mine,
  effectReady,
  onPointerDown,
}: {
  unit: Unit;
  power: number;
  drop: string;
  glow?: boolean;
  hot?: boolean;
  mine?: boolean;
  effectReady?: boolean;
  onPointerDown?: (e: PE<HTMLElement>) => void;
}) {
  const card = engineCard(unit.id);
  return (
    <div className={cn("leader-well", mine ? "is-me" : "is-opp", glow && "don-pulse")} data-drop={drop} data-unit={unit.iid}>
      <RestWrap rested={unit.rested} className={cn("is-leader", mine ? "is-me" : "is-opp", hot && "drop-hot", effectReady && "fx-ready")}>
        <button type="button" className="relative w-full touch-none overflow-visible" onPointerDown={onPointerDown}>
          {card.cost != null ? <CostPip card={card} className="field-cost" /> : null}
          <CardFace card={card} className="w-full" />
          <PowerTag card={card} power={power} large />
          <DonAttach n={unit.don} />
        </button>
      </RestWrap>
    </div>
  );
}

function FieldChar({
  unit,
  power,
  drop,
  hot,
  summoning,
  mine,
  effectReady,
  onPointerDown,
}: {
  unit: Unit;
  power: number;
  drop: string;
  hot?: boolean;
  summoning?: boolean;
  mine?: boolean;
  effectReady?: boolean;
  onPointerDown?: (e: PE<HTMLElement>) => void;
}) {
  const card = engineCard(unit.id);
  const abs = parseCard(card);
  const summonLock = unit.sick && !abs.rush && !abs.rushCharacter;
  return (
    <div className={cn("char-well", mine ? "is-me" : "is-opp", summoning && "is-arriving")} data-drop={drop} data-unit={unit.iid}>
      <RestWrap rested={unit.rested} className={cn("is-char w-full", hot && "drop-hot", effectReady && "fx-ready")}>
        <button type="button" className="relative w-full touch-none overflow-visible" onPointerDown={onPointerDown}>
          {card.cost != null ? <CostPip card={card} className="field-cost" /> : null}
          <CardFace card={card} className="w-full" />
          <PowerTag card={card} power={power} />
          <DonAttach n={unit.don} />
          {summonLock ? <SickAura /> : null}
        </button>
      </RestWrap>
    </div>
  );
}

function PowerTag({ card, power, large }: { card: TcgCard; power: number; large?: boolean }) {
  const c = card.colors[0] ? COLOR_HEX[card.colors[0]] : "#3a3d46";
  return (
    <span
      className={cn("field-power", large && "is-leader")}
      style={{
        background: large
          ? `linear-gradient(180deg, color-mix(in srgb, ${c} 70%, #fff), ${c} 78%, color-mix(in srgb, ${c} 88%, #1a0808))`
          : `linear-gradient(180deg, color-mix(in srgb, ${c} 42%, #fff), ${c} 52%, color-mix(in srgb, ${c} 72%, #120808))`,
      }}
    >
      {Number.isFinite(power) ? power : "—"}
    </span>
  );
}

function StageArt({
  card,
  onPointerDown,
}: {
  card: TcgCard;
  onPointerDown?: (e: PE<HTMLElement>) => void;
}) {
  const c = card.colors[0] ? COLOR_HEX[card.colors[0]] : "#c9a227";
  return (
    <div className="stage-crop" style={{ borderColor: c }}>
      <CardFace card={card} className="stage-crop-face" onPointerDown={onPointerDown} />
    </div>
  );
}
