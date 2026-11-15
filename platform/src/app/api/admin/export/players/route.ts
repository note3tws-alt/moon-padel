import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Exports players in the same column layout as the import template, so a round trip works. */
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const rows = await sql()`
    select p.player_code as "Player ID", p.full_name as "Player name", pp.email as "Email", pp.phone as "Phone number", p.country_code as "Country",
           p.nationality as "Nationality", p.photo_url as "Profile image URL", d.code as "Division", s.rating as "Current rating", p.base_rating as "Rating",
           p.base_points as "Points", p.base_tournaments as "Tournaments played", p.base_matches as "Matches played", p.base_wins as "Wins", p.base_losses as "Losses",
           p.playing_side as "Playing side", p.status as "Status", s.total_points as "Current total points", s.matches as "Current matches", s.wins as "Current wins", s.losses as "Current losses"
    from players p left join player_private pp on pp.player_id = p.id left join divisions d on d.id = p.division_id left join player_stats s on s.player_id = p.id
    order by p.player_code`;
  const csv = Papa.unparse(rows as unknown as Record<string, unknown>[]);
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="moonpadel-players-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
