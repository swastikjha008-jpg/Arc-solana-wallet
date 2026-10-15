import "server-only";
import { ApiError } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { solToLamports } from "@/lib/crypto/lamports";
import { BASE_FEE_LAMPORTS, NotSentError, createChainClient, type ChainClient } from "@/lib/solana/chain";
import { loadSigner } from "@/lib/solana/wallet";
import { transactionsRepo } from "@/server/repositories/transactions";
import { walletsRepo } from "@/server/repositories/wallets";

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
const PENDING_EXPIRY_MS = 3 * 60 * 1000; // a blockhash is valid ~90s; after this an unseen tx can no longer land
const CONFIRM_POLLS = 6;
const POLL_DELAY_MS = 1000;

export interface SendInput {
  userId: string; sourceWalletId: string; destinationAddress: string; amountSol: string; idempotencyKey: string;
}

type Row = NonNullable<Awaited<ReturnType<typeof transactionsRepo.findByIdempotencyKey>>>;

export async function sendSol(input: SendInput, chain: ChainClient = createChainClient(), sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<Row> {
  const amount = solToLamports(input.amountSol);
  if (amount === null) throw new ApiError(400, "invalid_amount", "Amount must be a positive number with at most 9 decimals");

  const existing = await transactionsRepo.findByIdempotencyKey(input.userId, input.idempotencyKey);
  if (existing) return existing; // duplicate submission: return the original, never send twice

  const wallet = await walletsRepo.findWithSecretForOwner(input.sourceWalletId, input.userId);
  if (!wallet) throw new ApiError(404, "not_found", "Wallet not found");
  if (input.destinationAddress === SYSTEM_PROGRAM_ADDRESS) throw new ApiError(400, "invalid_destination", "That address is a program, not a wallet. Enter a wallet address.");
  if (wallet.publicAddress === input.destinationAddress) throw new ApiError(400, "invalid_destination", "Destination must differ from the source wallet");
  if (wallet.networkOrCluster !== getEnv().SOLANA_CLUSTER) throw new ApiError(409, "cluster_mismatch", "This wallet belongs to a different network");

  let balance: bigint, minRent: bigint, destBalance: bigint;
  try {
    [balance, minRent, destBalance] = await Promise.all([chain.getBalance(wallet.publicAddress), chain.getMinimumRentExemption(), chain.getBalance(input.destinationAddress)]);
  } catch {
    throw new ApiError(502, "rpc_error", "Could not reach the Solana RPC. Please try again.");
  }
  if (balance < amount + BASE_FEE_LAMPORTS) throw new ApiError(400, "insufficient_funds", "Insufficient balance (amount plus network fee)");
  const remaining = balance - amount - BASE_FEE_LAMPORTS;
  if (remaining > 0n && remaining < minRent) throw new ApiError(400, "below_rent_exempt", "Transfer would leave the wallet below the rent-exempt minimum. Send less, or send the maximum that leaves nothing.");
  if (destBalance === 0n && amount < minRent) throw new ApiError(400, "destination_rent", "Amount is below the minimum needed to open a new account");

  let intent;
  try {
    intent = await transactionsRepo.createIntent({
      ownerUserId: input.userId, sourceWalletId: wallet.id, destinationAddress: input.destinationAddress,
      amountLamports: amount, networkOrCluster: wallet.networkOrCluster, idempotencyKey: input.idempotencyKey,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const dup = await transactionsRepo.findByIdempotencyKey(input.userId, input.idempotencyKey);
      if (dup) return dup; // lost the race to a concurrent identical request
    }
    throw e;
  }

  let submitted = false; // true once the signed transaction may have reached the network
  try {
    const signer = await loadSigner(wallet);
    const prepared = await chain.prepareTransfer(signer, input.destinationAddress, amount);
    await transactionsRepo.attachSignature(intent.id, prepared.signature, BASE_FEE_LAMPORTS);
    submitted = true;
    await prepared.send();
    return await waitForConfirmation(intent.id, prepared.signature, input.userId, chain, sleep);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (!submitted || e instanceof NotSentError) {
      // Provably never broadcast: safe to close out as failed.
      await transactionsRepo.setStatus(intent.id, "FAILED", "The network rejected the transaction");
      throw new ApiError(502, "send_failed", "The transaction was not sent. No funds were moved.");
    }
    // Ambiguous (e.g. connection dropped after broadcast). The signature is known, so leave it PENDING:
    // status refresh asks the chain and records the truth; it expires to FAILED if it can never land.
    throw new ApiError(502, "send_uncertain", "We couldn't confirm the network received the transaction. It is listed as pending — check its status before retrying.");
  }
}

async function waitForConfirmation(id: string, signature: string, userId: string, chain: ChainClient, sleep: (ms: number) => Promise<unknown>): Promise<Row> {
  for (let i = 0; i < CONFIRM_POLLS; i++) {
    await sleep(POLL_DELAY_MS);
    const row = await refreshTransaction(signature, userId, chain);
    if (row && row.status !== "PENDING") return row;
  }
  // Not confirmed yet: report the truth (PENDING). The dashboard keeps polling.
  return (await transactionsRepo.findBySignatureForOwner(signature, userId)) as Row;
}

/** Re-checks a pending transaction on-chain and persists the real status. */
export async function refreshTransaction(signature: string, userId: string, chain: ChainClient = createChainClient()): Promise<Row | null> {
  const row = await transactionsRepo.findBySignatureForOwner(signature, userId);
  if (!row || row.status === "FINALIZED" || row.status === "FAILED") return row;
  let status;
  try {
    status = await chain.getStatus(signature);
  } catch {
    return row; // RPC hiccup: keep the last known status instead of guessing
  }
  switch (status.state) {
    case "finalized": return transactionsRepo.setStatus(row.id, "FINALIZED");
    case "confirmed": return row.status === "CONFIRMED" ? row : transactionsRepo.setStatus(row.id, "CONFIRMED");
    case "failed": return transactionsRepo.setStatus(row.id, "FAILED", status.reason);
    case "pending":
      if (Date.now() - row.createdAt.getTime() > PENDING_EXPIRY_MS) return transactionsRepo.setStatus(row.id, "FAILED", "Transaction expired before it was confirmed");
      return row;
  }
}

export async function listTransactions(userId: string, chain: ChainClient = createChainClient()) {
  const rows = await transactionsRepo.listForOwner(userId);
  // Intents that never got a signature (e.g. the process died mid-request) can never land: close them out.
  const stale = rows.filter((r) => r.status === "PENDING" && !r.signature && Date.now() - r.createdAt.getTime() > PENDING_EXPIRY_MS);
  await Promise.all(stale.map((r) => transactionsRepo.setStatus(r.id, "FAILED", "Transaction was never submitted")));
  const pending = rows.filter((r) => r.status === "PENDING" && r.signature);
  if (pending.length || stale.length) {
    await Promise.all(pending.slice(0, 10).map((r) => refreshTransaction(r.signature as string, userId, chain)));
    return transactionsRepo.listForOwner(userId);
  }
  return rows;
}
