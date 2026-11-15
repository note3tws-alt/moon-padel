import { NextResponse } from "next/server";
import postgres from "postgres";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { demoCounts, getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Public health check: reports only timings and error codes, never data or settings. */
async function step(name: string, fn: () => Promise<unknown>, ms = 8000) {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)),
    ]);
    return { name, ok: true, ms: Date.now() - start };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { name, ok: false, ms: Date.now() - start, error: `${e.code ?? ""} ${e.message ?? ""}`.trim().slice(0, 200) };
  }
}

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ database: "not configured" });
  const steps = [];
  steps.push(
    await step("plain connection", async () => {
      const raw = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, ssl: "require", connect_timeout: 6 });
      try {
        await raw`select 1`;
      } finally {
        await raw.end({ timeout: 1 }).catch(() => {});
      }
    }),
  );
  for (const pipeline of [100, 1]) {
    steps.push(
      await step(`10 parallel queries, pipeline ${pipeline}`, async () => {
        const raw = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, ssl: "require", connect_timeout: 6, max_pipeline: pipeline } as postgres.Options<Record<string, postgres.PostgresType>>);
        try {
          await Promise.all(Array.from({ length: 10 }, () => raw`select pg_sleep(0.05)`));
        } finally {
          await raw.end({ timeout: 1 }).catch(() => {});
        }
      }),
    );
  }
  steps.push(await step("app pool 12 parallel", () => Promise.all(Array.from({ length: 12 }, () => sql()`select 1`))));
  steps.push(await step("app pool select 1", () => sql()`select 1`));
  steps.push(await step("settings", () => getSettings()));
  steps.push(await step("demo counts", () => demoCounts()));
  return NextResponse.json({ steps }, { headers: { "cache-control": "no-store" } });
}
