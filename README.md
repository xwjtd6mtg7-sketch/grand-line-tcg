# Grand Line TCG

Unofficial One Piece TCG client.

The **playable game** is the live snapshot in [`site/`](site/) (combat engine, catalog, card art). That is what `npm run dev`, `npm run build`, and the GitHub/Vercel site deploy.

`src/` is a separate, older TanStack Start rewrite kept in this repo for a login/card-admin backend experiment — it is **not** the live game (it's missing the combat engine and some cards). Do not point `npm run build`/`vercel.json` at a `vite build` of `src/`: that ships the old/incomplete version. If you edit the game itself, edit through the Grok App Builder project (grand-line-tcg.grok.me), not this `src/` folder.

**Play:** [grand-line-tcg.grok.me](https://grand-line-tcg.grok.me) · **GitHub:** [xwjtd6mtg7-sketch/grand-line-tcg](https://github.com/xwjtd6mtg7-sketch/grand-line-tcg)

## Run

```bash
npm install
npm run dev
```

Serves `site/` as-is.

`npm run build` copies `site/` → `dist/` (same live game). It does **not** rebuild from `src/`.

## Layout

| Path | What it is |
|---|---|
| `site/` | Current game (HTML, JS, catalog, card art) |
| `src/` | Older Vite/TanStack Start rewrite + a login/card-admin backend prototype (auth, `src/lib/admin/`) — not wired into the live build |
| `scripts/serve-live.mjs` | Dev server used by `npm run dev` |
| `scripts/export-live.mjs` | Used by `npm run build` / Vercel |

Card images live once under `site/cards-fr/`.

## Download

On GitHub: **Code → Download ZIP** (branch `main`). You get this live tree, including `site/`.

A Grok.com project download of the whole workspace can fail (card art is hundreds of MB).


