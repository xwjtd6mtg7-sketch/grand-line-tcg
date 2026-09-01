import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const circle =
  "grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-fg shadow-[0_4px_16px_rgb(0_0_0/0.35)]";

export function PageBack({
  to = "/",
  label = "Retour",
  className,
}: {
  to?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link to={to} aria-label={label} className={cn(circle, className)}>
      <ChevronLeft className="size-5" strokeWidth={1.75} />
    </Link>
  );
}

export function PageBackButton({
  onClick,
  label = "Retour",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn(circle, className)}>
      <ChevronLeft className="size-5" strokeWidth={1.75} />
    </button>
  );
}
