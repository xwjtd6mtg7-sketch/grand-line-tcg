# Grand Line TCG

Unofficial One Piece TCG client.

The **playable game** is the live snapshot in [`site/`](site/) (combat engine, catalog, card art) — untouched, compiled HTML/JS. `npm run dev` serves it as-is; `npm run build` copies it to `dist/` for Vercel. **Never rebuild the game itself from source in this repo** — edit it through the Grok App Builder project (grand-line-tcg.grok.me).

On top of that, unchanged, live game this repo adds a **real backend** (`api/`): email/password accounts and a card-catalog admin, without touching a single line of the compiled game bundle. See "Accounts & card administration" below.

**Play:** [grand-line-tcg.grok.me](https://grand-line-tcg.grok.me) · **GitHub:** [xwjtd6mtg7-sketch/grand-line-tcg](https://github.com/xwjtd6mtg7-sketch/grand-line-tcg)

## Run

```bash
npm install
npm run dev
```

Serves `site/` as-is on `http://localhost:8080` (no `/api/*` locally — see below to test those).

`npm run build` copies `site/` → `dist/` and applies database migrations (skipped gracefully if `DATABASE_URL` isn't set).

## Accounts & card administration

- **`/login.html`** — real email + password sign-up/sign-in (Better Auth). A small floating chip (bottom-right, injected via `site/account-widget.js`) shows sign-in state anywhere in the game and links to it.
- **The very first account ever created becomes the card-catalog admin automatically** — no config needed.
- **`/admin.html`** — the admin can add, edit, or remove any card. Changes are stored in Postgres and merged into the live catalog **by the game's own service worker** (`site/sw.js` intercepts `/data/catalog.json` and layers admin overrides on top) — the compiled game bundle is never modified. Any failure in that merge falls back to the exact original static file, so this can never break the game.
- Google/X sign-in is intentionally not offered — it depends on a private auth broker only available inside the Grok App Builder sandbox. Email + password is the supported method here.

### Required environment variables (set on Vercel before deploying)

| Variable | Value |
|---|---|
| `DATABASE_URL` | A Postgres connection string (e.g. [Neon](https://neon.tech)). Without it, accounts fall back to an in-memory database that resets on every cold start. |
| `BETTER_AUTH_SECRET` | A long random string, e.g. `openssl rand -hex 32`. |
| `BETTER_AUTH_URL` | The exact public URL of the deployment, e.g. `https://your-app.vercel.app`. Without it, sign-in fails with "Invalid origin". |

### Testing the backend locally

`npm run dev` only serves the static game (no `/api/*`). To exercise the backend locally, run `npx vercel dev` (requires a free Vercel login) or point any Node HTTP harness at the handlers under `api/*.js` — each is a plain `(req, res) => …` function with no framework dependency.

## Layout

| Path | What it is |
|---|---|
| `site/` | The live game (HTML, JS, catalog, card art, service worker) — do not edit its compiled JS |
| `api/` | Standalone Vercel serverless functions: Better Auth (`api/auth/`), card admin (`api/admin/`), public overrides feed (`api/card-overrides.js`) |
| `migrations/` | SQL schema (Better Auth tables + `admins`/`card_overrides`), applied automatically on build/startup |
| `site/login.html`, `site/admin.html` | Standalone pages for sign-in and card administration |
| `site/account-widget.js` | Floating account chip injected into `site/index.html` |
| `scripts/serve-live.mjs` | Dev server used by `npm run dev` |
| `scripts/export-live.mjs` | Publishes `site/` → `dist/`, used by `npm run build` / Vercel |

Card images live once under `site/cards-fr/`.

## Download

On GitHub: **Code → Download ZIP** (branch `main`). You get this live tree, including `site/`.

A Grok.com project download of the whole workspace can fail (card art is hundreds of MB).

