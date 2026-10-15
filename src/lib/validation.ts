import { z } from "zod";
import { isAddress } from "@solana/kit";
import { solToLamports } from "@/lib/crypto/lamports";
export * from "./validation-auth";

export const createWalletSchema = z.object({ label: z.string().trim().min(1).max(40).optional() });

export const solanaAddressSchema = z.string().trim().refine((v) => isAddress(v), "Enter a valid Solana address");

export const amountSolSchema = z
  .string().trim()
  .refine((v) => solToLamports(v) !== null, "Enter a positive amount with at most 9 decimals");

export const createTransactionSchema = z.object({
  sourceWalletId: z.string().min(1).max(64),
  destinationAddress: solanaAddressSchema,
  amountSol: amountSolSchema,
  idempotencyKey: z.string().min(16).max(100),
  confirmed: z.literal(true, { error: "Explicit confirmation is required" }),
});

export const signatureSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,100}$/, "Invalid signature");
