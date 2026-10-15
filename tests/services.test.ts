import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEnvKeyWrapper } from "@/lib/crypto/wallet-crypto";

// ---- in-memory fakes for the repository layer -------------------------------------------------
type Tx = Record<string, any>;
const db = vi.hoisted(() => ({ wallets: [] as any[], txs: [] as any[], users: [] as any[], seq: 0 }));

vi.mock("@/server/repositories/wallets", () => ({
  walletsRepo: {
    create: vi.fn(async (d: any) => { const w = { id: `w${++db.seq}`, createdAt: new Date(), ...d }; db.wallets.push(w); const pub = { id: w.id, label: w.label, publicAddress: w.publicAddress, networkOrCluster: w.networkOrCluster, createdAt: w.createdAt }; return pub; }),
    listForOwner: vi.fn(async (o: string) => db.wallets.filter((w) => w.ownerUserId === o)),
    findPublicForOwner: vi.fn(async (id: string, o: string) => db.wallets.find((w) => w.id === id && w.ownerUserId === o) ?? null),
    findWithSecretForOwner: vi.fn(async (id: string, o: string) => db.wallets.find((w) => w.id === id && w.ownerUserId === o) ?? null),
    countForOwner: vi.fn(async (o: string) => db.wallets.filter((w) => w.ownerUserId === o).length),
  },
}));
vi.mock("@/server/repositories/transactions", () => {
  const inc = (t: Tx) => ({ ...t, sourceWallet: db.wallets.find((w) => w.id === t.sourceWalletId) });
  return { transactionsRepo: {
    findByIdempotencyKey: vi.fn(async (o: string, k: string) => { const t = db.txs.find((x) => x.ownerUserId === o && x.idempotencyKey === k); return t ? inc(t) : null; }),
    createIntent: vi.fn(async (d: any) => { const t = { id: `t${++db.seq}`, signature: null, feeLamports: null, failureReason: null, status: "PENDING", createdAt: new Date(), updatedAt: new Date(), ...d }; db.txs.push(t); return inc(t); }),
    attachSignature: vi.fn(async (id: string, signature: string, fee: bigint) => { const t = db.txs.find((x) => x.id === id)!; Object.assign(t, { signature, feeLamports: fee }); return inc(t); }),
    setStatus: vi.fn(async (id: string, status: string, reason: string | null = null) => { const t = db.txs.find((x) => x.id === id)!; Object.assign(t, { status, failureReason: reason }); return inc(t); }),
    listForOwner: vi.fn(async (o: string) => db.txs.filter((x) => x.ownerUserId === o).map(inc)),
    findBySignatureForOwner: vi.fn(async (s: string, o: string) => { const t = db.txs.find((x) => x.signature === s && x.ownerUserId === o); return t ? inc(t) : null; }),
  } };
});
vi.mock("@/server/repositories/users", () => ({
  usersRepo: {
    findTaken: vi.fn(async (u: string, e: string) => db.users.find((x) => x.username.toLowerCase() === u.toLowerCase() || x.email === e) ?? null),
    create: vi.fn(async (d: any) => { const u = { id: `u${++db.seq}`, createdAt: new Date(), ...d }; db.users.push(u); return u; }),
    findByIdentifier: vi.fn(async (i: string) => db.users.find((x) => x.email === i.toLowerCase() || x.username.toLowerCase() === i.toLowerCase()) ?? null),
  },
}));

import { createWallet, getBalance, getWalletOrThrow, listWallets } from "@/server/services/wallets";
import { listTransactions, refreshTransaction, sendSol } from "@/server/services/transactions";
import { authenticate, signUp } from "@/server/services/auth";
import { walletsRepo } from "@/server/repositories/wallets";
import { NotSentError, type ChainClient } from "@/lib/solana/chain";
import { ApiError } from "@/lib/api";

const DEST = "Vote111111111111111111111111111111111111111";
const SIG = "5".repeat(88);
const SOL = 1_000_000_000n;
const MIN_RENT = 890_880n;

