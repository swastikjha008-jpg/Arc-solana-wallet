import { describe, expect, it } from "vitest";
import { createTransactionSchema, signatureSchema, signinSchema, signupSchema, solanaAddressSchema } from "@/lib/validation";

const good = { username: "swastik_1", email: "A@Example.com", password: "Str0ngPassword", confirmPassword: "Str0ngPassword" };

describe("signup validation", () => {
  it("accepts valid input and normalises email", () => {
    const r = signupSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@example.com");
  });
  it.each([
    ["short username", { username: "ab" }, "username"],
    ["bad chars", { username: "bad name!" }, "username"],
    ["bad email", { email: "nope" }, "email"],
    ["short password", { password: "Ab1", confirmPassword: "Ab1" }, "password"],
    ["weak password", { password: "alllowercase1", confirmPassword: "alllowercase1" }, "password"],
    ["mismatch", { confirmPassword: "Different1Pass" }, "confirmPassword"],
  ])("rejects %s", (_n, patch, field) => {
    const r = signupSchema.safeParse({ ...good, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === field)).toBe(true);
  });
  it("signin requires both fields", () => {
    expect(signinSchema.safeParse({ identifier: "", password: "x" }).success).toBe(false);
    expect(signinSchema.safeParse({ identifier: "me", password: "" }).success).toBe(false);
    expect(signinSchema.safeParse({ identifier: "me", password: "x" }).success).toBe(true);
  });
});

describe("public address + transaction validation", () => {
  const ADDR = "11111111111111111111111111111111";
  it("validates Solana addresses", () => {
    expect(solanaAddressSchema.safeParse(ADDR).success).toBe(true);
    for (const bad of ["", "abc", "0OIl" + "1".repeat(30), ADDR + "1111", "0x" + "a".repeat(40)]) expect(solanaAddressSchema.safeParse(bad).success, bad).toBe(false);
  });
  const tx = { sourceWalletId: "w1", destinationAddress: ADDR, amountSol: "0.5", idempotencyKey: "k".repeat(20), confirmed: true as const };
  it("accepts a valid transaction request", () => expect(createTransactionSchema.safeParse(tx).success).toBe(true));
  it.each([["zero", "0"], ["negative", "-1"], ["malformed", "1.2.3"], ["float noise", "0.1e1"], ["too precise", "0.0000000001"]])("rejects %s amount", (_n, amountSol) => {
    expect(createTransactionSchema.safeParse({ ...tx, amountSol }).success).toBe(false);
  });
  it("requires explicit confirmation and an idempotency key", () => {
    expect(createTransactionSchema.safeParse({ ...tx, confirmed: false }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...tx, confirmed: undefined }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...tx, idempotencyKey: "short" }).success).toBe(false);
  });
  it("validates signatures", () => {
    expect(signatureSchema.safeParse("5".repeat(88)).success).toBe(true);
    expect(signatureSchema.safeParse("../etc/passwd").success).toBe(false);
  });
});
