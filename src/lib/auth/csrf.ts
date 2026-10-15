/**
 * CSRF defence for cookie-authenticated state-changing requests:
 *  1. SameSite=Lax cookie (set in session.ts)
 *  2. Origin (or Referer) must match APP_URL's origin
 *  3. Body must be JSON (a cross-site <form> cannot send application/json)
 */
export function isSameOrigin(req: Request, appUrl: string): boolean {
  const expected = new URL(appUrl).origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === expected;
  const referer = req.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === expected; } catch { return false; }
  }
  return false;
}

export function isJsonRequest(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}