function chain(over: Partial<ChainClient> = {}): ChainClient & { sent: number } {
  const c = {
    sent: 0,
    getBalance: vi.fn(async (a: string) => (a === DEST ? 1n * SOL : 2n * SOL)),
    getMinimumRentExemption: vi.fn(async () => MIN_RENT),
    prepareTransfer: vi.fn(async () => ({ signature: SIG, send: async () => { c.sent++; } })),
    getStatus: vi.fn(async () => ({ state: "confirmed" as const })),
    ...over,
  };
  return c as never;
}
const nosleep = async () => {};
const rejectsWith = async (p: Promise<unknown>, code: string) => { const e = await p.then(() => null, (x) => x); expect(e).toBeInstanceOf(ApiError); expect((e as ApiError).code).toBe(code); return e as ApiError; };

beforeEach(() => { db.wallets.length = 0; db.txs.length = 0; db.users.length = 0; db.seq = 0; vi.clearAllMocks(); });

describe("signup, login and generic auth errors", () => {
  it("creates an account with an argon2id hash, rejects duplicates", async () => {
    const u = await signUp({ username: "alice", email: "a@x.io", password: "Str0ngPassword" });
    expect(u).toBeTruthy();
    expect(db.users[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(db.users[0].passwordHash).not.toContain("Str0ngPassword");
    await rejectsWith(signUp({ username: "ALICE", email: "b@x.io", password: "Str0ngPassword" }), "account_exists");
    await rejectsWith(signUp({ username: "bob", email: "a@x.io", password: "Str0ngPassword" }), "account_exists");
  });
  it("authenticates by email or username; unknown user and wrong password give the identical error", async () => {
    await signUp({ username: "alice", email: "a@x.io", password: "Str0ngPassword" });
    expect((await authenticate("a@x.io", "Str0ngPassword")).username).toBe("alice");
    expect((await authenticate("alice", "Str0ngPassword")).email).toBe("a@x.io");
    const wrong = await rejectsWith(authenticate("alice", "nope-nope-nope"), "invalid_credentials");
    const unknown = await rejectsWith(authenticate("ghost", "Str0ngPassword"), "invalid_credentials");
    expect(wrong.message).toBe(unknown.message);
    expect(wrong.status).toBe(401);
  });
});

describe("wallet creation and ownership", () => {
  it("creates a valid Solana wallet whose private key is encrypted and never returned", async () => {
    const w = await createWallet("u1", "Main");
    expect(w.publicAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(JSON.stringify(w)).not.toMatch(/encrypted|privateKey|secret/i);
    const stored = db.wallets[0];
    expect(stored.encryptedPrivateKey).toBeTruthy();
    expect(stored.encryptionMetadata).toMatchObject({ algorithm: "AES-256-GCM", version: 1 });
    expect(stored.networkOrCluster).toBe("devnet");
  });
  it("generates unique addresses", async () => {
    const a = await createWallet("u1"), b = await createWallet("u1");
    expect(a.publicAddress).not.toBe(b.publicAddress);
  });
  it("caps wallets per user", async () => {
    for (let i = 0; i < 10; i++) await createWallet("u1");
    await rejectsWith(createWallet("u1"), "wallet_limit");
  });
  it("prevents cross-user wallet access (same 404 as a missing wallet) and scopes queries by owner", async () => {
    const w = await createWallet("alice");
    await rejectsWith(getWalletOrThrow("mallory", w.id), "not_found");
    await rejectsWith(getBalance("mallory", w.id, chain()), "not_found");
    expect((await getWalletOrThrow("alice", w.id)).id).toBe(w.id);
    expect(walletsRepo.findPublicForOwner).toHaveBeenCalledWith(w.id, "mallory");
    expect(await listWallets("mallory")).toHaveLength(0);
  });
  it("returns the live balance from RPC and maps RPC failures to 502", async () => {
    const w = await createWallet("alice");
    expect((await getBalance("alice", w.id, chain())).lamports).toBe(2n * SOL);
    await rejectsWith(getBalance("alice", w.id, chain({ getBalance: async () => { throw new Error("rpc down https://secret-key.example"); } })), "rpc_error");
  });
});

describe("SOL transfers", () => {
  async function wallet(user = "alice") { return createWallet(user); }
  const input = (walletId: string, over: object = {}) => ({ userId: "alice", sourceWalletId: walletId, destinationAddress: DEST, amountSol: "0.5", idempotencyKey: "idem-key-0000000001", ...over });

  it("signs, sends, and only reports CONFIRMED after the chain says so", async () => {
    const w = await wallet(), c = chain();
    const tx = await sendSol(input(w.id), c, nosleep);
    expect(tx.status).toBe("CONFIRMED");
    expect(tx.signature).toBe(SIG);
    expect(tx.amountLamports).toBe(500_000_000n);
    expect(c.sent).toBe(1);
  });
  it("reports PENDING (not success) when the chain has not confirmed yet", async () => {
    const w = await wallet(), c = chain({ getStatus: async () => ({ state: "pending" }) });
    const tx = await sendSol(input(w.id), c, nosleep);
    expect(tx.status).toBe("PENDING");
  });
  it("records FAILED when the network rejects the transaction", async () => {
    const w = await wallet(), c = chain({ getStatus: async () => ({ state: "failed", reason: "Transaction failed on-chain" }) });
    const tx = await sendSol(input(w.id), c, nosleep);
    expect(tx.status).toBe("FAILED");
  });
  it("marks FAILED only when the network provably rejected the transaction (preflight)", async () => {
    const w = await wallet();
    const c = chain({ prepareTransfer: async () => ({ signature: SIG, send: async () => { throw new NotSentError("preflight"); } }) });
    await rejectsWith(sendSol(input(w.id), c, nosleep), "send_failed");
    expect(db.txs[0].status).toBe("FAILED");
    expect(db.txs[0].failureReason).not.toMatch(/blockhash|preflight/); // internals not persisted/leaked
  });
  it("keeps an ambiguous send (connection dropped after broadcast) PENDING and never claims 'no funds moved'", async () => {
    const w = await wallet();
    const c = chain({ prepareTransfer: async () => ({ signature: SIG, send: async () => { throw new Error("socket hang up"); } }) });
    const e = await rejectsWith(sendSol(input(w.id), c, nosleep), "send_uncertain");
    expect(e.message).not.toMatch(/no funds were moved/i);
    expect(db.txs[0].status).toBe("PENDING");
    expect(db.txs[0].signature).toBe(SIG);
    // ...and the later status check records the truth if it actually landed
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => ({ state: "confirmed" }) })))!.status).toBe("CONFIRMED");
  });
  it("marks FAILED when signing/preparation fails before anything could be broadcast", async () => {
    const w = await wallet();
    await rejectsWith(sendSol(input(w.id), chain({ prepareTransfer: async () => { throw new Error("blockhash fetch failed"); } }), nosleep), "send_failed");
    expect(db.txs[0].status).toBe("FAILED");
  });
  it("maps pre-flight RPC failures to 502 without creating an intent", async () => {
    const w = await wallet();
    await rejectsWith(sendSol(input(w.id), chain({ getBalance: async () => { throw new Error("down"); } }), nosleep), "rpc_error");
    expect(db.txs).toHaveLength(0);
  });
  it("rejects invalid amounts, self-transfers, and insufficient balance including fee", async () => {
    const w = await wallet();
    await rejectsWith(sendSol(input(w.id, { amountSol: "0" }), chain(), nosleep), "invalid_amount");
    await rejectsWith(sendSol(input(w.id, { amountSol: "-1" }), chain(), nosleep), "invalid_amount");
    await rejectsWith(sendSol(input(w.id, { destinationAddress: db.wallets[0].publicAddress }), chain(), nosleep), "invalid_destination");
    await rejectsWith(sendSol(input(w.id, { destinationAddress: "11111111111111111111111111111111" }), chain(), nosleep), "invalid_destination");
    await rejectsWith(sendSol(input(w.id, { amountSol: "3" }), chain(), nosleep), "insufficient_funds");
    await rejectsWith(sendSol(input(w.id, { amountSol: "2" }), chain(), nosleep), "insufficient_funds"); // balance == amount: fee makes it short
    expect(db.txs).toHaveLength(0);
  });
  it("rejects transfers that would strand the wallet below the rent-exempt minimum, and dust to new accounts", async () => {
    const w = await wallet();
    await rejectsWith(sendSol(input(w.id, { amountSol: "1.9995" }), chain({ getBalance: async (a) => (a === DEST ? SOL : 2n * SOL) }), nosleep), "below_rent_exempt");
    await rejectsWith(sendSol(input(w.id, { amountSol: "0.0001" }), chain({ getBalance: async (a) => (a === DEST ? 0n : 2n * SOL) }), nosleep), "destination_rent");
  });
  it("is idempotent: a repeated key returns the original transaction and never sends twice", async () => {
    const w = await wallet(), c = chain();
    const a = await sendSol(input(w.id), c, nosleep);
    const b = await sendSol(input(w.id), c, nosleep);
    expect(b.id).toBe(a.id);
    expect(c.sent).toBe(1);
    expect(db.txs).toHaveLength(1);
  });
  it("cannot spend from another user's wallet", async () => {
    const w = await wallet("alice"), c = chain();
    await rejectsWith(sendSol(input(w.id, { userId: "mallory" }), c, nosleep), "not_found");
    expect(c.sent).toBe(0);
  });
  it("refuses wallets from a different cluster", async () => {
    const w = await wallet(); db.wallets[0].networkOrCluster = "mainnet-beta";
    await rejectsWith(sendSol(input(w.id), chain(), nosleep), "cluster_mismatch");
  });
});

