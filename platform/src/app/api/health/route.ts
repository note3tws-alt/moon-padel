import { NextResponse } from "next/server";
import postgres from "postgres";
import { createClient, isDatabaseConfigured, sql } from "@/lib/db";
import {
  demoCounts, getDivisions, getLatestChampions, getLeagueStats, getMonthlyChampions, getRisingPlayers, getSettings, getTopByDivision, getUpcomingTournaments,
} from "@/lib/queries";
import { currentPeriod } from "@/lib/utils";

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
  const period0 = currentPeriod();
  steps.push(
    await step(
      "home page queries all at once (cold)",
      () => Promise.all([
        getSettings(), demoCounts(), getSettings(), getDivisions(), getUpcomingTournaments(6), getTopByDivision(period0),
        getMonthlyChampions(period0), getLatestChampions(), getRisingPlayers(7, 5), getRisingPlayers(30, 5), getLeagueStats(),
      ]),
      10000,
    ),
  );
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
  steps.push(await step("app pool select 1", () => sql()`select 1`));
  steps.push(await step("settings", () => getSettings()));
  steps.push(await step("demo counts", () => demoCounts()));
  const period = currentPeriod();
  const homeQueries: [string, () => Promise<unknown>][] = [
    ["divisions", () => getDivisions()],
    ["upcoming", () => getUpcomingTournaments(6)],
    ["top by division", () => getTopByDivision(period)],
    ["monthly champions", () => getMonthlyChampions(period)],
    ["latest champions", () => getLatestChampions()],
    ["rising players", () => getRisingPlayers(7, 5)],
    ["league stats", () => getLeagueStats()],
  ];
  for (const [name, fn] of homeQueries) steps.push(await step(`home: ${name}`, fn, 5000));

  // Same kind of queries through Supabase's session pooler (port 5432) for comparison.
  const url = process.env.DATABASE_URL!;
  if (url.includes(":6543/")) {
    const session = createClient(url.replace(":6543/", ":5432/"));
    try {
      steps.push(await step("session: select 1", () => session`select 1`, 5000));
      steps.push(await step("session: params", () => session`select ${5}::int as n, ${"2026-11-01"}::date as d`, 5000));
      steps.push(await step("session: 12 parallel", () => Promise.all(Array.from({ length: 12 }, (_, i) => session`select ${i}::int as n`)), 5000));
    } finally {
      await session.end({ timeout: 1 }).catch(() => {});
    }
  }
  steps.push(await step("pool: params", () => sql()`select ${5}::int as n, ${"2026-11-01"}::date as d`, 5000));
  return NextResponse.json({ sessionPooler: process.env.DATABASE_SESSION_POOLER === "1", steps }, { headers: { "cache-control": "no-store" } });
}
