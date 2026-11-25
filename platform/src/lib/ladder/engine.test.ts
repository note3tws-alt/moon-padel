import { describe, expect, it } from "vitest";
import {
  computeStandings, LadderError, milestonesToUnlock, nextRound, podium, roundBlockers, seedFirstRound, seededRandom,
  type CourtAssignment, type CourtResult, type LadderPlayer, type RoundInput,
} from "./engine";

const letters = "ABCDEFGHIJKLMNOP".split("");
const tiers = (l: string) => (l < "E" ? 1 : l < "I" ? 2 : 3); // D+, D, D-
const players: LadderPlayer[] = letters.map((l) => ({ id: l, name: `Player ${l}`, tierOrder: tiers(l) }));

/** The brief's example layout: Court 1 A+B vs C+D, Court 2 E+F vs G+H, ... */
const round1: CourtAssignment[] = [
  { court: 1, team1: ["A", "B"], team2: ["C", "D"] },
  { court: 2, team1: ["E", "F"], team2: ["G", "H"] },
  { court: 3, team1: ["I", "J"], team2: ["K", "L"] },
  { court: 4, team1: ["M", "N"], team2: ["O", "P"] },
];
const scored = (courts: CourtAssignment[], scores: [number, number][], confirmed = true): CourtResult[] =>
  courts.map((c, i) => ({ ...c, team1Games: scores[i][0], team2Games: scores[i][1], confirmed }));
const everyone = (courts: CourtAssignment[]) => courts.flatMap((c) => [...c.team1, ...c.team2]);

describe("first-round seeding (T03)", () => {
  it("puts 16 players on 4 courts, 4 each, no duplicates, strongest tier on court 1", () => {
    const courts = seedFirstRound(players, 4, seededRandom(7));
    expect(courts).toHaveLength(4);
    const ids = everyone(courts);
    expect(new Set(ids).size).toBe(16);
    expect(ids.sort()).toEqual([...letters].sort());
    const c1 = [...courts[0].team1, ...courts[0].team2];
    expect(c1.every((id) => tiers(id) === 1)).toBe(true);
    const c4 = [...courts[3].team1, ...courts[3].team2];
    expect(c4.every((id) => tiers(id) === 3)).toBe(true);
  });

  it("refuses to start with 15 players", () => {
    expect(() => seedFirstRound(players.slice(0, 15), 4)).toThrow(LadderError);
  });

  it("refuses duplicate players", () => {
    expect(() => seedFirstRound([...players.slice(0, 15), players[0]], 4)).toThrow(/twice/);
  });
});

