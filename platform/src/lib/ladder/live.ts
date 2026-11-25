import "server-only";
import { sql } from "../db";
import { allRoundsLocked, loadBundle, podiumOf, standingsOf, upcomingRound, type Bundle } from "./service";
import { roundBlockers } from "./engine";
import { toCourtResult } from "./service";

export type LiveAccess = "kiosk" | "tv" | "public" | "admin";

/** Shape sent to the kiosk, TV, public live page and admin. Public fields only: never phone numbers, PINs or notes. */
export interface LiveState {
  version: number;
  serverTime: number;
  access: LiveAccess;
  event: {
    id: string; slug: string; title: string; venue: string | null; date: string; startTime: string | null;
    courts: number; rounds: number; roundMinutes: number; cap: number; state: string; currentRound: number;
    roundEndsAt: number | null; pausedRemaining: number | null; tieRule: string; requirePin: boolean;
    tvMode: string; tvCycleSeconds: number; upcomingRound: number | null; allLocked: boolean;
  };
  players: { id: string; name: string; tier: string | null; checkedIn: boolean; checkedInAt: number | null }[];
  rounds: {
    round: number;
    courts: {
      id: string; court: number; team1: string[]; team2: string[]; status: string;
      team1Games: number | null; team2Games: number | null; advancing: number | null; submittedByTeam: number | null; revision: number;
    }[];
    blockers: { court: number; reason: string }[];
  }[];
  standings: { playerId: string; name: string; rank: number; rounds: (number | null)[]; total: number; wins: number; diff: number; tied: boolean }[];
  provisional: { playerId: string; total: number }[];
  podium: { ready: boolean; reason?: string; places: { medal: string; playerId: string; name: string; total: number }[] };
}

export async function findEventByToken(token: string): Promise<{ id: string; access: LiveAccess } | null> {
  if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
  const [row] = await sql()`select id, case when kiosk_token = ${token} then 'kiosk' else 'tv' end as access
                            from ladder_events where kiosk_token = ${token} or tv_token = ${token}`;
  return row ? { id: row.id, access: row.access } : null;
}

export async function findPublicEvent(slug: string): Promise<string | null> {
  const [row] = await sql()`select id from ladder_events where slug = ${slug} and is_public and state <> 'draft'`;
  return row?.id ?? null;
}

export async function eventVersion(id: string): Promise<number | null> {
  const [row] = await sql()`select version from ladder_events where id = ${id}`;
  return row ? Number(row.version) : null;
}

export function buildLiveState(b: Bundle, access: LiveAccess): LiveState {
  const e = b.event;
  const names = new Map(b.participants.map((p) => [p.player_id, p.full_name]));
  const roundsMap = new Map<number, LiveState["rounds"][number]>();
  for (const m of b.matches) {
    if (!roundsMap.has(m.round_no)) roundsMap.set(m.round_no, { round: m.round_no, courts: [], blockers: [] });
    roundsMap.get(m.round_no)!.courts.push({
      id: m.id, court: m.court_no, team1: m.team1, team2: m.team2, status: m.status,
      team1Games: m.team1_games, team2Games: m.team2_games, advancing: m.advancing, submittedByTeam: m.submitted_by_team, revision: m.revision,
    });
  }
  const rounds = [...roundsMap.values()].sort((a, b) => a.round - b.round);
  for (const r of rounds) {
    const ms = b.matches.filter((m) => m.round_no === r.round);
    r.blockers = ms.some((m) => ["scheduled", "live"].includes(m.status)) ? [] : roundBlockers(ms.map(toCourtResult));
  }
  const standings = standingsOf(b);
  const provisional = standingsOf(b, false).map((s) => ({ playerId: s.playerId, total: s.total }));
  return {
    version: Number(e.version),
    serverTime: Date.now(),
    access,
    event: {
      id: e.id, slug: e.slug, title: e.title, venue: e.club_name ?? e.venue_name, date: e.event_date, startTime: e.start_time,
      courts: e.court_count, rounds: e.round_count, roundMinutes: e.round_minutes, cap: e.player_cap, state: e.state, currentRound: e.current_round,
      roundEndsAt: e.round_ends_at ? new Date(e.round_ends_at).getTime() : null, pausedRemaining: e.paused_remaining_seconds,
      tieRule: e.tie_rule, requirePin: e.require_pin, tvMode: e.tv_mode, tvCycleSeconds: e.tv_cycle_seconds,
      upcomingRound: upcomingRound(b), allLocked: allRoundsLocked(b),
    },
    players: b.participants.filter((p) => p.status === "confirmed").map((p) => ({
      id: p.player_id, name: names.get(p.player_id)!, tier: p.tier_code, checkedIn: Boolean(p.checked_in_at),
      checkedInAt: p.checked_in_at ? new Date(p.checked_in_at).getTime() : null,
    })),
    rounds,
    standings: standings.map((s) => ({ playerId: s.playerId, name: s.name, rank: s.rank, rounds: s.rounds, total: s.total, wins: s.wins, diff: s.diff, tied: s.tied })),
    provisional,
    podium: podiumOf(b),
  };
}

export async function getLiveState(eventId: string, access: LiveAccess): Promise<LiveState> {
  const b = await loadBundle(sql(), eventId);
  return buildLiveState(b, access);
}
