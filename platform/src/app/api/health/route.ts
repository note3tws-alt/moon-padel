import { NextResponse } from "next/server";
import { isDatabaseConfigured, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public health check: one cheap query, reports only status and timing. */
export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ database: "not configured" }, { status: 503 });
  const start = Date.now();
  try {
    await Promise.race([
      sql()`select 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 8000)),
    ]);
    return NextResponse.json({ database: "ok", ms: Date.now() - start }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ database: "error", ms: Date.now() - start }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
