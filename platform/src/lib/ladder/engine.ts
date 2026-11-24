/**
 * MoonPadel Ladder Americano engine.
 *
 * Pure functions, no database. 4 players per court, partners rotate every
 * round, the winning pair of each court moves up and the losing pair moves
 * down (adjacent-court ladder), and each player is credited with the games
 * their own team won.
 *
 * Movement after a fully completed round (N courts, court 1 = top):
 *   Court 1      : W1 + W2
 *   Court k      : L(k-1) + W(k+1)      for 1 < k < N
 *   Court N      : L(N-1) + LN
 * With 4 courts this is the matrix on page 6 of the brief.
 */

export type TeamIndex = 1 | 2;
export type Pair = [string, string];

export interface LadderPlayer {
  id: string;
  name: string;
  /** Skill tier order: 1 = strongest. Players without a tier sort last. */
  tierOrder: number | null;
}

export interface CourtAssignment {
  court: number;
  team1: Pair;
  team2: Pair;
}

export interface CourtResult extends CourtAssignment {
  team1Games: number | null;
  team2Games: number | null;
  /** Set by the admin (or golden point) when the games are level. */
  advancing?: TeamIndex | null;
  /** True once the score is the one official, confirmed result. */
  confirmed: boolean;
}

export interface RoundInput {
  round: number;
  courts: CourtResult[];
}

export class LadderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "LadderError";
  }
}

// ---------------------------------------------------------------------------
// Random numbers: seeded so a draw can be reproduced in tests.
// ---------------------------------------------------------------------------
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Round 1 seeding.
// ---------------------------------------------------------------------------

/**
 * Level-aware first draw: strongest tier on court 1, least experienced on the
 * last court, random order within a tier. Inside each court the strongest and
 * weakest player partner against the middle two, so teams start balanced.
 */
export function seedFirstRound(players: LadderPlayer[], courtCount: number, rand: () => number = Math.random): CourtAssignment[] {
  assertRoster(players, courtCount);
  const byTier = new Map<number, LadderPlayer[]>();
  for (const p of players) {
    const t = p.tierOrder ?? Number.MAX_SAFE_INTEGER;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(p);
  }
  const ordered = [...byTier.keys()].sort((a, b) => a - b).flatMap((t) => shuffle(byTier.get(t)!, rand));
  const courts: CourtAssignment[] = [];
  for (let c = 0; c < courtCount; c++) {
    const g = ordered.slice(c * 4, c * 4 + 4);
    courts.push({ court: c + 1, team1: [g[0].id, g[3].id], team2: [g[1].id, g[2].id] });
  }
  return courts;
}

function assertRoster(players: LadderPlayer[], courtCount: number) {
  if (courtCount < 1) throw new LadderError("An event needs at least one court.", "courts");
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) throw new LadderError("The same player is on the roster twice.", "duplicate");
  if (players.length !== courtCount * 4) {
    throw new LadderError(
      `This event needs exactly ${courtCount * 4} checked-in players for ${courtCount} courts, but has ${players.length}. Replace a no-show, wait, or change the capacity before drawing courts.`,
      "roster_size",
    );
  }
}

// ---------------------------------------------------------------------------
// Results.
// ---------------------------------------------------------------------------

export function isValidScore(g: number | null | undefined): g is number {
  return typeof g === "number" && Number.isInteger(g) && g >= 0 && g <= 99;
}

/** Winning team of a court, or null when the games are level and nobody has been chosen to advance. */
export function winnerOf(r: Pick<CourtResult, "team1Games" | "team2Games" | "advancing">): TeamIndex | null {
  if (!isValidScore(r.team1Games) || !isValidScore(r.team2Games)) return null;
  if (r.team1Games > r.team2Games) return 1;
  if (r.team2Games > r.team1Games) return 2;
  return r.advancing ?? null;
}

export interface RoundBlocker {
  court: number;
  reason: "missing" | "unconfirmed" | "tie";
}

