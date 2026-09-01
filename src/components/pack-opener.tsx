import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { TcgCard } from "@/lib/tcg/types";
import { BoosterPack, CardBack, CardFace } from "./card-face";
import { CardDossier } from "./card-dossier";
import { RARITY_FR } from "@/lib/tcg/catalog";
import { BodyLock } from "@/lib/lock-body";
import { usePlayer } from "@/lib/store";
import { cn } from "@/lib/utils";
import { sfx, unlockSfx } from "@/lib/sfx";

const TEAR_TOP = 0.3;
const TEAR_PX = 132;

const HIT = new Set(["SR", "SEC", "SP", "L", "TR"]);

function isHit(r: string) {
  return HIT.has(r);
}

const RARITY_TONE: Record<string, string> = {
  C: "c",
  UC: "uc",
  R: "r",
  SR: "sr",
  SEC: "sec",
  L: "l",
  SP: "sp",
  PR: "pr",
  TR: "sr",
};

const RANK: Record<string, number> = { C: 0, UC: 1, R: 2, SR: 3, L: 3, TR: 4, SEC: 5, SP: 6 };

const TOSS = [
  { x: "0%", rot: "3deg" },
  { x: "10%", rot: "9deg" },
  { x: "-10%", rot: "-9deg" },
  { x: "18%", rot: "12deg" },
  { x: "-18%", rot: "-12deg" },
  { x: "28%", rot: "18deg" },
  { x: "-28%", rot: "-18deg" },
  { x: "42%", rot: "24deg" },
  { x: "-42%", rot: "-24deg" },
  { x: "56%", rot: "30deg" },
  { x: "-56%", rot: "-30deg" },
  { x: "8%", rot: "-6deg" },
  { x: "-14%", rot: "8deg" },
  { x: "34%", rot: "-16deg" },
  { x: "-36%", rot: "20deg" },
] as const;

function tossAway() {
  return TOSS[Math.floor(Math.random() * TOSS.length)] ?? TOSS[0];
}

function RareChip({ rarity, compact }: { rarity: string; compact?: boolean }) {
  const tone = RARITY_TONE[rarity] ?? "c";
  return (
    <span className={cn("mark-rare", `is-${tone}`, compact && "is-sm")}>{rarity}</span>
  );
}

function NewRibbon({ compact }: { compact?: boolean }) {
  return <span className={cn("mark-new", compact && "is-sm")}>NOUVEAU</span>;
}

function packTone(cards: TcgCard[]) {
  let best = "c";
  let n = -1;
  for (const c of cards) {
    const r = RANK[c.rarity] ?? 0;
    if (r > n) {
      n = r;
      best = RARITY_TONE[c.rarity] ?? "c";
    }
  }
  return best;
}

const SPARKS = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 + 0.4;
  const dist = 90 + (i % 5) * 28;
  return {
    i,
    delay: (i % 12) * 0.03,
    dur: 0.62 + (i % 4) * 0.1,
    scale: 0.55 + (i % 4) * 0.2,
    gold: i % 3 !== 0,
    dx: `${Math.cos(a) * dist}px`,
    dy: `${Math.sin(a) * dist - 20}px`,
  };
});

