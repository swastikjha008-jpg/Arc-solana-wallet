import "server-only";
import {
  address, appendTransactionMessageInstruction, createTransactionMessage, getBase64EncodedWireTransaction,
  getSignatureFromTransaction, isSolanaError, lamports, pipe,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, type KeyPairSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getRpc } from "./rpc";

/** Thrown only when the network definitively refused the transaction (preflight failure): it was NOT broadcast. */
export class NotSentError extends Error {}

export type ChainStatus = { state: "pending" } | { state: "confirmed" } | { state: "finalized" } | { state: "failed"; reason: string };

/** Narrow chain interface: services depend on this, tests mock it. */
export interface ChainClient {
  getBalance(addr: string): Promise<bigint>;
  getMinimumRentExemption(): Promise<bigint>;
  /** Signs a SOL transfer and returns the signature (known before sending) plus a function that submits it. */
  prepareTransfer(signer: KeyPairSigner, destination: string, amount: bigint): Promise<{ signature: string; send: () => Promise<void> }>;
  getStatus(signature: string): Promise<ChainStatus>;
}

/** Fixed base fee: one signature, no priority fee. Used for the pre-flight balance check and display. */
export const BASE_FEE_LAMPORTS = 5000n;

export function createChainClient(): ChainClient {
  const rpc = getRpc();
  return {
    async getBalance(addr) {
      const r = await rpc.getBalance(address(addr), { commitment: "confirmed" }).send();
      return BigInt(r.value);
    },
    async getMinimumRentExemption() {
      return BigInt(await rpc.getMinimumBalanceForRentExemption(0n).send());
    },
    async prepareTransfer(signer, destination, amount) {
      const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
        (m) => appendTransactionMessageInstruction(
          getTransferSolInstruction({ source: signer, destination: address(destination), amount: lamports(amount) }), m),
      );
      const signed = await signTransactionMessageWithSigners(message);
      const signature = getSignatureFromTransaction(signed);
      const wire = getBase64EncodedWireTransaction(signed);
      return {
        signature,
        send: async () => {
          try {
            await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
          } catch (e) {
            // Preflight failure = rejected before broadcast. Anything else (timeout, dropped connection) is ambiguous.
            if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) throw new NotSentError("preflight failed");
            throw e;
          }
        },
      };
    },
    async getStatus(signature) {
      const r = await rpc.getSignatureStatuses([signature as never], { searchTransactionHistory: true }).send();
      const s = r.value[0];
      if (!s) return { state: "pending" };
      if (s.err) return { state: "failed", reason: "Transaction failed on-chain" };
      return s.confirmationStatus === "finalized" ? { state: "finalized" } : s.confirmationStatus === "confirmed" ? { state: "confirmed" } : { state: "pending" };
    },
  };
}
