import { ok, route, serialize } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getBalance } from "@/server/services/wallets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok(serialize(await getBalance(user.id, id)));
});
