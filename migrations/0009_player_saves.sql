-- Cloud save: one JSON blob per signed-in account (collection, decks, berries, …)
create table if not exists player_saves (
  user_id    text primary key,
  blob       jsonb not null default '{}'::jsonb,
  rev        bigint not null default 0,
  updated_at timestamptz not null default now()
);
