import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RestWrap({ rested, className, children }: { rested?: boolean; className?: string; children: ReactNode }) {
  const prev = useRef(Boolean(rested));
  const [kick, setKick] = useState<"rest" | "wake" | null>(null);

  useEffect(() => {
    const now = Boolean(rested);
    if (prev.current === now) return;
    setKick(now ? "rest" : "wake");
    prev.current = now;
    const t = window.setTimeout(() => setKick(null), 640);
    return () => window.clearTimeout(t);
  }, [rested]);

  return (
    <div
      className={cn(
        "rest-wrap",
        rested && "is-rested",
        kick === "rest" && "anim-rest",
        kick === "wake" && "anim-wake",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SickAura() {
  return (
    <span className="sick-aura" aria-hidden>
      <span className="sick-veil" />
      <span className="sick-ring">
        <span className="sick-star s1" />
        <span className="sick-star s2" />
        <span className="sick-star s3" />
        <span className="sick-star s4" />
      </span>
    </span>
  );
}