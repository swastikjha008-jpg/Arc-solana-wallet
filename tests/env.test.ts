import { describe, expect, it } from "vitest";
import { getEnv } from "@/lib/env";

const base = {
  NODE_ENV: "test", APP_URL: "http://localhost:3000", AUTH_SECRET: "x".repeat(40), DATABASE_URL: "postgresql://u:p@h/db",
  SOLANA_RPC_URL: "https://api.devnet.solana.com", WALLET_ENCRYPTION_KEY: "ab".repeat(32),
} as unknown as NodeJS.ProcessEnv;

describe("environment validation", () => {
  it("accepts a valid config and defaults to devnet with mainnet disabled", () => {
    const e = getEnv(base);
    expect(e.SOLANA_CLUSTER).toBe("devnet");
    expect(e.ALLOW_MAINNET).toBe("false");
  });
  it("fails clearly when required values are missing, naming variables but not values", () => {
    let msg = "";
    try { getEnv({ ...base, AUTH_SECRET: undefined, DATABASE_URL: undefined } as unknown as NodeJS.ProcessEnv); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain("AUTH_SECRET");
    expect(msg).toContain("DATABASE_URL");
  });
  it("rejects .env.example placeholders", () => {
    expect(() => getEnv({ ...base, AUTH_SECRET: "REPLACE_WITH_A_LONG_RANDOM_SECRET_PLACEHOLDER" } as unknown as NodeJS.ProcessEnv)).toThrow(/placeholder/);
    expect(() => getEnv({ ...base, WALLET_ENCRYPTION_KEY: "REPLACE_WITH_A_SECURE_32_BYTE_KEY_IN_HEX" } as unknown as NodeJS.ProcessEnv)).toThrow();
  });
  it("rejects malformed encryption keys and secrets", () => {
    expect(() => getEnv({ ...base, WALLET_ENCRYPTION_KEY: "abc" } as unknown as NodeJS.ProcessEnv)).toThrow(/64 hex/);
    expect(() => getEnv({ ...base, AUTH_SECRET: "short" } as unknown as NodeJS.ProcessEnv)).toThrow();
  });
  it("keeps Mainnet disabled unless deliberately enabled", () => {
    expect(() => getEnv({ ...base, SOLANA_CLUSTER: "mainnet-beta" } as unknown as NodeJS.ProcessEnv)).toThrow(/Mainnet is disabled/);
    expect(getEnv({ ...base, SOLANA_CLUSTER: "mainnet-beta", ALLOW_MAINNET: "true" } as unknown as NodeJS.ProcessEnv).SOLANA_CLUSTER).toBe("mainnet-beta");
  });
  it("requires both Upstash variables or neither", () => {
    expect(() => getEnv({ ...base, UPSTASH_REDIS_REST_URL: "https://x" } as unknown as NodeJS.ProcessEnv)).toThrow();
  });
});
