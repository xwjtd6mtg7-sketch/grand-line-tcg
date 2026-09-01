import { useEffect, useRef, useState } from "react";
import { BodyLock } from "@/lib/lock-body";
import { bootPrefetch, useBootProgress } from "@/lib/cache";
import { loadCatalog } from "@/lib/tcg/catalog";
import { unlockSfx } from "@/lib/sfx";
import { preloadBgm, startBgm } from "@/lib/bgm";
import { hydrateAudio } from "@/lib/audio-prefs";
import { BrandLockup } from "@/components/brand";
import { cn } from "@/lib/utils";

const MIN_MS = 1800;

export function IntroScreen({ onEnter }: { onEnter: () => void }) {
  const boot = useBootProgress();
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(performance.now());
  const lock = useRef(false);

  useEffect(() => {
    started.current = performance.now();
    let live = true;
    void bootPrefetch();
    preloadBgm();
    const failsafe = window.setTimeout(() => {
      if (live) setReady(true);
    }, 6000);
    void loadCatalog()
      .catch(() => null)
      .then(async () => {
        const wait = MIN_MS - (performance.now() - started.current);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (live) setReady(true);
      });
    return () => {
      live = false;
      window.clearTimeout(failsafe);
    };
  }, []);

  const pct = boot.total > 0 ? Math.min(1, boot.done / boot.total) : ready ? 1 : 0.08;
  const shown = ready ? 1 : Math.max(0.08, pct);

  const enter = () => {
    if (!ready || lock.current) return;
    lock.current = true;
    unlockSfx();
    hydrateAudio();
    startBgm();
    setLeaving(true);
    window.setTimeout(onEnter, 640);
  };

  return (
    <div
      className={cn("intro-root", ready && "is-ready", leaving && "is-out")}
      onClick={enter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enter();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={ready ? "Appuyer pour commencer" : "Chargement"}
    >
      <BodyLock />
      <div className="intro-sky" aria-hidden />
      <div className="intro-glow" aria-hidden />
      <div className="intro-rings" aria-hidden />
      <div className="intro-veil" />
      <div className="intro-stage">
        <BrandLockup size="hero" className="intro-logo" />
      </div>
      <div className="intro-foot">
        {ready ? (
          <p className="intro-tap">Appuyez pour commencer</p>
        ) : (
          <>
            <div className="intro-bar" aria-hidden>
              <span className="intro-bar-fill" style={{ transform: `scaleX(${shown})` }} />
            </div>
            <p className="intro-load">Chargement</p>
          </>
        )}
        <p className="intro-copy">Projet fan · non affilié à Bandai / Toei / Shueisha</p>
      </div>
    </div>
  );
}
