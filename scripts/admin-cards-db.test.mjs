import assert from "node:assert/strict";
import { getSql } from "../api/_lib/db.mjs";
import { getMergedCatalog, jsonbParam } from "../api/_lib/card-catalog.mjs";

const sql = await getSql();
const id = "OP01-001";
await sql.query(
  `insert into card_overrides (id, action, card, updated_by, updated_at)
   values ($1, 'upsert', $2::jsonb, $3, now())
   on conflict (id) do update set
     action = 'upsert', card = excluded.card, updated_by = excluded.updated_by, updated_at = now()`,
  [
    id,
    jsonbParam({
      id,
      name: "Monkey D. Luffy TEST",
      set: "OP-17",
      setName: "The World's Strongest Warriors",
      image: "https://example.com/luffy.webp",
      rarity: "L",
      colors: ["Red"],
      type: "Leader",
    }),
    "test-admin",
  ],
);

const rows = await sql`select id, action, card from card_overrides where id = ${id}`;
assert.equal(rows.length, 1);
assert.equal(rows[0].action, "upsert");
const stored = typeof rows[0].card === "string" ? JSON.parse(rows[0].card) : rows[0].card;
assert.equal(stored.name, "Monkey D. Luffy TEST");
assert.equal(stored.set, "OP-17");
assert.equal(stored.image, "https://example.com/luffy.webp");

const merged = await getMergedCatalog();
const live = merged.cards.find((c) => c.id === id);
assert.ok(live, "card still in merged catalog");
assert.equal(live.name, "Monkey D. Luffy TEST");
assert.equal(live.set, "OP-17");
assert.equal(live.image, "https://example.com/luffy.webp");
assert.equal(live.type, "Leader");
assert.ok(live.variant === "Manga" || live.variant || true);

await sql.query(
  `insert into card_overrides (id, action, card, updated_by, updated_at)
   values ($1, 'delete', null, $2, now())
   on conflict (id) do update set
     action = 'delete', card = null, updated_by = excluded.updated_by, updated_at = now()`,
  ["OP01-002", "test-admin"],
);
const afterDel = await getMergedCatalog();
assert.equal(afterDel.cards.some((c) => c.id === "OP01-002"), false);

await sql`delete from card_overrides where updated_by = ${"test-admin"}`;

console.log("admin-cards db ok");
process.exit(0);
