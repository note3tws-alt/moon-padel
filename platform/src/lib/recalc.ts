import { sql, type Tx } from "./db";
import { parseScoringConfig, type ScoringConfig } from "./scoring/config";
import { runEngine, type EngineInput } from "./scoring/engine";

export async function loadActiveConfig(db: Tx | ReturnType<typeof sql> = sql()): Promise<{ id: number | null; name: string; config: ScoringConfig }> {
  const [row] = await db`select id, name, config from scoring_settings where is_active limit 1`;
  if (!row) return { id: null, name: "Defaults", config: parseScoringConfig({}) };
  return { id: row.id, name: row.name, config: parseScoringConfig(row.config) };
}

async function loadInput(tx: Tx, now: Date): Promise<EngineInput> {
  const { config } = await loadActiveConfig(tx);
  const players = await tx`select id, full_name, division_id, base_rating, base_points, base_tournaments, base_matches, base_wins, base_losses from players`;
  const pairs = await tx`select p.id, p.name, p.division_id, coalesce(array_agg(pm.player_id order by pm.position) filter (where pm.player_id is not null), '{}') as members
                         from pairs p left join pair_members pm on pm.pair_id = p.id group by p.id`;
  const tournaments = await tx`select id, tournament_date, division_id, pair_type from tournaments where results_published and status <> 'cancelled'`;
  const matches = await tx`
    select m.id, m.tournament_id, m.round_number, m.court_number, m.match_date, m.team_a_pair_id, m.team_b_pair_id,
           m.team_a_games, m.team_b_games, m.winner,
           coalesce(array_agg(mp.player_id) filter (where mp.team = 'A'), '{}') as team_a,
           coalesce(array_agg(mp.player_id) filter (where mp.team = 'B'), '{}') as team_b
    from matches m
    join tournaments t on t.id = m.tournament_id and t.results_published and t.status <> 'cancelled'
    join match_players mp on mp.match_id = m.id
    where m.status = 'completed' and m.verified and m.winner is not null
    group by m.id`;
  const registrations = await tx`select tournament_id, player_id, pair_id, final_position_override from tournament_registrations where status = 'registered'`;
  const adjustments = await tx`select id, player_id, effective_at, kind, value from rating_adjustments`;
  const history = await tx`select player_id, month, division_id, points, tournaments, matches, wins, losses, rating from historical_monthly_stats`;
  return {
    config,
    now,
    players: players.map((p) => ({
      id: p.id, name: p.full_name, divisionId: p.division_id, baseRating: p.base_rating, basePoints: p.base_points,
      baseTournaments: p.base_tournaments, baseMatches: p.base_matches, baseWins: p.base_wins, baseLosses: p.base_losses,
    })),
    pairs: pairs.map((p) => ({ id: p.id, name: p.name, divisionId: p.division_id, memberIds: p.members })),
    tournaments: tournaments.map((t) => ({ id: t.id, date: t.tournament_date, divisionId: t.division_id, pairType: t.pair_type })),
    matches: matches.map((m) => ({
      id: m.id, tournamentId: m.tournament_id, round: m.round_number, court: m.court_number,
      playedAt: m.match_date ? new Date(m.match_date).toISOString() : null,
      teamA: m.team_a, teamB: m.team_b, pairA: m.team_a_pair_id, pairB: m.team_b_pair_id,
      gamesA: m.team_a_games, gamesB: m.team_b_games, winner: m.winner,
    })),
    registrations: registrations.map((r) => ({ tournamentId: r.tournament_id, playerId: r.player_id, pairId: r.pair_id, positionOverride: r.final_position_override })),
    adjustments: adjustments.map((a) => ({ id: Number(a.id), playerId: a.player_id, effectiveAt: new Date(a.effective_at).toISOString(), kind: a.kind, value: a.value })),
    history: history.map((h) => ({ playerId: h.player_id, month: h.month, divisionId: h.division_id, points: h.points, tournaments: h.tournaments, matches: h.matches, wins: h.wins, losses: h.losses, rating: h.rating })),
  };
}

async function insertChunks<T extends Record<string, unknown>>(tx: Tx, table: string, rows: T[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await tx`insert into ${tx(table)} ${tx(chunk as never)}`;
  }
}

/**
 * Rebuilds every derived table inside the given transaction (or a new one).
 * A transaction-level advisory lock stops two recalculations running at once.
 */
export async function recalculateAll(trigger: string, existingTx?: Tx) {
  const run = async (tx: Tx) => {
    await tx`select pg_advisory_xact_lock(424242)`;
    const now = new Date();
    const input = await loadInput(tx, now);
    const out = runEngine(input);
    await tx`delete from monthly_rankings`;
    await tx`delete from tournament_points`;
    await tx`delete from player_rating_history`;
    await tx`delete from player_stats`;
    await tx`delete from pair_stats`;
    await insertChunks(tx, "player_rating_history", out.ratingHistory.map((r) => ({
      player_id: r.playerId, match_id: r.matchId, tournament_id: r.tournamentId, adjustment_id: r.adjustmentId,
      rated_at: r.ratedAt, rating_before: r.before, rating_after: r.after, delta: r.delta,
    })));
    await insertChunks(tx, "tournament_points", out.tournamentPoints.map((r) => ({
      tournament_id: r.tournamentId, entity_type: r.entityType, player_id: r.playerId, pair_id: r.pairId,
      matches: r.matches, wins: r.wins, losses: r.losses, draws: r.draws, games_won: r.gamesWon, games_lost: r.gamesLost,
      win_points: r.winPoints, game_points: r.gamePoints, placement_points: r.placementPoints, total_points: r.totalPoints, final_position: r.finalPosition,
    })));
    await insertChunks(tx, "monthly_rankings", out.rankings.map((r) => ({
      period: r.period, mode: r.mode, division_id: r.divisionId, player_id: r.playerId, pair_id: r.pairId, rank: r.rank,
      points: r.points, rating: r.rating, tournaments: r.tournaments, matches: r.matches, wins: r.wins, losses: r.losses,
      is_champion: r.isChampion, computed_at: now,
    })));
    await insertChunks(tx, "player_stats", out.playerStats.map((s) => ({
      player_id: s.playerId, rating: s.rating, rating_visible: s.ratingVisible, overall_rank: s.overallRank, division_rank: s.divisionRank,
      total_points: s.totalPoints, tournaments: s.tournaments, matches: s.matches, wins: s.wins, losses: s.losses, draws: s.draws,
      titles: s.titles, podiums: s.podiums, last_played: s.lastPlayed, rating_change_7d: s.ratingChange7d, rating_change_30d: s.ratingChange30d, computed_at: now,
    })));
    await insertChunks(tx, "pair_stats", out.pairStats.map((s) => ({
      pair_id: s.pairId, rating: s.rating, overall_rank: s.overallRank, total_points: s.totalPoints, tournaments: s.tournaments,
      matches: s.matches, wins: s.wins, losses: s.losses, titles: s.titles, computed_at: now,
    })));
    await tx`insert into recalc_runs (trigger, started_at, finished_at, matches_processed, ok) values (${trigger}, ${now}, now(), ${out.matchesProcessed}, true)`;
    return { matchesProcessed: out.matchesProcessed, players: out.playerStats.length, rankings: out.rankings.length };
  };
  if (existingTx) return run(existingTx);
  return sql().begin(run);
}
