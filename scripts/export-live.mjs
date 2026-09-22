#!/usr/bin/env node
/**
 * Publish the live game (site/) as dist/.
 * Vercel / any `npm run build` must ship this snapshot — never a Vite rebuild of src/.
 *
 * Card art in site/cards-fr (~390MB, 3966 files) is NOT copied: it blows the
 * deploy size limit. Production serves /cards-fr/* from GitHub via vercel.json
 * rewrite. Local preview still reads site/cards-fr directly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const dist = path.join(root, "dist");
const index = path.join(site, "index.html");

if (!fs.existsSync(index)) {
  console.error("[grand-line-tcg] missing site/index.html");
  process.exit(1);
}

const html = fs.readFileSync(index, "utf8");
if (!html.includes("Grand Line TCG") || !html.includes("/assets/index-")) {
  console.error("[grand-line-tcg] site/index.html is not the live game");
  process.exit(1);
}

const match = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
const bundle = match ? match[1] : "?";

const skip = new Set(["cards-fr"]);

function include(src) {
  const rel = path.relative(site, src);
  if (!rel || rel.startsWith("..")) return true;
  const top = rel.split(path.sep)[0];
  return !skip.has(top);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(site, dist, { recursive: true, dereference: true, filter: include });
fs.mkdirSync(path.join(dist, "cards-fr"), { recursive: true });
fs.writeFileSync(
  path.join(dist, "cards-fr", ".keep"),
  "card art is served from GitHub/jsDelivr in production\n",
);
console.log(`[grand-line-tcg] exported live site/ -> dist/ (${bundle}, cards-fr omitted)`);
