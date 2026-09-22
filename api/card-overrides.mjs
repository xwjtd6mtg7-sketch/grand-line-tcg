import { loadOverrides } from "./_lib/card-catalog.mjs";

/**
 * Public, read-only: the admin's add/edit/delete list, merged into the live
 * catalog by the server (/data/catalog.json) and the game store.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  try {
    const overrides = await loadOverrides();
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store, no-cache, must-revalidate");
    res.statusCode = 200;
    res.end(JSON.stringify(overrides.map(({ id, action, card }) => ({ id, action, card }))));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error", message: err?.message }));
  }
}