export function PackOpener({
  setId,
  setName,
  cards,
  packs = 1,
  onDone,
}: {
  setId: string;
  setName: string;
  cards: TcgCard[];
  packs?: number;
  onDone: () => void;
}) {
  const list = useMemo(() => (cards ?? []).filter((c): c is TcgCard => Boolean(c?.id)), [cards]);
  const collection = usePlayer((s) => s.collection);
  const owned = useRef(collection);
  const [phase, setPhase] = useState<"pack" | "rip" | "reveal" | "grid">("pack");
  const [shown, setShown] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [toss, setToss] = useState({ x: "0%", rot: "0deg" });
  const [instant, setInstant] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [marks, setMarks] = useState(false);
  const [info, setInfo] = useState<TcgCard | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, p: 0, dir: 1 });
  const start = useRef<{ x: number } | null>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  useEffect(() => {
    owned.current = collection;
  }, []);

  useEffect(() => {
    if (phase !== "reveal" || !flipped) {
      setMarks(false);
      return;
    }
    if (instant) {
      setMarks(true);
      return;
    }
    setMarks(false);
    const t = window.setTimeout(() => setMarks(true), 640);
    return () => window.clearTimeout(t);
  }, [phase, flipped, instant, shown]);

  useEffect(() => {
    if (phase !== "rip") return;
    const first = list[0];
    const secret = Boolean(first && isHit(first.rarity));
    sfx(list.some((c) => isHit(c.rarity)) ? "win" : "hit");
    const t = window.setTimeout(() => {
      setShown(1);
      setFlipped(!secret);
      setInstant(!secret);
      setPhase("reveal");
      lock.current = secret;
      if (!secret) sfx("draw");
    }, 780);
    return () => window.clearTimeout(t);
  }, [phase, list]);

  const current = shown > 0 ? list[shown - 1] : null;
  const hit = current ? isHit(current.rarity) : false;
  const discovered =
    current &&
    (owned.current[current.id] ?? 0) === 0 &&
    list.findIndex((c) => c.id === current.id) === shown - 1;
  const tone = current ? (RARITY_TONE[current.rarity] ?? "c") : "c";
  const flashTone = useMemo(() => packTone(list), [list]);
  const first = list[0];
  const firstSecret = Boolean(first && isHit(first.rarity));

  const skipAll = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (phase === "grid") return;
    if (phase === "reveal" && hit && !flipped) return;
    sfx("ui");
    const from = phase === "reveal" ? shown : 0;
    const nextSecret = list.findIndex((c, i) => i >= from && isHit(c.rarity));
    if (nextSecret < 0) {
      setPhase("grid");
      return;
    }
    setLeaving(false);
    setShown(nextSecret + 1);
    setFlipped(false);
    setInstant(false);
    setMarks(false);
    lock.current = false;
    setPhase("reveal");
  };

  const collect = () => {
    if (collecting) return;
    sfx("hit");
    const nav = document.querySelector<HTMLElement>("[data-nav=collection]");
    const t = nav?.getBoundingClientRect();
    const tx = t ? t.left + t.width / 2 : window.innerWidth * 0.375;
    const ty = t ? t.top + t.height / 2 : window.innerHeight - 36;
    const items = gridRef.current?.querySelectorAll<HTMLElement>(".pack-grid-item") ?? [];
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--fly-x", `${tx - (r.left + r.width / 2)}px`);
      el.style.setProperty("--fly-y", `${ty - (r.top + r.height / 2)}px`);
      el.style.setProperty("--fly-d", `${36 + Math.min(i, 20) * 26}ms`);
      el.style.setProperty("--fly-spin", `${i % 2 === 0 ? -26 : 26}deg`);
    });
    nav?.classList.add("is-catch");
    setCollecting(true);
    window.setTimeout(() => {
      nav?.classList.remove("is-catch");
      onDone();
    }, 780 + Math.min(items.length, 20) * 26);
  };

  const nextCard = () => {
    if (phase !== "reveal" || lock.current || leaving) return;
    if (!flipped) {
      setInstant(false);
      setFlipped(true);
      sfx(hit ? "win" : "draw");
      return;
    }
    if (shown >= list.length) {
      setPhase("grid");
      sfx("ui");
      return;
    }
    lock.current = true;
    setToss(tossAway());
    setLeaving(true);
    const n = shown + 1;
    const next = list[n - 1];
    const secret = Boolean(next && isHit(next.rarity));
    window.setTimeout(() => {
      setLeaving(false);
      setFlipped(!secret);
      setInstant(!secret);
      setShown(n);
      if (secret) {
        lock.current = false;
      } else {
        sfx(n === list.length ? "hit" : "draw");
        window.setTimeout(() => {
          lock.current = false;
        }, 420);
      }
    }, 560);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "pack") return;
    const box = packRef.current?.getBoundingClientRect();
    if (!box) return;
    if (e.clientY - box.top > box.height * (TEAR_TOP + 0.08)) return;
    start.current = { x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
    unlockSfx();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current || phase !== "pack") return;
    const x = e.clientX - start.current.x;
    const p = Math.min(1, Math.abs(x) / TEAR_PX);
    setDrag({ x, p, dir: x >= 0 ? 1 : -1 });
  };

  const onUp = () => {
    if (!start.current || phase !== "pack") return;
    start.current = null;
    if (drag.p >= 0.48) {
      sfx("pack");
      setPhase("rip");
    } else {
      setDrag({ x: 0, p: 0, dir: drag.dir });
    }
  };

  const peek = shown > 0 && shown < list.length;
  const upcoming = peek ? list[shown] : null;
  const ripping = phase === "rip";
  const p = ripping ? 1 : drag.p;
  const lidX = ripping ? drag.dir * 40 : drag.x;
  const lidRot = drag.dir * p * 18;
  const origin = drag.dir >= 0 ? "0% 100%" : "100% 100%";
  const sparks = useMemo(() => SPARKS, []);

  return (
    <div className={cn("pack-stage", collecting && "is-collect")}>
      <BodyLock />
      <div className="pack-vignette" aria-hidden />

      {phase === "pack" || phase === "rip" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="pack-scene">
            {phase === "rip" && first ? (
              <div className="pack-inside" aria-hidden>
                <div className="pack-inside-stack">
                  {firstSecret ? (
                    <CardBack className="h-full w-full rounded-[10px]" />
                  ) : (
                    <CardFace card={first} className="h-full w-full rounded-[10px]" />
                  )}
                </div>
              </div>
            ) : null}

            <div
              ref={packRef}
              className="pack-hero"
              style={{
                animation: phase === "pack" && !start.current && p === 0 ? "pack-float 3.2s ease-in-out infinite" : undefined,
                touchAction: "none",
                transform: phase === "pack" ? `rotateY(${drag.x * 0.08}deg) rotateZ(${drag.dir * p * 2}deg)` : undefined,
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <div className="pack-spot" aria-hidden />

              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `inset(${TEAR_TOP * 100}% 0 0 0)`,
                  animation: ripping ? "pack-body-drop 720ms cubic-bezier(0.22, 1, 0.36, 1) forwards" : undefined,
                }}
              >
                <BoosterPack setId={setId} name={setName} className="h-full w-full" />
              </div>

              <div
                className="absolute inset-0 overflow-hidden will-change-transform"
                style={{
                  clipPath: `inset(0 0 ${(1 - TEAR_TOP) * 100}% 0)`,
                  transformOrigin: origin,
                  transform: ripping ? undefined : `translate(${lidX}px, ${p * -12}px) rotate(${lidRot}deg)`,
                  animation: ripping
                    ? `${drag.dir >= 0 ? "pack-lid-fly-right" : "pack-lid-fly-left"} 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards`
                    : undefined,
                  filter: `drop-shadow(${drag.dir * 10}px 12px 18px rgb(0 0 0 / ${0.2 + p * 0.35}))`,
                }}
              >
                <BoosterPack setId={setId} name={setName} className="h-full w-full" />
                <div className="pointer-events-none absolute inset-x-0 overflow-hidden" style={{ height: `${TEAR_TOP * 100}%` }}>
                  <div
                    className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{ animation: p === 0 ? "pack-shimmer 2.6s ease-in-out infinite" : undefined }}
                  />
                </div>
              </div>

              {phase === "pack" || phase === "rip" ? (
                <div className="pack-tear" style={{ top: `calc(${TEAR_TOP * 100}% - 7px)`, opacity: ripping ? 0 : 0.4 + p * 0.6 }}>
                  <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-3.5 w-full">
                    <polyline
                      fill="none"
                      stroke="rgb(244 234 212 / 0.95)"
                      strokeWidth="1.15"
                      points="0,4 4,1 8,6 12,2 16,7 20,3 24,6 28,1 32,5 36,2 40,7 44,3 48,6 52,1 56,5 60,2 64,7 68,3 72,6 76,1 80,5 84,2 88,7 92,3 96,6 100,4"
                    />
                  </svg>
                </div>
              ) : null}
              {phase === "pack" ? (
                <div className="absolute inset-x-0 z-20" style={{ height: `${(TEAR_TOP + 0.08) * 100}%` }} />
              ) : null}
            </div>
          </div>

          <div className="text-center">
            <p className="font-display text-xl tracking-wide text-fg">
              {setName}
              {packs > 1 ? ` · ×${packs}` : ""}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {ripping
                ? "Ouverture…"
                : packs > 1
                  ? `Glisse pour ouvrir · ×${packs}`
                  : "Glisse le haut du booster pour l’ouvrir"}
            </p>
          </div>
        </div>
      ) : null}

      {phase === "rip" && (
        <div className={cn("pack-burst", `is-${flashTone}`, "is-on")} aria-hidden>
          <div className="pack-burst-flash" />
          <div className="pack-burst-rays" />
          {sparks.map((s) => (
            <span
              key={s.i}
              className={cn("pack-spark", s.gold ? "is-gold" : "is-white")}
              style={{
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
                ["--s" as string]: s.scale,
                ["--dx" as string]: s.dx,
                ["--dy" as string]: s.dy,
              }}
            />
          ))}
        </div>
      )}

      {phase === "reveal" && current ? (
        <div className="pack-reveal">
          {marks && discovered ? (
            <div className="mark-banner" role="status">
              <span className="mark-banner-line" />
              <span>NOUVEAU</span>
              <span className="mark-banner-line is-flip" />
            </div>
          ) : (
            <div className="mark-banner-slot" />
          )}
          <button type="button" className="pack-card-hit" onClick={nextCard} aria-label="Carte suivante">
            <div className="pack-stack">
              {peek && upcoming ? (
                <div className="pack-under" aria-hidden>
                  {isHit(upcoming.rarity) ? (
                    <CardBack className="h-full w-full rounded-[10px]" />
                  ) : (
                    <CardFace card={upcoming} className="h-full w-full rounded-[10px]" />
                  )}
                </div>
              ) : null}
              <div
                className={cn(
                  "pack-flip",
                  `is-${tone}`,
                  flipped && !leaving && "is-glow",
                  hit && "is-hit",
                  leaving && "is-leave",
                )}
                style={
                  leaving
                    ? ({ ["--leave-x"]: toss.x, ["--leave-rot"]: toss.rot } as CSSProperties)
                    : undefined
                }
              >
                <div className={cn("pack-glow", flipped && !leaving && "is-on")} aria-hidden />
                <div className={cn("pack-3d", flipped && "is-open", instant && flipped && "is-instant")}>
                  <div className="pack-face pack-face-back">
                    <CardBack className="h-full w-full rounded-[10px]" />
                  </div>
                  <div className="pack-face pack-face-front">
                    <CardFace card={current} className="h-full w-full" />
                  </div>
                </div>
                {marks ? <RareChip rarity={current.rarity} /> : null}
              </div>
            </div>
          </button>

          <div className={cn("pack-caption", flipped && "is-in")}>
            <p className="font-display text-xl text-fg">{current.name}</p>
            <p className={cn("pack-rarity", `is-${tone}`)}>{RARITY_FR[current.rarity] ?? current.rarity}</p>
          </div>
          <p className="font-mono text-[11px] tracking-widest text-subtle">
            {Math.min(shown, list.length)} / {list.length}
          </p>
          <button type="button" className="pack-skip" onClick={skipAll}>
            Passer
          </button>
        </div>
      ) : null}

      {phase === "grid" ? (
        <div className={cn("pack-haul", collecting && "is-collecting")}>
          {collecting ? null : (
            <div className="gl-head">
              <div className="gl-head-row">
                <h2 className="gl-head-title">Cartes obtenues</h2>
              </div>
              <div className="gl-rule" />
              <span className="coll-hub-count">
                {setName}
                {packs > 1 ? ` · ×${packs}` : ""} · {list.length} cartes
              </span>
            </div>
          )}
          <div data-scrolllock-allow className="pack-grid" ref={gridRef}>
            <div className="grid grid-cols-4 gap-2 px-1 pb-2">
              {list.map((c, i) => {
                const isNew =
                  (owned.current[c.id] ?? 0) === 0 &&
                  list.findIndex((x) => x.id === c.id) === i;
                return (
                  <button
                    key={`${c.id}-${i}`}
                    type="button"
                    className={cn("pack-grid-item", collecting && "is-fly")}
                    style={{ animationDelay: collecting ? undefined : `${Math.min(i, 16) * 40}ms` }}
                    onClick={() => {
                      if (!collecting) setInfo(c);
                    }}
                  >
                    <CardFace card={c} className="w-full" />
                    <RareChip rarity={c.rarity} compact />
                    {isNew ? <NewRibbon compact /> : null}
                  </button>
                );
              })}
            </div>
            <div className="list-end-pad" aria-hidden />
          </div>
          {collecting ? null : (
            <div className="studio-float">
              <button type="button" className="studio-float-save" onClick={collect}>
                Ajouter à la collection
              </button>
            </div>
          )}
        </div>
      ) : null}
      {info ? (
        <CardDossier
          card={info}
          count={(owned.current[info.id] ?? 0) + list.filter((c) => c.id === info.id).length}
          onClose={() => setInfo(null)}
          onPick={setInfo}
        />
      ) : null}
    </div>
  );
}