describe("transaction status tracking", () => {
  async function pendingTx(ageMs = 0) {
    const w = await createWallet("alice");
    await sendSol({ userId: "alice", sourceWalletId: w.id, destinationAddress: DEST, amountSol: "0.5", idempotencyKey: "idem-key-0000000009" }, chain({ getStatus: async () => ({ state: "pending" }) }), nosleep);
    db.txs[0].createdAt = new Date(Date.now() - ageMs);
  }
  it("promotes pending -> confirmed -> finalized from RPC status", async () => {
    await pendingTx();
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => ({ state: "confirmed" }) })))!.status).toBe("CONFIRMED");
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => ({ state: "finalized" }) })))!.status).toBe("FINALIZED");
  });
  it("marks on-chain failures and expired transactions as FAILED", async () => {
    await pendingTx();
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => ({ state: "failed", reason: "x" }) })))!.status).toBe("FAILED");
    db.txs.length = 0; await pendingTx(10 * 60_000);
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => ({ state: "pending" }) })))!.status).toBe("FAILED");
  });
  it("keeps the last known status when the RPC errors (never guesses)", async () => {
    await pendingTx();
    expect((await refreshTransaction(SIG, "alice", chain({ getStatus: async () => { throw new Error("rpc"); } })))!.status).toBe("PENDING");
  });
  it("hides other users' transactions", async () => {
    await pendingTx();
    expect(await refreshTransaction(SIG, "mallory", chain())).toBeNull();
    expect(await listTransactions("mallory", chain())).toHaveLength(0);
  });
  it("closes out never-submitted intents after the expiry window", async () => {
    const w = await createWallet("alice");
    db.txs.push({ id: "tx-stale", ownerUserId: "alice", sourceWalletId: w.id, signature: null, status: "PENDING", createdAt: new Date(Date.now() - 10 * 60_000), updatedAt: new Date(), destinationAddress: DEST, amountLamports: 1n, idempotencyKey: "k" });
    const rows = await listTransactions("alice", chain());
    expect(rows.find((r: any) => r.id === "tx-stale")!.status).toBe("FAILED");
  });
});

// keep the wrapper import used (ensures env-key wrapper construction stays valid with the test key)
it("test master key is a valid wrapper key", () => expect(createEnvKeyWrapper("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff").keyId).toBeTruthy());
