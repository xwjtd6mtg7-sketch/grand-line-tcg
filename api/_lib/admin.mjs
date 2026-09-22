import { randomBytes } from "node:crypto";
import { getSql } from "./db.mjs";

export const ROLE_META = {
  user: { id: "user", label: "Joueur", rank: 0 },
  moderator: { id: "moderator", label: "Modérateur", rank: 1 },
  admin: { id: "admin", label: "Administrateur", rank: 2 },
  owner: { id: "owner", label: "Fondateur", rank: 3 },
};

export function normalizeRole(value) {
  const v = String(value || "user").trim().toLowerCase();
  return ROLE_META[v] ? v : "user";
}

function ownerEmails() {
  return String(process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerAccount({ email, name } = {}) {
  const mail = String(email || "").trim().toLowerCase();
  if (mail && ownerEmails().includes(mail)) return true;
  return /^baggy\b/i.test(String(name || "").trim());
}

function digits16() {
  const buf = randomBytes(16);
  let s = "";
  for (const b of buf) s += (b % 10).toString();
  return s;
}

async function ensureProfile(sql, userId, name) {
  const id = String(userId);
  const rows = await sql`select role, name from profiles where user_id = ${id} limit 1`;
  if (rows[0]) return { role: normalizeRole(rows[0].role), name: rows[0].name };
  const label = String(name || "Pirate").trim() || "Pirate";
  for (let i = 0; i < 8; i += 1) {
    const code = digits16();
    try {
      await sql`insert into profiles (user_id, friend_code, name, role) values (${id}, ${code}, ${label}, 'user')`;
      return { role: "user", name: label };
    } catch {
      /* friend_code clash */
    }
  }
  return { role: "user", name: label };
}

async function setProfileRole(sql, userId, role) {
  await sql`update profiles set role = ${role}, updated_at = now() where user_id = ${userId}`;
}

function capsFor(role) {
  const r = normalizeRole(role);
  const rank = ROLE_META[r].rank;
  return {
    role: r,
    canUsers: rank >= ROLE_META.moderator.rank,
    canCards: rank >= ROLE_META.admin.rank,
    canRoles: rank >= ROLE_META.admin.rank,
  };
}

/**
 * Resolve staff capabilities. Bootstraps the founder (Baggy) and, on an empty
 * staff roster, the first signed-in account as admin.
 */
export async function resolveRole(user) {
  const userId = typeof user === "string" ? user : user?.id;
  if (!userId) return { role: "user", canUsers: false, canCards: false, canRoles: false };
  const sql = await getSql();
  const id = String(userId);

  const rows = await sql`select name, email from "user" where id = ${id} limit 1`;
  const profile = rows[0] || (typeof user === "object" && user) || {};
  await ensureProfile(sql, id, profile.name);

  if (isOwnerAccount(profile)) {
    await setProfileRole(sql, id, "owner");
    await sql`
      insert into admins (id, user_id) values (1, ${id})
      on conflict (id) do update set user_id = excluded.user_id
    `;
    return capsFor("owner");
  }

  const current = await sql`select role from profiles where user_id = ${id} limit 1`;
  let role = normalizeRole(current[0]?.role);

  if (role === "user") {
    const staff = await sql`select 1 from profiles where role in ('admin', 'owner') limit 1`;
    if (!staff[0]) {
      await setProfileRole(sql, id, "admin");
      await sql`insert into admins (id, user_id) values (1, ${id}) on conflict (id) do nothing`;
      role = "admin";
    }
  }

  return capsFor(role);
}

export async function claimOrCheckAdmin(user) {
  const ctx = await resolveRole(user);
  return ctx.canUsers || ctx.canCards;
}
