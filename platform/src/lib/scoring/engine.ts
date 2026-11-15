/**
 * MoonPadel scoring engine.
 *
 * Pure and deterministic: given the raw league data (players, tournaments,
 * verified matches, adjustments, imported history) and a ruleset, it rebuilds
 * every derived number from scratch. Rebuilding instead of patching means an
 * edited or deleted score can never leave stale or double-counted totals.
 *
 * Rating methods live in ./rating.ts behind one interface, so an official
 * MoonPadel formula can be added without touching the rest of the engine.
 */
import { courtMultiplier, type ScoringConfig, type TieBreaker, type FinishKey } from "./config";
import { createRatingModel } from "./rating";

export type Id = string;

export interface EnginePlayer {
  id: Id;
  name: string;
  divisionId: number | null;
  baseRating: number | null;
  basePoints: number;
  baseTournaments: number;
  baseMatches: number;
  baseWins: number;
  baseLosses: number;
}
export interface EnginePair {
  id: Id;
  name: string;
  divisionId: number | null;
  memberIds: Id[];
}
export interface EngineTournament {
  id: Id;
  date: string; // YYYY-MM-DD
  divisionId: number | null;
  pairType: "fixed" | "non_fixed";
}
export interface EngineMatch {
  id: Id;
  tournamentId: Id;
  round: number;
  court: number;
  playedAt: string | null; // ISO timestamp, optional
  teamA: Id[];
  teamB: Id[];
  pairA: Id | null;
  pairB: Id | null;
  gamesA: number;
  gamesB: number;
  winner: "A" | "B" | "D";
}
export interface EngineRegistration {
  tournamentId: Id;
  playerId: Id;
  pairId: Id | null;
  positionOverride: number | null;
}
export interface EngineAdjustment {
  id: number;
  playerId: Id;
  effectiveAt: string;
  kind: "delta" | "set";
  value: number;
}
export interface EngineHistory {
  playerId: Id;
  month: string; // YYYY-MM-01
  divisionId: number | null;
  points: number;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  rating: number | null;
}

export interface EngineInput {
  config: ScoringConfig;
  now: Date;
  players: EnginePlayer[];
  pairs: EnginePair[];
  tournaments: EngineTournament[];
  matches: EngineMatch[]; // verified, completed, in published tournaments only
  registrations: EngineRegistration[];
  adjustments: EngineAdjustment[];
  history: EngineHistory[];
}

export interface RatingHistoryRow {
  playerId: Id;
  matchId: Id | null;
  tournamentId: Id | null;
  adjustmentId: number | null;
  ratedAt: string;
  before: number | null;
  after: number;
  delta: number;
}
export interface TournamentPointsRow {
  tournamentId: Id;
  entityType: "player" | "pair";
  playerId: Id | null;
  pairId: Id | null;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  gamesWon: number;
  gamesLost: number;
  winPoints: number;
  gamePoints: number;
  placementPoints: number;
  totalPoints: number;
  finalPosition: number | null;
}
export interface RankingRow {
  period: string | null; // YYYY-MM-01 or null for all-time
  mode: "individual" | "pair";
  divisionId: number | null;
  playerId: Id | null;
  pairId: Id | null;
  rank: number;
  points: number;
  rating: number | null;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  isChampion: boolean;
}
export interface PlayerStatsRow {
  playerId: Id;
  rating: number | null;
  ratingVisible: boolean;
  overallRank: number | null;
  divisionRank: number | null;
  totalPoints: number;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  titles: number;
  podiums: number;
  lastPlayed: string | null;
  ratingChange7d: number;
  ratingChange30d: number;
}
export interface PairStatsRow {
  pairId: Id;
  rating: number | null;
  overallRank: number | null;
  totalPoints: number;
  tournaments: number;
  matches: number;
  wins: number;
  losses: number;
  titles: number;
}
export interface EngineOutput {
  ratingHistory: RatingHistoryRow[];
  tournamentPoints: TournamentPointsRow[];
  rankings: RankingRow[];
  playerStats: PlayerStatsRow[];
  pairStats: PairStatsRow[];
  matchesProcessed: number;
}

