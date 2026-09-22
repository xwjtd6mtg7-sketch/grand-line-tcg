alter table profiles add column if not exists avatar_card text;
alter table profiles add column if not exists avatar_x double precision;
alter table profiles add column if not exists avatar_y double precision;
alter table profiles add column if not exists avatar_s double precision;

create table if not exists friend_requests (
  from_id text not null,
  to_id text not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

create index if not exists friend_requests_to_idx on friend_requests (to_id);

create table if not exists bans (
  user_id text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by text
);
