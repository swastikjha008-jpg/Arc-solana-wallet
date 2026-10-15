import "server-only";
import { createSolanaRpc } from "@solana/kit";
import { getEnv } from "@/lib/env";

type Rpc = ReturnType<typeof createSolanaRpc>;
let rpc: Rpc | null = null;

/** The RPC URL may contain an API key; it is never logged or returned to clients. */
export function getRpc(): Rpc {
  rpc ??= createSolanaRpc(getEnv().SOLANA_RPC_URL);
  return rpc;
}

export function explorerUrl(signature: string, cluster: string): string {
  const q = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${q}`;
}
export function explorerAddressUrl(address: string, cluster: string): string {
  const q = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${q}`;
}
