import { BodyLock } from "@/lib/lock-body";
import { COLOR_HEX, COLOR_ORDER, RARITY_FR, TYPE_FR } from "@/lib/tcg/catalog";
import type { CardFilter } from "@/lib/tcg/filters";
import { EMPTY_FILTER } from "@/lib/tcg/filters";
import type { ColorName } from "@/lib/tcg/types";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

const KINDS: Array<CardFilter["kind"]> = ["all", "Leader", "Character", "Event", "Stage"];
const RARITIES = ["", "C", "UC", "R", "SR", "SEC", "L", "SP", "TR", "PR"];

export function FilterSheet({
  value,
  sets,
  onClose,
  onApply,
}: {
  value: CardFilter;
  sets: string[];
  onClose: () => void;
  onApply: (next: CardFilter) => void;
}) {
  const [draft, setDraft] = useState<CardFilter>(value);
  const apply = (next: CardFilter) => {
    setDraft(next);
    onApply(next);
  };
  const set = (patch: Partial<CardFilter>) => apply({ ...draft, ...patch });
  const toggleColor = (c: ColorName) =>
    set({ colors: draft.colors.includes(c) ? draft.colors.filter((x) => x !== c) : [...draft.colors, c] });

  const metricsRef = useRef({ minH: 120, maxH: 640 });
  const hRef = useRef(0);
  const [drag, setDrag] = useState(false);
  const [live, setLive] = useState(false);
  const [closing, setClosing] = useState(false);
  const start = useRef<{ y: number; base: number } | null>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const boot = useRef(true);
  const closed = useRef(false);

  const paint = (h: number, animate: boolean) => {
    hRef.current = h;
    const { maxH } = metricsRef.current;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
    sheet.style.transform = `translate3d(0,${Math.max(0, maxH - h)}px,0)`;
  };

  useEffect(() => {
    boot.current = true;
    closed.current = false;
    setLive(false);
    const calc = () => {
      const vh = window.innerHeight;
      const grab = grabRef.current?.offsetHeight ?? 120;
      const maxH = Math.round(vh * 0.7);
      metricsRef.current = { minH: Math.min(grab, maxH), maxH };
      if (sheetRef.current) sheetRef.current.style.height = `${maxH}px`;
      if (boot.current) {
        boot.current = false;
        paint(0, false);
        requestAnimationFrame(() => {
          setLive(true);
          requestAnimationFrame(() => paint(maxH, true));
        });
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const dismiss = () => {
    if (closed.current) return;
    closed.current = true;
    setDrag(false);
    setClosing(true);
    paint(0, true);
    window.setTimeout(onClose, 380);
  };

  const onGrabDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (closed.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, base: hRef.current };
    setDrag(true);
  };
  const onGrabMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!start.current || closed.current) return;
    const { maxH } = metricsRef.current;
    const h = Math.max(80, Math.min(maxH + 28, start.current.base - (e.clientY - start.current.y)));
    paint(h, false);
    if (h < maxH * 0.42) {
      start.current = null;
      dismiss();
    }
  };
  const onGrabUp = () => {
    if (!start.current || closed.current) return;
    start.current = null;
    setDrag(false);
    const { maxH } = metricsRef.current;
    if (hRef.current < maxH * 0.78) dismiss();
    else paint(maxH, true);
  };

  const ui = (
    <div className="filter-sheet" onClick={dismiss}>
      <BodyLock />
      <div
        ref={sheetRef}
        className={cn("dossier-sheet filter-panel", drag && "is-drag", live && "is-live")}
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
          <p className="filter-title">Filtres</p>
          <div className="gl-rule" />
          <div className="filter-search" onPointerDown={(e) => e.stopPropagation()}>
            <Search className="size-4 text-muted" />
            <input
              value={draft.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Rechercher une carte…"
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
            />
            {draft.q ? (
              <button type="button" onClick={() => set({ q: "" })} className="text-muted" aria-label="Effacer">
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="dossier-extra filter-sheet-body" data-scrolllock-allow>
          <div className="filter-block">
            <p className="filter-label">Couleur</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn("filter-chip", draft.colors.length === 0 && "is-on")}
                onClick={() => set({ colors: [] })}
              >
                Tout
              </button>
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => toggleColor(c)}
                  className={cn("filter-dot", draft.colors.includes(c) && "is-on")}
                  style={{ background: COLOR_HEX[c] }}
                />
              ))}
            </div>
          </div>

          <div className="filter-block">
            <p className="filter-label">Type</p>
            <div className="filter-pair">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={cn("filter-chip", draft.kind === k && "is-on")}
                  onClick={() => set({ kind: k })}
                >
                  {k === "all" ? "Tout" : TYPE_FR[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <p className="filter-label">Rareté</p>
            <div className="filter-pair">
              {RARITIES.map((r) => (
                <button
                  key={r || "all"}
                  type="button"
                  className={cn("filter-chip", draft.rarity === r && "is-on")}
                  onClick={() => set({ rarity: r })}
                >
                  {r ? RARITY_FR[r] ?? r : "Tout"}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <p className="filter-label">Ensemble</p>
            <div className="filter-pair">
              {sets.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn("filter-chip", draft.setId === s && "is-on")}
                  onClick={() => set({ setId: s })}
                >
                  {s === "owned" ? "Possédées" : s === "all" ? "Toutes" : s === "alt" ? "Alternatives" : s === "manga" ? "Manga" : s === "promo" ? "Promos" : s}
                </button>
              ))}
            </div>
          </div>
          <div className="list-end-pad is-float" aria-hidden />
        </div>
      </div>
      {closing ? null : (
        <div className="filter-float" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="studio-float-cancel" onClick={() => apply({ ...EMPTY_FILTER, setId: "all" })}>
            Réinitialiser
          </button>
          <button type="button" className="studio-float-save" onClick={dismiss}>
            OK
          </button>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined" || !document.body) return null;
  return createPortal(ui, document.body);
}

export function CardCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="card-count">{n}</span>;
}
