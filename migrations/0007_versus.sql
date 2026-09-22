create table if not exists versus_rooms (
  id text primary key,
  password text,
  mode text not null default 'password',
  status text not null default 'wait',
  host_id text not null,
  guest_id text,
  host_name text,
  guest_name text,
  host_deck jsonb,
  guest_deck jsonb,
  state jsonb,
  winner_id text,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists versus_rooms_password_idx
  on versus_rooms (password)
  where status = 'wait' and password is not null;

create index if not exists versus_rooms_host_idx on versus_rooms (host_id);
create index if not exists versus_rooms_status_idx on versus_rooms (status, updated_at);
