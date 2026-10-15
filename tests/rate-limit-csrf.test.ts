import { describe, expect, it } from "vitest";
import { MemoryLimiter } from "@/lib/rate-limit";
import { isJsonRequest, isSameOrigin } from "@/lib/auth/csrf";
import { hashSessionToken, newSessionToken, safeEqual } from "@/lib/auth/tokens";

describe("rate limiter", () => {
  it("blocks after max hits and recovers after the window", async () => {
    let now = 1_000_000;
    const l = new MemoryLimiter(() => now);
    for (let i = 0; i < 3; i++) expect((await l.limit("k", 3, 60_000)).ok).toBe(true);
    const blocked = await l.limit("k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await l.limit("other", 3, 60_000)).ok).toBe(true); // keys are independent
    now += 60_001;
    expect((await l.limit("k", 3, 60_000)).ok).toBe(true);
  });
});

describe("CSRF / origin checks", () => {
  const app = "https://arc.example.com";
  const req = (headers: Record<string, string>) => new Request(`${app}/api/v1/x`, { method: "POST", headers });
  it("accepts same-origin, rejects cross-origin and missing origin", () => {
    expect(isSameOrigin(req({ origin: app }), app)).toBe(true);
    expect(isSameOrigin(req({ origin: "https://evil.example" }), app)).toBe(false);
    expect(isSameOrigin(req({}), app)).toBe(false);
    expect(isSameOrigin(req({ referer: `${app}/dashboard` }), app)).toBe(true);
    expect(isSameOrigin(req({ referer: "https://evil.example/x" }), app)).toBe(false);
    expect(isSameOrigin(req({ origin: "https://arc.example.com.evil.io" }), app)).toBe(false);
  });
  it("requires JSON bodies", () => {
    expect(isJsonRequest(req({ "content-type": "application/json; charset=utf-8" }))).toBe(true);
    expect(isJsonRequest(req({ "content-type": "application/x-www-form-urlencoded" }))).toBe(false);
  });
});

describe("session tokens", () => {
  it("generates unique high-entropy tokens and stores only an HMAC", () => {
    const a = newSessionToken(), b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    const h = hashSessionToken(a, "secret");
    expect(h).not.toContain(a);
    expect(h).toBe(hashSessionToken(a, "secret"));
    expect(h).not.toBe(hashSessionToken(a, "other-secret"));
    expect(safeEqual(h, h)).toBe(true);
    expect(safeEqual(h, hashSessionToken(b, "secret"))).toBe(false);
  });
});
