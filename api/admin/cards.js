import { z } from "zod";
import { getSql } from "../_lib/db.mjs";
import { requireAdmin, HttpError } from "../_lib/require-admin.mjs";

const cardSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Identifiant requis")
    .regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement"),
  name: z.string().trim().min(1, "Nom requis"),
  set: z.string().trim().min(1, "Set requis"),
  setName: z.string().trim().min(1, "Nom de set requis"),
  rarity: z.string().trim().min(1, "Rareté requise"),
  colors: z.array(z.enum(["Red", "Green", "Blue", "Purple", "Black", "Yellow"])).default([]),
  type: z.enum(["Leader", "Character", "Event", "Stage", "DON!!"]),
  life: z.number().int().nullable(),
  cost: z.number().int().nullable(),
  power: z.number().int().nullable(),
  counter: z.number().int().nullable(),
  traits: z.array(z.string().trim().min(1)).default([]),
  attr: z.string().trim().nullable(),
  text: z.string().default(""),
  textEn: z.string().trim().optional(),
  image: z.string().trim().min(1, "Image requise"),
  parallel: z.boolean().default(false),
  src: z.string().trim().min(1, "Source requise"),
});

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** Add/replace a card by id (POST) or hide one (DELETE ?id=...). Admin only. */
export default async function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  try {
    const user = await requireAdmin(req);
    const sql = await getSql();

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const data = cardSchema.parse(body);
      await sql`
        insert into card_overrides (id, action, card, updated_by, updated_at)
        values (${data.id}, 'upsert', ${JSON.stringify(data)}::jsonb, ${user.id}, now())
        on conflict (id) do update set
          action = 'upsert', card = excluded.card, updated_by = excluded.updated_by, updated_at = now()
      `;
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url, "http://localhost");
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) throw new HttpError(400, "Identifiant requis");
      await sql`
        insert into card_overrides (id, action, card, updated_by, updated_at)
        values (${id}, 'delete', null, ${user.id}, now())
        on conflict (id) do update set
          action = 'delete', card = null, updated_by = excluded.updated_by, updated_at = now()
      `;
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err?.name === "ZodError" ? 400 : 500;
    const message =
      err?.name === "ZodError" ? err.issues?.[0]?.message : err?.message || "internal_error";
    res.statusCode = status;
    res.end(JSON.stringify({ error: message }));
  }
}
