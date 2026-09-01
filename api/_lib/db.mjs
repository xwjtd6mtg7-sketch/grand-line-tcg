/**
 * Server-side SQL client for the standalone `/api` backend (auth + card admin).
 *
 * Dual-mode, same idea as before: real Postgres (`pg`) when `DATABASE_URL` is
 * set (production on Vercel), otherwise an embedded in-memory PGLite so the
 * functions still work with `vercel dev` / local testing without a database.
 * PGLite state resets whenever the process restarts — expected for local use.
 *
 * Schema lives in migrations/*.sql (single source of truth): applied to Neon
 * at deploy time by `scripts/migrate.mjs` (see package.json "build"), and to
 * the local PGLite fallback lazily on first query.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";

const rawDatabaseUrl = process.env.DATABASE_URL;
const databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/** Active backend: "neon" (any real Postgres) when `DATABASE_URL` is set, else "pglite". */
export const dbSource = databaseUrl ? "neon" : "pglite";

// Result-type parity between pg and PGLite (see the original db.ts note this was ported from).
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v) => v;

const g = globalThis;

/** Wrap a `(text, params) => rows` runner as a tagged-template + `.query()` client. */
function toSql(run) {
  const sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run(text, values);
  };
  sql.query = (text, params = []) => run(text, params);
  return sql;
}

async function createNeonSql() {
  g.__glPgPool__ ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    return new Pool({ connectionString: databaseUrl });
  })().catch((err) => {
    g.__glPgPool__ = undefined;
    throw err;
  });
  const pool = await g.__glPgPool__;
  return toSql(async (text, params) => {
    const res = await pool.query(text, params);
    return res.rows;
  });
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

async function listMigrationFiles() {
  try {
    return await readdir(migrationsDir);
  } catch {
    return [];
  }
}

/**
 * The shared PGLite instance (local-only), with migrations/*.sql applied.
 * Lets Better Auth persist to the SAME embedded DB as app data (via the Kysely
 * dialect), so callers other than `getSql()` — e.g. the auth instance — still
 * get a fully migrated database.
 */
export async function getPglite() {
  if (databaseUrl) throw new Error("getPglite() called while DATABASE_URL is set");
  g.__glPglite__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: { [OID_INT8]: Number, [OID_DATE]: identity, [OID_INTERVAL]: identity },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    g.__glPglite__ = undefined;
    throw err;
  });
  const pg = await g.__glPglite__;

  g.__glPgliteMigrate__ ??= (async () => {
    const entries = await listMigrationFiles();
    const doneRows = await pg.query("select name from _migrations");
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(entries, done)) {
      const text = await readFile(join(migrationsDir, path), "utf8");
      await pg.transaction(async (tx) => {
        await tx.exec(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  })().catch((err) => {
    g.__glPgliteMigrate__ = undefined;
    throw err;
  });
  await g.__glPgliteMigrate__;

  return pg;
}

async function createPgliteSql() {
  const pg = await getPglite();
  return toSql(async (text, params) => {
    const result = await pg.query(text, params);
    return result.rows;
  });
}

let sqlPromise = null;

/** Get the shared, server-only SQL client (memoized). */
export function getSql() {
  sqlPromise ??= (dbSource === "neon" ? createNeonSql() : createPgliteSql()).catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}
