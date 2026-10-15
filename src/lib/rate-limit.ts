import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/env";

export interface LimitResult { ok: boolean; retryAfterSeconds: number }
export interface LimiterAdapter { limit(key: string, max: number, windowMs: number): Promise<LimitResult> }

/** Single-instance fallback. Use Upstash (see README) for multi-instance deployments. */
export class MemoryLimiter implements LimiterAdapter {
  private hits = new Map<string, number[]>();
  constructor(private now: () => number = Date.now) {}
  async limit(key: string, max: number, windowMs: number): Promise<LimitResult> {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(((recent[0] as number) + windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some((x) => t - x < windowMs)) this.hits.delete(k);
    return { ok: true, retryAfterSeconds: 0 };
  }
}

class UpstashLimiter implements LimiterAdapter {
  private cache = new Map<string, Ratelimit>();
  constructor(private redis: Redis) {}
  async limit(key: string, max: number, windowMs: number): Promise<LimitResult> {
    const id = `${max}:${windowMs}`;
    let rl = this.cache.get(id);
    if (!rl) {
      rl = new Ratelimit({ redis: this.redis, limiter: Ratelimit.slidingWindow(max, `${Math.ceil(windowMs / 1000)} s`), prefix: "arc:rl" });
      this.cache.set(id, rl);
    }
    const r = await rl.limit(key);
    return { ok: r.success, retryAfterSeconds: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
  }
}

let adapter: LimiterAdapter | null = null;
export function getLimiter(): LimiterAdapter {
  if (adapter) return adapter;
  const env = getEnv();
  adapter = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashLimiter(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))
    : new MemoryLimiter();
  return adapter;
}
export function setLimiterForTests(a: LimiterAdapter | null): void { adapter = a; }

export const LIMITS = {
  signup: { max: 5, windowMs: 60 * 60 * 1000 },
  signin: { max: 10, windowMs: 15 * 60 * 1000 },
  signinPerAccount: { max: 8, windowMs: 15 * 60 * 1000 },
  transaction: { max: 10, windowMs: 60 * 1000 },
  walletCreate: { max: 10, windowMs: 60 * 60 * 1000 },
} as const;
