import { describe, expect, it } from "vitest";
import { parseScoringConfig } from "./config";
import { rankRows, runEngine, type EngineInput } from "./engine";

const cfg = parseScoringConfig({
  rating: { method: "elo", initial: 3, elo: { k: 0.1, spread: 1.5, marginOfVictory: false }, provisional: { matches: 0, kMultiplier: 1 }, visibleAfterMatches: 1 },
  points: { win: 3, draw: 1, loss: 0, perGameWon: 0, courtMultipliers: { "1": 2, default: 1 }, placement: [10, 5, 2, 1] },
  standings: { bestTournamentsMonthly: 1, bestTournamentsAllTime: 2, tieBreakers: ["points", "wins"] },
});

const players = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), divisionId: 1, baseRating: null, basePoints: 0, baseTournaments: 0, baseMatches: 0, baseWins: 0, baseLosses: 0 }));

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    config: cfg,
    now: new Date("2026-11-20T12:00:00Z"),
    players,
    pairs: [],
    tournaments: [
      { id: "t1", date: "2026-10-05", divisionId: 1, pairType: "non_fixed" },
      { id: "t2", date: "2026-11-02", divisionId: 1, pairType: "non_fixed" },
    ],
    matches: [
      { id: "m1", tournamentId: "t1", round: 1, court: 1, playedAt: null, teamA: ["a", "b"], teamB: ["c", "d"], pairA: null, pairB: null, gamesA: 6, gamesB: 2, winner: "A" },
      { id: "m2", tournamentId: "t1", round: 2, court: 2, playedAt: null, teamA: ["a", "c"], teamB: ["b", "d"], pairA: null, pairB: null, gamesA: 6, gamesB: 4, winner: "A" },
      { id: "m3", tournamentId: "t2", round: 1, court: 1, playedAt: null, teamA: ["c", "d"], teamB: ["a", "b"], pairA: null, pairB: null, gamesA: 6, gamesB: 3, winner: "A" },
    ],
    registrations: [],
    adjustments: [],
    history: [],
    ...over,
  };
}

