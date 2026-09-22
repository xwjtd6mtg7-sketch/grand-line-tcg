-- Staff roles on player profiles. Default is a regular player.
-- user | moderator | admin | owner
alter table profiles add column if not exists role text not null default 'user';

update profiles p
   set role = 'admin'
  from admins a
 where a.user_id = p.user_id
   and coalesce(p.role, 'user') = 'user';

update profiles p
   set role = 'owner'
  from "user" u
 where u.id = p.user_id
   and (lower(u.name) like 'baggy%' or lower(p.name) like 'baggy%');

create index if not exists profiles_role_idx on profiles (role);
