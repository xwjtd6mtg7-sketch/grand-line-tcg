import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "../_lib/db.mjs";
import { requireUsers, HttpError } from "../_lib/require-admin.mjs";
import { ROLE_META, normalizeRole } from "../_lib/admin.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function nid(len = 32) {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const buf = randomBytes(len);
  let s = "";
  for (const b of buf) s += chars[b % chars.length];
  return s;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = randomBytes(12);
  let s = "";
  for (const b of buf) s += chars[b % chars.length];
  return s;
}

function digits16() {
  const buf = randomBytes(16);
  let s = "";
  for (const b of buf) s += (b % 10).toString();
  return s;
}

async function listUsers(sql) {
  return sql.query(
    `select u.id, u.name, u.email, u."createdAt" as created_at,
            p.friend_code as code,
            p.avatar_card,
            coalesce(p.role, 'user') as role,
            b.user_id is not null as banned,
            b.reason as ban_reason
       from "user" u
       left join profiles p on p.user_id = u.id
       left join bans b on b.user_id = u.id
      order by
        case coalesce(p.role, 'user')
          when 'owner' then 0
          when 'admin' then 1
          when 'moderator' then 2
          else 3
        end,
        u."createdAt" desc`,
  );
}

async function roleOf(sql, userId) {
  const rows = await sql.query(`select coalesce(role, 'user') as role from profiles where user_id = $1`, [userId]);
  return normalizeRole(rows[0]?.role);
}