describe("scoring and movement (T04, T05, T06)", () => {
  const r1: RoundInput = { round: 1, courts: scored(round1, [[4, 2], [6, 3], [5, 1], [2, 4]]) };

  it("credits each player their own team's games (T04)", () => {
    const s = computeStandings(players, [r1], { roundCount: 6 });
    const get = (id: string) => s.find((r) => r.playerId === id)!;
    expect(get("A").total).toBe(4);
    expect(get("B").total).toBe(4);
    expect(get("C").total).toBe(2);
    expect(get("D").total).toBe(2);
    expect(get("A").wins).toBe(1);
    expect(get("C").wins).toBe(0);
  });

  it("court 1 in round 2 has A, B, E, F remixed as A+E vs B+F (T05)", () => {
    const r2 = nextRound(r1);
    expect(r2[0].team1).toEqual(["A", "E"]);
    expect(r2[0].team2).toEqual(["B", "F"]);
  });

  it("follows the adjacent-court matrix and places every player once (T06)", () => {
    const r2 = nextRound(r1);
    const set = (c: CourtAssignment) => new Set([...c.team1, ...c.team2]);
    // W1=AB W2=EF W3=IJ W4=OP ; L1=CD L2=GH L3=KL L4=MN
    expect(set(r2[0])).toEqual(new Set(["A", "B", "E", "F"]));
    expect(set(r2[1])).toEqual(new Set(["C", "D", "I", "J"]));
    expect(set(r2[2])).toEqual(new Set(["G", "H", "O", "P"]));
    expect(set(r2[3])).toEqual(new Set(["K", "L", "M", "N"]));
    expect(new Set(everyone(r2)).size).toBe(16);
  });

  it("never keeps the arriving pair together", () => {
    const r2 = nextRound(r1);
    for (const c of r2) {
      for (const pair of [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"], ["K", "L"], ["M", "N"], ["O", "P"]]) {
        const together = (c.team1.includes(pair[0]) && c.team1.includes(pair[1])) || (c.team2.includes(pair[0]) && c.team2.includes(pair[1]));
        expect(together).toBe(false);
      }
    }
  });
});

describe("disputes and ties (T07, T08)", () => {
  it("a 4-4 tie blocks the next round until a pair is chosen to advance", () => {
    const courts = scored(round1, [[4, 4], [6, 3], [5, 1], [2, 4]]);
    expect(roundBlockers(courts)).toEqual([{ court: 1, reason: "tie" }]);
    expect(() => nextRound({ round: 1, courts })).toThrow(/tied/);
    courts[0].advancing = 2;
    const r2 = nextRound({ round: 1, courts });
    expect(new Set([...r2[0].team1, ...r2[0].team2])).toEqual(new Set(["C", "D", "E", "F"]));
  });

  it("an unconfirmed score blocks the round and is left out of standings", () => {
    const courts = scored(round1, [[4, 2], [6, 3], [5, 1], [2, 4]]);
    courts[2].confirmed = false;
    expect(roundBlockers(courts)).toEqual([{ court: 3, reason: "unconfirmed" }]);
    const s = computeStandings(players, [{ round: 1, courts }], { roundCount: 6 });
    expect(s.find((r) => r.playerId === "I")!.total).toBe(0);
    expect(podium(s, false).ready).toBe(false);
  });
});

describe("full six-round night (T09)", () => {
  it("every player ends with six round scores and one total; podium is ready", () => {
    const rand = seededRandom(42);
    let courts = seedFirstRound(players, 4, rand);
    const rounds: RoundInput[] = [];
    for (let r = 1; r <= 6; r++) {
      const results = courts.map((c) => {
        let a = Math.floor(rand() * 7);
        let b = Math.floor(rand() * 7);
        if (a === b) a += 1;
        if (r === 6 && c.court === 1) { a = 9; b = 0; } // make the gold place clear
        return { ...c, team1Games: a, team2Games: b, confirmed: true };
      });
      const round = { round: r, courts: results };
      for (const c of results) expect(new Set([...c.team1, ...c.team2]).size).toBe(4);
      expect(new Set(everyone(results)).size).toBe(16);
      if (r < 6) courts = nextRound(round, rounds);
      rounds.push(round);
    }
    const s = computeStandings(players, rounds, { roundCount: 6 });
    for (const row of s) {
      expect(row.rounds.every((g) => typeof g === "number")).toBe(true);
      expect(row.total).toBe(row.rounds.reduce((a: number, b) => a + (b ?? 0), 0));
      expect(row.played).toBe(6);
    }
    const p = podium(s, true);
    expect(p.places.map((x) => x.medal)).toEqual(["gold", "silver", "bronze"]);
    if (!s.slice(0, 3).some((r) => r.tied)) expect(p.ready).toBe(true);
  });

  it("matches the brief's example total: 4+3+6+2+5+5 = 25", () => {
    const rounds: RoundInput[] = [4, 3, 6, 2, 5, 5].map((g, i) => ({
      round: i + 1,
      courts: [{ court: 1, team1: ["A", "B"], team2: ["C", "D"], team1Games: g, team2Games: 1, confirmed: true }],
    }));
    const s = computeStandings(players.slice(0, 4), rounds, { roundCount: 6 });
    expect(s[0].total).toBe(25);
  });

  it("ranks ties by wins, then game difference, then organiser decision", () => {
    const four = players.slice(0, 4);
    const rounds: RoundInput[] = [{ round: 1, courts: [{ court: 1, team1: ["A", "C"], team2: ["B", "D"], team1Games: 3, team2Games: 3, advancing: 1, confirmed: true }] }];
    const s = computeStandings(four, rounds, { roundCount: 1 });
    expect(s.slice(0, 2).map((r) => r.playerId)).toEqual(["A", "C"]); // A and C have the win
    expect(s[0].tied).toBe(true); // A and C are level on everything
    expect(podium(s, true).ready).toBe(false);
    const decided = computeStandings(four, rounds, { roundCount: 1, manualOrder: { C: 1, A: 2, B: 3, D: 4 } });
    expect(decided.map((r) => r.playerId)).toEqual(["C", "A", "B", "D"]);
    expect(podium(decided, true).ready).toBe(true);
  });
});

describe("lifetime milestones (T10)", () => {
  const tiersList = [
    { id: 1, threshold: 50, active: true },
    { id: 2, threshold: 100, active: true },
    { id: 3, threshold: 150, active: false },
  ];
  it("unlocks every newly reached level once", () => {
    expect(milestonesToUnlock(tiersList, 49, new Set())).toEqual([]);
    expect(milestonesToUnlock(tiersList, 104, new Set())).toEqual([1, 2]);
    expect(milestonesToUnlock(tiersList, 104, new Set([1]))).toEqual([2]);
    expect(milestonesToUnlock(tiersList, 200, new Set([1, 2]))).toEqual([]);
  });
});
