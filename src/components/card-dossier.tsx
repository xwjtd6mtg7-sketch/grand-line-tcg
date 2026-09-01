import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { CardBack, CardFace } from "@/components/card-face";
import { BodyLock } from "@/lib/lock-body";
import { ATTR_FR, COLOR_FR, COLOR_HEX, RARITY_FR, TYPE_FR } from "@/lib/tcg/catalog";
import { cardFxSource, splitEffectBlocks, tagHue } from "@/lib/tcg/fr-text";
import { asOwned, usePlayer } from "@/lib/store";
import type { TcgCard } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";

function charKey(name: string) {
  const parts = name
    .toLowerCase()
    .replace(/['’"«»]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w.length > 1 && w !== "d");
  return parts[parts.length - 1] || name.toLowerCase();
}

function prettySet(id: string) {
  return id.replace(/^(ST|OP|EB|PR)(\d+)$/i, (_, a, n) => `${a}-${n}`);
}

function InspectCard({
  card,
  compact,
  onTap,
  sealed,
}: {
  card: TcgCard;
  compact?: boolean;
  onTap?: () => void;
  sealed?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const pose = useRef({ rx: 0, ry: 0 });
  const start = useRef<{ x: number; y: number; prx: number; pry: number } | null>(null);
  const moved = useRef(false);
  const locked = useRef(!!compact);
  const lastDir = useRef(1);

  const paint = (rest: boolean) => {
    const n = el.current;
    if (!n) return;
    n.classList.toggle("is-rest", rest);
    n.classList.toggle("is-compact", locked.current);
    if (locked.current) {
      n.style.transform = "none";
      return;
    }
    n.style.transform = `rotateX(${pose.current.rx}deg) rotateY(${pose.current.ry}deg) translateZ(0)`;
    if (shine.current) {
      shine.current.style.background = `linear-gradient(${105 + pose.current.ry * 0.4}deg, #fff0 35%, #fff28 48%, #fff0 62%)`;
    }
  };

  const isBack = () => {
    const n = ((pose.current.ry % 360) + 360) % 360;
    return n > 90 && n < 270;
  };

  useEffect(() => {
    if (!compact) {
      locked.current = false;
      paint(true);
      return;
    }
    if (!isBack()) {
      pose.current = { rx: 0, ry: 0 };
      locked.current = true;
      paint(true);
      return;
    }
    const dir = lastDir.current || 1;
    pose.current = { rx: 0, ry: pose.current.ry - dir * 180 };
    locked.current = false;
    paint(true);
    const t = window.setTimeout(() => {
      pose.current = { rx: 0, ry: 0 };
      locked.current = true;
      paint(true);
    }, 480);
    return () => window.clearTimeout(t);
  }, [compact]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (sealed || compact || locked.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pose.current;
    start.current = { x: e.clientX, y: e.clientY, prx: p.rx, pry: p.ry };
    moved.current = false;
    paint(false);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (sealed || compact || locked.current || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > 8) moved.current = true;
    if (dx !== 0) lastDir.current = Math.sign(dx);
    pose.current = {
      rx: Math.max(-42, Math.min(42, start.current.prx - dy * 0.26)),
      ry: start.current.pry + dx * 0.52,
    };
    paint(false);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (sealed) {
      onTap?.();
      return;
    }
    if (compact || locked.current) {
      onTap?.();
      return;
    }
    if (!start.current) return;
    start.current = null;
    const p = pose.current;
    const facing = Math.round(p.ry / 180) * 180;
    const delta = p.ry - facing;
    const next = Math.abs(delta) >= 88 ? facing + Math.sign(delta || 1) * 180 : facing;
    pose.current = { rx: 0, ry: moved.current ? next : p.ry };
    paint(true);
  };

  return (
    <div
      ref={el}
      className="dossier-inspect is-rest"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="dossier-face dossier-front">
        {sealed ? (
          <CardBack className="h-full w-full rounded-[10px]" />
        ) : (
          <CardFace card={card} className="!aspect-auto h-full w-full rounded-[10px]" />
        )}
        {sealed ? null : <span ref={shine} className="dossier-shine" aria-hidden />}
      </div>
      <div className="dossier-face dossier-back">
        <CardBack className="h-full w-full rounded-[10px]" />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="dossier-row">
      <span>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}

export function CardDossier({
  card,
  count,
  onClose,
  onPick,
}: {
  card: TcgCard;
  count?: number;
  onClose: () => void;
  onPick?: (c: TcgCard) => void;
}) {
  const catalog = useCatalog();
  const raw = usePlayer((s) => s.collection);
  const infinite = usePlayer((s) => s.devInfinite);
  const collection = useMemo(() => asOwned(raw, catalog.cards, infinite), [raw, catalog.cards, infinite]);
  const [inspect, setInspect] = useState(false);
  const inspectRef = useRef(false);
  inspectRef.current = inspect;
  const metricsRef = useRef({ minH: 220, maxH: 640, vh: 844, vw: 390 });
  const hRef = useRef(0);
  const [drag, setDrag] = useState(false);
  const [live, setLive] = useState(false);
  const start = useRef<{ y: number; base: number } | null>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const boot = useRef(true);
  const closing = useRef(false);
  const [shut, setShut] = useState(false);

  const paint = (h: number, animate: boolean) => {
    hRef.current = h;
    const { maxH, vh, vw } = metricsRef.current;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
      sheet.style.transform = `translate3d(0,${Math.max(0, maxH - h)}px,0)`;
    }
    const card = cardWrapRef.current;
    if (card && !closing.current) {
      const shown = inspectRef.current ? 0 : h;
      const stageH = Math.max(120, vh - shown);
      const targetW = Math.max(92, Math.min(vw - 36, (stageH - 28) * (63 / 88)));
      const baseW = Math.min(vw * 0.72, 300);
      const s = targetW / baseW;
      const lift = shown * 0.5;
      card.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
      card.style.transform = `translate3d(0,${-lift}px,0) scale(${s})`;
    }
  };

  useEffect(() => {
    boot.current = true;
    setLive(false);
    const calc = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const grab = grabRef.current?.offsetHeight ?? 168;
      const maxH = Math.round(vh * 0.7);
      const minH = Math.min(grab, maxH);
      metricsRef.current = { minH, maxH, vh, vw };
      if (sheetRef.current) sheetRef.current.style.height = `${maxH}px`;
      if (boot.current) {
        boot.current = false;
        paint(0, false);
        requestAnimationFrame(() => {
          setLive(true);
          requestAnimationFrame(() => paint(minH, true));
        });
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [card.id]);

  const owned = count ?? collection[card.id] ?? 0;
  const effects = splitEffectBlocks(cardFxSource(card));
  const colors = Array.isArray(card.colors) ? card.colors : [];
  const key = charKey(card.name);
  const related = catalog.cards.filter((c) => c.id !== card.id && charKey(c.name) === key);
  const traits = card.traits?.join(" · ") ?? "";

  const onGrabDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, base: hRef.current };
    setDrag(true);
  };
  const onGrabMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const { minH, maxH } = metricsRef.current;
    const next = start.current.base - (e.clientY - start.current.y);
    paint(Math.max(minH - 140, Math.min(maxH + 28, next)), false);
  };
  const onGrabUp = () => {
    if (!start.current) return;
    start.current = null;
    setDrag(false);
    const cur = hRef.current;
    const { minH, maxH } = metricsRef.current;
    if (cur < minH - 70) {
      dismiss();
      return;
    }
    paint(cur > minH + (maxH - minH) * 0.28 ? maxH : minH, true);
  };

  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    setShut(true);
    setInspect(false);
    inspectRef.current = false;
    paint(0, true);
    window.setTimeout(onClose, 380);
  };

  const openInspect = () => {
    setInspect(true);
    inspectRef.current = true;
    paint(0, true);
  };
  const backToSheet = () => {
    setInspect(false);
    inspectRef.current = false;
    paint(metricsRef.current.minH, true);
  };

  const ui = (
    <div className={cn("dossier-root", !inspect && "is-sheet")} onClick={() => inspect && backToSheet()}>
      <BodyLock />
      <div className={cn("dossier-stage", live && "is-live")}>
        <div
          ref={cardWrapRef}
          className={cn("dossier-card-wrap", live && "is-live")}
          onClick={(e) => e.stopPropagation()}
        >
          <InspectCard key={card.id} card={card} compact={!inspect} sealed={owned <= 0} onTap={openInspect} />
        </div>
      </div>

      <div
        ref={sheetRef}
        className={cn("dossier-sheet", drag && "is-drag", inspect && "is-off", live && "is-live")}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="dossier-grab"
          data-scrolllock-allow
          ref={grabRef}
          onPointerDown={onGrabDown}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabUp}
          onPointerCancel={onGrabUp}
        >
          <div className="dossier-handle">
            <span />
          </div>
          <div className="dossier-toolbar">
            <span className="dossier-owned">
              <span className="dossier-frac">
                <span className="n">{owned}</span>
                <span className="d">/4</span>
              </span>
            </span>
            <span className="dossier-set">
              {prettySet(card.set)}
              <em>{RARITY_FR[card.rarity] ?? card.rarity}</em>
            </span>
          </div>
          <div className="dossier-idblock">
            <h2 className="dossier-name">{card.name}</h2>
            <p className="dossier-type">{TYPE_FR[card.type] ?? card.type}</p>
            <p className="dossier-code">
              {card.id}
              {traits ? ` · ${traits}` : ""}
            </p>
          </div>
        </div>

        <div className="dossier-extra" data-scrolllock-allow>
          {effects.length ? (
            <section className="dossier-block">
              <h3>Effets</h3>
              {effects.map((b, i) => (
                <p key={`${b.key}-${i}`} className="dossier-fx">
                  {b.tag
                    ? b.tag.split(" · ").map((t) => {
                        const hue = tagHue(t);
                        return (
                          <span key={t} className="dossier-tag" style={{ background: hue.bg, color: hue.fg }}>
                            {t}
                          </span>
                        );
                      })
                    : null}
                  {b.body}
                </p>
              ))}
            </section>
          ) : null}
          <section className="dossier-block">
            <h3>Caractéristiques</h3>
            <div className="dossier-table">
              <Row k="Type" v={TYPE_FR[card.type] ?? card.type} />
              <Row k="Rareté" v={RARITY_FR[card.rarity] ?? card.rarity} />
              {colors.length ? (
                <div className="dossier-row">
                  <span>Couleur</span>
                  <strong className="dossier-swatches">
                    {colors.map((c) => (
                      <i key={c} style={{ background: COLOR_HEX[c] }} title={COLOR_FR[c]} />
                    ))}
                  </strong>
                </div>
              ) : null}
              {card.cost != null ? <Row k="Coût" v={String(card.cost)} /> : null}
              {card.power != null ? <Row k="Puissance" v={String(card.power)} /> : null}
              {card.counter ? <Row k="Contre" v={`+${card.counter}`} /> : null}
              {card.life != null ? <Row k="Vie" v={String(card.life)} /> : null}
              {card.attr ? <Row k="Attribut" v={ATTR_FR[card.attr] ?? card.attr} /> : null}
              {traits ? <Row k="Traits" v={traits} /> : null}
              <Row k="Série" v={prettySet(card.set)} />
            </div>
          </section>
          {related.length ? (
            <section className="dossier-block">
              <h3>Cartes connexes</h3>
              <div className="dossier-related" data-scrolllock-allow>
                {related.map((c) => (
                  <button key={c.id} type="button" className="dossier-rel" onClick={() => onPick?.(c)}>
                    <CardFace card={c} dimmed={(collection[c.id] ?? 0) === 0} className="w-full" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="list-end-pad is-float" aria-hidden />
        </div>
      </div>
      {inspect || shut ? null : (
        <button type="button" className="dossier-close" onClick={dismiss} aria-label="Fermer">
          <X className="size-5" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );

  if (typeof document === "undefined" || !document.body) return null;
  return createPortal(ui, document.body);
}
