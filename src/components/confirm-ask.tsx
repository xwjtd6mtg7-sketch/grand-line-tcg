import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ConfirmAsk({
  kicker = "Confirmer",
  title,
  copy,
  confirm = "Oui",
  cancel = "Non",
  bp,
  danger,
  children,
  onNo,
  onYes,
}: {
  kicker?: string;
  title: string;
  copy: string;
  confirm?: ReactNode;
  cancel?: string;
  bp?: boolean;
  danger?: boolean;
  children?: ReactNode;
  onNo: () => void;
  onYes: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="buy-ask" role="dialog" aria-modal>
      <button type="button" className="buy-ask-scrim" aria-label="Annuler" onClick={onNo} />
      <div className="buy-ask-card">
        <p className="buy-ask-kicker">{kicker}</p>
        <h3 className="buy-ask-title">{title}</h3>
        <p className="buy-ask-copy">{copy}</p>
        {children}
        <div className="buy-ask-row">
          <button type="button" className="studio-float-cancel" onClick={onNo}>
            {cancel}
          </button>
          <button type="button" className={cn("studio-float-save", bp && "is-bp", danger && "is-fight")} onClick={onYes}>
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
