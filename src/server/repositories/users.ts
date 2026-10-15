import "server-only";
import { getDb } from "@/lib/db/client";

export const usersRepo = {
  create: (data: { username: string; email: string; passwordHash: string }) =>
    getDb().user.create({ data, select: { id: true, username: true, email: true, createdAt: true } }),
  findByIdentifier: (identifier: string) =>
    getDb().user.findFirst({
      where: identifier.includes("@") ? { email: identifier.toLowerCase() } : { username: { equals: identifier, mode: "insensitive" } },
    }),
  findTaken: (username: string, email: string) =>
    getDb().user.findFirst({
      where: { OR: [{ username: { equals: username, mode: "insensitive" } }, { email }] },
      select: { id: true },
    }),
};
