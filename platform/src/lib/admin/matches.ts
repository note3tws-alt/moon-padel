import "server-only";
import { z } from "zod";
import type { Tx } from "../db";
import { parseSetScores, summariseSets } from "../utils";

export const matchInputSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  tournament_id: z.string().uuid("Choose a tournament"),
  round_number: z.coerce.number().int().min(1),
  court_number: z.coerce.number().int().min(1),
  team_a: z.array(z.string().uuid()).max(2),
  team_b: z.array(z.string().uuid()).max(2),
  pair_a: z.string().uuid().nullable().optional(),
  pair_b: z.string().uuid().nullable().optional(),
  set_scores: z.string().optional(),
  winner: z.enum(["auto", "A", "B", "D"]).default("auto"),
  duration_minutes: z.coerce.number().int().min(0).nullable().optional(),
  match_date: z.string().nullable().optional(),
  status: z.enum(["scheduled", "completed", "void"]).default("completed"),
  verified: z.boolean().default(true),
});
export type MatchInput = z.infer<typeof matchInputSchema>;

/** Validates and saves one match with its players. Returns the match id and whether results are live. */
export async function upsertMatch(tx: Tx, input: MatchInput): Promise<{ id: string; published: boolean; before: unknown; after: unknown }> {
  const [t] = await tx`select id, pair_type, results_published, tournament_date from tournaments where id = ${input.tournament_id}`;
  if (!t) throw new Error("Tournament not found");

  let teamA = input.team_a.filter(Boolean);
  let teamB = input.team_b.filter(Boolean);
  const pairA = input.pair_a || null;
  const pairB = input.pair_b || null;
  if (t.pair_type === "fixed") {
    if (!pairA || !pairB) throw new Error("Fixed-pair tournaments need a pair on each side.");
    if (pairA === pairB) throw new Error("A pair cannot play itself.");
    const members = await tx`select pair_id, player_id from pair_members where pair_id in ${tx([pairA, pairB])} order by position`;
    teamA = members.filter((m) => m.pair_id === pairA).map((m) => m.player_id);
    teamB = members.filter((m) => m.pair_id === pairB).map((m) => m.player_id);
  }
  if (teamA.length !== 2 || teamB.length !== 2) throw new Error("Each team needs two players.");
  const all = [...teamA, ...teamB];
  if (new Set(all).size !== 4) throw new Error("The same player appears twice in this match.");

  let sets: number[][] = [];
  let summary = { gamesA: 0, gamesB: 0, winner: null as "A" | "B" | "D" | null };
  if (input.status === "completed") {
    const parsed = input.set_scores ? parseSetScores(input.set_scores) : null;
    if (!parsed) throw new Error('Enter the set scores, e.g. "6-4, 3-6, 10-8".');
    if (parsed.some(([a, b]) => a > 99 || b > 99)) throw new Error("Set scores look wrong.");
    sets = parsed;
    const s = summariseSets(parsed);
    summary = { gamesA: s.gamesA, gamesB: s.gamesB, winner: input.winner === "auto" ? s.winner : input.winner };
  } else if (input.set_scores) {
    sets = parseSetScores(input.set_scores) ?? [];
  }

  // Player cannot be in two matches of the same round.
  const clash = await tx`
    select p.full_name from match_players mp join matches m on m.id = mp.match_id join players p on p.id = mp.player_id
    where m.tournament_id = ${t.id} and m.round_number = ${input.round_number} and m.status <> 'void'
      and mp.player_id in ${tx(all)} ${input.id ? tx`and m.id <> ${input.id}` : tx``}`;
  if (clash.length) throw new Error(`${clash.map((c) => c.full_name).join(", ")} already ${clash.length > 1 ? "play" : "plays"} in round ${input.round_number}.`);

  const values = {
    tournament_id: t.id, round_number: input.round_number, court_number: input.court_number,
    match_date: input.match_date ? new Date(input.match_date) : null, duration_minutes: input.duration_minutes ?? null,
    team_a_pair_id: pairA, team_b_pair_id: pairB, set_scores: tx.json(sets), team_a_games: summary.gamesA, team_b_games: summary.gamesB,
    winner: input.status === "completed" ? summary.winner : null, status: input.status, verified: input.verified, updated_at: new Date(),
  };
  let before: unknown = undefined;
  let id = input.id;
  if (id) {
    const [b] = await tx`select m.*, (select json_agg(json_build_object('player_id', player_id, 'team', team)) from match_players where match_id = m.id) as players from matches m where m.id = ${id} for update`;
    if (!b) throw new Error("Match not found");
    before = b;
    await tx`update matches set ${tx(values as never)} where id = ${id}`;
    await tx`delete from match_players where match_id = ${id}`;
  } else {
    const [row] = await tx`insert into matches ${tx(values as never)} returning id`;
    id = row.id as string;
  }
  for (const p of teamA) await tx`insert into match_players (match_id, player_id, team) values (${id}, ${p}, 'A')`;
  for (const p of teamB) await tx`insert into match_players (match_id, player_id, team) values (${id}, ${p}, 'B')`;
  // Make sure everyone who played is registered.
  for (const [p, pair] of [...teamA.map((x) => [x, pairA]), ...teamB.map((x) => [x, pairB])] as [string, string | null][]) {
    await tx`insert into tournament_registrations (tournament_id, player_id, pair_id) values (${t.id}, ${p}, ${pair})
             on conflict (tournament_id, player_id) do update set status = 'registered', pair_id = coalesce(excluded.pair_id, tournament_registrations.pair_id)`;
  }
  return { id: id!, published: t.results_published, before, after: { ...values, set_scores: sets, team_a: teamA, team_b: teamB } };
}

