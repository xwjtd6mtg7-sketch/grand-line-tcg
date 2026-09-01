import { getSql } from "./db.mjs";

/**
 * Single-admin bootstrap: the first verified user to call this claims the one
 * admin slot (row id = 1) and becomes the permanent card-catalog admin; every
 * later caller is just checked against it. The `on conflict` insert is one
 * atomic statement, so concurrent first calls still elect exactly one admin.
 */
export async function claimOrCheckAdmin(userId) {
  const sql = await getSql();
  await sql`insert into admins (id, user_id) values (1, ${userId}) on conflict (id) do nothing`;
  const rows = await sql`select user_id from admins where id = 1`;
  return rows[0]?.user_id === userId;
}
