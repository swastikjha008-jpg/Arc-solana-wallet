import { describe, expect, it, vi } from "vitest";
import { getTransactionDecoder, getBase64Encoder, getBase58Decoder, verifySignature, getBase58Encoder, getCompiledTransactionMessageDecoder } from "@solana/kit";

const sendTransaction = vi.fn();
const fakeRpc = {
  getLatestBlockhash: () => ({ send: async () => ({ value: { blockhash: "4NCYB3kRT8sCNodPNuCZo8VUh4xqpBQxsxed2wd9xaD4", lastValidBlockHeight: 100n } }) }),
  sendTransaction: (...args: unknown[]) => { sendTransaction(...args); return { send: async () => "sig" }; },
  getBalance: () => ({ send: async () => ({ value: 5n }) }),
  getMinimumBalanceForRentExemption: () => ({ send: async () => 890880n }),
  getSignatureStatuses: (sigs: string[]) => ({ send: async () => ({ value: [sigs[0] === "done" ? { err: null, confirmationStatus: "finalized" } : sigs[0] === "bad" ? { err: { InstructionError: [0, "x"] }, confirmationStatus: "confirmed" } : null] }) }),
};
vi.mock("@/lib/solana/rpc", () => ({ getRpc: () => fakeRpc }));

import { generateEncryptedWallet, loadSigner } from "@/lib/solana/wallet";
import { BASE_FEE_LAMPORTS, createChainClient } from "@/lib/solana/chain";

const DEST = "Vote111111111111111111111111111111111111111"; // any non-System-Program address
const RECIPIENT = "CLEZ5HXicNwWJmvgTryoomxkejb5ASNv46ZeAnYs3Z4";

function getCompiledAddresses(messageBytes: Parameters<ReturnType<typeof getCompiledTransactionMessageDecoder>["decode"]>[0]): string[] {
  return [...getCompiledTransactionMessageDecoder().decode(messageBytes).staticAccounts];
}
void getBase58Decoder;

describe("real keypair generation + signing (RPC faked)", () => {
  it("generated wallets reload into a signer with the same address; tampered ciphertext is rejected", async () => {
    const g = await generateEncryptedWallet();
    const signer = await loadSigner(g);
    expect(signer.address).toBe(g.publicAddress);
    const bad = Buffer.from(g.encryptedPrivateKey, "base64"); bad[3] = (bad[3] as number) ^ 1;
    await expect(loadSigner({ ...g, encryptedPrivateKey: bad.toString("base64") })).rejects.toThrow();
    await expect(loadSigner({ ...g, publicAddress: DEST })).rejects.toThrow(); // key bound to its own address
  });

  it("builds a valid SOL transfer, returns the real signature before sending, and the signature verifies", async () => {
    const g = await generateEncryptedWallet();
    const signer = await loadSigner(g);
    const chain = createChainClient();
    const prepared = await chain.prepareTransfer(signer, RECIPIENT, 1_500_000n);
    expect(prepared.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/);
    expect(sendTransaction).not.toHaveBeenCalled(); // nothing is sent until send() is invoked
    await prepared.send();
    expect(sendTransaction).toHaveBeenCalledTimes(1);
    const [wire, opts] = sendTransaction.mock.calls[0] as [string, { encoding: string }];
    expect(opts.encoding).toBe("base64");

    const tx = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
    const sigBytes = tx.signatures[signer.address]!;
    expect(sigBytes).toBeTruthy();
    expect(getBase58Encoder().encode(prepared.signature)).toEqual(sigBytes); // returned signature == the one in the wire tx
    expect(await verifySignature(signer.keyPair.publicKey, sigBytes, tx.messageBytes)).toBe(true);
    // the message must reference the destination and the System Program, and pay fee from the source wallet
    const keys = getCompiledAddresses(tx.messageBytes);
    expect(keys).toContain(RECIPIENT);
    expect(keys).toContain("11111111111111111111111111111111");
    expect(keys[0]).toBe(signer.address); // fee payer is the source wallet
  });

  it("maps RPC signature statuses to pending / confirmed / finalized / failed", async () => {
    const chain = createChainClient();
    expect(await chain.getStatus("unknown")).toEqual({ state: "pending" });
    expect(await chain.getStatus("done")).toEqual({ state: "finalized" });
    expect((await chain.getStatus("bad")).state).toBe("failed");
    expect(await chain.getBalance(DEST)).toBe(5n);
    expect(await chain.getMinimumRentExemption()).toBe(890880n);
    expect(BASE_FEE_LAMPORTS).toBe(5000n);
  });
});
