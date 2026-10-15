import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

const g = globalThis as unknown as { __arcPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!g.__arcPrisma) {
    g.__arcPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) });
  }
  return g.__arcPrisma;
}
