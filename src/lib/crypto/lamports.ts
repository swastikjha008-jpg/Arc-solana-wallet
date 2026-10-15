/** Integer-only SOL/lamport conversion. Never uses floating point. */
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const MAX_TRANSFER_LAMPORTS = 1_000_000n * LAMPORTS_PER_SOL;

const SOL_RE = /^(\d{1,12})(?:\.(\d{1,9}))?$/;

/** Parses a decimal SOL string ("1.5") into lamports. Returns null for malformed, zero, negative or oversize values. */
export function solToLamports(input: string): bigint | null {
  const m = SOL_RE.exec(input.trim());
  if (!m) return null;
  const whole = BigInt(m[1] as string);
  const frac = BigInt(((m[2] ?? "") + "000000000").slice(0, 9));
  const total = whole * LAMPORTS_PER_SOL + frac;
  if (total <= 0n || total > MAX_TRANSFER_LAMPORTS) return null;
  return total;
}

export function lamportsToSol(lamports: bigint): string {
  const neg = lamports < 0n;
  const abs = neg ? -lamports : lamports;
  const whole = abs / LAMPORTS_PER_SOL;
  const frac = (abs % LAMPORTS_PER_SOL).toString().padStart(9, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
