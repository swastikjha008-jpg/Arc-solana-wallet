import "server-only";
import { ApiError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { generateEncryptedWallet } from "@/lib/solana/wallet";
import { createChainClient, type ChainClient } from "@/lib/solana/chain";
import { walletsRepo } from "@/server/repositories/wallets";

const MAX_WALLETS_PER_USER = 10;

export async function createWallet(userId: string, label?: string) {
  if ((await walletsRepo.countForOwner(userId)) >= MAX_WALLETS_PER_USER) {
    throw new ApiError(409, "wallet_limit", `You can have at most ${MAX_WALLETS_PER_USER} wallets`);
  }
  const g = await generateEncryptedWallet();
  return walletsRepo.create({
    ownerUserId: userId,
    label: label ?? "Wallet",
    publicAddress: g.publicAddress,
    encryptedPrivateKey: g.encryptedPrivateKey,
    encryptionMetadata: g.encryptionMetadata as unknown as Record<string, string | number>,
    networkOrCluster: getEnv().SOLANA_CLUSTER,
  });
}

export const listWallets = (userId: string) => walletsRepo.listForOwner(userId);

export async function getWalletOrThrow(userId: string, id: string) {
  const w = await walletsRepo.findPublicForOwner(id, userId);
  if (!w) throw new ApiError(404, "not_found", "Wallet not found"); // same response for "not yours" and "doesn't exist"
  return w;
}

export async function getBalance(userId: string, id: string, chain: ChainClient = createChainClient()) {
  const w = await getWalletOrThrow(userId, id);
  try {
    return { walletId: w.id, address: w.publicAddress, lamports: await chain.getBalance(w.publicAddress), cluster: w.networkOrCluster };
  } catch {
    throw new ApiError(502, "rpc_error", "Could not reach the Solana RPC. Please try again.");
  }
}
