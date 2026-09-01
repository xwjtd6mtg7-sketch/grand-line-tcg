import { useEffect } from "react";

export function BrowserGuard() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
      if ("scale" in e && typeof (e as TouchEvent & { scale?: number }).scale === "number") {
        if ((e as TouchEvent & { scale: number }).scale !== 1) e.preventDefault();
      }
    };

    let last: { t: number; x: number; y: number } | null = null;
    const onTouchEnd = (e: TouchEvent) => {
      const p = e.changedTouches[0];
      if (!p) return;
      const now = Date.now();
      if (last && now - last.t < 280 && Math.hypot(p.clientX - last.x, p.clientY - last.y) < 24) {
        e.preventDefault();
      }
      last = { t: now, x: p.clientX, y: p.clientY };
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };

    document.addEventListener("gesturestart", block, { passive: false });
    document.addEventListener("gesturechange", block, { passive: false });
    document.addEventListener("gestureend", block, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);
  return null;
}
