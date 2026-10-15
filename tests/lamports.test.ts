import { describe, expect, it } from "vitest";
import { lamportsToSol, solToLamports } from "@/lib/crypto/lamports";

describe("SOL <-> lamports (integer math only)", () => {
  it("converts exact values", () => {
    expect(solToLamports("1")).toBe(1_000_000_000n);
    expect(solToLamports("0.000000001")).toBe(1n);
    expect(solToLamports("1.5")).toBe(1_500_000_000n);
    expect(solToLamports("0.1")).toBe(100_000_000n); // the classic float trap (0.1 * 1e9 = 100000000.00000001)
    expect(solToLamports("0.3")).toBe(300_000_000n);
    expect(solToLamports(" 2.25 ")).toBe(2_250_000_000n);
  });
  it("rejects zero, negative, malformed, too many decimals, and oversize input", () => {
    for (const bad of ["0", "0.0", "-1", "", "abc", "1e3", "1,5", "1.0000000001", ".5", "1.", "NaN", "Infinity", "0x10", "9999999999999"]) {
      expect(solToLamports(bad), bad).toBeNull();
    }
  });
  it("round-trips", () => {
    for (const s of ["1", "0.5", "123.456789012", "0.000000001"]) expect(lamportsToSol(solToLamports(s)!)).toBe(s);
    expect(lamportsToSol(0n)).toBe("0");
    expect(lamportsToSol(5000n)).toBe("0.000005");
  });
});
