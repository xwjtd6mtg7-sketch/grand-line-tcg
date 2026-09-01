import { useEffect, useRef, useState } from "react";
import { CardBack, CardFace } from "@/components/card-face";
import {
  attackerUnit,
  currentPower,
  defendingUnit,
  engineCard,
  type Action,
  type GameState,
} from "@/lib/tcg/engine";
import { parseCard } from "@/lib/tcg/parse";
import { cn } from "@/lib/utils";

export type ClashSnap = {
  atkId: string;
  defId: string;
  atkP: number;
  defP: number;
  hitLeader: boolean;
  atkWins: boolean;
  lifeLost: number;
};

export function snapBattle(state: GameState): ClashSnap | null {
  const atk = attackerUnit(state);
  const def = defendingUnit(state);
  if (!atk || !def) return null;
  const atkP = currentPower(state, state.turn, atk);
  const defP = currentPower(state, def.pid, def.unit);
  const abs = parseCard(engineCard(atk.id));
  const hitLeader = def.unit === state.players[def.pid].leader;
  const atkWins = atkP >= defP;
  return {
    atkId: atk.id,
    defId: def.unit.id,
    atkP,
    defP,
    hitLeader,
    atkWins,
    lifeLost: atkWins && hitLeader ? (abs.doubleAttack ? 2 : 1) : 0,
  };
}

