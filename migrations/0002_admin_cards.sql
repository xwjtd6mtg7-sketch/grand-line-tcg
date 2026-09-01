-- Card catalog overrides: an admin can add, edit or remove game cards on top of
-- the static /data/catalog.json without redeploying. The client merges these
-- rows over the base catalog (see src/lib/tcg/catalog.ts applyOverrides()).
--   action = 'upsert' -> `card` is the full card JSON, added or replacing the id.
--   action = 'delete' -> `card` is null; the id is hidden from the catalog.
create table if not exists card_overrides (
  id text primary key,
  action text not null check (action in ('upsert', 'delete')),
  card jsonb,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

-- Single-admin bootstrap (row id is always 1): the first verified account to
-- reach an admin-only server function claims this slot and becomes the
-- permanent card-catalog admin. See src/lib/admin/admin.server.ts.
create table if not exists admins (
  id integer primary key,
  user_id text not null,
  created_at timestamptz not null default now()
);
