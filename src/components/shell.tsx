import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Home, Menu, Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand";
import { Home as HomePage } from "@/routes/index";
import { Collection } from "@/routes/collection";
import { Shop } from "@/routes/shop";
import { Play } from "@/routes/play";
import { Decks } from "@/routes/decks";
import { StylePage } from "@/routes/style";
import { RulesPage } from "@/routes/rules";
import { LoginPage } from "@/routes/login";
import { AdminCardsPage } from "@/routes/admin.cards";
import { setBgmPaused } from "@/lib/bgm";
import { MenuDrawer } from "@/components/menu-drawer";
import { WalletChips } from "@/components/wallet";

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/collection", label: "Collection", icon: BookOpen },
  { to: "/play", label: "Combat", icon: Swords },
] as const;

export function Shell({ children: _children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const playMode = pathname.startsWith("/play");
  const decksMode = pathname.startsWith("/decks");
  const collectionMode = pathname.startsWith("/collection");
  const shopMode = pathname.startsWith("/shop");
  const styleMode = pathname.startsWith("/style");
  const rulesMode = pathname.startsWith("/rules");
  const loginMode = pathname.startsWith("/login");
  const adminMode = pathname.startsWith("/admin");
  const homeMode = pathname === "/";
  const hideHeader = homeMode || playMode || decksMode || collectionMode || shopMode || styleMode || rulesMode || loginMode || adminMode;
  const hideNav = playMode || decksMode || styleMode || rulesMode || loginMode || adminMode;
  const [menu, setMenu] = useState(false);
  const [tick, setTick] = useState({ home: 0, coll: 0, shop: 0 });
  const bump = (k: keyof typeof tick) => setTick((t) => ({ ...t, [k]: t[k] + 1 }));
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    if (pathname.startsWith("/collection")) bump("coll");
  }, [pathname]);

  useEffect(() => {
    setBgmPaused(playMode);
  }, [playMode]);

  return (
    <div className={cn("mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden", (homeMode || playMode || decksMode || collectionMode || shopMode || styleMode || rulesMode || loginMode || adminMode) && "decks-fs")}>
      {hideHeader ? null : (
      <header className="z-30 flex shrink-0 items-center justify-between gap-3 bg-transparent px-4 pb-2 pt-[max(0.7rem,calc(env(safe-area-inset-top)+0.35rem))]">
        <BrandLockup />
        <WalletChips />
      </header>
      )}
      <div
        data-app-scroll
        className="tab-host min-h-0 flex-1 overflow-hidden"
      >
        <div className={cn("tab-pane home-scroll overflow-y-auto [-webkit-overflow-scrolling:touch]", homeMode && "is-on")}>
          <HomePage key={tick.home} />
        </div>
        <div className={cn("tab-pane overflow-hidden", collectionMode && "is-on")}>
          {collectionMode ? <Collection key={tick.coll} /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", shopMode && "is-on")}>
          {shopMode ? <Shop key={tick.shop} /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", playMode && "is-on")}>
          {playMode ? <Play /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", decksMode && "is-on")}>
          {decksMode ? <Decks /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", styleMode && "is-on")}>
          {styleMode ? <StylePage /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", rulesMode && "is-on")}>
          {rulesMode ? <RulesPage /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", loginMode && "is-on")}>
          {loginMode ? <LoginPage /> : null}
        </div>
        <div className={cn("tab-pane overflow-hidden", adminMode && "is-on")}>
          {adminMode ? <AdminCardsPage /> : null}
        </div>
      </div>
      {hideNav ? null : (
      <nav className="z-30 shrink-0 border-t border-line bg-bg pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="app-dock">
          {NAV.map((item) => {
            const active = item.to === "/" ? homeMode : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  preload="intent"
                  onClick={() => {
                    if (!active && (item.to === "/" || item.to === "/collection")) {
                      bump(item.to === "/" ? "home" : "coll");
                    }
                    window.dispatchEvent(new CustomEvent("gl-tab", { detail: item.to }));
                  }}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] tracking-wide",
                    active ? "text-foam" : "text-subtle",
                  )}
                  data-nav={item.to === "/collection" ? "collection" : undefined}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <span className="relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] tracking-wide text-subtle/70">
              <Users className="size-5" strokeWidth={1.75} />
              Social
              <span className="nav-soon">Soon</span>
            </span>
          </li>
          <li>
            <button
              type="button"
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[10px] tracking-wide",
                menu ? "text-foam" : "text-subtle",
              )}
              onClick={() => setMenu(true)}
              aria-label="Paramètres"
            >
              <Menu className="size-5" strokeWidth={1.75} />
              Menu
            </button>
          </li>
        </ul>
      </nav>
      )}
      <MenuDrawer open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}