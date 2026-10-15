import { LIMITS } from "@/lib/rate-limit";
import { enforceLimit, ok, parseJson, route, serialize } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createTransactionSchema } from "@/lib/validation";
import { listTransactions, sendSol } from "@/server/services/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = route(async () => {
  const user = await requireUser();
  return ok({ transactions: serialize(await listTransactions(user.id)) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceLimit(`tx:${user.id}`, LIMITS.transaction);
  const body = await parseJson(req, createTransactionSchema);
  const tx = await sendSol({
    userId: user.id, sourceWalletId: body.sourceWalletId, destinationAddress: body.destinationAddress,
    amountSol: body.amountSol, idempotencyKey: body.idempotencyKey,
  });
  return ok({ transaction: serialize(tx) }, 201);
}, { mutation: true });
