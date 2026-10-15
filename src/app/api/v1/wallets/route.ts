import { LIMITS } from "@/lib/rate-limit";
import { enforceLimit, ok, parseJson, route, serialize } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createWalletSchema } from "@/lib/validation";
import { createWallet, listWallets } from "@/server/services/wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ wallets: serialize(await listWallets(user.id)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceLimit(`wallet:${user.id}`, LIMITS.walletCreate);
  const body = await parseJson(req, createWalletSchema);
  return ok({ wallet: serialize(await createWallet(user.id, body.label)) }, 201);
}, { mutation: true });
