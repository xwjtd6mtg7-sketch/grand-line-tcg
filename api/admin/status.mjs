import { getSessionUser } from "../_lib/require-admin.mjs";
import { claimOrCheckAdmin } from "../_lib/admin.mjs";

/** Whether the signed-in caller is the card-catalog admin (claims the slot if empty). */
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
      res.end(JSON.stringify({ signedIn: false, isAdmin: false }));
      return;
    }
    const isAdmin = await claimOrCheckAdmin(user.id);
    res.statusCode = 200;
    res.end(JSON.stringify({ signedIn: true, isAdmin, name: user.name, email: user.email }));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "internal_error", message: err?.message }));
  }
}
