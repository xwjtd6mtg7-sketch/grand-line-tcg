alter table profiles add column if not exists motto text;
alter table profiles add column if not exists favs text;
alter table profiles add column if not exists wins integer not null default 0;
alter table profiles add column if not exists losses integer not null default 0;
alter table profiles add column if not exists opened integer not null default 0;
alter table profiles add column if not exists owned integer not null default 0;
