import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lifetime points and milestone medals per player. */
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const rows = await sql()`
    select p.player_code as "Player ID", p.full_name as "Player", st.code as "Level",
      coalesce((select sum(points) from player_points_ledger l where l.player_id = p.id), 0)::int as "Lifetime points",
      (select count(*) from ladder_results r where r.player_id = p.id)::int as "Events",
      (select string_agg(t.name || case when m.issued_at is null then ' (to hand over)' else ' (handed over)' end, '; ' order by t.threshold)
         from player_medals m join medal_tiers t on t.id = m.medal_tier_id where m.player_id = p.id) as "Milestone medals"
    from players p left join skill_tiers st on st.id = p.skill_tier_id order by 4 desc, p.full_name`;
  const csv = Papa.unparse(rows as unknown as Record<string, unknown>[]);
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="moonpadel-medals-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
