import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";

const publicSelect = { id: true, label: true, publicAddress: true, networkOrCluster: true, createdAt: true } as const;

export const walletsRepo = {
  create: (data: {
    ownerUserId: string; label: string; publicAddress: string; encryptedPrivateKey: string;
    encryptionMetadata: Prisma.InputJsonValue; networkOrCluster: string;
  }) => getDb().wallet.create({ data, select: publicSelect }),
  /** Every query is scoped by ownerUserId: ownership is enforced in the data layer, never from client input. */
  listForOwner: (ownerUserId: string) =>
    getDb().wallet.findMany({ where: { ownerUserId }, orderBy: { createdAt: "asc" }, select: publicSelect }),
  findPublicForOwner: (id: string, ownerUserId: string) =>
    getDb().wallet.findFirst({ where: { id, ownerUserId }, select: publicSelect }),
  /** Includes key material. Only for server-side signing. */
  findWithSecretForOwner: (id: string, ownerUserId: string) =>
    getDb().wallet.findFirst({ where: { id, ownerUserId } }),
  countForOwner: (ownerUserId: string) => getDb().wallet.count({ where: { ownerUserId } }),
};
