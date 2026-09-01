import type { ColorName } from "@/lib/tcg/types";
import { COLOR_FR, COLOR_HEX, COLOR_ORDER } from "@/lib/tcg/catalog";
import { cn } from "@/lib/utils";

export function ColorChips({
  value,
  onChange,
}: {
  value: ColorName[];
  onChange: (next: ColorName[]) => void;
}) {
  const toggle = (c: ColorName) => {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  };
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label="Toutes les couleurs"
        onClick={() => onChange([])}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
          value.length === 0 ? "bg-foam text-ink" : "bg-elevated text-muted",
        )}
      >
        Tous
      </button>
      {COLOR_ORDER.map((c) => {
        const on = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-label={COLOR_FR[c]}
            title={COLOR_FR[c]}
            onClick={() => toggle(c)}
            className={cn(
              "size-7 shrink-0 rounded-full",
              on ? "ring-2 ring-foam ring-offset-2 ring-offset-bg" : "opacity-70",
            )}
            style={{ background: COLOR_HEX[c] }}
          />
        );
      })}
    </div>
  );
}