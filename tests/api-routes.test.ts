import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ store: new Map<string, string>(), set: vi.fn(), deleted: [] as string[] }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.store.has(n) ? { name: n, value: jar.store.get(n) } : undefined),
    set: (n: string, v: string, o: unknown) => { jar.set(n, v, o); jar.store.set(n, v); },
    delete: (n: string) => { jar.deleted.push(n); jar.store.delete(n); },
  }),
}));

const repo = vi.hoisted(() => ({ sessions: [] as any[], users: [] as any[], wallets: [] as any[] }));
vi.mock("@/server/repositories/sessions", () => ({
  sessionsRepo: {
    create: vi.fn(async (d: any) => { repo.sessions.push(d); return d; }),
    findValid: vi.fn(async (h: string) => { const s = repo.sessions.find((x) => x.tokenHash === h && x.expiresAt > new Date()); return s ? { ...s, user: repo.users.find((u) => u.id === s.userId) } : null; }),
    deleteByHash: vi.fn(async (h: string) => { repo.sessions = repo.sessions.filter((s) => s.tokenHash !== h); }),
  },
}));
vi.mock("@/server/repositories/users", () => ({
  usersRepo: {
    findTaken: vi.fn(async () => null),
    create: vi.fn(async (d: any) => { const u = { id: "u1", createdAt: new Date(), ...d }; repo.users.push(u); return u; }),
    findByIdentifier: vi.fn(async (i: string) => repo.users.find((u) => u.email === i || u.username === i) ?? null),
  },
}));
vi.mock("@/server/repositories/wallets", () => ({
  walletsRepo: {
    listForOwner: vi.fn(async (o: string) => repo.wallets.filter((w) => w.ownerUserId === o)),
    findPublicForOwner: vi.fn(async () => null),
    countForOwner: vi.fn(async () => 0),
    create: vi.fn(async (d: any) => ({ id: "w1", ...d })),
  },
}));
vi.mock("@/server/repositories/transactions", () => ({ transactionsRepo: {} }));

import { setLimiterForTests, MemoryLimiter } from "@/lib/rate-limit";
import { GET as meGET } from "@/app/api/v1/me/route";
import { GET as walletsGET, POST as walletsPOST } from "@/app/api/v1/wallets/route";
import { POST as signupPOST } from "@/app/api/v1/signup/route";
import { POST as signinPOST } from "@/app/api/v1/signin/route";
import { POST as signoutPOST } from "@/app/api/v1/signout/route";
import { GET as txGET, POST as txPOST } from "@/app/api/v1/transactions/route";
import { GET as healthGET } from "@/app/api/health/route";

