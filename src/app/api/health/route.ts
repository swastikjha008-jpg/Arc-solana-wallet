import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness only: reveals nothing about configuration. */
export function GET() {
  return NextResponse.json({ ok: true, service: "arc", time: new Date().toISOString() });
}
