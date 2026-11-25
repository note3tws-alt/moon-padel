/**
 * End-to-end checks of the brief's acceptance tests (T01 to T12) against a real
 * Postgres database. Runs only when TEST_DATABASE_URL points at a disposable
 * database with the migrations applied, e.g.
 *   TEST_DATABASE_URL=postgres://moon:moon@localhost:5432/moonpadel_test npx vitest run ladder
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: () => {}, revalidatePath: () => {} }));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const run = url ? describe : describe.skip;

run("Ladder Americano event, end to end", async () => {
  const { sql } = await import("../db");
  const svc = await import("./service");
  const { getLiveState } = await import("./live");
  const admin = { kind: "admin" as const, admin: { id: "00000000-0000-0000-0000-000000000001", email: "owner@test", displayName: "Owner", role: "admin" as const } };
  const kiosk = { kind: "kiosk" as const };
  const db = sql();
  const ids: string[] = [];
  let eventId = "";

  async function playRound(scores: [number, number][], opts: { tieOnCourt?: number } = {}) {
    let s = await getLiveState(eventId, "kiosk");
    const round = s.rounds.find((r) => r.round === s.event.currentRound)!;
    for (const c of round.courts) {
      const [a, b] = opts.tieOnCourt === c.court ? [4, 4] : scores[c.court - 1];
      await svc.submitScore(eventId, { matchId: c.id, playerId: c.team1[0], team1Games: a, team2Games: b, revision: c.revision }, kiosk);
      s = await getLiveState(eventId, "kiosk");
      const fresh = s.rounds.flatMap((r) => r.courts).find((x) => x.id === c.id)!;
      await svc.respondToScore(eventId, { matchId: c.id, playerId: c.team2[0], agree: true, revision: fresh.revision }, kiosk);
    }
  }

  beforeAll(async () => {
    await db`delete from ladder_events`;
    await db`delete from player_points_ledger`;
    await db`delete from player_medals`;
    await db`delete from tournaments where description like 'MoonPadel Ladder Americano night%'`;
    await db`delete from players where player_code like 'T-%'`;
    await db`insert into users (id, email, role) values (${admin.admin.id}, 'owner@test', 'admin') on conflict do nothing`;
    const tiers = await db`select id, code from skill_tiers where code in ('D+', 'D', 'D-')`;
    const tier = (c: string) => tiers.find((t) => t.code === c)!.id;
    // T01: 16 permanent players with D-/D/D+ tags.
    for (let i = 0; i < 16; i++) {
      const code = i < 5 ? "D+" : i < 11 ? "D" : "D-";
      const [p] = await db`insert into players (player_code, slug, full_name, skill_tier_id) values (${`T-${i}`}, ${`t-${i}`}, ${`Test ${String.fromCharCode(65 + i)}`}, ${tier(code)}) returning id`;
      await db`insert into player_private (player_id, phone, notes) values (${p.id}, ${"+971500000" + String(i).padStart(3, "0")}, 'private note')`;
      ids.push(p.id);
    }
  });

  afterAll(async () => { await db.end(); });

  it("T01 creates an event with 16 distinct players and refuses a 17th", async () => {
    eventId = await svc.createEvent({
      title: "Test night", club_id: null, venue_name: "[VENUE]", event_date: "2026-12-01", start_time: "21:00", duration_minutes: 90,
      court_count: 4, player_cap: 16, round_count: 6, round_minutes: 15, transition_minutes: 0, tie_rule: "admin", eligible_tier_ids: [],
      require_pin: false, is_public: true, count_in_league: true, notes: "private", public_note: null, tv_cycle_seconds: 12,
    }, admin);
    await svc.setParticipants(eventId, ids, [], admin);
    const [extra] = await db`insert into players (player_code, slug, full_name) values ('T-X', 't-x', 'Test Extra') returning id`;
    await expect(svc.setParticipants(eventId, [extra.id], [], admin)).rejects.toThrow(/holds 16/);
    const s = await getLiveState(eventId, "admin");
    expect(new Set(s.players.map((p) => p.id)).size).toBe(16);
  });

  it("T02 kiosk check-in marks exactly that player and bumps the version for the TV", async () => {
    await svc.setState(eventId, "checkin_open", admin);
    const before = (await getLiveState(eventId, "tv")).version;
    await svc.checkIn(eventId, ids[0], kiosk);
    const after = await getLiveState(eventId, "tv");
    expect(after.version).toBeGreaterThan(before);
    expect(after.players.filter((p) => p.checkedIn).map((p) => p.id)).toEqual([ids[0]]);
    // Double tap is harmless.
    await svc.checkIn(eventId, ids[0], kiosk);
    expect((await getLiveState(eventId, "tv")).players.filter((p) => p.checkedIn)).toHaveLength(1);
  });

  it("never draws courts with 15 players", async () => {
    for (const id of ids.slice(1, 15)) await svc.checkIn(eventId, id, kiosk);
    await expect(svc.drawCourts(eventId, admin)).rejects.toThrow(/15\/16 checked in/);
  });

  it("T03 draws 4 courts x 4 players, level-aware, no duplicates", async () => {
    await svc.checkIn(eventId, ids[15], kiosk);
    await svc.drawCourts(eventId, admin, 7);
    const s = await getLiveState(eventId, "admin");
    const r1 = s.rounds[0];
    expect(r1.courts).toHaveLength(4);
    const all = r1.courts.flatMap((c) => [...c.team1, ...c.team2]);
    expect(new Set(all).size).toBe(16);
    const c1 = [...r1.courts[0].team1, ...r1.courts[0].team2];
    expect(c1.every((id) => ids.indexOf(id) < 5)).toBe(true); // D+ players start on court 1
  });

  it("T07/T08 a tie blocks the round; pending scores block the podium; duplicate submit does not double count", async () => {
    await svc.startRound(eventId, admin);
    await expect(svc.submitScore(eventId, { matchId: (await getLiveState(eventId, "kiosk")).rounds[0].courts[0].id, playerId: ids[0], team1Games: 1, team2Games: 1, revision: 0 }, kiosk)).rejects.toThrow(/whistle/);
    await svc.endRound(eventId, admin);
    await playRound([[4, 2], [6, 3], [5, 1], [2, 4]], { tieOnCourt: 2 });
    let s = await getLiveState(eventId, "admin");
    expect(s.event.state).toBe("score_collection");
    expect(s.rounds[0].blockers).toEqual([{ court: 2, reason: "tie" }]);
    expect(s.podium.ready).toBe(false);
    // Retrying an already confirmed confirmation is a no-op.
    const c1 = s.rounds[0].courts[0];
    await svc.respondToScore(eventId, { matchId: c1.id, playerId: c1.team2[0], agree: true, revision: c1.revision }, kiosk);
    // Admin decides the tie: team 2 moves up. Round locks and round 2 is drawn.
    const c2 = s.rounds[0].courts[1];
    await svc.adminSetScore(eventId, { matchId: c2.id, team1Games: 4, team2Games: 4, advancing: 2 }, admin);
    s = await getLiveState(eventId, "admin");
    expect(s.event.state).toBe("round_locked");
    expect(s.rounds).toHaveLength(2);
    // T04: winners get their games, losers get theirs.
    const st = new Map(s.standings.map((r) => [r.playerId, r.total]));
    for (const id of c1.team1) expect(st.get(id)).toBe(4);
    for (const id of c1.team2) expect(st.get(id)).toBe(2);
  });

  it("refuses a score from someone not on the court and a stale revision", async () => {
    await svc.startRound(eventId, admin);
    await svc.endRound(eventId, admin);
    const s = await getLiveState(eventId, "kiosk");
    const c = s.rounds[1].courts[0];
    const outsider = s.rounds[1].courts[3].team1[0];
    await expect(svc.submitScore(eventId, { matchId: c.id, playerId: outsider, team1Games: 3, team2Games: 1, revision: c.revision }, kiosk)).rejects.toThrow(/Only a player/);
    await svc.submitScore(eventId, { matchId: c.id, playerId: c.team1[0], team1Games: 3, team2Games: 1, revision: c.revision }, kiosk);
    // Same submit again (retry after Wi-Fi drop) is accepted as a duplicate, not a second score.
    const dup = await svc.submitScore(eventId, { matchId: c.id, playerId: c.team1[1], team1Games: 3, team2Games: 1, revision: c.revision }, kiosk);
    expect(dup).toMatchObject({ duplicate: true });
    // A different score on top of a pending one is refused.
    await expect(svc.submitScore(eventId, { matchId: c.id, playerId: c.team2[0], team1Games: 1, team2Games: 3, revision: c.revision + 1 }, kiosk)).rejects.toThrow(/already waiting/);
    // The submitting team cannot confirm its own score.
    await expect(svc.respondToScore(eventId, { matchId: c.id, playerId: c.team1[1], agree: true, revision: c.revision + 1 }, kiosk)).rejects.toThrow(/other team/);
    const r = await getLiveState(eventId, "kiosk");
    const fresh = r.rounds[1].courts[0];
    await svc.respondToScore(eventId, { matchId: c.id, playerId: c.team2[0], agree: false, revision: fresh.revision }, kiosk);
    expect((await getLiveState(eventId, "kiosk")).rounds[1].courts[0].status).toBe("disputed");
    await svc.adminSetScore(eventId, { matchId: c.id, team1Games: 3, team2Games: 2, reason: "Agreed at desk" }, admin);
    const rest = (await getLiveState(eventId, "kiosk")).rounds[1].courts.slice(1);
    for (const x of rest) {
      await svc.submitScore(eventId, { matchId: x.id, playerId: x.team2[1], team1Games: 2, team2Games: 5, revision: x.revision }, kiosk);
      const f = (await getLiveState(eventId, "kiosk")).rounds[1].courts.find((y) => y.id === x.id)!;
      await svc.respondToScore(eventId, { matchId: x.id, playerId: x.team1[0], agree: true, revision: f.revision }, kiosk);
    }
    expect((await getLiveState(eventId, "kiosk")).event.state).toBe("round_locked");
  });

  it("T06/T09 plays all six rounds, every player once per round, six scores each, podium shown", async () => {
    for (let r = 3; r <= 6; r++) {
      await svc.startRound(eventId, admin);
      await svc.endRound(eventId, admin);
      await playRound([[6, 1], [5, 2], [4, 3], [3, 1]].map(([a, b], i) => (r === 6 && i === 0 ? [9, 0] : [a, b])) as [number, number][]);
    }
    const s = await getLiveState(eventId, "admin");
    for (const round of s.rounds) expect(new Set(round.courts.flatMap((c) => [...c.team1, ...c.team2])).size).toBe(16);
    const counts = await db`select player_id, count(*)::int as n from ladder_match_players where event_id = ${eventId} group by player_id`;
    expect(counts.every((c) => c.n === 6)).toBe(true);
    for (const row of s.standings) {
      expect(row.rounds.every((g) => typeof g === "number")).toBe(true);
      expect(row.total).toBe(row.rounds.reduce((a: number, b) => a + (b ?? 0), 0));
    }
    expect(s.event.allLocked).toBe(true);
    if (!s.podium.ready) {
      const order: Record<string, number> = {};
      s.standings.forEach((r, i) => { order[r.playerId] = i + 1; });
      await svc.setManualOrder(eventId, order, admin);
    }
    const res = await svc.finalizeEvent(eventId, admin);
    expect(res.podium.map((p) => p.medal)).toEqual(["gold", "silver", "bronze"]);
  });

  it("T12 public state never contains phone numbers or notes", async () => {
    for (const access of ["tv", "kiosk", "public"] as const) {
      const json = JSON.stringify(await getLiveState(eventId, access));
      expect(json).not.toMatch(/\+97150/);
      expect(json).not.toMatch(/private note/);
      expect(json).not.toMatch(/kiosk_token|tv_token/);
    }
  });

  it("T10 a second event adds to lifetime totals; milestones unlock once", async () => {
    const [{ points: before }] = await db`select coalesce(sum(points),0)::int as points from player_points_ledger where player_id = ${ids[0]}`;
    expect(before).toBeGreaterThan(0);
    const second = await svc.duplicateEvent(eventId, "2026-12-08", admin);
    const prev = eventId;
    eventId = second;
    await svc.setState(eventId, "checkin_open", admin);
    for (const id of ids) await svc.checkIn(eventId, id, admin);
    await svc.drawCourts(eventId, admin, 3);
    for (let r = 1; r <= 6; r++) {
      await svc.startRound(eventId, admin);
      await svc.endRound(eventId, admin);
      await playRound([[7, 0], [6, 1], [5, 2], [4, 3]].map(([a, b], i) => (r === 6 && i === 0 ? [12, 0] : [a, b])) as [number, number][]);
    }
    const s = await getLiveState(eventId, "admin");
    if (!s.podium.ready) {
      const order: Record<string, number> = {};
      s.standings.forEach((r, i) => { order[r.playerId] = i + 1; });
      await svc.setManualOrder(eventId, order, admin);
    }
    await svc.finalizeEvent(eventId, admin);
    const totals = await db`select player_id, sum(points)::int as points from player_points_ledger group by player_id`;
    const night1 = await db`select player_id, total from ladder_results where event_id = ${prev}`;
    const night2 = await db`select player_id, total from ladder_results where event_id = ${eventId}`;
    for (const t of totals) {
      const a = night1.find((x) => x.player_id === t.player_id)?.total ?? 0;
      const b = night2.find((x) => x.player_id === t.player_id)?.total ?? 0;
      expect(t.points).toBe(a + b);
    }
    const medals = await db`select player_id, medal_tier_id, count(*)::int as n from player_medals group by 1, 2`;
    expect(medals.every((m) => m.n === 1)).toBe(true);
    const over50 = totals.filter((t) => t.points >= 50);
    const fifty = (await db`select id from medal_tiers where threshold = 50`)[0].id;
    for (const t of over50) expect(medals.some((m) => m.player_id === t.player_id && m.medal_tier_id === fifty)).toBe(true);
    // Finalised nights also appear in the league.
    const [t] = await db`select count(*)::int as n from tournaments where description like 'MoonPadel Ladder Americano night%'`;
    expect(t.n).toBe(2);
  });

  it("T11 reopening and correcting recomputes totals without double counting", async () => {
    const [{ points: before }] = await db`select sum(points)::int as points from player_points_ledger where player_id = ${ids[0]}`;
    await svc.reopenEvent(eventId, "Test correction", admin);
    const s = await getLiveState(eventId, "admin");
    const last = s.rounds[5].courts.find((c) => c.team1.includes(ids[0]) || c.team2.includes(ids[0]))!;
    const mine = last.team1.includes(ids[0]) ? 1 : 2;
    const old = mine === 1 ? last.team1Games! : last.team2Games!;
    const t1 = mine === 1 ? old + 1 : last.team1Games!;
    const t2 = mine === 2 ? old + 1 : last.team2Games!;
    await svc.adminSetScore(eventId, { matchId: last.id, team1Games: t1, team2Games: t2, advancing: t1 === t2 ? 1 : null, reason: "Wrong score keyed" }, admin);
    const s2 = await getLiveState(eventId, "admin");
    if (!s2.podium.ready) {
      const order: Record<string, number> = {};
      s2.standings.forEach((r, i) => { order[r.playerId] = i + 1; });
      await svc.setManualOrder(eventId, order, admin);
    }
    await svc.finalizeEvent(eventId, admin);
    await svc.finalizeEvent(eventId, admin).catch(() => {}); // a second finalise is refused, never doubles
    const [{ points: after }] = await db`select sum(points)::int as points from player_points_ledger where player_id = ${ids[0]}`;
    expect(after).toBe(before + 1);
    const log = await db`select count(*)::int as n from ladder_score_log where event_id = ${eventId} and action = 'correction'`;
    expect(log[0].n).toBe(1);
  });
});
