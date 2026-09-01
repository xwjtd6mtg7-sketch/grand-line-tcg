import { getSql } from "@/lib/db";

/**
 * Single-admin bootstrap (server-only). The `admins` table has a single row
 * (id = 1): the first verified user to call this claims it and becomes the
 * permanent card-catalog admin; every later caller is just checked against it.
 * The `insert ... on conflict do nothing` is one atomic statement, so
 * concurrent first calls still elect exactly one admin.
 */
export async function claimOrCheckAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  await sql`insert into admins (id, user_id) values (1, ${userId}) on conflict (id) do nothing`;
  const rows = await sql<{ user_id: string }>`select user_id from admins where id = 1`;
  return rows[0]?.user_id === userId;
}
