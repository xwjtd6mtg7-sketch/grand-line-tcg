import assert from "node:assert/strict";
import { applyOverrides, normalizeCard, jsonbParam } from "../api/_lib/card-catalog.mjs";

const catalog = {
  cards: [
    {
      id: "OP01-001",
      name: "Luffy",
      set: "OP-01",
      setName: "Romance Dawn",
      image: "/old.webp",
      variant: "Manga",
      type: "Leader",
    },
    { id: "OP01-002", name: "Zoro", set: "OP-01", image: "/z.webp" },
  ],
};
applyOverrides(catalog, [
  {
    id: "OP01-001",
    action: "upsert",
    card: { id: "OP01-001", name: "Monkey D. Luffy", set: "OP-02", setName: "Paramount War", image: "/new.webp" },
  },
]);
const card = catalog.cards.find((c) => c.id === "OP01-001");
assert.equal(card.name, "Monkey D. Luffy");
assert.equal(card.set, "OP-02");
assert.equal(card.setName, "Paramount War");
assert.equal(card.image, "/new.webp");
assert.equal(card.variant, "Manga");
assert.equal(catalog.cards.some((c) => c.id === "OP01-002"), true);

const removed = { cards: [{ id: "OP01-001", name: "Luffy" }, { id: "OP01-002", name: "Zoro" }] };
applyOverrides(removed, [{ id: "OP01-001", action: "delete", card: null }]);
assert.deepEqual(removed.cards.map((c) => c.id), ["OP01-002"]);

const added = { cards: [{ id: "OP01-001", name: "Luffy" }] };
applyOverrides(added, [
  { id: "OP99-999", action: "upsert", card: { id: "OP99-999", name: "Custom", set: "OP-17", image: "/c.webp" } },
]);
assert.equal(added.cards.length, 2);
assert.equal(added.cards.find((c) => c.id === "OP99-999").name, "Custom");

assert.equal(normalizeCard(JSON.stringify({ id: "X", name: "Y" })).id, "X");
assert.equal(normalizeCard(null), null);
assert.equal(JSON.parse(jsonbParam({ id: "OP01-001", name: "Luffy" })).name, "Luffy");

console.log("admin-cards overlay ok");
