import "server-only";
import { sql } from "../db";
import type { AdminUser } from "../auth";
import { seededRandom } from "./engine";
import * as svc from "./service";
import { todayDubai } from "../utils";

/**
 * Demo Ladder nights on top of the demo league data: one finished night (podium,
 * lifetime points, medals) and one tonight with round 3 scores coming in, so
 * the tablet, TV and website have something to show. Everything is is_demo
 * and goes away with "Remove demo data".
 */
export async function seedLadderDemo(admin: AdminUser) {
  const db = sql();
  const actor = { kind: "admin" as const, admin };
  const tiers = await db`select id, code, numeric_order from skill_tiers where code in ('D+', 'D', 'D-') order by numeric_order`;
  const demo = await db`select id from players where is_demo order by player_code limit 16`;
  if (demo.length < 16) throw new Error("Load the demo league data first (it creates the demo players).");
  for (let i = 0; i < demo.length; i++) {
    await db`update players set skill_tier_id = ${tiers[i < 5 ? 0 : i < 11 ? 1 : 2].id} where id = ${demo[i].id}`;
  }
  const ids = demo.map((p) => p.id as string);
  const rand = seededRandom(20261124);
  const score = (): [number, number] => {
    const a = Math.floor(rand() * 7);
    let b = Math.floor(rand() * 7);
    if (a === b) b = (b + 2) % 7;
    return [a, b];
  };
  const today = todayDubai();
  const lastWeek = new Date(new Date(`${today}T12:00:00Z`).getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const nextWeek = new Date(new Date(`${today}T12:00:00Z`).getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const base = {
    club_id: null, venue_name: "[VENUE] (demo)", start_time: "21:00", duration_minutes: 90, court_count: 4, player_cap: 16, round_count: 6,
    round_minutes: 15, transition_minutes: 0, tie_rule: "admin" as const, eligible_tier_ids: tiers.map((t) => t.id as number), require_pin: false,
    is_public: true, count_in_league: false, notes: null, public_note: null, tv_cycle_seconds: 12,
  };

  async function play(eventId: string, rounds: number, finish: boolean) {
    await svc.setParticipants(eventId, ids, [], actor);
    await svc.setState(eventId, "checkin_open", actor);
    for (const id of ids) await svc.checkIn(eventId, id, actor);
    await svc.drawCourts(eventId, actor, 11);
    for (let r = 1; r <= rounds; r++) {
      await svc.startRound(eventId, actor);
      await svc.endRound(eventId, actor);
      const b = await svc.loadBundle(db, eventId);
      for (const m of b.matches.filter((x) => x.round_no === r)) {
        const [a, c] = score();
        await svc.adminSetScore(eventId, { matchId: m.id, team1Games: a, team2Games: c }, actor);
      }
    }
    if (finish) {
      const b = await svc.loadBundle(db, eventId);
      const st = svc.standingsOf(b);
      if (st.slice(0, 4).some((r) => r.tied)) {
        const order: Record<string, number> = {};
        st.forEach((r, i) => { order[r.playerId] = i + 1; });
        await svc.setManualOrder(eventId, order, actor);
      }
      await svc.finalizeEvent(eventId, actor);
    }
  }

  const done = await svc.createEvent({ ...base, title: "Ladder Americano (demo)", event_date: lastWeek }, actor);
  await db`update ladder_events set is_demo = true where id = ${done}`;
  await play(done, 6, true);

  const tonight = await svc.createEvent({ ...base, title: "Ladder Americano (demo)", event_date: today }, actor);
  await db`update ladder_events set is_demo = true where id = ${tonight}`;
  await play(tonight, 2, false);
  // Round 3 finished: two courts confirmed, one waiting for confirmation, one still to enter.
  await svc.startRound(tonight, actor);
  await svc.endRound(tonight, actor);
  const b = await svc.loadBundle(db, tonight);
  const r3 = b.matches.filter((m) => m.round_no === 3);
  await svc.adminSetScore(tonight, { matchId: r3[0].id, team1Games: 5, team2Games: 3 }, actor);
  await svc.adminSetScore(tonight, { matchId: r3[1].id, team1Games: 2, team2Games: 4 }, actor);
  await svc.submitScore(tonight, { matchId: r3[2].id, playerId: r3[2].team1[0], team1Games: 4, team2Games: 1, revision: r3[2].revision }, { kind: "kiosk" });

  const upcoming = await svc.createEvent({ ...base, title: "Ladder Americano (demo)", event_date: nextWeek, public_note: "Levels D-, D and D+. Message MOON on WhatsApp to join." }, actor);
  await db`update ladder_events set is_demo = true where id = ${upcoming}`;
  await svc.setParticipants(upcoming, ids.slice(0, 11), [], actor);
  return { finished: done, tonight, upcoming };
}
