import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMergedCatalog } from "./_lib/card-catalog.mjs";

const FALLBACK = join(dirname(fileURLToPath(import.meta.url)), "..", "site", "data", "catalog.json");

/** Public merged catalog (static JSON + admin add/edit/delete). */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  try {
    const catalog = await getMergedCatalog();
    const body = JSON.stringify(catalog);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store, no-cache, must-revalidate");
    res.statusCode = 200;
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  } catch (err) {
    try {
      const raw = await readFile(FALLBACK);
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.statusCode = 200;
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(raw);
    } catch {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "internal_error", message: err?.message }));
    }
  }
}
