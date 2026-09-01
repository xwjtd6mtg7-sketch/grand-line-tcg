import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LogIn, Loader2, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: () => null });

type Mode = "signin" | "signup";

export function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in — bounce home with a full navigation (a client-side
  // router.navigate() away from /login raced Vite's dev module loading here).
  useEffect(() => {
    if (!isPending && user) window.location.href = "/";
  }, [isPending, user]);

  if (!isPending && user) return null;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({
          email: cleanEmail,
          password,
          name: name.trim() || cleanEmail.split("@")[0]!,
        });
        if (err) throw new Error(err.message ?? "Impossible de créer le compte.");
      } else {
        const { error: err } = await authClient.signIn.email({ email: cleanEmail, password });
        if (err) throw new Error(err.message ?? "Email ou mot de passe incorrect.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-root">
      <div className="auth-glow" aria-hidden />
      <div className="auth-stage">
        <BrandLockup size="cine" className="auth-brand" />

        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={cn("auth-tab", mode === "signin" && "is-on")}
              onClick={() => switchMode("signin")}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={cn("auth-tab", mode === "signup" && "is-on")}
              onClick={() => switchMode("signup")}
            >
              Créer un compte
            </button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" ? (
              <label className="auth-field">
                <span>Pseudo</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Roronoa"
                  autoComplete="nickname"
                  maxLength={40}
                  className="auth-input"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                autoComplete="email"
                className="auth-input"
              />
            </label>

            <label className="auth-field">
              <span>Mot de passe</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                className="auth-input"
              />
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <Button type="submit" variant="don" size="lg" disabled={busy} className="auth-submit">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "signup" ? (
                <UserPlus className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </Button>
          </form>

          <p className="auth-swap">
            {mode === "signup" ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "Se connecter" : "En créer un"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
