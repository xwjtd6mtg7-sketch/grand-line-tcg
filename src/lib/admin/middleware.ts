import { createMiddleware } from "@tanstack/react-start";

/** Thrown when a signed-in caller is not the card-catalog admin. Carries `status: 403`. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * Server function middleware requiring the caller to be the app's single
 * card-catalog admin. Mirrors `authMiddleware` (bearer forwarding for the live
 * preview + same-site check), then claims-or-checks the admin slot — see
 * `admin.server.ts`. Use on every server function that adds/edits/removes cards.
 */
export const adminMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { requireUserId } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    const { claimOrCheckAdmin } = await import("./admin.server");
    if (!(await claimOrCheckAdmin(userId))) throw new ForbiddenError();
    return next({ context: { userId } });
  });
