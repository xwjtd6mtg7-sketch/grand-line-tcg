import { useMemo, useState } from "react";
import { Check, Lock } from "lucide-react";
import { COSMETICS, cosmeticById, cosmeticsOf, type CosmeticKind } from "@/lib/tcg/cosmetics";
import { usePlayer } from "@/lib/store";
import { WalletChips } from "@/components/wallet";
import { cn } from "@/lib/utils";

const TABS: { id: CosmeticKind; label: string }[] = [
  { id: "back", label: "Dos" },
  { id: "don", label: "DON!!" },
  { id: "mat", label: "Tapis" },
];

export function StyleStudio({
  asPage,
  initialKind = "back",
  equipped,
  onEquip,
  onClose,
}: {
  asPage?: boolean;
  initialKind?: CosmeticKind;
  equipped: { back: string; don: string; mat: string };
  onEquip: (kind: CosmeticKind, id: string) => void;
  onClose?: () => void;
}) {
  const player = usePlayer();
  const [tab, setTab] = useState<CosmeticKind>(initialKind);
  const list = useMemo(() => cosmeticsOf(tab), [tab]);
  const [sel, setSel] = useState(equipped[tab] || list[0]?.id);
  const selected = COSMETICS.find((c) => c.id === sel) ?? list[0];
  const owned = selected ? player.ownedCosmetics.includes(selected.id) : false;
  const on = selected ? equipped[tab] === selected.id : false;
  const winLock = Boolean(selected?.wins && player.wins < (selected.wins ?? 0));
  const canBuy = Boolean(selected && !owned && !winLock && (player.devInfinite || player.berries >= selected.price));

  const previewBack = tab === "back" ? selected?.src : cosmeticById(equipped.back)?.src;
  const previewDon = tab === "don" ? selected?.src : cosmeticById(equipped.don)?.src;
  const previewMat = tab === "mat" ? selected?.src : cosmeticById(equipped.mat)?.src;

  const switchTab = (k: CosmeticKind) => {
    setTab(k);
    setSel(equipped[k] || cosmeticsOf(k)[0]?.id);
  };

  const act = () => {
    if (!selected) return;
    if (owned || selected.price === 0) onEquip(tab, selected.id);
    else player.buyCosmetic(selected.id);
  };

  const inner = (
    <main className="app-safe relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="gl-head">
        <div className="gl-head-row">
          <h2 className="gl-head-title">Personnaliser</h2>
          <WalletChips />
        </div>
        <div className="gl-rule" />
      </div>

      <section
        className={cn("style-stage mx-3 mt-2 shrink-0", tab === "mat" && "is-mat-focus")}
        style={{ ["--mat-image" as string]: previewMat ? `url("${previewMat}")` : "none" }}
      >
        <div className="style-stage-veil" />
        <div className="style-stage-cards">
          <div className={cn("style-preview-back", tab === "back" && "is-focus")}>
            {previewBack ? <img src={previewBack} alt="" draggable={false} /> : null}
          </div>
          <div className={cn("style-preview-don", tab === "don" && "is-focus")}>
            {previewDon ? <img src={previewDon} alt="" draggable={false} /> : null}
          </div>
        </div>
        <p className="style-stage-name font-display">{selected?.name}</p>
      </section>

      <div className="mt-3 px-3">
        <div className="style-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn("style-tab font-display", tab === t.id && "is-on")}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul className={cn("style-grid min-h-0 flex-1 overflow-y-auto px-3 pt-3", tab === "mat" && "is-mat")} data-scrolllock-allow>
        {list.map((c) => {
          const has = player.ownedCosmetics.includes(c.id);
          const equippedNow = equipped[tab] === c.id;
          const locked = Boolean(c.wins && player.wins < c.wins);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={cn("style-tile", sel === c.id && "is-pick", equippedNow && "is-on")}
                onClick={() => setSel(c.id)}
              >
                <span className="style-tile-art">
                  <img src={c.src} alt="" draggable={false} className={c.kind === "mat" ? "is-mat" : undefined} />
                  {!has ? (
                    <span className="style-lock">
                      <Lock className="size-3.5" strokeWidth={2} />
                    </span>
                  ) : equippedNow ? (
                    <span className="style-check">
                      <Check className="size-3.5" strokeWidth={2.4} />
                    </span>
                  ) : null}
                </span>
                <span className="style-tile-name">{c.name}</span>
                <span className="style-tile-meta">
                  {has ? (equippedNow ? "Équipé" : "Possédé") : locked ? `${c.wins} V` : `${c.price} B`}
                </span>
              </button>
            </li>
          );
        })}
        <li className="list-end-pad col-span-full" aria-hidden />
      </ul>

      <div className="studio-float">
        {onClose ? (
          <button type="button" className="studio-float-cancel" onClick={onClose}>
            Retour
          </button>
        ) : null}
        <button type="button" className="studio-float-save" disabled={on || (!owned && !canBuy)} onClick={act}>
          {on ? "Équipé" : owned ? "Équiper" : winLock ? `${selected?.wins} V` : `Acheter · ${selected?.price ?? 0} B`}
        </button>
      </div>
    </main>
  );

  if (asPage) return inner;
  return <div className="fixed inset-0 z-[80] decks-fs bg-bg">{inner}</div>;
}
