import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCatalogSync, loadCatalog } from "@/lib/tcg/catalog";
import type { Catalog } from "@/lib/tcg/types";
import { IntroScreen } from "@/components/intro";
import { usePlayer } from "@/lib/store";
import { bootPrefetch, prefetchOwned, registerGameWorker } from "@/lib/cache";

const Ctx = createContext<Catalog | null>(null);

export function useCatalog(): Catalog {
  const v = useContext(Ctx);
  if (!v) throw new Error("Catalogue non chargé");
  return v;
}

function hydratePlayer(c: Catalog) {
  try {
    if (usePlayer.persist.hasHydrated()) usePlayer.getState().hydrate(c);
    else usePlayer.persist.onFinishHydration(() => usePlayer.getState().hydrate(c));
  } catch {
    usePlayer.getState().hydrate(c);
  }
  window.setTimeout(() => usePlayer.getState().hydrate(c), 400);
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [cat, setCat] = useState<Catalog | null>(() => getCatalogSync());
  const [gate, setGate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    registerGameWorker();
    void bootPrefetch();
    const stub = getCatalogSync();
    if (stub) hydratePlayer(stub);
    loadCatalog()
      .then((c) => {
        if (cancelled) return;
        setCat(c);
        hydratePlayer(c);
        const owned = usePlayer.getState().collection ?? {};
        const urls = c.cards.filter((card) => owned[card.id]).map((card) => card.image);
        void prefetchOwned(urls);
      })
      .catch(() => {
        if (!cancelled && stub) setCat(stub);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => cat ?? getCatalogSync(), [cat]);
  if (!value) {
    return <IntroScreen onEnter={() => setGate(false)} />;
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      {gate ? <IntroScreen onEnter={() => setGate(false)} /> : null}
    </Ctx.Provider>
  );
}