const ORIGIN = "http://localhost:3000";
const post = (path: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  new Request(`${ORIGIN}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const get = (path: string) => new Request(`${ORIGIN}${path}`);
const json = async (r: Response) => r.json() as Promise<any>;
const SIGNUP = { username: "alice", email: "alice@example.com", password: "Str0ngPassword", confirmPassword: "Str0ngPassword" };

beforeEach(() => { jar.store.clear(); jar.deleted.length = 0; jar.set.mockClear(); repo.sessions = []; repo.users = []; repo.wallets = []; setLimiterForTests(new MemoryLimiter()); });

describe("unauthorized API access", () => {
  it.each([["/api/v1/me", meGET], ["/api/v1/wallets", walletsGET], ["/api/v1/transactions", txGET]] as const)("GET %s -> 401 without a session", async (path, handler) => {
    const r = await (handler as any)(get(path), {});
    expect(r.status).toBe(401);
    const b = await json(r);
    expect(b).toEqual({ ok: false, error: { code: "unauthorized", message: "Authentication required" } });
  });
  it("POST routes reject unauthenticated callers", async () => {
    expect((await walletsPOST(post("/api/v1/wallets", {}), {})).status).toBe(401);
    expect((await txPOST(post("/api/v1/transactions", { sourceWalletId: "w", destinationAddress: "11111111111111111111111111111111", amountSol: "1", idempotencyKey: "k".repeat(20), confirmed: true }), {})).status).toBe(401);
  });
  it("rejects a forged / unknown session cookie", async () => {
    jar.store.set("arc_session", "forged-token");
    expect((await meGET(get("/api/v1/me"), {})).status).toBe(401);
  });
});

describe("CSRF protections on mutations", () => {
  it("rejects cross-site origin, missing origin, and non-JSON bodies", async () => {
    expect((await signupPOST(post("/api/v1/signup", SIGNUP, { origin: "https://evil.example" }), {})).status).toBe(403);
    expect((await signupPOST(post("/api/v1/signup", SIGNUP, {}), {})).status).toBe(403);
    const form = new Request(`${ORIGIN}/api/v1/signup`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/x-www-form-urlencoded" }, body: "a=b" });
    expect((await signupPOST(form, {})).status).toBe(415);
    expect(repo.users).toHaveLength(0);
  });
});

describe("signup, session cookie, login, logout", () => {
  it("signup validates server-side and returns field errors", async () => {
    const r = await signupPOST(post("/api/v1/signup", { ...SIGNUP, password: "x", confirmPassword: "y" }), {});
    expect(r.status).toBe(400);
    const b = await json(r);
    expect(b.error.code).toBe("validation_error");
    expect(Object.keys(b.error.details)).toContain("password");
  });
  it("rejects malformed JSON", async () => {
    const r = await signupPOST(new Request(`${ORIGIN}/api/v1/signup`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{not json" }), {});
    expect(r.status).toBe(400);
    expect((await json(r)).error.code).toBe("invalid_json");
  });
  it("signup sets an HttpOnly SameSite session cookie, stores only a token hash, and never returns the password hash", async () => {
    const r = await signupPOST(post("/api/v1/signup", SIGNUP), {});
    expect(r.status).toBe(201);
    const text = JSON.stringify(await json(r));
    expect(text).not.toMatch(/passwordHash|argon2/);
    const [name, token, opts] = jar.set.mock.calls[0]!;
    expect(name).toBe("arc_session");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(repo.sessions[0].tokenHash).not.toBe(token);
    expect(repo.sessions[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("a session cookie grants access to /me; logout invalidates it server-side", async () => {
    await signupPOST(post("/api/v1/signup", SIGNUP), {});
    const me = await meGET(get("/api/v1/me"), {});
    expect(me.status).toBe(200);
    expect((await json(me)).data.user.username).toBe("alice");
    const out = await signoutPOST(post("/api/v1/signout", {}), {});
    expect(out.status).toBe(200);
    expect(repo.sessions).toHaveLength(0);
    expect(jar.deleted).toContain("arc_session");
    expect((await meGET(get("/api/v1/me"), {})).status).toBe(401);
  });
  it("expired sessions are rejected", async () => {
    await signupPOST(post("/api/v1/signup", SIGNUP), {});
    repo.sessions[0].expiresAt = new Date(Date.now() - 1000);
    expect((await meGET(get("/api/v1/me"), {})).status).toBe(401);
  });
  it("signin: valid credentials succeed; wrong password and unknown user return the same generic 401", async () => {
    await signupPOST(post("/api/v1/signup", SIGNUP), {});
    jar.store.clear();
    expect((await signinPOST(post("/api/v1/signin", { identifier: "alice", password: "Str0ngPassword" }), {})).status).toBe(200);
    const bad = await signinPOST(post("/api/v1/signin", { identifier: "alice", password: "wrong-password" }), {});
    const ghost = await signinPOST(post("/api/v1/signin", { identifier: "ghost", password: "wrong-password" }), {});
    expect(bad.status).toBe(401); expect(ghost.status).toBe(401);
    expect(await json(bad)).toEqual(await json(ghost));
  });
  it("signin is throttled after repeated failures", async () => {
    await signupPOST(post("/api/v1/signup", SIGNUP), {});
    let last = 0, retry: string | null = null;
    for (let i = 0; i < 12; i++) { const r = await signinPOST(post("/api/v1/signin", { identifier: "alice", password: "wrong-password" }), {}); last = r.status; retry = r.headers.get("retry-after"); if (last === 429) break; }
    expect(last).toBe(429);
    expect(Number(retry)).toBeGreaterThan(0);
  });
});

describe("health endpoint", () => {
  it("is public and exposes no configuration", async () => {
    const r = healthGET();
    const text = JSON.stringify(await r.json());
    expect(r.status).toBe(200);
    expect(text).not.toMatch(/DATABASE|SECRET|RPC|KEY|postgres/i);
  });
});
