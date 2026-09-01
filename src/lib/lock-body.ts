import { useEffect } from "react";

function appScrollers() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-app-scroll]"));
}

function freezeAppScroll() {
  for (const el of appScrollers()) {
    el.dataset.lockY = String(el.scrollTop);
    el.style.overflow = "hidden";
    el.style.touchAction = "none";
  }
}

function unfreezeAppScroll() {
  for (const el of appScrollers()) {
    el.style.overflow = "";
    el.style.touchAction = "";
    const y = Number(el.dataset.lockY || 0);
    el.scrollTop = y;
    delete el.dataset.lockY;
  }
}

function clearLockStyles() {
  if (typeof document === "undefined") return;
  const b = document.body;
  const h = document.documentElement;
  b.style.position = "";
  b.style.top = "";
  b.style.left = "";
  b.style.right = "";
  b.style.overflow = "";
  b.style.touchAction = "";
  h.style.overflow = "";
  h.style.overscrollBehavior = "";
  delete h.dataset.scrollLocks;
  unfreezeAppScroll();
}

if (typeof window !== "undefined") {
  clearLockStyles();
}

function applyLock() {
  if (typeof document === "undefined") return;
  const h = document.documentElement;
  const n = Number(h.dataset.scrollLocks || 0);
  if (n === 0) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    h.style.overflow = "hidden";
    h.style.overscrollBehavior = "none";
    freezeAppScroll();
  }
  h.dataset.scrollLocks = String(n + 1);
}

function applyUnlock() {
  if (typeof document === "undefined") return;
  const h = document.documentElement;
  const n = Math.max(0, Number(h.dataset.scrollLocks || 0) - 1);
  if (n === 0) {
    clearLockStyles();
    return;
  }
  h.dataset.scrollLocks = String(n);
}

function inAllowedScroller(target: EventTarget | null) {
  let node = target instanceof HTMLElement ? target : target instanceof Text ? target.parentElement : null;
  while (node && node !== document.body) {
    if (node.dataset.scrolllockAllow !== undefined) return true;
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    const ox = style.overflowX;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1) return true;
    if ((ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 1) return true;
    node = node.parentElement;
  }
  return false;
}

export function useLockBody() {
  useEffect(() => {
    applyLock();
    const onTouchMove = (e: TouchEvent) => {
      if (inAllowedScroller(e.target)) return;
      e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (inAllowedScroller(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("wheel", onWheel, { capture: true });
      applyUnlock();
    };
  }, []);
}

export function BodyLock() {
  useLockBody();
  return null;
}