describe("scoring engine", () => {
  it("applies Elo symmetrically and conserves rating between equal teams", () => {
    const out = runEngine(input());
    const first = out.ratingHistory.filter((r) => r.matchId === "m1");
    expect(first).toHaveLength(4);
    // equal teams: expected 0.5, K 0.1 -> +/-0.05
    expect(first.find((r) => r.playerId === "a")!.delta).toBeCloseTo(0.05, 2);
    expect(first.find((r) => r.playerId === "c")!.delta).toBeCloseTo(-0.05, 2);
    const sum = out.playerStats.reduce((s, p) => s + (p.rating ?? 0), 0);
    expect(sum).toBeCloseTo(12, 1);
  });

  it("uses court multipliers and placement points", () => {
    const out = runEngine(input());
    const a = out.tournamentPoints.find((r) => r.tournamentId === "t1" && r.playerId === "a")!;
    // court 1 win = 3*2, court 2 win = 3*1 -> 9 win points, 1st place -> +10
    expect(a.winPoints).toBe(9);
    expect(a.finalPosition).toBe(1);
    expect(a.totalPoints).toBe(19);
    const d = out.tournamentPoints.find((r) => r.tournamentId === "t1" && r.playerId === "d")!;
    expect(d.wins).toBe(0);
    expect(d.finalPosition).toBe(4);
  });

  it("builds monthly and all-time boards with best-N", () => {
    const out = runEngine(input());
    const oct = out.rankings.filter((r) => r.mode === "individual" && r.period === "2026-10-01" && r.divisionId == null);
    expect(oct[0].playerId).toBe("a");
    expect(oct[0].isChampion).toBe(true); // October is over
    const nov = out.rankings.filter((r) => r.mode === "individual" && r.period === "2026-11-01" && r.divisionId == null);
    expect(nov.every((r) => !r.isChampion)).toBe(true); // current month
    const allTime = out.rankings.filter((r) => r.mode === "individual" && r.period == null && r.divisionId == null);
    expect(allTime).toHaveLength(4);
    const statA = out.playerStats.find((p) => p.playerId === "a")!;
    expect(statA.matches).toBe(3);
    expect(statA.wins).toBe(2);
    expect(statA.losses).toBe(1);
    expect(statA.titles).toBe(1);
  });

  it("is deterministic and recalculates cleanly after a score edit", () => {
    const a = runEngine(input());
    const b = runEngine(input());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const edited = input();
    edited.matches[0] = { ...edited.matches[0], winner: "B", gamesA: 2, gamesB: 6 };
    const c = runEngine(edited);
    const aT1 = c.tournamentPoints.find((r) => r.tournamentId === "t1" && r.playerId === "a")!;
    expect(aT1.wins).toBe(1);
    expect(aT1.losses).toBe(1);
    expect(c.tournamentPoints.filter((r) => r.tournamentId === "t1")).toHaveLength(4);
  });

  it("applies manual adjustments and respects position overrides", () => {
    const out = runEngine(input({
      adjustments: [{ id: 1, playerId: "d", effectiveAt: "2026-11-10T00:00:00Z", kind: "set", value: 5 }],
      registrations: [{ tournamentId: "t1", playerId: "d", pairId: null, positionOverride: 1 }],
    }));
    expect(out.playerStats.find((p) => p.playerId === "d")!.rating).toBe(5);
    expect(out.tournamentPoints.find((r) => r.tournamentId === "t1" && r.playerId === "d")!.finalPosition).toBe(1);
  });

  it("ranks pairs only from fixed-pair tournaments", () => {
    const out = runEngine(input({
      pairs: [{ id: "p1", name: "AB", divisionId: 1, memberIds: ["a", "b"] }, { id: "p2", name: "CD", divisionId: 1, memberIds: ["c", "d"] }],
      tournaments: [{ id: "t3", date: "2026-11-05", divisionId: 1, pairType: "fixed" }],
      matches: [{ id: "m9", tournamentId: "t3", round: 1, court: 1, playedAt: null, teamA: ["a", "b"], teamB: ["c", "d"], pairA: "p1", pairB: "p2", gamesA: 6, gamesB: 1, winner: "A" }],
    }));
    const pairBoard = out.rankings.filter((r) => r.mode === "pair" && r.period == null && r.divisionId == null);
    expect(pairBoard[0].pairId).toBe("p1");
    // fixed events do not feed the individual board by default
    const indiv = out.rankings.filter((r) => r.mode === "individual" && r.period == null && r.divisionId == null);
    expect(indiv).toHaveLength(0);
    // but player match stats still count them
    expect(out.playerStats.find((p) => p.playerId === "a")!.matches).toBe(1);
    expect(out.pairStats.find((p) => p.pairId === "p1")!.titles).toBe(1);
  });

  it("shares ranks for full ties", () => {
    const ranked = rankRows(
      [
        { id: "1", name: "x", points: 10, wins: 2, losses: 0, matches: 2, tournaments: 1, gameDiff: 0, rating: null },
        { id: "2", name: "y", points: 10, wins: 2, losses: 0, matches: 2, tournaments: 1, gameDiff: 0, rating: null },
        { id: "3", name: "z", points: 5, wins: 1, losses: 1, matches: 2, tournaments: 1, gameDiff: 0, rating: null },
      ],
      ["points", "wins"],
    );
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("supports the weighted and manual rating methods", () => {
    const w = runEngine(input({ config: { ...cfg, rating: { ...cfg.rating, method: "weighted" } } }));
    expect(w.playerStats.find((p) => p.playerId === "a")!.rating).not.toBe(3);
    const m = runEngine(input({ config: { ...cfg, rating: { ...cfg.rating, method: "manual" } } }));
    expect(m.ratingHistory).toHaveLength(0);
  });
});
