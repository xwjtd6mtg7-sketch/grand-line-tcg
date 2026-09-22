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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPglite } from "./db.mjs";
import { pgliteDialect } from "./pglite-dialect.mjs";

const env = (key) => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const databaseUrl = env("DATABASE_URL");
const PUBLIC_HOST = "grand-line-tcg.grok.me";

function devSecret() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".grok");
  const file = join(dir, "auth-secret");
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch {}
  const next = randomBytes(32).toString("hex");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, next);
  } catch {
    // Vercel / read-only FS — keep the in-memory value for this isolate.
  }
  return env("GROK_AUTH_CLIENT_SECRET") || next;
}

async function database() {
  if (databaseUrl) {
    const { Pool } = await import("pg");
    return new Pool({ connectionString: databaseUrl });
  }
  return { dialect: pgliteDialect(() => getPglite()), type: "postgres" };
}

function resolveBaseURL() {
  const fromEnv = env("BETTER_AUTH_URL");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = env("VERCEL_URL");
  if (vercel) {
    if (env("VERCEL_ENV") === "production") return `https://${PUBLIC_HOST}`;
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://127.0.0.1:8080";
}

const baseURL = resolveBaseURL();
const isHttps = baseURL.startsWith("https://") || Boolean(env("VERCEL_URL"));

function hostOf(raw) {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function originOf(raw) {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return "";
  }
}

function isTrustedHost(host) {
  if (!host) return false;
  const h = host.replace(/:\d+$/, "").toLowerCase();
  return (
    h === "127.0.0.1" ||
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === PUBLIC_HOST ||
    h.endsWith(".grok.me") ||
    h.endsWith(".grok-sandbox.com") ||
    h.endsWith(".vercel.app")
  );
}

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? devSecret(),
  database: await database(),
  trustedOrigins: (request) => {
    const out = new Set([
      baseURL,
      "http://127.0.0.1:8080",
      "http://localhost:8080",
      "http://0.0.0.0:8080",
      `https://${PUBLIC_HOST}`,
    ]);
    if (request?.headers) {
      const get = (k) => request.headers.get(k);
      for (const raw of [get("origin"), get("x-forwarded-host"), get("host")]) {
        if (!raw) continue;
        const host = hostOf(raw);
        if (isTrustedHost(host)) {
          const origin = originOf(raw);
          if (origin) out.add(origin);
        }
      }
    }
    return [...out];
  },
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8 },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  advanced: {
    useSecureCookies: isHttps,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isHttps,
      path: "/",
    },
  },
  plugins: [bearer()],
});