/** Everything that stops a round from being locked. An empty list means it can lock. */
export function roundBlockers(courts: CourtResult[]): RoundBlocker[] {
  const out: RoundBlocker[] = [];
  for (const c of [...courts].sort((a, b) => a.court - b.court)) {
    if (!isValidScore(c.team1Games) || !isValidScore(c.team2Games)) out.push({ court: c.court, reason: "missing" });
    else if (!c.confirmed) out.push({ court: c.court, reason: "unconfirmed" });
    else if (winnerOf(c) === null) out.push({ court: c.court, reason: "tie" });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Movement and partner reshuffle.
// ---------------------------------------------------------------------------

export interface History {
  /** "a|b" (sorted) -> times partnered */
  partners: Map<string, number>;
  /** "a|b" (sorted) -> times opposed */
  opponents: Map<string, number>;
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildHistory(rounds: { courts: CourtAssignment[] }[]): History {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of rounds) {
    for (const c of r.courts) {
      bump(partners, key(...c.team1));
      bump(partners, key(...c.team2));
      for (const a of c.team1) for (const b of c.team2) bump(opponents, key(a, b));
    }
  }
  return { partners, opponents };
}

/**
 * Split four players who arrived as two pairs into two new teams.
 * Rules: never keep an arriving pair together when another split exists;
 * then fewest repeat partners across the event; then fewest repeat opponents.
 * Ties keep the listed order, so A,B (+) E,F becomes A+E vs B+F.
 */
export function remixCourt(incomingA: Pair, incomingB: Pair, history: History): { team1: Pair; team2: Pair } {
  const [p, q] = incomingA;
  const [r, s] = incomingB;
  const options: { team1: Pair; team2: Pair; keepsPair: boolean }[] = [
    { team1: [p, r], team2: [q, s], keepsPair: false },
    { team1: [p, s], team2: [q, r], keepsPair: false },
    { team1: [p, q], team2: [r, s], keepsPair: true },
  ];
  const cost = (o: (typeof options)[number]) => {
    const partnerRepeats = (history.partners.get(key(...o.team1)) ?? 0) + (history.partners.get(key(...o.team2)) ?? 0);
    let opponentRepeats = 0;
    for (const a of o.team1) for (const b of o.team2) opponentRepeats += history.opponents.get(key(a, b)) ?? 0;
    return [o.keepsPair ? 1 : 0, partnerRepeats, opponentRepeats];
  };
  let best = options[0];
  let bestCost = cost(best);
  for (const o of options.slice(1)) {
    const c = cost(o);
    for (let i = 0; i < c.length; i++) {
      if (c[i] < bestCost[i]) { best = o; bestCost = c; break; }
      if (c[i] > bestCost[i]) break;
    }
  }
  return { team1: best.team1, team2: best.team2 };
}

/**
 * Next round's courts from a fully completed round. Throws when any court is
 * missing a score, is unconfirmed, or is tied without an advancing pair.
 */
export function nextRound(current: RoundInput, previousRounds: { courts: CourtAssignment[] }[] = []): CourtAssignment[] {
  const blockers = roundBlockers(current.courts);
  if (blockers.length) {
    const b = blockers[0];
    const msg = b.reason === "tie"
      ? `Court ${b.court} is tied. Choose the pair that moves up (or play golden point) before the next round.`
      : b.reason === "unconfirmed"
        ? `Court ${b.court} has a score waiting for confirmation.`
        : `Court ${b.court} has no score yet.`;
    throw new LadderError(msg, b.reason);
  }
  const courts = [...current.courts].sort((a, b) => a.court - b.court);
  const n = courts.length;
  const W: Pair[] = [];
  const L: Pair[] = [];
  for (const c of courts) {
    const w = winnerOf(c)!;
    W.push(w === 1 ? c.team1 : c.team2);
    L.push(w === 1 ? c.team2 : c.team1);
  }
  const history = buildHistory([...previousRounds, { courts }]);
  const groups: [Pair, Pair][] = [];
  if (n === 1) groups.push([W[0], L[0]]);
  else {
    for (let k = 0; k < n; k++) {
      if (k === 0) groups.push([W[0], W[1]]);
      else if (k === n - 1) groups.push([L[n - 2], L[n - 1]]);
      else groups.push([L[k - 1], W[k + 1]]);
    }
  }
  const next = groups.map(([a, b], i) => ({ court: i + 1, ...remixCourt(a, b, history) }));
  assertEveryoneOnce(next, courts);
  return next;
}

export function assertEveryoneOnce(next: CourtAssignment[], previous: CourtAssignment[]) {
  const seen = new Set<string>();
  for (const c of next) for (const id of [...c.team1, ...c.team2]) {
    if (seen.has(id)) throw new LadderError("A player was placed twice in one round.", "duplicate");
    seen.add(id);
  }
  const expected = previous.flatMap((c) => [...c.team1, ...c.team2]);
  if (expected.length !== seen.size || expected.some((id) => !seen.has(id))) {
    throw new LadderError("A player is missing from the next round.", "missing_player");
  }
}

// ---------------------------------------------------------------------------
// Standings.
// ---------------------------------------------------------------------------

export interface StandingRow {
  playerId: string;
  name: string;
  /** Games credited per round, index 0 = round 1. null = no confirmed score yet. */
  rounds: (number | null)[];
  total: number;
  wins: number;
  played: number;
  gamesFor: number;
  gamesAgainst: number;
  diff: number;
  rank: number;
  /** True when this player is level with another on every published tie-breaker. */
  tied: boolean;
}

export interface StandingsOptions {
  roundCount: number;
  /** Only confirmed scores count (default). Set false for a provisional live view. */
  confirmedOnly?: boolean;
  /** Organiser decision for players level on every tie-breaker: lower comes first. */
  manualOrder?: Record<string, number>;
}

export function computeStandings(players: { id: string; name: string }[], rounds: RoundInput[], opts: StandingsOptions): StandingRow[] {
  const confirmedOnly = opts.confirmedOnly ?? true;
  const rows = new Map<string, StandingRow>();
  for (const p of players) {
    rows.set(p.id, { playerId: p.id, name: p.name, rounds: Array(opts.roundCount).fill(null), total: 0, wins: 0, played: 0, gamesFor: 0, gamesAgainst: 0, diff: 0, rank: 0, tied: false });
  }
  for (const r of rounds) {
    for (const c of r.courts) {
      if (!isValidScore(c.team1Games) || !isValidScore(c.team2Games)) continue;
      if (confirmedOnly && !c.confirmed) continue;
      const w = winnerOf(c);
      const credit = (ids: Pair, own: number, other: number, team: TeamIndex) => {
        for (const id of ids) {
          const row = rows.get(id);
          if (!row) continue;
          row.rounds[r.round - 1] = own;
          row.total += own;
          row.gamesFor += own;
          row.gamesAgainst += other;
          row.played += 1;
          if (w === team) row.wins += 1;
        }
      };
      credit(c.team1, c.team1Games, c.team2Games, 1);
      credit(c.team2, c.team2Games, c.team1Games, 2);
    }
  }
  const list = [...rows.values()];
  for (const r of list) r.diff = r.gamesFor - r.gamesAgainst;
  const manual = opts.manualOrder ?? {};
  const cmpCore = (a: StandingRow, b: StandingRow) => b.total - a.total || b.wins - a.wins || b.diff - a.diff;
  list.sort((a, b) => cmpCore(a, b) || (manual[a.playerId] ?? 1e9) - (manual[b.playerId] ?? 1e9) || a.name.localeCompare(b.name));
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const prev = list[i - 1];
    const levelWithPrev = prev && cmpCore(prev, r) === 0;
    const manualSplit = levelWithPrev && manual[prev.playerId] !== undefined && manual[r.playerId] !== undefined && manual[prev.playerId] !== manual[r.playerId];
    r.rank = levelWithPrev && !manualSplit ? prev.rank : i + 1;
    if (levelWithPrev && !manualSplit) { r.tied = true; prev.tied = true; }
  }
  return list;
}

export type Medal = "gold" | "silver" | "bronze";

export interface PodiumState {
  ready: boolean;
  reason?: string;
  places: { medal: Medal; playerId: string; name: string; total: number }[];
}

/**
 * Daily podium. Never final while a score is pending, a round is unplayed,
 * or a tie touches a medal place without an organiser decision.
 */
export function podium(standings: StandingRow[], allRoundsLocked: boolean): PodiumState {
  const medals: Medal[] = ["gold", "silver", "bronze"];
  const places = standings.slice(0, 3).map((r, i) => ({ medal: medals[i], playerId: r.playerId, name: r.name, total: r.total }));
  if (!allRoundsLocked) return { ready: false, reason: "Scores are still coming in.", places };
  const contested = standings.filter((r) => r.tied && r.rank <= 3);
  if (contested.length) return { ready: false, reason: `Tie for a medal place: ${contested.map((r) => r.name).join(", ")}. The organiser decides the order.`, places };
  return { ready: true, places };
}

// ---------------------------------------------------------------------------
// Lifetime milestone medals.
// ---------------------------------------------------------------------------

export interface MilestoneTier {
  id: number;
  threshold: number;
  active: boolean;
}

/** Every active milestone reached by `total` that the player does not already hold. */
export function milestonesToUnlock(tiers: MilestoneTier[], total: number, held: Set<number>): number[] {
  return tiers.filter((t) => t.active && total >= t.threshold && !held.has(t.id)).sort((a, b) => a.threshold - b.threshold).map((t) => t.id);
}
