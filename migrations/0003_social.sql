-- Social: friend codes + friendships (one row per direction).
create table if not exists profiles (
  user_id text primary key,
  friend_code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists friendships (
  user_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create index if not exists friendships_friend_id_idx on friendships (friend_id);
