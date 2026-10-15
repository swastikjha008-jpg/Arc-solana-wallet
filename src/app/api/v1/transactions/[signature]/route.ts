import { ApiError, ok, route, serialize } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { signatureSchema } from "@/lib/validation";
import { refreshTransaction } from "@/server/services/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx: { params: Promise<{ signature: string }> }) => {
  const user = await requireUser();
  const { signature } = await ctx.params;
  if (!signatureSchema.safeParse(signature).success) throw new ApiError(400, "invalid_signature", "Invalid signature");
  const tx = await refreshTransaction(signature, user.id);
  if (!tx) throw new ApiError(404, "not_found", "Transaction not found");
  return ok({ transaction: serialize(tx) });
});
