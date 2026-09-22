import { getSessionUser } from "../_lib/require-admin.mjs";
import { resolveRole } from "../_lib/admin.mjs";

/** Session + staff capabilities (claims founder / first admin if the slot is empty). */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.statusCode = 200;
      res.end(JSON.stringify({ signedIn: false, isAdmin: false, role: "user" }));
      return;
    }
    const ctx = await resolveRole(user);
    const isAdmin = ctx.canUsers || ctx.canCards;
    res.statusCode = 200;
    res.end(JSON.stringify({
      signedIn: true,
      isAdmin,
      role: ctx.role,
      canCards: ctx.canCards,
      canUsers: ctx.canUsers,
      canRoles: ctx.canRoles,
      name: user.name,
      email: user.email,
      image: user.image || null,
      id: user.id,
    }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "internal_error", message: err?.message }));
  }
}
