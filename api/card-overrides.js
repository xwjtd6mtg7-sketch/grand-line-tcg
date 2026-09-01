import { getSql } from "./_lib/db.mjs";

/**
 * Public, read-only: the admin's add/edit/delete list, merged into the live
 * catalog by site/sw.js (the game's own JS never changes). Small payload —
 * safe to fetch on every catalog load.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  try {
    const sql = await getSql();
    const rows = await sql`select id, action, card from card_overrides order by updated_at asc`;
    const overrides = rows.map((r) => ({
      id: r.id,
      action: r.action,
      card:
        r.action === "delete" || r.card == null
          ? null
          : typeof r.card === "string"
            ? JSON.parse(r.card)
            : r.card,
    }));
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.statusCode = 200;
    res.end(JSON.stringify(overrides));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "internal_error", message: err?.message }));
  }
}
