import "server-only";
import type { TransactionStatus } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";

const include = { sourceWallet: { select: { id: true, label: true, publicAddress: true } } } as const;

export const transactionsRepo = {
  findByIdempotencyKey: (ownerUserId: string, idempotencyKey: string) =>
    getDb().transaction.findUnique({ where: { ownerUserId_idempotencyKey: { ownerUserId, idempotencyKey } }, include }),
  createIntent: (d: {
    ownerUserId: string; sourceWalletId: string; destinationAddress: string; amountLamports: bigint;
    networkOrCluster: string; idempotencyKey: string;
  }) => getDb().transaction.create({ data: { ...d, status: "PENDING" }, include }),
  attachSignature: (id: string, signature: string, feeLamports: bigint) =>
    getDb().transaction.update({ where: { id }, data: { signature, feeLamports }, include }),
  setStatus: (id: string, status: TransactionStatus, failureReason: string | null = null) =>
    getDb().transaction.update({ where: { id }, data: { status, failureReason }, include }),
  listForOwner: (ownerUserId: string, take = 50) =>
    getDb().transaction.findMany({ where: { ownerUserId }, orderBy: { createdAt: "desc" }, take, include }),
  findBySignatureForOwner: (signature: string, ownerUserId: string) =>
    getDb().transaction.findFirst({ where: { signature, ownerUserId }, include }),
};