const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const monthOf = (date: string) => `${date.slice(0, 7)}-01`;

/** Timestamp used to order a match: explicit time, else tournament date + round + court. */
function matchTime(m: EngineMatch, t: EngineTournament): string {
  if (m.playedAt) return new Date(m.playedAt).toISOString();
  const base = new Date(`${t.date}T00:00:00Z`).getTime();
  return new Date(base + m.round * 60_000 + m.court * 1000).toISOString();
}

interface Agg {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  gamesWon: number;
  gamesLost: number;
  winPoints: number;
  gamePoints: number;
}
const emptyAgg = (): Agg => ({ matches: 0, wins: 0, losses: 0, draws: 0, gamesWon: 0, gamesLost: 0, winPoints: 0, gamePoints: 0 });

function addResult(agg: Agg, cfg: ScoringConfig, court: number, gf: number, ga: number, result: "W" | "L" | "D") {
  const mult = courtMultiplier(cfg, court);
  agg.matches++;
  agg.gamesWon += gf;
  agg.gamesLost += ga;
  if (result === "W") { agg.wins++; agg.winPoints += cfg.points.win * mult; }
  else if (result === "L") { agg.losses++; agg.winPoints += cfg.points.loss * mult; }
  else { agg.draws++; agg.winPoints += cfg.points.draw * mult; }
  agg.gamePoints += gf * cfg.points.perGameWon * mult;
}

