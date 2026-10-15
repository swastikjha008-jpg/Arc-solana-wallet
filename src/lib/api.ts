import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { isJsonRequest, isSameOrigin } from "@/lib/auth/csrf";
import { getLimiter } from "@/lib/rate-limit";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown, public headers?: Record<string, string>) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ ok: true, data }, { status });

export function fail(status: number, code: string, message: string, details?: unknown, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, { status, headers });
}

/** Converts bigint (lamports) into strings for JSON. */
export function serialize<T>(v: T): unknown {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function enforceLimit(key: string, cfg: { max: number; windowMs: number }): Promise<void> {
  const r = await getLimiter().limit(key, cfg.max, cfg.windowMs);
  if (!r.ok) throw new ApiError(429, "rate_limited", "Too many requests. Please try again later.", undefined, { "Retry-After": String(r.retryAfterSeconds) });
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new ApiError(400, "invalid_json", "Request body must be valid JSON"); }
  const r = schema.safeParse(body);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join(".") || "_"] ??= i.message;
    throw new ApiError(400, "validation_error", "Please fix the highlighted fields", fields);
  }
  return r.data;
}

/** Wraps a route handler: CSRF checks for mutations, consistent errors, no stack traces or secrets leaked. */
export function route<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>, opts: { mutation?: boolean } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      if (opts.mutation) {
        if (!isSameOrigin(req, getEnv().APP_URL)) throw new ApiError(403, "bad_origin", "Cross-site request rejected");
        if (!isJsonRequest(req)) throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json");
      }
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.details, e.headers);
      console.error("[arc] unhandled error:", e instanceof Error ? e.name : "unknown"); // name only: never log messages that may contain secrets
      return fail(500, "internal_error", "Something went wrong. Please try again.");
    }
  };
}
