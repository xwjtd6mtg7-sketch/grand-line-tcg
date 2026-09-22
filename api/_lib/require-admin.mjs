import { auth } from "./auth.mjs";
import { resolveRole } from "./admin.mjs";

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

async function staffFrom(req) {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "Unauthorized");
  const ctx = await resolveRole(user);
  return { ...user, ...ctx };
}

/** Any staff role (moderator / admin / founder). */
export async function requireStaff(req) {
  const staff = await staffFrom(req);
  if (!staff.canUsers && !staff.canCards) throw new HttpError(403, "Forbidden");
  return staff;
}

/** Users tab: moderator and above. */
export async function requireUsers(req) {
  const staff = await staffFrom(req);
  if (!staff.canUsers) throw new HttpError(403, "Forbidden");
  return staff;
}

/** Card catalog: admin and founder. */
export async function requireAdmin(req) {
  const staff = await staffFrom(req);
  if (!staff.canCards) throw new HttpError(403, "Forbidden");
  return staff;
}
