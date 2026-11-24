import "server-only";
import { sql } from "../db";
import { todayDubai } from "../utils";

/** Data the marketing website and public pages show: no tokens, notes or contact details. */
export async function publicEventsFeed() {
  const db = sql();
  const today = todayDubai();
  const upcoming = await db`
    select e.slug, e.title, e.event_date, e.start_time, e.duration_minutes, e.court_count, e.player_cap, e.round_count, e.round_minutes,
           e.state, e.public_note, coalesce(c.name, e.venue_name) as venue, c.area,
           (select count(*)::int from ladder_participants lp where lp.event_id = e.id and lp.status = 'confirmed') as confirmed,
           (select array_agg(st.code order by st.numeric_order) from skill_tiers st where st.id = any(e.eligible_tier_ids)) as levels
    from ladder_events e left join clubs c on c.id = e.club_id
    where e.is_public and e.state not in ('cancelled', 'completed') and e.event_date >= ${today}::date - 1
    order by e.event_date, e.start_time nulls last limit 12`;
  const recent = await db`
    select e.slug, e.title, e.event_date, coalesce(c.name, e.venue_name) as venue,
           (select json_agg(json_build_object('medal', r.medal, 'name', p.full_name, 'slug', p.slug, 'total', r.total) order by r.rank)
              from ladder_results r join players p on p.id = r.player_id where r.event_id = e.id and r.medal is not null) as podium
    from ladder_events e left join clubs c on c.id = e.club_id
    where e.is_public and e.state = 'completed' order by e.event_date desc limit 6`;
  const lifetime = await db`
    select p.full_name as name, p.slug, st.code as level, sum(l.points)::int as points, count(distinct l.event_id)::int as events,
           (select count(*)::int from player_medals m where m.player_id = p.id) as medals
    from player_points_ledger l join players p on p.id = l.player_id left join skill_tiers st on st.id = p.skill_tier_id
    where p.status = 'active' group by p.id, st.code order by points desc, p.full_name limit 10`;
  const milestones = await db`select name, threshold from medal_tiers where active order by threshold`;
  return { generatedAt: new Date().toISOString(), upcoming, recent, lifetime, milestones };
}

/** Lifetime points, medals and Ladder night history for a public player profile. */
export async function playerLadderSummary(playerId: string) {
  const db = sql();
  const [[totals], medals, nights, next] = await Promise.all([
    db`select coalesce(sum(points), 0)::int as points, (select st.code from players p left join skill_tiers st on st.id = p.skill_tier_id where p.id = ${playerId}) as level
       from player_points_ledger where player_id = ${playerId}`,
    db`select t.name, t.threshold, t.image_url, m.unlocked_at from player_medals m join medal_tiers t on t.id = m.medal_tier_id where m.player_id = ${playerId} order by t.threshold`,
    db`select e.slug, e.title, e.event_date, r.rank, r.total, r.medal from ladder_results r join ladder_events e on e.id = r.event_id
       where r.player_id = ${playerId} and e.is_public order by e.event_date desc limit 12`,
    db`select threshold, name from medal_tiers where active and threshold > (select coalesce(sum(points), 0) from player_points_ledger where player_id = ${playerId}) order by threshold limit 1`,
  ]);
  return { points: totals.points as number, level: totals.level as string | null, medals, nights, next: next[0] ?? null };
}
