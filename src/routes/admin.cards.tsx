import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  cardInputSchema,
  deleteCardOverride,
  getAdminStatus,
  listCardOverrides,
  upsertCardOverride,
  type CardInput,
} from "@/lib/admin/cards";
import type { CardType, ColorName, TcgCard } from "@/lib/tcg/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/cards")({ component: () => null });

const TYPES: CardType[] = ["Leader", "Character", "Event", "Stage", "DON!!"];
const COLORS: ColorName[] = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"];
const MAX_LISTED = 200;

function blankCard(): CardInput {
  return {
    id: "",
    name: "",
    set: "",
    setName: "",
    rarity: "C",
    colors: [],
    type: "Character",
    life: null,
    cost: null,
    power: null,
    counter: null,
    traits: [],
    attr: null,
    text: "",
    textEn: "",
    image: "",
    parallel: false,
    src: "custom",
  };
}

function toInput(card: TcgCard): CardInput {
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    setName: card.setName,
    rarity: card.rarity,
    colors: card.colors,
    type: card.type,
    life: card.life,
    cost: card.cost,
    power: card.power,
    counter: card.counter,
    traits: card.traits,
    attr: card.attr,
    text: card.text,
    textEn: card.textEn ?? "",
    image: card.image,
    parallel: card.parallel,
    src: card.src,
  };
}

export function AdminCardsPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) return <div className="admin-gate">Chargement…</div>;
  if (!user) return <Navigate to="/login" />;
  return <AdminCardsGate />;
}