export default async function handler(req, res) {
  try {
    const staff = await requireUsers(req);
    const sql = await getSql();
    const meRank = ROLE_META[normalizeRole(staff.role)].rank;

    if (req.method === "GET") {
      json(res, 200, {
        users: await listUsers(sql),
        roles: ROLE_META,
        me: { id: staff.id, role: staff.role, canRoles: staff.canRoles },
      });
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "method" });
      return;
    }

    const body = await readJsonBody(req);
    const action = String(body.action || "");
    const id = String(body.id || "");

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim() || email.split("@")[0] || "Pirate";
      if (!email || !email.includes("@")) throw new HttpError(400, "Email invalide");
      const exists = await sql.query(`select 1 from "user" where email = $1`, [email]);
      if (exists[0]) throw new HttpError(409, "Cet email est déjà utilisé");
      const password = randomPassword();
      const userId = nid();
      const now = new Date();
      const hash = await hashPassword(password);
      await sql.query(
        `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, false, $4, $4)`,
        [userId, name, email, now],
      );
      await sql.query(
        `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         values ($1, $2, 'credential', $3, $4, $5, $5)`,
        [nid(), userId, userId, hash, now],
      );
      let code = digits16();
      for (let i = 0; i < 6; i += 1) {
        try {
          await sql.query(
            `insert into profiles (user_id, friend_code, name, role) values ($1, $2, $3, 'user')`,
            [userId, code, name],
          );
          break;
        } catch {
          code = digits16();
        }
      }
      json(res, 200, { ok: true, password, user: { id: userId, name, email, code, role: "user" } });
      return;
    }

    if (!id) throw new HttpError(400, "Utilisateur manquant");
    const targetRole = await roleOf(sql, id);

    if (targetRole === "owner" && staff.role !== "owner" && action !== "unban") {
      throw new HttpError(403, "Tu ne peux pas modifier le fondateur");
    }
    if (id === staff.id && (action === "ban" || action === "delete")) {
      throw new HttpError(400, "Tu ne peux pas te bannir / te supprimer");
    }

    if (action === "role") {
      if (!staff.canRoles) throw new HttpError(403, "Tu ne peux pas changer les rôles");
      const next = normalizeRole(body.role);
      if (next === "owner" && staff.role !== "owner") {
        throw new HttpError(403, "Seul le fondateur peut nommer un fondateur");
      }
      if (targetRole === "owner" && next !== "owner" && staff.role !== "owner") {
        throw new HttpError(403, "Tu ne peux pas retirer le fondateur");
      }
      if (id === staff.id && staff.role === "owner" && next !== "owner") {
        const owners = await sql.query(`select count(*)::int as n from profiles where role = 'owner'`);
        if ((owners[0]?.n || 0) <= 1) {
          throw new HttpError(400, "Nomme un autre fondateur avant de changer ton rôle");
        }
      }
      const hasProfile = await sql.query(`select 1 from profiles where user_id = $1`, [id]);
      if (!hasProfile[0]) {
        const u = await sql.query(`select name from "user" where id = $1`, [id]);
        let code = digits16();
        await sql.query(
          `insert into profiles (user_id, friend_code, name, role) values ($1, $2, $3, $4)`,
          [id, code, u[0]?.name || "Pirate", next],
        );
      } else {
        await sql.query(`update profiles set role = $1, updated_at = now() where user_id = $2`, [next, id]);
      }
      json(res, 200, { ok: true, role: next, label: ROLE_META[next].label });
      return;
    }

    if (action === "ban") {
      if (targetRole === "owner") throw new HttpError(403, "Impossible de bannir le fondateur");
      await sql.query(
        `insert into bans (user_id, reason, banned_by) values ($1, $2, $3)
         on conflict (user_id) do update set reason = excluded.reason, banned_at = now(), banned_by = excluded.banned_by`,
        [id, String(body.reason || "Bannissement"), staff.id],
      );
      await sql.query(`delete from "session" where "userId" = $1`, [id]);
      json(res, 200, { ok: true });
      return;
    }

    if (action === "unban") {
      await sql.query(`delete from bans where user_id = $1`, [id]);
      json(res, 200, { ok: true });
      return;
    }

    if (action === "email") {
      if (meRank < ROLE_META.admin.rank) throw new HttpError(403, "Réservé aux administrateurs");
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) throw new HttpError(400, "Email invalide");
      const clash = await sql.query(`select 1 from "user" where email = $1 and id <> $2`, [email, id]);
      if (clash[0]) throw new HttpError(409, "Cet email est déjà utilisé");
      await sql.query(`update "user" set email = $1, "updatedAt" = now() where id = $2`, [email, id]);
      json(res, 200, { ok: true, email });
      return;
    }

    if (action === "name") {
      if (meRank < ROLE_META.admin.rank) throw new HttpError(403, "Réservé aux administrateurs");
      const name = String(body.name || "").trim();
      if (!name) throw new HttpError(400, "Pseudo requis");
      await sql.query(`update "user" set name = $1, "updatedAt" = now() where id = $2`, [name, id]);
      await sql.query(`update profiles set name = $1, updated_at = now() where user_id = $2`, [name, id]);
      json(res, 200, { ok: true, name });
      return;
    }

    if (action === "password") {
      if (meRank < ROLE_META.admin.rank) throw new HttpError(403, "Réservé aux administrateurs");
      const password = randomPassword();
      const hash = await hashPassword(password);
      await sql.query(
        `update "account" set password = $1, "updatedAt" = now()
          where "userId" = $2 and "providerId" = 'credential'`,
        [hash, id],
      );
      await sql.query(`delete from "session" where "userId" = $1`, [id]);
      json(res, 200, { ok: true, password });
      return;
    }

    if (action === "delete") {
      if (meRank < ROLE_META.admin.rank) throw new HttpError(403, "Réservé aux administrateurs");
      if (targetRole === "owner") throw new HttpError(403, "Impossible de supprimer le fondateur");
      await sql.query(`delete from friendships where user_id = $1 or friend_id = $1`, [id]);
      await sql.query(`delete from friend_requests where from_id = $1 or to_id = $1`, [id]);
      await sql.query(`delete from bans where user_id = $1`, [id]);
      await sql.query(`delete from profiles where user_id = $1`, [id]);
      await sql.query(`delete from "session" where "userId" = $1`, [id]);
      await sql.query(`delete from "account" where "userId" = $1`, [id]);
      await sql.query(`delete from "user" where id = $1`, [id]);
      json(res, 200, { ok: true });
      return;
    }

    throw new HttpError(400, "Action inconnue");
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    json(res, status, { error: "admin_users", message: err?.message || "Erreur" });
  }
}
