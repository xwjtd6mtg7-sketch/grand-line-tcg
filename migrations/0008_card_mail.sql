-- Share / trade of cards between friends.
create table if not exists card_transfers (
  id text primary key,
  kind text not null,
  from_id text not null,
  to_id text not null,
  offer_card text not null,
  reply_card text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists card_transfers_to_idx on card_transfers (to_id, status);
create index if not exists card_transfers_from_idx on card_transfers (from_id, status);

create table if not exists card_mail (
  id text primary key,
  user_id text not null,
  from_id text not null,
  card_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists card_mail_user_idx on card_mail (user_id);