function AdminCardsGate() {
  const [status, setStatus] = useState<"checking" | "denied" | "ok">("checking");

  useEffect(() => {
    let cancelled = false;
    void getAdminStatus()
      .then((r) => {
        if (!cancelled) setStatus(r.isAdmin ? "ok" : "denied");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="admin-gate">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="admin-gate">
        <ShieldAlert className="size-8" />
        <p>Accès réservé à l'administrateur du jeu.</p>
      </div>
    );
  }
  return <AdminCardsEditor />;
}

function AdminCardsEditor() {
  const catalog = useCatalog();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [addedById, setAddedById] = useState<Map<string, TcgCard>>(new Map());
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CardInput | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refreshOverrides = () =>
    void listCardOverrides().then((rows) => {
      setDeletedIds(new Set(rows.filter((r) => r.action === "delete").map((r) => r.id)));
      setAddedById(new Map(rows.filter((r) => r.action === "upsert").map((r) => [r.id, r.card] as const)));
    });

  useEffect(refreshOverrides, []);

  const cards = useMemo(() => {
    const byId = new Map(catalog.cards.map((c) => [c.id, c] as const));
    for (const [id, card] of addedById) byId.set(id, card);
    for (const id of deletedIds) byId.delete(id);
    return Array.from(byId.values());
  }, [catalog.cards, addedById, deletedIds]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? cards.filter(
          (c) =>
            c.id.toLowerCase().includes(query) ||
            c.name.toLowerCase().includes(query) ||
            c.set.toLowerCase().includes(query),
        )
      : cards;
    return list.slice(0, MAX_LISTED);
  }, [cards, q]);

  const save = async (input: CardInput) => {
    const parsed = cardInputSchema.safeParse(input);
    if (!parsed.success) {
      setStatus(parsed.error.issues[0]?.message ?? "Formulaire invalide.");
      return;
    }
    setStatus(null);
    try {
      await upsertCardOverride({ data: parsed.data });
      setEditing(null);
      setStatus(`« ${parsed.data.name} » enregistrée.`);
      setQ(parsed.data.id);
      refreshOverrides();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Échec de l'enregistrement.");
    }
  };

  const remove = async (card: TcgCard) => {
    if (!window.confirm(`Supprimer « ${card.name} » (${card.id}) du jeu ?`)) return;
    try {
      await deleteCardOverride({ data: card.id });
      setStatus(`« ${card.name} » supprimée.`);
      refreshOverrides();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Échec de la suppression.");
    }
  };

  return (
    <div className="admin-root">
      <header className="admin-head">
        <h1>Administration des cartes</h1>
        <Button variant="don" size="sm" onClick={() => setEditing(blankCard())}>
          <Plus className="size-4" /> Nouvelle carte
        </Button>
      </header>

      <div className="admin-search">
        <Search className="size-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par nom, id ou set…"
          className="admin-search-input"
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label="Effacer">
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {status ? <p className="admin-status">{status}</p> : null}

      <p className="admin-count">
        {cards.length} carte{cards.length > 1 ? "s" : ""} au total
        {filtered.length < cards.length && !q ? ` — ${MAX_LISTED} affichées, affine ta recherche` : ""}
      </p>

      <ul className="admin-list">
        {filtered.map((card) => (
          <li key={card.id} className="admin-row">
            <div className="admin-row-main">
              <span className="admin-row-name">{card.name}</span>
              <span className="admin-row-meta">
                {card.id} · {card.set} · {card.rarity} · {card.type}
              </span>
            </div>
            <div className="admin-row-actions">
              <button type="button" aria-label="Modifier" onClick={() => setEditing(toInput(card))}>
                <Pencil className="size-4" />
              </button>
              <button type="button" aria-label="Supprimer" className="is-danger" onClick={() => void remove(card)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <CardForm
          value={editing}
          isNew={!cards.some((c) => c.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
    </div>
  );
}

function CardForm({
  value,
  isNew,
  onCancel,
  onSave,
}: {
  value: CardInput;
  isNew: boolean;
  onCancel: () => void;
  onSave: (input: CardInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState(value);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CardInput>(key: K, v: CardInput[K]) => setForm((f) => ({ ...f, [key]: v }));

  const num = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onSave(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal>
      <div className="admin-form-card">
        <div className="admin-form-head">
          <h2>{isNew ? "Nouvelle carte" : `Modifier ${value.id}`}</h2>
          <button type="button" onClick={onCancel} aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        <div className="admin-form-body">
          <label className="auth-field">
            <span>Identifiant</span>
            <input
              value={form.id}
              disabled={!isNew}
              onChange={(e) => set("id", e.target.value)}
              placeholder="OP01-999"
              className="auth-input"
            />
          </label>
          <label className="auth-field">
            <span>Nom</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="auth-input" />
          </label>
          <div className="admin-form-grid">
            <label className="auth-field">
              <span>Set</span>
              <input value={form.set} onChange={(e) => set("set", e.target.value)} className="auth-input" />
            </label>
            <label className="auth-field">
              <span>Nom du set</span>
              <input value={form.setName} onChange={(e) => set("setName", e.target.value)} className="auth-input" />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="auth-field">
              <span>Rareté</span>
              <input value={form.rarity} onChange={(e) => set("rarity", e.target.value)} className="auth-input" />
            </label>
            <label className="auth-field">
              <span>Type</span>
              <select value={form.type} onChange={(e) => set("type", e.target.value as CardType)} className="auth-input">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="auth-field">
            <span>Couleurs</span>
            <div className="admin-chip-row">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={cn("admin-chip", form.colors.includes(c) && "is-on")}
                  onClick={() =>
                    set(
                      "colors",
                      form.colors.includes(c) ? form.colors.filter((x) => x !== c) : [...form.colors, c],
                    )
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-form-grid-4">
            <label className="auth-field">
              <span>Vie</span>
              <input
                inputMode="numeric"
                defaultValue={form.life ?? ""}
                onChange={(e) => set("life", num(e.target.value))}
                className="auth-input"
              />
            </label>
            <label className="auth-field">
              <span>Coût</span>
              <input
                inputMode="numeric"
                defaultValue={form.cost ?? ""}
                onChange={(e) => set("cost", num(e.target.value))}
                className="auth-input"
              />
            </label>
            <label className="auth-field">
              <span>Puissance</span>
              <input
                inputMode="numeric"
                defaultValue={form.power ?? ""}
                onChange={(e) => set("power", num(e.target.value))}
                className="auth-input"
              />
            </label>
            <label className="auth-field">
              <span>Contre</span>
              <input
                inputMode="numeric"
                defaultValue={form.counter ?? ""}
                onChange={(e) => set("counter", num(e.target.value))}
                className="auth-input"
              />
            </label>
          </div>

          <label className="auth-field">
            <span>Traits (séparés par des virgules)</span>
            <input
              defaultValue={form.traits.join(", ")}
              onChange={(e) =>
                set(
                  "traits",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className="auth-input"
            />
          </label>

          <label className="auth-field">
            <span>Attribut</span>
            <input
              value={form.attr ?? ""}
              onChange={(e) => set("attr", e.target.value || null)}
              className="auth-input"
            />
          </label>

          <label className="auth-field">
            <span>Texte</span>
            <textarea
              value={form.text}
              onChange={(e) => set("text", e.target.value)}
              rows={3}
              className="auth-input admin-textarea"
            />
          </label>

          <label className="auth-field">
            <span>Image (chemin ou URL)</span>
            <input value={form.image} onChange={(e) => set("image", e.target.value)} className="auth-input" />
          </label>

          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.parallel}
              onChange={(e) => set("parallel", e.target.checked)}
            />
            Carte parallèle / alternative
          </label>
        </div>

        <div className="admin-form-foot">
          <button type="button" className="studio-float-cancel" onClick={onCancel}>
            Annuler
          </button>
          <Button variant="don" disabled={busy || !form.id.trim() || !form.name.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
