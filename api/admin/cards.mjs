import { z } from "zod";
import { getSql } from "../_lib/db.mjs";
import { requireAdmin, HttpError } from "../_lib/require-admin.mjs";
import { findExistingCard, jsonbParam } from "../_lib/card-catalog.mjs";

const COLORS = new Set(["Red", "Green", "Blue", "Purple", "Black", "Yellow"]);
const COLOR_FR = {
  rouge: "Red",
  vert: "Green",
  bleu: "Blue",
  violet: "Purple",
  noir: "Black",
  jaune: "Yellow",
};

const intNull = z.preprocess((v) => {
  if (v === "" || v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}, z.number().int().nullable());

const cardSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Identifiant requis")
      .regex(/^[A-Za-z0-9._-]+$/, "Lettres, chiffres, - et _ uniquement"),
    name: z.string().trim().min(1, "Nom requis"),
    set: z.string().trim().min(1, "Booster requis"),
    setName: z.string().trim().min(1, "Nom du booster requis"),
    rarity: z.string().trim().min(1, "Rareté requise"),
    colors: z.array(z.string()).default([]),
    type: z.string().trim().min(1, "Type requis"),
    life: intNull,
    cost: intNull,
    power: intNull,
    counter: intNull,
    traits: z.array(z.string()).default([]),
    attr: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().trim().nullable()),
    text: z.string().default(""),
    textEn: z.string().optional(),
    image: z.string().trim().min(1, "Emplacement d'image requis"),
    parallel: z.boolean().default(false),
    src: z.string().trim().min(1).default("custom"),
    variant: z.string().optional(),
  })
  .passthrough();

function mapColor(c) {
  const s = String(c || "").trim();
  if (COLORS.has(s)) return s;
  const hit = COLOR_FR[s.toLowerCase()];
  return hit || null;
}

function normalizeBody(body) {
  const b = body && typeof body === "object" ? { ...body } : {};
  if (!b.set && (b.booster || b.setId)) b.set = b.booster || b.setId;
  if (!b.setName && (b.boosterName || b.set_name)) b.setName = b.boosterName || b.set_name;
  if (!b.image && (b.emplacement || b.imageUrl || b.srcImage)) {
    b.image = b.emplacement || b.imageUrl || b.srcImage;
  }
  if (typeof b.colors === "string") {
    b.colors = b.colors.split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(b.colors)) b.colors = [];
  b.colors = b.colors.map(mapColor).filter(Boolean);
  if (typeof b.traits === "string") {
    b.traits = b.traits.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(b.traits)) b.traits = [];
  b.traits = b.traits.map((s) => String(s).trim()).filter(Boolean);
  if (typeof b.parallel === "string") b.parallel = b.parallel === "true" || b.parallel === "1";
  if (!b.src) b.src = "custom";
  if (b.text == null) b.text = "";
  if (b.textEn === "") delete b.textEn;
  return b;
}

function isZodError(err) {
  return err?.name === "ZodError" || Array.isArray(err?.issues);
}

function zodMessage(err) {
  const issue = err?.issues?.[0];
  if (!issue) return err?.message || "Carte invalide";
  const path = Array.isArray(issue.path) && issue.path.length ? `${issue.path.join(".")}: ` : "";
  return path + (issue.message || "invalide");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** Add/replace a card by id (POST) or hide one (DELETE ?id=...). Admin only. */
export default async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  try {
    const user = await requireAdmin(req);
    const sql = await getSql();

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const parsed = cardSchema.parse(normalizeBody(body));
      const prev = await findExistingCard(parsed.id);
      const card = { ...(prev && typeof prev === "object" ? prev : {}), ...parsed, id: parsed.id };
      if (body.variant != null) card.variant = String(body.variant);
      await sql.query(
        `insert into card_overrides (id, action, card, updated_by, updated_at)
         values ($1, 'upsert', $2::jsonb, $3, now())
         on conflict (id) do update set
           action = 'upsert', card = excluded.card, updated_by = excluded.updated_by, updated_at = now()`,
        [card.id, jsonbParam(card), user.id],
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, card }));
      return;
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url, "http://localhost");
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) throw new HttpError(400, "Identifiant requis");
      await sql.query(
        `insert into card_overrides (id, action, card, updated_by, updated_at)
         values ($1, 'delete', null, $2, now())
         on conflict (id) do update set
           action = 'delete', card = null, updated_by = excluded.updated_by, updated_at = now()`,
        [id, user.id],
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, id, deleted: true }));
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : isZodError(err) ? 400 : 500;
    const message = isZodError(err) ? zodMessage(err) : err?.message || "internal_error";
    res.statusCode = status;
    res.end(JSON.stringify({ error: message }));
  }
}
