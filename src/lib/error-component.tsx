import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-fg">
      <span className="text-crimson" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl">Une erreur est survenue</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "Le jeu n’a pas pu continuer. Relance pour réessayer."}
      </p>
      <button
        type="button"
        className="h-12 rounded-[14px] bg-foam px-5 font-medium text-ink"
        onClick={() => window.location.reload()}
      >
        Relancer
      </button>
    </main>
  );
}