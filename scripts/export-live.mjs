#!/usr/bin/env node
/**
 * Publish the live game (site/) as dist/.
 * Vercel / any `npm run build` must ship this snapshot — never a Vite rebuild of src/.
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

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(site, dist, { recursive: true, dereference: true });
console.log(`[grand-line-tcg] exported live site/ -> dist/ (${bundle})`);
