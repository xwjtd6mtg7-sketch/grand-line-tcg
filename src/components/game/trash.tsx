import { useState } from "react";
import { createPortal } from "react-dom";
import { BodyLock } from "@/lib/lock-body";
import { CardFace } from "@/components/card-face";
import { CardZoom } from "@/components/card-zoom";
import { engineCard } from "@/lib/tcg/engine";
import { cn } from "@/lib/utils";

export function TrashView({
  ids,
  mine,
  onClose,
  onCard,
}: {
  ids: string[];
  mine: boolean;
  onClose: () => void;
  onCard: (id: string) => void;
}) {
  const cards = [...ids].reverse();
  const [zoom, setZoom] = useState<string | null>(null);
  const ui = (
    <div className="trash-root decks-fs" onClick={onClose}>
      <BodyLock />
      <div className="trash-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gl-head">
          <div className="gl-head-row">
            <h2 className="gl-head-title">{mine ? "Défausse" : "Défausse adverse"}</h2>
            <span className="coll-hub-count">
              {cards.length === 0
                ? "Vide"
                : `${cards.length} carte${cards.length > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="gl-rule" />
        </div>

        {cards.length === 0 ? (
          <div className="trash-empty">
            <div className="trash-empty-slot" />
            <p className="font-display tracking-[0.18em] text-muted">PILE VIDE</p>
          </div>
        ) : (
          <div data-scrolllock-allow className="trash-grid">
            {cards.map((id, i) => (
              <button
                key={`${id}-${i}`}
                type="button"
                className={cn("trash-card", i === 0 && "is-top")}
                style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
                onClick={() => setZoom(id)}
              >
                <CardFace card={engineCard(id)} className="w-full" />
              </button>
            ))}
          </div>
        )}

        <div className="studio-float">
          <button type="button" className="studio-float-save" onClick={onClose}>
            Retour
          </button>
        </div>
      </div>
      {zoom ? (
        <CardZoom
          card={engineCard(zoom)}
          inspect
          plain
          onClose={() => setZoom(null)}
        />
      ) : null}
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(ui, document.body);
}
