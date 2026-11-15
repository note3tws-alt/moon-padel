import { NextResponse } from "next/server";
import { refreshPublicSite } from "@/lib/cache";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { runImport } from "@/lib/import/process";
import { MAX_IMPORT_ROWS } from "@/lib/import/parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  kind: z.enum(["players", "tournaments", "matches", "history"]),
  commit: z.boolean(),
  fileName: z.string().max(255).optional(),
  mapping: z.record(z.string()),
  rows: z.array(z.record(z.string())).min(1).max(MAX_IMPORT_ROWS),
  options: z.object({
    mode: z.enum(["add_new", "update"]),
    matchByName: z.boolean().optional(),
    strict: z.boolean().optional(),
    publishResults: z.boolean().optional(),
    createMissingPlayers: z.boolean().optional(),
  }),
});

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await runImport({ ...parsed.data, admin });
    if (result.committed) refreshPublicSite();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
