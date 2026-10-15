import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2; the const enum can't be imported under isolatedModules).
// OWASP-recommended minimum profile: 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** Burn equivalent CPU time when the account doesn't exist, so login timing doesn't reveal valid users. */
export async function verifyDummy(password: string): Promise<void> {
  dummy ??= hashPassword("arc-dummy-password-for-timing");
  await verifyPassword(await dummy, password);
}
