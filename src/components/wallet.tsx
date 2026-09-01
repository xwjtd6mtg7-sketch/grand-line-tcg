import { useEffect } from "react";
import { BoostMark } from "@/components/boost-mark";
import { BP_MAX } from "@/lib/boost-pts";
import { usePlayer } from "@/lib/store";
import { cn } from "@/lib/utils";

export function WalletChips({ className }: { className?: string }) {
  const berries = usePlayer((s) => s.berries);
  const infinite = usePlayer((s) => s.devInfinite);
  const bp = usePlayer((s) => s.bp ?? 0);
  const tick = usePlayer((s) => s.tickBoost);
  useEffect(() => {
    tick();
    const id = window.setInterval(() => tick(), 30000);
    return () => window.clearInterval(id);
  }, [tick]);
  return (
    <span className={cn("wallet", className)}>
      <span className="shop-berries">{infinite ? "∞" : (berries ?? 0).toLocaleString("fr-FR")} B</span>
      <span className="bp-chip">
        <BoostMark />
        <span>
          {infinite ? "∞" : bp}/{BP_MAX}
        </span>
      </span>
    </span>
  );
}
