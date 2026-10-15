import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing (Argon2id)", () => {
  it("hashes with argon2id, salts uniquely, and verifies", async () => {
    const [h1, h2] = await Promise.all([hashPassword("Correct-Horse-9"), hashPassword("Correct-Horse-9")]);
    expect(h1.startsWith("$argon2id$")).toBe(true);
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("Correct-Horse-9");
    expect(await verifyPassword(h1, "Correct-Horse-9")).toBe(true);
    expect(await verifyPassword(h1, "wrong-password")).toBe(false);
  });
  it("returns false (never throws) for garbage hashes", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});
