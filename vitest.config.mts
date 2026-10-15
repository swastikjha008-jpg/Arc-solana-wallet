import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "test-auth-secret-test-auth-secret-test-auth-secret",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SOLANA_CLUSTER: "devnet",
      SOLANA_RPC_URL: "https://api.devnet.solana.com",
      WALLET_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    },
  },
});
