/**
 * Standalone Better Auth instance for the plain `/api` backend (email +
 * password only — no OAuth broker here, this isn't running inside the Grok
 * App Builder sandbox). Mounted at `/api/auth/*` by `api/auth/[...all].js`.
 *
 * Requires `DATABASE_URL` + `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` in
 * production (see README). Falls back to the local embedded PGLite (see
 * `db.mjs`) with a process-local secret when `DATABASE_URL` is unset, so
 * `vercel dev` / local testing works with zero configuration.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { randomBytes } from "node:crypto";
import { getPglite } from "./db.mjs";
import { pgliteDialect } from "./pglite-dialect.mjs";

const env = (key) => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const databaseUrl = env("DATABASE_URL");

const globalRef = globalThis;
function devSecret() {
  globalRef.__glAuthSecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__glAuthSecret__;
}

async function database() {
  if (databaseUrl) {
    const { Pool } = await import("pg");
    return new Pool({ connectionString: databaseUrl });
  }
  return { dialect: pgliteDialect(() => getPglite()), type: "postgres" };
}

const baseURL = env("BETTER_AUTH_URL");

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? devSecret(),
  database: await database(),
  trustedOrigins: baseURL ? [baseURL] : undefined,
  emailAndPassword: { enabled: true },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  plugins: [bearer()],
});
