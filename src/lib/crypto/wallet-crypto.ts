import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope encryption for wallet secret keys.
 *   secret --AES-256-GCM(DEK)--> ciphertext
 *   DEK    --AES-256-GCM(master key)--> wrappedDek
 * The master key comes from server config today (DEVELOPMENT ONLY) and can be swapped for a KMS/HSM
 * by implementing `KeyWrapper` — only wrap/unwrap of the 32-byte DEK touches the master key.
 */

export interface KeyWrapper {
  readonly keyId: string;
  wrap(dek: Buffer): { wrapped: Buffer; iv: Buffer; authTag: Buffer };
  unwrap(wrapped: Buffer, iv: Buffer, authTag: Buffer): Buffer;
}

export interface EncryptionMetadata {
  version: 1;
  algorithm: "AES-256-GCM";
  keyId: string;
  iv: string;
  authTag: string;
  wrappedDek: string;
  dekIv: string;
  dekAuthTag: string;
}

export interface EncryptedSecret {
  ciphertext: string; // base64
  metadata: EncryptionMetadata;
}

const AAD_PREFIX = "arc:wallet:v1:";

export function createEnvKeyWrapper(hexMasterKey: string, keyId = "env-dev-v1"): KeyWrapper {
  if (!/^[0-9a-fA-F]{64}$/.test(hexMasterKey)) throw new Error("Master key must be 64 hex characters (32 bytes)");
  const master = Buffer.from(hexMasterKey, "hex");
  return {
    keyId,
    wrap(dek) {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", master, iv);
      const wrapped = Buffer.concat([c.update(dek), c.final()]);
      return { wrapped, iv, authTag: c.getAuthTag() };
    },
    unwrap(wrapped, iv, authTag) {
      const d = createDecipheriv("aes-256-gcm", master, iv);
      d.setAuthTag(authTag);
      return Buffer.concat([d.update(wrapped), d.final()]);
    },
  };
}

/** `context` (e.g. the wallet's public address) is bound as AAD so ciphertext can't be moved between wallets. */
export function encryptSecret(secret: Uint8Array, wrapper: KeyWrapper, context: string): EncryptedSecret {
  const dek = randomBytes(32);
  try {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", dek, iv);
    c.setAAD(Buffer.from(AAD_PREFIX + context));
    const ciphertext = Buffer.concat([c.update(secret), c.final()]);
    const authTag = c.getAuthTag();
    const w = wrapper.wrap(dek);
    return {
      ciphertext: ciphertext.toString("base64"),
      metadata: {
        version: 1,
        algorithm: "AES-256-GCM",
        keyId: wrapper.keyId,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        wrappedDek: w.wrapped.toString("base64"),
        dekIv: w.iv.toString("base64"),
        dekAuthTag: w.authTag.toString("base64"),
      },
    };
  } finally {
    dek.fill(0);
  }
}

export function isEncryptionMetadata(v: unknown): v is EncryptionMetadata {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return m.version === 1 && m.algorithm === "AES-256-GCM" &&
    ["keyId", "iv", "authTag", "wrappedDek", "dekIv", "dekAuthTag"].every((k) => typeof m[k] === "string");
}

/** Returns the secret bytes. The caller must zero the buffer after use. */
export function decryptSecret(enc: { ciphertext: string; metadata: unknown }, wrapper: KeyWrapper, context: string): Buffer {
  if (!isEncryptionMetadata(enc.metadata)) throw new Error("Invalid wallet encryption metadata");
  const m = enc.metadata;
  const dek = wrapper.unwrap(Buffer.from(m.wrappedDek, "base64"), Buffer.from(m.dekIv, "base64"), Buffer.from(m.dekAuthTag, "base64"));
  try {
    const d = createDecipheriv("aes-256-gcm", dek, Buffer.from(m.iv, "base64"));
    d.setAAD(Buffer.from(AAD_PREFIX + context));
    d.setAuthTag(Buffer.from(m.authTag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc.ciphertext, "base64")), d.final()]);
  } finally {
    dek.fill(0);
  }
}
