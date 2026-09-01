# Grand Line TCG

Unofficial One Piece TCG client — deck building, boosters, and 1v1 combat, built
with TanStack Start (React) + a Postgres backend (accounts, card admin).

**Play:** [grand-line-tcg.grok.me](https://grand-line-tcg.grok.me) · **GitHub:** [xwjtd6mtg7-sketch/grand-line-tcg](https://github.com/xwjtd6mtg7-sketch/grand-line-tcg)

## Run locally

```bash
npm install
npm run dev
```

Opens on `http://localhost:8080`. With no `DATABASE_URL` set, accounts and the
card admin fall back to an embedded in-memory Postgres (PGLite) — everything
works, but data resets whenever the dev server restarts.

## Accounts & card administration

Sign-up/sign-in is real email + password (see `/login`). **The very first
account ever created becomes the card-catalog admin automatically** — no
config needed. That account gets an "Administration des cartes" entry in the
menu (☰), where they can add, edit, or remove any card in the game. Changes
apply to every player's catalog on their next load.

## Deploying to Vercel

`npm run build` runs the real production build (Vite + TanStack Start +
Nitro's `vercel` preset) and applies database migrations. Push this repo to
GitHub and import it in Vercel, then set these **Environment Variables** on
the Vercel project before deploying:

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | Yes | A Postgres connection string (e.g. from [Neon](https://neon.tech), Vercel Postgres, or Supabase). Without it, accounts don't persist between requests in production. |
| `BETTER_AUTH_SECRET` | Yes | A long random string (e.g. `openssl rand -hex 32`). Used to sign session tokens. |
| `BETTER_AUTH_URL` | Yes | The exact public URL of your deployment, e.g. `https://your-app.vercel.app`. Required for sign-in/sign-up to work — without it you'll see "Invalid origin" errors. |

Google/X sign-in buttons are intentionally not shown — they depend on a
private auth broker only available inside the Grok App Builder sandbox. Email
+ password is the supported method for a standalone deployment.

## Layout

| Path | What it is |
|---|---|
| `src/routes/` | Pages (file-based routing; each page's actual render is mounted by `src/components/shell.tsx`) |
| `src/lib/auth/` | Better Auth wiring (do not edit, except `email-password.ts`) |
| `src/lib/admin/` | Card-catalog admin: single-admin bootstrap + add/edit/delete server functions |
| `src/lib/db.ts` | Postgres (Neon) / PGLite dual-mode database client |
| `migrations/` | SQL schema, applied automatically on build/startup |
| `public/data/catalog.json` | The static base card catalog (admin edits layer on top of this) |

## Tests

```bash
npm test
npm run typecheck
npm run lint
```

