import { auth } from "./auth.mjs";
import { claimOrCheckAdmin } from "./admin.mjs";

/** Thrown by `requireAdmin`; callers should reply with `.status` + `.message`. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toWebHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }
  return headers;
}

/** Resolve the signed-in user from a Node request, or null. */
export async function getSessionUser(req) {
  const session = await auth.api.getSession({ headers: toWebHeaders(req.headers) });
  return session?.user ?? null;
}

/** Require an admin session; throws `HttpError` (401/403) otherwise. */
export async function requireAdmin(req) {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Unauthorized");
  if (!(await claimOrCheckAdmin(user.id))) throw new HttpError(403, "Forbidden");
  return user;
}
