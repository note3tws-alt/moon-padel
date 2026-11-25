import "server-only";
import { sql } from "../db";
import { buildLiveState } from "./live";
import { loadBundle } from "./service";

/** Everything an organiser needs to audit an event, as plain rows. */
export async function eventReport(id: string) {
  const db = sql();
  const b = await loadBundle(db, id);
  const s = buildLiveState(b, "admin");
  const codes = new Map(b.participants.map((p) => [p.player_id, p.player_code]));
  const name = (pid: string) => b.participants.find((p) => p.player_id === pid)?.full_name ?? pid;
  const totals = s.standings.map((r) => ({
    Rank: r.rank, "Player ID": codes.get(r.playerId), Player: r.name,
    Level: b.participants.find((p) => p.player_id === r.playerId)?.tier_code ?? "",
    ...Object.fromEntries(r.rounds.map((g, i) => [`R${i + 1}`, g ?? ""])),
    Wins: r.wins, "Game diff": r.diff, Total: r.total,
    Medal: s.podium.ready ? s.podium.places.find((p) => p.playerId === r.playerId)?.medal ?? "" : "",
  }));
  const matches = b.matches.map((m) => ({
    Round: m.round_no, Court: m.court_no,
    "Team 1": m.team1.map(name).join(" + "), "Team 2": m.team2.map(name).join(" + "),
    "Team 1 games": m.team1_games ?? "", "Team 2 games": m.team2_games ?? "",
    "Moved up (tie)": m.advancing ? `Team ${m.advancing}` : "", Status: m.status,
    "Submitted by team": m.submitted_by_team ?? "", "Confirmed by": m.confirmed_by ?? "",
    "Confirmed at": m.confirmed_at ? new Date(m.confirmed_at).toISOString() : "",
  }));
  const audit = (await db`select created_at, action, actor, reason, old_value, new_value from ladder_score_log where event_id = ${id} order by created_at`).map((l) => ({
    Time: new Date(l.created_at).toISOString(), Action: l.action, Actor: l.actor, Reason: l.reason ?? "",
    Before: l.old_value ? JSON.stringify(l.old_value) : "", After: l.new_value ? JSON.stringify(l.new_value) : "",
  }));
  return { bundle: b, state: s, totals, matches, audit };
}
