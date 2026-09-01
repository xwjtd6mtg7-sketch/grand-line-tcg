import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Download, Gift, HelpCircle, LogIn, Settings, ShieldCheck } from "lucide-react";
import { GoldSwitch, VolumeSlider } from "@/components/gold-switch";
import { BodyLock } from "@/lib/lock-body";
import { useCatalog } from "@/components/catalog-provider";
import { usePlayer } from "@/lib/store";
import { useAudio } from "@/lib/audio-prefs";
import { cancelDownload, downloadAll, readCacheStatus, useCacheJob } from "@/lib/cache";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { getAdminStatus } from "@/lib/admin/cards";

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [shown, setShown] = useState(open);
  const [inview, setInview] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [prefsIn, setPrefsIn] = useState(false);
  const [pull, setPull] = useState(0);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const nav = useNavigate();
  const player = usePlayer();
  const audio = useAudio();
  const catalog = useCatalog();

  useEffect(() => {
    if (open) {
      setShown(true);
      setInview(false);
      const t = window.setTimeout(() => setInview(true), 24);
      return () => window.clearTimeout(t);
    }
    setInview(false);
    setPrefsIn(false);
    const t = window.setTimeout(() => {
      setShown(false);
      setPrefs(false);
    }, 400);
    return () => window.clearTimeout(t);
  }, [open]);

  useLayoutEffect(() => {
    if (!shown) return;
    const place = () => {
      const panel = document.querySelector<HTMLElement>(".side-panel");
      if (!panel) return;
      const row =
        document.querySelector<HTMLElement>(".tab-pane.is-on .gl-head-row") ??
        document.querySelector<HTMLElement>(".gl-head-row");
      const rule =
        document.querySelector<HTMLElement>(".tab-pane.is-on .gl-rule") ??
        document.querySelector<HTMLElement>(".gl-rule");
      const dock = document.querySelector<HTMLElement>("nav .app-dock")?.closest("nav");
      const topEl = rule ?? row;
      const top = topEl ? Math.round(topEl.getBoundingClientRect().bottom + 8) : 0;
      const bot = dock ? Math.round(window.innerHeight - dock.getBoundingClientRect().top) : 0;
      if (top) panel.style.setProperty("top", `${top}px`, "important");
      if (bot) panel.style.setProperty("bottom", `${bot}px`, "important");
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [shown, inview]);

  if (!shown) return null;

  const go = (to: "/rules" | "/shop" | "/login" | "/admin/cards") => {
    sfx("ui");
    onClose();
    void nav({ to });
  };

  const openPrefs = () => {
    sfx("ui");
    setPrefs(true);
    setPrefsIn(false);
    window.setTimeout(() => setPrefsIn(true), 24);
  };
  const closePrefs = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    sfx("ui");
    setPull(0);
    setPrefsIn(false);
    window.setTimeout(() => setPrefs(false), 380);
  };

  const onGrabDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, dy: 0 };
  };
  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    setPull(dy);
  };
  const onGrabUp = () => {
    if (!drag.current) return;
    const dy = drag.current.dy;
    drag.current = null;
    if (dy > 88) closePrefs();
    else setPull(0);
  };

  return createPortal(
    <div className={cn("side-root", inview && "is-in")} onClick={onClose}>
      <BodyLock />
      <aside className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-profile">
          <div className="side-avatar" aria-hidden>
            GL
          </div>
          <div className="side-who">
            <p className="side-name">Grand Line</p>
            <p className="side-meta">
              {player.wins}V · {player.losses}D
            </p>
          </div>
        </div>

        <div className="side-list">
          <button type="button" className="side-row" onClick={() => go("/shop")}>
            <Gift className="size-5" strokeWidth={1.7} />
            Boutique
          </button>
          <SignedOut>
            <button type="button" className="side-row" onClick={() => go("/login")}>
              <LogIn className="size-5" strokeWidth={1.7} />
              Connexion / Compte
            </button>
          </SignedOut>
          <SignedIn>
            <div className="side-row is-static">
              <UserButton />
            </div>
            <AdminRow onNavigate={go} />
          </SignedIn>
        </div>

        <div className="side-foot">
          <button type="button" className="side-row" onClick={() => go("/rules")}>
            <HelpCircle className="size-5" strokeWidth={1.7} />
            Comment jouer
          </button>
          <DownloadRow />
          <button type="button" className="side-row" onClick={openPrefs}>
            <Settings className="size-5" strokeWidth={1.7} />
            Paramètres
          </button>
          <div className="side-row is-static">
            <span className="side-dev">DEV</span>
            Développement
            <GoldSwitch
              on={player.devInfinite}
              onChange={() => player.toggleDevInfinite()}
              label="Cartes et berries"
            />
          </div>
        </div>
      </aside>

      {prefs ? (
        <div
          className={cn("pref-root", prefsIn && "is-in")}
          onClick={(e) => {
            e.stopPropagation();
            closePrefs();
          }}
        >
          <div
            className={cn("pref-sheet", pull > 0 && "is-drag")}
            style={{ ["--pull" as string]: `${pull}px` } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pref-grab"
              onPointerDown={onGrabDown}
              onPointerMove={onGrabMove}
              onPointerUp={onGrabUp}
              onPointerCancel={onGrabUp}
            >
              <span className="pref-handle" />
              <h3 className="pref-title">Paramètres</h3>
              <div className="gl-rule pref-rule" />
            </div>
            <p className="pref-label">Audio</p>
            <AudioCard
              title="Musique"
              on={audio.musicOn}
              vol={audio.musicVol}
              onToggle={() => audio.setMusicOn(!audio.musicOn)}
              onVol={audio.setMusicVol}
            />
            <AudioCard
              title="Effets sonores"
              on={audio.sfxOn}
              vol={audio.sfxVol}
              onToggle={() => {
                audio.setSfxOn(!audio.sfxOn);
                if (!audio.sfxOn) sfx("ui");
              }}
              onVol={audio.setSfxVol}
            />
            <button type="button" className="pref-reset" onClick={() => audio.resetAudio()}>
              Réinitialiser
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function AdminRow({ onNavigate }: { onNavigate: (to: "/admin/cards") => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getAdminStatus()
      .then((r) => {
        if (!cancelled) setIsAdmin(r.isAdmin);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!isAdmin) return null;
  return (
    <button type="button" className="side-row" onClick={() => onNavigate("/admin/cards")}>
      <ShieldCheck className="size-5" strokeWidth={1.7} />
      Administration des cartes
    </button>
  );
}

function AudioCard({
  title,
  on,
  vol,
  onToggle,
  onVol,
}: {
  title: string;
  on: boolean;
  vol: number;
  onToggle: () => void;
  onVol: (v: number) => void;
}) {
  return (
    <div className={cn("pref-card", !on && "is-off")}>
      <div className="pref-card-top">
        <span>{title}</span>
        <GoldSwitch on={on} onChange={onToggle} label={title} />
      </div>
      <VolumeSlider value={vol} onChange={onVol} disabled={!on} />
    </div>
  );
}

function DownloadRow() {
  const catalog = useCatalog();
  const job = useCacheJob();
  const [saved, setSaved] = useState(readCacheStatus);
  useEffect(() => {
    if (!job.running) setSaved(readCacheStatus());
  }, [job.running, job.done]);
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  const ready = Boolean(saved?.complete) && !job.running;
  return (
    <button
      type="button"
      className="side-row is-col"
      onClick={() => {
        sfx("ui");
        if (job.running) cancelDownload();
        else void downloadAll(catalog);
      }}
    >
      <span className="side-row-line">
        <Download className="size-5" strokeWidth={1.7} />
        {job.running ? "Téléchargement…" : ready ? "Mettre à jour" : "Télécharger le jeu"}
      </span>
      {job.running ? <span className="side-dl">{pct}%</span> : ready ? <span className="side-dl is-ok">Prêt</span> : null}
    </button>
  );
}
