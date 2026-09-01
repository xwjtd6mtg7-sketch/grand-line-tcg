import { toNodeHandler } from "better-auth/node";
import { auth } from "./_lib/auth.mjs";

// Mounts Better Auth's own routes (sign-up/sign-in/session/sign-out).
// Reached via the /api/auth/:path* rewrite in vercel.json — NOT a filesystem
// [...all] catch-all: that bracket-file convention isn't picked up as a
// route on this "Other" framework project, only fixed-name function files are.
// Do not add other providers here — this deploy has no OAuth broker; email +
// password is the only supported method.
export default toNodeHandler(auth);
