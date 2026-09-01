import { toNodeHandler } from "better-auth/node";
import { auth } from "../_lib/auth.mjs";

// Mounts Better Auth's own routes (sign-up/sign-in/session/sign-out) at
// /api/auth/*. Do not add other providers here — this deploy has no OAuth
// broker; email + password is the only supported method.
export default toNodeHandler(auth);
