import "server-only";
import { createKeyPairSignerFromBytes, generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import { getEnv } from "@/lib/env";
import { createEnvKeyWrapper, decryptSecret, encryptSecret, type EncryptionMetadata } from "@/lib/crypto/wallet-crypto";

export function getKeyWrapper() {
  return createEnvKeyWrapper(getEnv().WALLET_ENCRYPTION_KEY);
}

/** Exports the 64-byte secret (seed || pubkey) of a freshly generated, extractable keypair. */
async function exportSecret(signer: KeyPairSigner): Promise<Uint8Array> {
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", signer.keyPair.privateKey));
  const seed = pkcs8.slice(-32); // PKCS#8 Ed25519 wraps the 32-byte seed at the end
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", signer.keyPair.publicKey));
  const out = new Uint8Array(64);
  out.set(seed, 0); out.set(pub, 32);
  pkcs8.fill(0); seed.fill(0);
  return out;
}

export interface GeneratedWallet { publicAddress: string; encryptedPrivateKey: string; encryptionMetadata: EncryptionMetadata }

export async function generateEncryptedWallet(): Promise<GeneratedWallet> {
  const signer = await generateKeyPairSigner(true);
  const secret = await exportSecret(signer);
  try {
    // Round-trip validation: key material must reproduce the same address before we persist it.
    const check = await createKeyPairSignerFromBytes(secret);
    if (check.address !== signer.address) throw new Error("Generated key material failed validation");
    const enc = encryptSecret(secret, getKeyWrapper(), signer.address);
    return { publicAddress: signer.address, encryptedPrivateKey: enc.ciphertext, encryptionMetadata: enc.metadata };
  } finally {
    secret.fill(0);
  }
}

/** Decrypts into a non-extractable signer; the plaintext buffer is zeroed immediately. */
export async function loadSigner(w: { publicAddress: string; encryptedPrivateKey: string; encryptionMetadata: unknown }): Promise<KeyPairSigner> {
  const secret = decryptSecret({ ciphertext: w.encryptedPrivateKey, metadata: w.encryptionMetadata }, getKeyWrapper(), w.publicAddress);
  try {
    const signer = await createKeyPairSignerFromBytes(new Uint8Array(secret), false);
    if (signer.address !== w.publicAddress) throw new Error("Wallet key does not match its public address");
    return signer;
  } finally {
    secret.fill(0);
  }
}
