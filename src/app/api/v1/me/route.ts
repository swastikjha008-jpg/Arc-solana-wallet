import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => ok({ user: await requireUser() }));
