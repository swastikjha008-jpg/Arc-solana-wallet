import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { sessionsRepo } from "@/server/repositories/sessions";
import { ApiError } from "@/lib/api";
import { SESSION_COOKIE, SESSION_TTL_MS, hashSessionToken, newSessionToken } from "./tokens";

export interface SessionUser { id: string; username: string; email: string }

export async function createSession(userId: string): Promise<void> {
  const env = getEnv();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await sessionsRepo.create({ tokenHash: hashSessionToken(token, env.AUTH_SECRET), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await sessionsRepo.findValid(hashSessionToken(token, getEnv().AUTH_SECRET));
  return s?.user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "unauthorized", "Authentication required");
  return u;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sessionsRepo.deleteByHash(hashSessionToken(token, getEnv().AUTH_SECRET));
  jar.delete(SESSION_COOKIE);
}
