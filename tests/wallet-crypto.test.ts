import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createEnvKeyWrapper, decryptSecret, encryptSecret } from "@/lib/crypto/wallet-crypto";

const KEY = "11".repeat(32);
const wrapper = createEnvKeyWrapper(KEY);

describe("wallet envelope encryption", () => {
  const secret = randomBytes(64);

  it("round-trips and never stores plaintext", () => {
    const enc = encryptSecret(secret, wrapper, "addr1");
    expect(enc.ciphertext).not.toContain(secret.toString("base64"));
    expect(Buffer.from(enc.ciphertext, "base64").equals(secret)).toBe(false);
    expect(enc.metadata).toMatchObject({ version: 1, algorithm: "AES-256-GCM", keyId: "env-dev-v1" });
    expect(decryptSecret(enc, wrapper, "addr1").equals(secret)).toBe(true);
  });
  it("uses fresh IVs and DEKs every time", () => {
    const a = encryptSecret(secret, wrapper, "a"), b = encryptSecret(secret, wrapper, "a");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.metadata.iv).not.toBe(b.metadata.iv);
    expect(a.metadata.wrappedDek).not.toBe(b.metadata.wrappedDek);
  });
  it("fails with the wrong master key", () => {
    const enc = encryptSecret(secret, wrapper, "a");
    expect(() => decryptSecret(enc, createEnvKeyWrapper("22".repeat(32)), "a")).toThrow();
  });
  it("fails when ciphertext is tampered with", () => {
    const enc = encryptSecret(secret, wrapper, "a");
    const buf = Buffer.from(enc.ciphertext, "base64"); buf[0] = (buf[0] as number) ^ 1;
    expect(() => decryptSecret({ ...enc, ciphertext: buf.toString("base64") }, wrapper, "a")).toThrow();
  });
  it("binds ciphertext to its wallet (context/AAD)", () => {
    const enc = encryptSecret(secret, wrapper, "wallet-A");
    expect(() => decryptSecret(enc, wrapper, "wallet-B")).toThrow();
  });
  it("rejects malformed metadata and bad master keys", () => {
    expect(() => decryptSecret({ ciphertext: "AA==", metadata: { version: 2 } }, wrapper, "a")).toThrow(/metadata/);
    expect(() => createEnvKeyWrapper("short")).toThrow();
  });
});
