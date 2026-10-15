import "server-only";
import { z } from "zod";

const hexKey = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 32 bytes encoded as 64 hex characters (generate: openssl rand -hex 32)");

const placeholder = (v: string) => v.startsWith("REPLACE_WITH");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "must be at least 32 characters (generate: openssl rand -base64 48)"),
    DATABASE_URL: z.string().min(1),
    SOLANA_CLUSTER: z.enum(["devnet", "testnet", "mainnet-beta"]).default("devnet"),
    SOLANA_RPC_URL: z.url(),
    WALLET_ENCRYPTION_KEY: hexKey,
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    // Mainnet stays disabled unless this is deliberately set to "true".
    ALLOW_MAINNET: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((env, ctx) => {
    for (const key of ["AUTH_SECRET", "DATABASE_URL", "SOLANA_RPC_URL", "WALLET_ENCRYPTION_KEY"] as const) {
      if (placeholder(env[key])) {
        ctx.addIssue({ code: "custom", path: [key], message: "still set to the .env.example placeholder" });
      }
    }
    if (env.SOLANA_CLUSTER === "mainnet-beta" && env.ALLOW_MAINNET !== "true") {
      ctx.addIssue({ code: "custom", path: ["SOLANA_CLUSTER"], message: "Mainnet is disabled. This starter is Devnet-only." });
    }
    if (!!env.UPSTASH_REDIS_REST_URL !== !!env.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_URL"], message: "set both Upstash variables or neither" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validates and returns server environment. Throws a readable error naming variables (never values). */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example and README.md.`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

export function resetEnvCacheForTests(): void {
  cached = null;
}