export function CombatOverlay({
  state,
  legal,
  spectator,
  aftermath,
  onBlock,
  onPassBlock,
  onCounter,
  onPassCounter,
  onAftermathDone,
}: {
  state: GameState;
  legal: Action[];
  spectator?: boolean;
  aftermath?: ClashSnap | null;
  onBlock: (iid: string) => void;
  onPassBlock: () => void;
  onCounter: (handIndex: number) => void;
  onPassCounter: () => void;
  onAftermathDone?: () => void;
}) {
  const live = snapBattle(state);
  const snap = aftermath ?? live;
  const resolving = Boolean(aftermath);
  const [beat, setBeat] = useState<"in" | "hold" | "impact" | "result">(resolving ? "impact" : "in");
  const doneRef = useRef(onAftermathDone);
  doneRef.current = onAftermathDone;
  const seen = useRef<ClashSnap | null>(null);

  useEffect(() => {
    if (aftermath) return;
    setBeat("in");
    const t = window.setTimeout(() => setBeat("hold"), 620);
    return () => window.clearTimeout(t);
  }, [live?.atkId, live?.defId, state.step.kind, aftermath]);

  useEffect(() => {
    if (!aftermath || seen.current === aftermath) return;
    seen.current = aftermath;
    setBeat("impact");
    const a = window.setTimeout(() => setBeat("result"), 520);
    const b = window.setTimeout(() => doneRef.current?.(), 1760);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [aftermath]);

  if (!snap) return null;

  const atkWins = snap.atkP >= snap.defP;
  const blockers = legal.filter((a): a is Action & { type: "block"; iid: string } => a.type === "block" && !!a.iid);
  const counters = legal.filter((a): a is Action & { type: "counterCard" } => a.type === "counterCard");
  const me = state.players[0];
  const choosing = !resolving && !spectator && (state.step.kind === "block" || state.step.kind === "counter");
  const resultKind = resolving
    ? snap.atkWins
      ? snap.hitLeader
        ? "life"
        : "ko"
      : "whiff"
    : null;

  return (
    <div
      className={cn(
        "combat-root absolute inset-0 z-40 flex flex-col",
        beat === "impact" && "combat-impact",
        beat === "result" && "combat-result",
      )}
    >
      <div className="combat-speed" />
      <span className="combat-shock" />
      {beat === "impact" || beat === "result" ? <span className="combat-shock is-late" /> : null}
      {beat === "impact" ? <span className="combat-flash" /> : null}
      {beat === "impact" || beat === "result" ? <span className="combat-burst" /> : null}

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center gap-8 px-3 pt-8">
        <ClashCard
          side="left"
          cardId={snap.atkId}
          power={snap.atkP}
          win={atkWins}
          beat={beat}
          impact={beat === "impact" || beat === "result"}
        />
        <ClashCard
          side="right"
          cardId={snap.defId}
          power={snap.defP}
          win={!atkWins}
          beat={beat}
          impact={beat === "impact" || beat === "result"}
          ko={resultKind === "ko" && beat === "result"}
          dim={resultKind === "life" && beat === "result"}
        />
      </div>
      {beat === "in" || beat === "hold" ? (
        <span className="combat-vs font-display">VS</span>
      ) : null}

      {resultKind === "life" && beat === "result" ? (
        <div className="pointer-events-none absolute inset-x-0 top-[10%] z-20 flex justify-center gap-1">
          {Array.from({ length: Math.max(1, snap.lifeLost) }).map((_, i) => (
            <CardBack key={i} className="life-fly h-[78px] w-[56px]" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : null}

      {resultKind === "whiff" && beat === "result" ? (
        <p className="combat-result-label font-display">RÉSISTÉ</p>
      ) : null}
      {resultKind === "ko" && beat === "result" ? (
        <p className="combat-result-label font-display">K.O.</p>
      ) : null}
      {resultKind === "life" && beat === "result" ? (
        <p className="combat-result-label is-life font-display">LIFE −{snap.lifeLost}</p>
      ) : null}

      <div className="relative z-10 flex min-h-[120px] w-full shrink-0 flex-col justify-end px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))]">
        {resolving ? null : spectator ? (
          <p className="mb-4 text-center text-sm text-muted">L’adversaire répond…</p>
        ) : choosing && state.step.kind === "block" ? (
          <div className="clash-pick">
            {blockers.length ? (
              <div className="clash-pick-row">
                {blockers.map((a) => {
                  const ch = me.chars.find((c) => c.iid === a.iid);
                  if (!ch) return null;
                  return (
                    <button key={a.iid} type="button" className="clash-pick-card" onClick={() => onBlock(a.iid)}>
                      <CardFace card={engineCard(ch.id)} className="w-full target-glow" />
                      <span>Bloquer</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="clash-pick-empty">Aucun Blocker disponible.</p>
            )}
            <button type="button" className="studio-float-save clash-pick-btn" onClick={onPassBlock}>
              Ne pas bloquer
            </button>
          </div>
        ) : choosing && state.step.kind === "counter" ? (
          <div className="clash-pick">
            {counters.length ? (
              <div className="clash-pick-row">
                {counters.map((a) => {
                  const id = me.hand[a.handIndex];
                  if (!id) return null;
                  const c = engineCard(id);
                  const plus = c.counter || parseCard(c).counterPlus || 1000;
                  return (
                    <button key={`${id}-${a.handIndex}`} type="button" className="clash-pick-card" onClick={() => onCounter(a.handIndex)}>
                      <CardFace card={c} className="w-full card-playable" />
                      <span>+{plus}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="clash-pick-empty">Aucun Counter en main.</p>
            )}
            <button type="button" className="studio-float-save clash-pick-btn" onClick={onPassCounter}>
              Passer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClashCard({
  side,
  cardId,
  power,
  win,
  beat,
  impact,
  ko,
  dim,
}: {
  side: "left" | "right";
  cardId: string;
  power: number;
  win: boolean;
  beat: "in" | "hold" | "impact" | "result";
  impact?: boolean;
  ko?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "clash-card",
        side === "left" ? "clash-left" : "clash-right",
        impact && (win ? "is-impact is-win" : "is-impact is-hit"),
        ko && "is-ko",
        dim && "is-dim",
      )}
    >
      <span className="clash-trail" />
      <div className="clash-art">
        <CardFace card={engineCard(cardId)} className="w-full" />
        {ko ? <span className="ko-stamp font-display">KO</span> : null}
      </div>
      <span className={cn("clash-power font-display", win ? "is-win" : "is-lose", beat === "impact" && "is-punch")}>
        {power}
      </span>
    </div>
  );
}