export function runEngine(input: EngineInput): EngineOutput {
  const { config: cfg, now } = input;
  const dec = cfg.rating.decimals;
  const tById = new Map(input.tournaments.map((t) => [t.id, t]));
  const playerById = new Map(input.players.map((p) => [p.id, p]));
  const pairById = new Map(input.pairs.map((p) => [p.id, p]));

  const matches = input.matches
    .filter((m) => tById.has(m.tournamentId))
    .map((m) => ({ m, t: tById.get(m.tournamentId)!, at: matchTime(m, tById.get(m.tournamentId)!) }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.m.round - b.m.round || a.m.court - b.m.court || (a.m.id < b.m.id ? -1 : 1)));

  // ---------------------------------------------------------------- ratings
  const playerModel = createRatingModel(cfg, (id) => playerById.get(id)?.baseRating ?? null);
  const pairModel = createRatingModel(cfg, () => null);
  const ratingHistory: RatingHistoryRow[] = [];

  type Event = { at: string; kind: "match"; item: (typeof matches)[number] } | { at: string; kind: "adj"; item: EngineAdjustment };
  const events: Event[] = [
    ...matches.map((item) => ({ at: item.at, kind: "match" as const, item })),
    ...input.adjustments
      .filter((a) => playerById.has(a.playerId))
      .map((item) => ({ at: new Date(item.effectiveAt).toISOString(), kind: "adj" as const, item })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === b.kind ? 0 : a.kind === "match" ? -1 : 1));

  for (const ev of events) {
    if (ev.kind === "adj") {
      const a = ev.item;
      const before = playerModel.get(a.playerId);
      const after = playerModel.adjust(a.playerId, a.kind, a.value);
      ratingHistory.push({ playerId: a.playerId, matchId: null, tournamentId: null, adjustmentId: a.id, ratedAt: ev.at, before: round(before, dec), after: round(after, dec), delta: round(after - before, dec) });
      continue;
    }
    const { m, t } = ev.item;
    const scoreA = m.winner === "A" ? 1 : m.winner === "B" ? 0 : 0.5;
    const changes = playerModel.rateMatch({ teamA: m.teamA, teamB: m.teamB, scoreA, gamesA: m.gamesA, gamesB: m.gamesB, at: ev.at });
    for (const c of changes) {
      ratingHistory.push({ playerId: c.id, matchId: m.id, tournamentId: t.id, adjustmentId: null, ratedAt: ev.at, before: round(c.before, dec), after: round(c.after, dec), delta: round(c.after - c.before, dec) });
    }
    if (t.pairType === "fixed" && m.pairA && m.pairB) {
      pairModel.rateMatch({ teamA: [m.pairA], teamB: [m.pairB], scoreA, gamesA: m.gamesA, gamesB: m.gamesB, at: ev.at });
    }
  }

  // ------------------------------------------------------- tournament points
  const tournamentPoints: TournamentPointsRow[] = [];
  const matchesByT = new Map<Id, EngineMatch[]>();
  for (const { m } of matches) {
    const list = matchesByT.get(m.tournamentId) ?? [];
    list.push(m);
    matchesByT.set(m.tournamentId, list);
  }
  const overrides = new Map<string, number>();
  for (const r of input.registrations) {
    if (r.positionOverride != null) {
      overrides.set(`player:${r.tournamentId}:${r.playerId}`, r.positionOverride);
      if (r.pairId) overrides.set(`pair:${r.tournamentId}:${r.pairId}`, r.positionOverride);
    }
  }

  for (const [tid, list] of matchesByT) {
    const t = tById.get(tid)!;
    const playerAgg = new Map<Id, Agg>();
    const pairAgg = new Map<Id, Agg>();
    for (const m of list) {
      const resA = m.winner === "A" ? "W" : m.winner === "B" ? "L" : "D";
      const resB = m.winner === "B" ? "W" : m.winner === "A" ? "L" : "D";
      for (const p of m.teamA) { const a = playerAgg.get(p) ?? emptyAgg(); addResult(a, cfg, m.court, m.gamesA, m.gamesB, resA); playerAgg.set(p, a); }
      for (const p of m.teamB) { const a = playerAgg.get(p) ?? emptyAgg(); addResult(a, cfg, m.court, m.gamesB, m.gamesA, resB); playerAgg.set(p, a); }
      if (t.pairType === "fixed") {
        if (m.pairA) { const a = pairAgg.get(m.pairA) ?? emptyAgg(); addResult(a, cfg, m.court, m.gamesA, m.gamesB, resA); pairAgg.set(m.pairA, a); }
        if (m.pairB) { const a = pairAgg.get(m.pairB) ?? emptyAgg(); addResult(a, cfg, m.court, m.gamesB, m.gamesA, resB); pairAgg.set(m.pairB, a); }
      }
    }
    const pairOf = new Map<Id, Id>();
    if (t.pairType === "fixed") {
      for (const m of list) {
        if (m.pairA) m.teamA.forEach((p) => pairOf.set(p, m.pairA!));
        if (m.pairB) m.teamB.forEach((p) => pairOf.set(p, m.pairB!));
      }
    }

    const finish = (entries: [Id, Agg][], ratingOf: (id: Id) => number, kind: "player" | "pair") => {
      const sorted = [...entries].sort((x, y) => compareFinish(x[1], y[1], ratingOf(x[0]), ratingOf(y[0]), cfg.tournament.finishOrder) || (x[0] < y[0] ? -1 : 1));
      const pos = new Map<Id, number>();
      sorted.forEach(([id], i) => pos.set(id, i + 1));
      for (const [id] of sorted) {
        const o = overrides.get(`${kind}:${tid}:${id}`);
        if (o != null) pos.set(id, o);
      }
      return pos;
    };

    // In fixed-pair events the pair finish decides each member's finish.
    const pairPos = t.pairType === "fixed" ? finish([...pairAgg.entries()], (id) => pairModel.get(id), "pair") : new Map<Id, number>();
    const playerPos =
      t.pairType === "fixed"
        ? new Map([...playerAgg.keys()].map((p) => [p, overrides.get(`player:${tid}:${p}`) ?? pairPos.get(pairOf.get(p) ?? "") ?? null] as [Id, number | null]))
        : finish([...playerAgg.entries()], (id) => playerModel.get(id), "player");

    const mk = (entityType: "player" | "pair", id: Id, a: Agg, position: number | null): TournamentPointsRow => {
      const placement = position != null ? cfg.points.placement[position - 1] ?? 0 : 0;
      const total = a.winPoints + a.gamePoints + placement + cfg.points.participation;
      return {
        tournamentId: tid, entityType, playerId: entityType === "player" ? id : null, pairId: entityType === "pair" ? id : null,
        matches: a.matches, wins: a.wins, losses: a.losses, draws: a.draws, gamesWon: a.gamesWon, gamesLost: a.gamesLost,
        winPoints: round(a.winPoints), gamePoints: round(a.gamePoints), placementPoints: round(placement), totalPoints: round(total),
        finalPosition: position,
      };
    };
    for (const [id, a] of playerAgg) tournamentPoints.push(mk("player", id, a, playerPos.get(id) ?? null));
    for (const [id, a] of pairAgg) tournamentPoints.push(mk("pair", id, a, pairPos.get(id) ?? null));
  }

  // ------------------------------------------------------- rating snapshots
  const historyByPlayer = new Map<Id, RatingHistoryRow[]>();
  for (const r of ratingHistory) {
    const l = historyByPlayer.get(r.playerId) ?? [];
    l.push(r);
    historyByPlayer.set(r.playerId, l);
  }
  const ratingAt = (playerId: Id, iso: string): number | null => {
    const l = historyByPlayer.get(playerId);
    const base = playerById.get(playerId)?.baseRating ?? null;
    if (!l || l.length === 0) return base;
    let val: number | null = l[0].before ?? base;
    for (const r of l) { if (r.ratedAt <= iso) val = r.after; else break; }
    return val;
  };
  const currentRating = (playerId: Id): number | null => {
    const l = historyByPlayer.get(playerId);
    if (l && l.length) return l[l.length - 1].after;
    return playerById.get(playerId)?.baseRating ?? (cfg.rating.method === "manual" ? null : null);
  };

  // ------------------------------------------------------------- standings
  const nowMonth = monthOf(now.toISOString().slice(0, 10));
  const months = new Set<string>([nowMonth]);
  for (const t of input.tournaments) if (matchesByT.has(t.id)) months.add(monthOf(t.date));
  for (const h of input.history) months.add(h.month);

  const divisions = [...new Set([...input.tournaments.map((t) => t.divisionId), ...input.players.map((p) => p.divisionId), ...input.history.map((h) => h.divisionId)].filter((d): d is number => d != null))];
  const scopes: (number | null)[] = [null, ...divisions];

  type Entry = { points: number; tournaments: number; matches: number; wins: number; losses: number; gameDiff: number; isTournament: boolean };
  const rankings: RankingRow[] = [];

  const tpPlayer = tournamentPoints.filter((r) => r.entityType === "player" && (cfg.standings.individualIncludesFixedPairs || tById.get(r.tournamentId)!.pairType === "non_fixed"));
  const tpPair = tournamentPoints.filter((r) => r.entityType === "pair");

  const buildBoard = (
    mode: "individual" | "pair",
    period: string | null,
    scope: number | null,
  ) => {
    const bestN = period ? cfg.standings.bestTournamentsMonthly : cfg.standings.bestTournamentsAllTime;
    const entries = new Map<Id, Entry[]>();
    const push = (id: Id, e: Entry) => { const l = entries.get(id) ?? []; l.push(e); entries.set(id, l); };
    const source = mode === "individual" ? tpPlayer : tpPair;
    for (const r of source) {
      const t = tById.get(r.tournamentId)!;
      if (period && monthOf(t.date) !== period) continue;
      if (scope != null && t.divisionId !== scope) continue;
      push((mode === "individual" ? r.playerId : r.pairId)!, { points: r.totalPoints, tournaments: 1, matches: r.matches, wins: r.wins, losses: r.losses, gameDiff: r.gamesWon - r.gamesLost, isTournament: true });
    }
    if (mode === "individual") {
      for (const h of input.history) {
        if (!playerById.has(h.playerId)) continue;
        if (period && h.month !== period) continue;
        if (scope != null && h.divisionId !== scope) continue;
        push(h.playerId, { points: h.points, tournaments: h.tournaments, matches: h.matches, wins: h.wins, losses: h.losses, gameDiff: 0, isTournament: false });
      }
      if (!period) {
        for (const p of input.players) {
          if (scope != null && p.divisionId !== scope) continue;
          if (p.basePoints || p.baseTournaments || p.baseMatches) {
            push(p.id, { points: p.basePoints, tournaments: p.baseTournaments, matches: p.baseMatches, wins: p.baseWins, losses: p.baseLosses, gameDiff: 0, isTournament: false });
          }
        }
      }
    }
    const periodEnd = period ? endOfMonthIso(period) : now.toISOString();
    const rows = [...entries.entries()].map(([id, list]) => {
      const tourn = list.filter((e) => e.isTournament).sort((a, b) => b.points - a.points);
      const counted = bestN > 0 ? tourn.slice(0, bestN) : tourn;
      const extra = list.filter((e) => !e.isTournament);
      const sum = (k: keyof Entry) => list.reduce((s, e) => s + (e[k] as number), 0);
      const points = counted.reduce((s, e) => s + e.points, 0) + extra.reduce((s, e) => s + e.points, 0);
      const rating =
        mode === "individual"
          ? (period && period !== nowMonth ? ratingAt(id, periodEnd) : currentRating(id))
          : pairModel.has(id) ? pairModel.get(id) : null;
      return { id, points: round(points), tournaments: sum("tournaments"), matches: sum("matches"), wins: sum("wins"), losses: sum("losses"), gameDiff: sum("gameDiff"), rating: rating == null ? null : round(rating, dec), name: mode === "individual" ? playerById.get(id)?.name ?? "" : pairById.get(id)?.name ?? "" };
    });
    const ranked = rankRows(rows, cfg.standings.tieBreakers);
    for (const r of ranked) {
      rankings.push({
        period, mode, divisionId: scope, playerId: mode === "individual" ? r.id : null, pairId: mode === "pair" ? r.id : null,
        rank: r.rank, points: r.points, rating: r.rating, tournaments: r.tournaments, matches: r.matches, wins: r.wins, losses: r.losses,
        isChampion: period != null && period < nowMonth && r.rank === 1 && r.points > 0,
      });
    }
  };

  for (const period of [...months].sort()) for (const scope of scopes) { buildBoard("individual", period, scope); buildBoard("pair", period, scope); }
  for (const scope of scopes) { buildBoard("individual", null, scope); buildBoard("pair", null, scope); }

  // ------------------------------------------------------------ player stats
  const allTimeOverall = new Map(rankings.filter((r) => r.mode === "individual" && r.period == null && r.divisionId == null).map((r) => [r.playerId!, r]));
  const allTimeByDiv = new Map(rankings.filter((r) => r.mode === "individual" && r.period == null && r.divisionId != null).map((r) => [`${r.divisionId}:${r.playerId}`, r]));
  const playerTp = new Map<Id, TournamentPointsRow[]>();
  for (const r of tournamentPoints) if (r.entityType === "player") { const l = playerTp.get(r.playerId!) ?? []; l.push(r); playerTp.set(r.playerId!, l); }

  const iso7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const iso30 = new Date(now.getTime() - 30 * 86400_000).toISOString();

  const playerStats: PlayerStatsRow[] = input.players.map((p) => {
    const tps = playerTp.get(p.id) ?? [];
    const matchesN = tps.reduce((s, r) => s + r.matches, 0);
    const wins = tps.reduce((s, r) => s + r.wins, 0);
    const losses = tps.reduce((s, r) => s + r.losses, 0);
    const draws = tps.reduce((s, r) => s + r.draws, 0);
    const titles = tps.filter((r) => r.finalPosition === 1).length;
    const podiums = tps.filter((r) => r.finalPosition != null && r.finalPosition <= 3).length;
    const lastPlayed = tps.map((r) => tById.get(r.tournamentId)!.date).sort().pop() ?? null;
    const rating = currentRating(p.id);
    const totalMatches = matchesN + p.baseMatches;
    const totalTournaments = tps.length + p.baseTournaments;
    const r7 = ratingAt(p.id, iso7);
    const r30 = ratingAt(p.id, iso30);
    const overall = allTimeOverall.get(p.id);
    const divRank = p.divisionId != null ? allTimeByDiv.get(`${p.divisionId}:${p.id}`) : undefined;
    return {
      playerId: p.id,
      rating: rating == null ? null : round(rating, dec),
      ratingVisible: rating != null && totalMatches >= cfg.rating.visibleAfterMatches && totalTournaments >= cfg.rating.visibleAfterTournaments,
      overallRank: overall?.rank ?? null,
      divisionRank: divRank?.rank ?? null,
      totalPoints: overall?.points ?? 0,
      tournaments: totalTournaments,
      matches: totalMatches,
      wins: wins + p.baseWins,
      losses: losses + p.baseLosses,
      draws,
      titles,
      podiums,
      lastPlayed,
      ratingChange7d: rating != null && r7 != null ? round(rating - r7, dec) : 0,
      ratingChange30d: rating != null && r30 != null ? round(rating - r30, dec) : 0,
    };
  });

  // -------------------------------------------------------------- pair stats
  const pairAllTime = new Map(rankings.filter((r) => r.mode === "pair" && r.period == null && r.divisionId == null).map((r) => [r.pairId!, r]));
  const pairStats: PairStatsRow[] = input.pairs.map((p) => {
    const tps = tpPair.filter((r) => r.pairId === p.id);
    const at = pairAllTime.get(p.id);
    return {
      pairId: p.id,
      rating: pairModel.has(p.id) ? round(pairModel.get(p.id), dec) : null,
      overallRank: at?.rank ?? null,
      totalPoints: at?.points ?? 0,
      tournaments: tps.length,
      matches: tps.reduce((s, r) => s + r.matches, 0),
      wins: tps.reduce((s, r) => s + r.wins, 0),
      losses: tps.reduce((s, r) => s + r.losses, 0),
      titles: tps.filter((r) => r.finalPosition === 1).length,
    };
  });

  return { ratingHistory, tournamentPoints, rankings, playerStats, pairStats, matchesProcessed: matches.length };
}

