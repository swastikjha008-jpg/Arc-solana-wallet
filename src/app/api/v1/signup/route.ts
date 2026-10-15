import { LIMITS } from "@/lib/rate-limit";
import { clientIp, enforceLimit, ok, parseJson, route } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { signUp } from "@/server/services/auth";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await enforceLimit(`signup:${clientIp(req)}`, LIMITS.signup);
  const body = await parseJson(req, signupSchema);
  const user = await signUp({ username: body.username, email: body.email, password: body.password });
  await createSession(user.id);
  return ok({ user: { id: user.id, username: user.username, email: user.email } }, 201);
}, { mutation: true });
