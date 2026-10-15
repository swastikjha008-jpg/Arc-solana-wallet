import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI reads DATABASE_URL from the environment (or a local .env file loaded by your shell).
// A harmless placeholder keeps `prisma generate` / `prisma validate` working without credentials.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/arc",
  },
});
