import { LIMITS } from "@/lib/rate-limit";
import { clientIp, enforceLimit, ok, parseJson, route } from "@/lib/api";
import { signinSchema } from "@/lib/validation";
import { authenticate } from "@/server/services/auth";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await enforceLimit(`signin:ip:${clientIp(req)}`, LIMITS.signin);
  const body = await parseJson(req, signinSchema);
  await enforceLimit(`signin:acct:${body.identifier.toLowerCase()}`, LIMITS.signinPerAccount);
  const user = await authenticate(body.identifier, body.password);
  await createSession(user.id);
  return ok({ user });
}, { mutation: true });
