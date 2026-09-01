import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; onReset?: () => void; fallbackTitle?: string };
type State = { err: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[combat]", err, info.componentStack);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="grid min-h-[60dvh] place-items-center px-6 py-10">
        <div className="w-full max-w-sm rounded-[18px] border border-line bg-surface p-5 text-center">
          <p className="font-display text-xl text-fg">{this.props.fallbackTitle ?? "Une erreur est survenue"}</p>
          <p className="mt-2 text-sm text-muted">Le combat n’a pas pu continuer. Tu peux revenir au menu.</p>
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              variant="ghost"
              onClick={() => {
                this.setState({ err: null });
                this.props.onReset?.();
              }}
            >
              Réessayer
            </Button>
            <Link to="/" className="flex-1">
              <Button className="w-full" variant="crimson">
                Menu
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
