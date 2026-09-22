/**
 * Shared catalog overlay: admin upserts/deletes live on top of the static
 * /data/catalog.json. Used by the public feed, the merged catalog endpoint,
 * and the admin save path (to keep extra fields like `variant`).
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSql } from "./db.mjs";

const CANDIDATES = [
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "site", "data", "catalog.json"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "data", "catalog.json"),
  join(process.cwd(), "site", "data", "catalog.json"),
  join(process.cwd(), "dist", "data", "catalog.json"),
];

let baseCache = null;

export function applyOverrides(catalog, overrides) {
  if (!catalog || !Array.isArray(catalog.cards)) return catalog;
  if (!Array.isArray(overrides) || !overrides.length) return catalog;
  const byId = new Map(catalog.cards.map((c) => [c.id, c]));
  for (const o of overrides) {
    if (!o || !o.id) continue;
    if (o.action === "delete") {
      byId.delete(o.id);
      continue;
    }
    const incoming = normalizeCard(o.card);
    if (!incoming) continue;
    const prev = byId.get(o.id) || {};
    byId.set(o.id, { ...prev, ...incoming, id: o.id });
  }
  catalog.cards = Array.from(byId.values());
  return catalog;
}

export function normalizeCard(card) {
  if (card == null) return null;
  if (typeof card === "string") {
    try {
      card = JSON.parse(card);
    } catch {
      return null;
    }
  }
  if (typeof card !== "object") return null;
  return card;
}

export async function loadBaseCatalog() {
  if (baseCache) return structuredClone(baseCache);
  let lastErr;
  for (const path of CANDIDATES) {
    try {
      const raw = await readFile(path, "utf8");
      baseCache = JSON.parse(raw);
      return structuredClone(baseCache);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("catalog.json introuvable");
}

export async function loadOverrides() {
  const sql = await getSql();
  const rows = await sql`select id, action, card, updated_at from card_overrides order by updated_at asc`;
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    card: r.action === "delete" ? null : normalizeCard(r.card),
    updated_at: r.updated_at,
  }));
}

export async function getMergedCatalog() {
  const [base, overrides] = await Promise.all([loadBaseCatalog(), loadOverrides().catch(() => [])]);
  applyOverrides(base, overrides);
  return base;
}

export async function findExistingCard(id) {
  const sql = await getSql();
  const rows = await sql`select action, card from card_overrides where id = ${id} limit 1`;
  const row = rows[0];
  if (row?.action === "upsert") {
    const card = normalizeCard(row.card);
    if (card) return card;
  }
  try {
    const base = await loadBaseCatalog();
    return (base.cards || []).find((c) => c.id === id) || null;
  } catch {
    return null;
  }
}

export function jsonbParam(value) {
  return JSON.stringify(value ?? null);
}
