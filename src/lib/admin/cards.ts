import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { claimOrCheckAdmin } from "./admin.server";
import { adminMiddleware } from "./middleware";
import type { TcgCard } from "@/lib/tcg/types";

/** Validates a card payload from the admin form before it is persisted. */
export const cardInputSchema = z.object({
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

export type CardInput = z.infer<typeof cardInputSchema>;

export type CardOverrideRow =
  | { id: string; action: "upsert"; card: TcgCard }
  | { id: string; action: "delete"; card: null };

/**
 * Public — every visitor's catalog load merges these over the static catalog.
 * POST (not GET): the admin page re-calls this right after a mutation, and a
 * GET with no params is a prime target for the browser's HTTP cache.
 */
export const listCardOverrides = createServerFn({ method: "POST" }).handler(
  async (): Promise<CardOverrideRow[]> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; action: string; card: unknown }>`
      select id, action, card from card_overrides order by updated_at asc
    `;
    return rows.map((r) => {
      if (r.action === "delete" || r.card == null) {
        return { id: r.id, action: "delete", card: null };
      }
      const card = (typeof r.card === "string" ? JSON.parse(r.card) : r.card) as TcgCard;
      return { id: r.id, action: "upsert", card };
    });
  },
);

/** Whether the signed-in caller is the card-catalog admin (claims the slot if it's empty). */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => ({ isAdmin: await claimOrCheckAdmin(context.userId) }));

/** Add a new card or replace an existing one (base or previously-added) by id. Admin only. */
export const upsertCardOverride = createServerFn({ method: "POST" })
  .validator(cardInputSchema)
  .middleware([adminMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await sql`
      insert into card_overrides (id, action, card, updated_by, updated_at)
      values (${data.id}, 'upsert', ${JSON.stringify(data)}::jsonb, ${context.userId}, now())
      on conflict (id) do update set
        action = 'upsert', card = excluded.card, updated_by = excluded.updated_by, updated_at = now()
    `;
    return { ok: true as const };
  });

/** Hide a card (base or custom) from the catalog by id. Admin only. */
export const deleteCardOverride = createServerFn({ method: "POST" })
  .validator((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) throw new Error("Identifiant requis");
    return trimmed;
  })
  .middleware([adminMiddleware])
  .handler(async ({ data: id, context }) => {
    const sql = await getSql();
    await sql`
      insert into card_overrides (id, action, card, updated_by, updated_at)
      values (${id}, 'delete', null, ${context.userId}, now())
      on conflict (id) do update set
        action = 'delete', card = null, updated_by = excluded.updated_by, updated_at = now()
    `;
    return { ok: true as const };
  });
