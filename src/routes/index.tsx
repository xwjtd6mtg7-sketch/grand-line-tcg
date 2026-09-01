import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { CardFace } from "@/components/card-face";
import { BoostHero, BoostMark } from "@/components/boost-mark";
import { BrandLockup } from "@/components/brand";
import { WalletChips } from "@/components/wallet";
import { useCatalog } from "@/components/catalog-provider";
import { usePlayer } from "@/lib/store";
import { cardById, COLOR_HEX } from "@/lib/tcg/catalog";
import type { ColorName } from "@/lib/tcg/types";
import { packSrc } from "@/lib/tcg/art";
import { BP_MAX, chargeProgress, fmtEta, nextBoostIn } from "@/lib/boost-pts";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: () => null });

function glowVars(colors?: ColorName[]) {
  const a = colors?.[0] ?? "Red";
  const b = colors?.[1] ?? a;
  const hex = (c: ColorName) => (c === "Black" ? "#8b909c" : COLOR_HEX[c]);
  return { ["--g1" as string]: hex(a), ["--g2" as string]: hex(b) };
}

export function Home() {
  const player = usePlayer();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const leader = cardById(player.decks.find((d) => d.id === player.activeDeckId)?.leaderId ?? "ST01-001");
  const packCount = Object.values(player.packs).reduce((a, b) => a + b, 0);

  return (
    <main className="home-page flex h-full min-h-0 flex-col overflow-hidden pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="gl-head">
        <div className="gl-head-row">
          <BrandLockup className="home-brand" />
          <WalletChips />
        </div>
        <div className="gl-rule" />
      </div>
      <div className="home-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]">
      <div className="flex flex-col gap-3">
      <PackBanner />
      <section className="home-duel" style={glowVars(leader?.colors)}>
        <span className="home-duel-glow" aria-hidden />
        <div className="home-duel-copy">
          <h2>Duel</h2>
          <p>Glisse tes cartes, attache tes DON!!, attaque. Règles officielles.</p>
          <div className="home-duel-row">
            <Link to="/play" className="home-fight">
              Combattre
            </Link>
            <span className="home-record">
              {player.wins}V · {player.losses}D
            </span>
          </div>
        </div>
        {mounted && leader ? (
          <div className="home-duel-card">
            <CardFace card={leader} />
          </div>
        ) : null}
      </section>

      <div className="home-tiles">
        <FreeBoostTile />
        <Link to="/shop" className="home-tile is-shop">
          <span className="home-tile-pack is-ico">
            <ShoppingBag className="home-tile-ico" strokeWidth={1.5} />
          </span>
          <span className="home-tile-title">Boutique</span>
          <span className="home-tile-sub">{packCount ? `${packCount} à ouvrir` : "Boosters & starters"}</span>
        </Link>
      </div>
      </div>
      </div>
    </main>
  );
}

function packRank(id: string) {
  const m = id.match(/^(OP|EB|ST)-?(\d+)/i);
  if (!m) return 0;
  const w = m[1].toUpperCase() === "OP" ? 2000 : m[1].toUpperCase() === "EB" ? 1000 : 0;
  return w + Number(m[2]);
}