function endOfMonthIso(period: string): string {
  const d = new Date(`${period}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return new Date(d.getTime() - 1).toISOString();
}

function compareFinish(a: Agg, b: Agg, ra: number, rb: number, order: FinishKey[]): number {
  for (const k of order) {
    let d = 0;
    if (k === "winPoints") d = b.winPoints - a.winPoints;
    else if (k === "totalPoints") d = b.winPoints + b.gamePoints - (a.winPoints + a.gamePoints);
    else if (k === "gameDiff") d = b.gamesWon - b.gamesLost - (a.gamesWon - a.gamesLost);
    else if (k === "gamesWon") d = b.gamesWon - a.gamesWon;
    else if (k === "wins") d = b.wins - a.wins;
    else if (k === "rating") d = rb - ra;
    if (Math.abs(d) > 1e-9) return d;
  }
  return 0;
}

interface Rankable { id: string; name: string; points: number; wins: number; losses: number; matches: number; tournaments: number; gameDiff: number; rating: number | null }

function tieValue(r: Rankable, k: TieBreaker): number {
  switch (k) {
    case "points": return r.points;
    case "wins": return r.wins;
    case "winPct": return r.matches > 0 ? r.wins / r.matches : 0;
    case "gameDiff": return r.gameDiff;
    case "rating": return r.rating ?? -Infinity;
    case "fewerTournaments": return -r.tournaments;
    case "moreTournaments": return r.tournaments;
  }
}

/** Standard competition ranking (1, 2, 2, 4). Rows tied on every tie-breaker share a rank. */
export function rankRows<T extends Rankable>(rows: T[], tieBreakers: TieBreaker[]): (T & { rank: number })[] {
  const keys: TieBreaker[] = tieBreakers.includes("points") ? tieBreakers : ["points", ...tieBreakers];
  const cmp = (a: T, b: T) => {
    for (const k of keys) {
      const d = tieValue(b, k) - tieValue(a, k);
      if (Number.isFinite(d) ? Math.abs(d) > 1e-9 : tieValue(a, k) !== tieValue(b, k)) return d > 0 || (!Number.isFinite(d) && tieValue(b, k) > tieValue(a, k)) ? 1 : -1;
    }
    return 0;
  };
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1));
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => {
    const rank = i > 0 && cmp(sorted[i - 1], r) === 0 ? out[i - 1].rank : i + 1;
    out.push({ ...r, rank });
  });
  return out;
}
