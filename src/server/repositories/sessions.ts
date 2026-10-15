import "server-only";
import { getDb } from "@/lib/db/client";

export const sessionsRepo = {
  create: (data: { tokenHash: string; userId: string; expiresAt: Date }) => getDb().session.create({ data }),
  findValid: (tokenHash: string) =>
    getDb().session.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
  deleteByHash: (tokenHash: string) => getDb().session.deleteMany({ where: { tokenHash } }),
  deleteExpired: () => getDb().session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
};