function PackBanner() {
  const catalog = useCatalog();
  const nav = useNavigate();
  const packs = useMemo(
    () => [...(catalog.boosters ?? [])].sort((a, b) => packRank(b.id) - packRank(a.id)),
    [catalog.boosters],
  );
  const pages = useMemo(() => {
    const out: typeof packs[] = [];
    for (let i = 0; i < packs.length; i += 3) out.push(packs.slice(i, i + 3));
    return out;
  }, [packs]);

  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onTab = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/") return;
      track.current?.scrollTo({ left: 0, behavior: "smooth" });
      document.querySelector(".home-body")?.scrollTo({ top: 0, behavior: "smooth" });
      document.querySelector(".home-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("gl-tab", onTab);
    return () => window.removeEventListener("gl-tab", onTab);
  }, []);
  const snap = () => {
    const el = track.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const i = Math.round(el.scrollLeft / w);
    el.scrollTo({ left: i * w, behavior: "smooth" });
  };

  const open = (id: string) => {
    try {
      sessionStorage.setItem("gl-shop-buy", id);
      sessionStorage.setItem("gl-shop-from", "home");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("gl-shop-buy", { detail: { id, from: "home" } }));
    void nav({ to: "/shop" });
  };

  return (
    <section className="pack-banner">
      <div className="pack-banner-glow" aria-hidden />
      <div
        ref={track}
        className="pack-banner-track"
        data-scrolllock-allow
        onPointerUp={snap}
        onTouchEnd={snap}
        onScroll={(e) => {
          const el = e.currentTarget;
          window.clearTimeout((el as HTMLDivElement & { _t?: number })._t);
          (el as HTMLDivElement & { _t?: number })._t = window.setTimeout(snap, 80);
        }}
      >
        {pages.map((page, i) => (
          <div key={i} className="pack-banner-page">
            {page.map((b) => (
              <button
                key={b.id}
                type="button"
                className="pack-banner-item"
                onClick={() => open(b.id)}
              >
                <img
                  src={packSrc(b.id)}
                  alt={b.name}
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = "/boosters/generic.webp?v=st30";
                  }}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FreeBoostTile() {
  const player = usePlayer();
  const tile = useRef<HTMLButtonElement>(null);
  const [eta, setEta] = useState("05 h 00 min");
  const [prog, setProg] = useState(0);
  const stock = player.bpStock ?? 0;
  const wallet = player.bp ?? 0;
  const can = stock > 0 && wallet < BP_MAX;

  useEffect(() => {
    const beat = () => {
      const s = player.tickBoost();
      const ms = nextBoostIn(s);
      setEta(s.bpStock >= BP_MAX || s.bpMade >= BP_MAX ? "Max" : fmtEta(ms));
      setProg(chargeProgress(s));
    };
    beat();
    const id = window.setInterval(beat, 1000);
    return () => window.clearInterval(id);
  }, [player]);

  const fly = (n: number) => {
    const from = tile.current?.getBoundingClientRect();
    const to = document.querySelector(".bp-chip")?.getBoundingClientRect();
    if (!from || !to) return;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "bp-fly";
      el.innerHTML =
        '<svg viewBox="0 0 32 44"><rect x="3" y="2" width="26" height="40" rx="4" fill="#c9a227"/></svg>';
      el.style.left = `${from.left + from.width * (0.18 + i * 0.14)}px`;
      el.style.top = `${from.top + from.height * 0.28}px`;
      document.body.appendChild(el);
      const dx = to.left + to.width / 2 - (from.left + from.width * (0.18 + i * 0.14));
      const dy = to.top + to.height / 2 - (from.top + from.height * 0.28);
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(.4)`;
        el.style.opacity = "0";
      });
      window.setTimeout(() => el.remove(), 700 + i * 50);
    }
  };

  return (
    <button
      ref={tile}
      type="button"
      className={cn("home-tile is-free", can && "is-ready")}
      onClick={() => {
        const n = player.claimBoost();
        if (n <= 0) return;
        sfx("pack");
        fly(n);
      }}
    >
      <BoostHero className="free-hero" />
      <span className="home-tile-title">Boosters gratuits</span>
      <span className="free-rail" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i < stock;
          const charge = !on && i === stock && stock < BP_MAX && prog >= 0;
          return (
            <span key={i} className={cn("free-pip", on && "is-on", charge && "is-charge")}>
              <BoostMark gold={on} />
            </span>
          );
        })}
      </span>
      <span className="free-eta">
        {stock >= BP_MAX || player.bpMade >= BP_MAX
          ? "Max"
          : can
            ? `Récupérer · ${eta}`
            : eta}
      </span>
    </button>
  );
}
