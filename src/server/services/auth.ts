import "server-only";
import { hashPassword, verifyDummy, verifyPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/api";
import { usersRepo } from "@/server/repositories/users";

export async function signUp(input: { username: string; email: string; password: string }) {
  if (await usersRepo.findTaken(input.username, input.email)) {
    // Single message for both fields avoids confirming which one exists.
    throw new ApiError(409, "account_exists", "An account with that username or email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  try {
    return await usersRepo.create({ username: input.username, email: input.email, passwordHash });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ApiError(409, "account_exists", "An account with that username or email already exists");
    throw e;
  }
}

const INVALID = () => new ApiError(401, "invalid_credentials", "Invalid credentials");

export async function authenticate(identifier: string, password: string) {
  const user = await usersRepo.findByIdentifier(identifier);
  if (!user) { await verifyDummy(password); throw INVALID(); }
  if (!(await verifyPassword(user.passwordHash, password))) throw INVALID();
  return { id: user.id, username: user.username, email: user.email };
}