/** Builds the next round of a tournament from registrations and earlier results. */
export async function generateNextRound(tx: Tx, tournamentId: string): Promise<{ round: number; matches: number }> {
  const [t] = await tx`select id, pair_type, format, courts_count from tournaments where id = ${tournamentId}`;
  if (!t) throw new Error("Tournament not found");
  const [{ last }] = await tx`select coalesce(max(round_number), 0)::int as last from matches where tournament_id = ${tournamentId} and status <> 'void'`;
  const round = last + 1;

  if (t.pair_type === "fixed") {
    const pairs = await tx`select distinct r.pair_id from tournament_registrations r where r.tournament_id = ${tournamentId} and r.status = 'registered' and r.pair_id is not null order by r.pair_id`;
    const ids = pairs.map((p) => p.pair_id as string);
    if (ids.length < 2) throw new Error("Register at least two pairs first.");
    // Circle method round robin.
    const list = ids.length % 2 ? [...ids, "BYE"] : [...ids];
    const n = list.length;
    if (round > n - 1) throw new Error("Every pair has already played every other pair.");
    const rot = [list[0], ...list.slice(1).map((_, i) => list[1 + ((i + round - 1) % (n - 1))])];
    let court = 1;
    let created = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i], b = rot[n - 1 - i];
      if (a === "BYE" || b === "BYE") continue;
      await upsertMatch(tx, { tournament_id: tournamentId, round_number: round, court_number: court++, team_a: [], team_b: [], pair_a: a, pair_b: b, status: "scheduled", winner: "auto", verified: true });
      created++;
    }
    return { round, matches: created };
  }

  const players = await tx`
    select r.player_id, coalesce(s.rating, p.base_rating, 0) as rating from tournament_registrations r
    join players p on p.id = r.player_id left join player_stats s on s.player_id = r.player_id
    where r.tournament_id = ${tournamentId} and r.status = 'registered' order by rating desc, p.full_name`;
  if (players.length < 4) throw new Error("Register at least four players first.");
  const courts = Math.min(Math.floor(players.length / 4), t.courts_count ?? 99);
  let order: string[] = players.map((p) => p.player_id);

  if (last > 0 && t.format === "ladder") {
    const prev = await tx`
      select m.court_number, m.winner, mp.player_id, mp.team from matches m join match_players mp on mp.match_id = m.id
      where m.tournament_id = ${tournamentId} and m.round_number = ${last} and m.status <> 'void' order by m.court_number`;
    if (prev.some((r) => !r.winner)) throw new Error(`Enter all round ${last} results before generating round ${round}.`);
    const byCourt = new Map<number, { winners: string[]; losers: string[] }>();
    for (const r of prev) {
      const c = byCourt.get(r.court_number) ?? { winners: [], losers: [] };
      (r.winner === r.team ? c.winners : c.losers).push(r.player_id);
      byCourt.set(r.court_number, c);
    }
    const cs = [...byCourt.keys()].sort((a, b) => a - b);
    const next: string[][] = cs.map(() => []);
    cs.forEach((c, i) => {
      const { winners, losers } = byCourt.get(c)!;
      next[Math.max(0, i - 1)].push(...winners); // winners move up (top court stays)
      next[Math.min(cs.length - 1, i + 1)].push(...losers); // losers move down (bottom court stays)
    });
    order = next.flat();
    const sitting = players.map((p) => p.player_id).filter((id) => !order.includes(id));
    order = [...order, ...sitting];
  } else if (last > 0) {
    // Americano style: rotate so partners change each round.
    const shift = (last * 2) % order.length;
    order = [...order.slice(shift), ...order.slice(0, shift)];
  }

  const patterns = [[0, 3, 1, 2], [0, 2, 1, 3], [0, 1, 2, 3]];
  const pat = patterns[(round - 1) % 3];
  for (let c = 0; c < courts; c++) {
    const four = order.slice(c * 4, c * 4 + 4);
    await upsertMatch(tx, {
      tournament_id: tournamentId, round_number: round, court_number: c + 1,
      team_a: [four[pat[0]], four[pat[1]]], team_b: [four[pat[2]], four[pat[3]]],
      status: "scheduled", winner: "auto", verified: true,
    });
  }
  return { round, matches: courts };
}
