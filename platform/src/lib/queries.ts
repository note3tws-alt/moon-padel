import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { LEAGUE_TAG } from "./cache";
import { currentPeriod, todayDubai } from "./utils";
import { loadActiveConfig } from "./recalc";

export type Division = { id: number; code: string; name: string; sort_order: number; color: string | null; description: string | null; min_rating: number | null; max_rating: number | null; promote_top_n: number; relegate_bottom_n: number; promotion_min_tournaments: number; use_rating_thresholds: boolean; active: boolean };

export interface GeneralSettings {
  leagueName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  city: string;
  whatsappNumber: string;
  instagramHandle: string;
  contactEmail: string;
  showDemoBanner: boolean;
}
export interface RulesSettings { intro: string; sections: { title: string; body: string }[] }

const GENERAL_DEFAULTS: GeneralSettings = {
  leagueName: "MoonPadel", tagline: "Play beyond.", heroTitle: "PLAY. COMPETE. RISE.", heroSubtitle: "Your game. Your ranking. Your journey.",
  city: "Dubai", whatsappNumber: "", instagramHandle: "", contactEmail: "", showDemoBanner: true,
};

async function loadSettings(): Promise<{ general: GeneralSettings; rules: RulesSettings }> {
  const rows = await sql()`select key, value from site_settings where key in ('general', 'rules')`;
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    general: { ...GENERAL_DEFAULTS, ...(map.general ?? {}) },
    rules: { intro: "", sections: [], ...(map.rules ?? {}) },
  };
}

/** Cached for the public site; admin changes clear it through refreshPublicSite(). */
export const getSettings = unstable_cache(loadSettings, ["site-settings"], { tags: [LEAGUE_TAG], revalidate: 300 });

export async function getDivisions(): Promise<Division[]> {
  return (await sql()`select * from divisions order by sort_order, code`) as unknown as Division[];
}

export const demoCounts = unstable_cache(
  async () => {
    const [r] = await sql()`select (select count(*) from players where is_demo)::int as players, (select count(*) from tournaments where is_demo)::int as tournaments`;
    return { players: Number(r.players), tournaments: Number(r.tournaments) };
  },
  ["demo-counts"],
  { tags: [LEAGUE_TAG], revalidate: 300 },
);

// ------------------------------------------------------------------- home
export async function getUpcomingTournaments(limit = 6) {
  const today = todayDubai();
  return sql()`
    select t.id, t.slug, t.name, t.tournament_date, t.start_time, t.duration_minutes, t.format, t.pair_type, t.max_players, t.status, t.entry_fee, t.currency,
           c.name as club_name, c.slug as club_slug, d.code as division_code, d.name as division_name,
           (select count(*)::int from tournament_registrations r where r.tournament_id = t.id and r.status = 'registered') as registered
    from tournaments t
    left join clubs c on c.id = t.club_id
    left join divisions d on d.id = t.division_id
    where t.status in ('upcoming', 'registration_open', 'full', 'in_progress') and t.tournament_date >= ${today}
    order by t.tournament_date, t.start_time nulls last
    limit ${limit}`;
}

export async function getTopByDivision(period: string, mode: "individual" | "pair" = "individual", limit = 5) {
  if (mode === "pair") {
    return sql()`
      select r.division_id, r.rank, r.points, r.rating, pr.name, pr.slug, null as country_code
      from monthly_rankings r join pairs pr on pr.id = r.pair_id
      where r.mode = 'pair' and r.period = ${period} and r.division_id is not null and r.rank <= ${limit}
      order by r.division_id, r.rank, pr.name`;
  }
  return sql()`
    select r.division_id, r.rank, r.points, r.rating, p.full_name as name, p.slug, p.country_code, p.photo_url, s.rating_visible
    from monthly_rankings r join players p on p.id = r.player_id left join player_stats s on s.player_id = p.id
    where r.mode = 'individual' and r.period = ${period} and r.division_id is not null and r.rank <= ${limit}
    order by r.division_id, r.rank, p.full_name`;
}

export async function getMonthlyChampions(period: string) {
  const players = await sql()`
    select r.division_id, r.points, r.tournaments, r.wins, r.matches, p.full_name as name, p.slug, p.country_code, p.photo_url
    from monthly_rankings r join players p on p.id = r.player_id
    where r.mode = 'individual' and r.period = ${period} and r.division_id is not null and r.rank = 1
    order by r.division_id`;
  const pairs = await sql()`
    select r.division_id, r.points, r.tournaments, r.wins, r.matches, pr.name, pr.slug
    from monthly_rankings r join pairs pr on pr.id = r.pair_id
    where r.mode = 'pair' and r.period = ${period} and r.division_id is not null and r.rank = 1
    order by r.division_id`;
  return { players, pairs };
}

/** Most recent published tournament per division, with its winner(s). */
export async function getLatestChampions() {
  return sql()`
    with latest as (
      select distinct on (t.division_id) t.id, t.slug, t.name, t.tournament_date, t.division_id, t.pair_type
      from tournaments t
      where t.results_published and t.status = 'completed'
      order by t.division_id, t.tournament_date desc, t.created_at desc
    )
    select l.*, d.code as division_code, d.name as division_name,
      coalesce(
        (select json_agg(json_build_object('name', pr.name, 'slug', pr.slug, 'type', 'pair', 'points', tp.total_points))
           from tournament_points tp join pairs pr on pr.id = tp.pair_id
           where tp.tournament_id = l.id and tp.entity_type = 'pair' and tp.final_position = 1),
        (select json_agg(json_build_object('name', p.full_name, 'slug', p.slug, 'type', 'player', 'country', p.country_code, 'points', tp.total_points))
           from tournament_points tp join players p on p.id = tp.player_id
           where tp.tournament_id = l.id and tp.entity_type = 'player' and tp.final_position = 1)
      ) as winners
    from latest l left join divisions d on d.id = l.division_id
    order by d.sort_order nulls last`;
}

export async function getRisingPlayers(window: 7 | 30 = 7, limit = 5) {
  const col = window === 7 ? sql()`s.rating_change_7d` : sql()`s.rating_change_30d`;
  return sql()`
    select p.full_name as name, p.slug, p.country_code, p.photo_url, s.rating, ${col} as change, d.code as division_code
    from player_stats s join players p on p.id = s.player_id left join divisions d on d.id = p.division_id
    where ${col} > 0 and p.status = 'active'
    order by ${col} desc, p.full_name
    limit ${limit}`;
}

export async function getLeagueStats() {
  const [r] = await sql()`
    select
      (select count(*)::int from players) as players,
      (select count(*)::int from players where status = 'active') as active_players,
      (select count(*)::int from tournaments where status = 'completed' and results_published) as tournaments,
      (select count(*)::int from matches m join tournaments t on t.id = m.tournament_id where m.status = 'completed' and m.verified and t.results_published) as matches,
      (select count(*)::int from divisions where active) as divisions,
      (select count(*)::int from clubs where active) as clubs`;
  return r as { players: number; active_players: number; tournaments: number; matches: number; divisions: number; clubs: number };
}

// ------------------------------------------------------------- leaderboard
export const SORTS = { rank: "rank", rating: "rating", points: "points", tournaments: "tournaments", wins: "wins", winpct: "winpct", name: "name" } as const;
export type SortKey = keyof typeof SORTS;

export interface LeaderboardQuery {
  mode: "individual" | "pair";
  period: string | null; // YYYY-MM-01 or null = all-time
  divisionId: number | null;
  q?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function getAvailablePeriods(): Promise<string[]> {
  const rows = await sql()`select distinct period from monthly_rankings where period is not null order by period desc`;
  const list = rows.map((r) => r.period as string);
  const cur = currentPeriod();
  if (!list.includes(cur)) list.unshift(cur);
  return list;
}

export async function getLeaderboard(q: LeaderboardQuery) {
  const db = sql();
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 25));
  const page = Math.max(1, q.page ?? 1);
  const sort = q.sort && q.sort in SORTS ? q.sort : "rank";
  const defaultDir = sort === "rank" || sort === "name" ? "asc" : "desc";
  const dir = q.dir === "asc" || q.dir === "desc" ? q.dir : defaultDir;
  const search = q.q?.trim() ? `%${q.q.trim().toLowerCase()}%` : null;

  const periodCond = q.period ? db`r.period = ${q.period}` : db`r.period is null`;
  const divCond = q.divisionId != null ? db`r.division_id = ${q.divisionId}` : db`r.division_id is null`;
  const orderCol =
    sort === "rating" ? db`r.rating` :
    sort === "points" ? db`r.points` :
    sort === "tournaments" ? db`r.tournaments` :
    sort === "wins" ? db`r.wins` :
    sort === "winpct" ? db`(case when r.matches > 0 then r.wins::numeric / r.matches else 0 end)` :
    sort === "name" ? db`name` : db`r.rank`;
  const orderDir = dir === "asc" ? db`asc nulls last` : db`desc nulls last`;

  if (q.mode === "pair") {
    const rows = await db`
      select r.rank, r.points, r.rating, r.tournaments, r.matches, r.wins, r.losses, r.is_champion,
             pr.id, pr.name as name, pr.slug, d.code as division_code,
             (select json_agg(json_build_object('name', p.full_name, 'slug', p.slug, 'country', p.country_code) order by pm.position)
                from pair_members pm join players p on p.id = pm.player_id where pm.pair_id = pr.id) as members,
             count(*) over() as total
      from monthly_rankings r join pairs pr on pr.id = r.pair_id left join divisions d on d.id = pr.division_id
      where r.mode = 'pair' and ${periodCond} and ${divCond}
        ${search ? db`and (lower(pr.name) like ${search} or exists (select 1 from pair_members pm join players p on p.id = pm.player_id where pm.pair_id = pr.id and lower(p.full_name) like ${search}))` : db``}
      order by ${orderCol} ${orderDir}, r.rank, pr.name
      limit ${pageSize} offset ${(page - 1) * pageSize}`;
    return { rows, total: Number(rows[0]?.total ?? 0), page, pageSize, sort, dir };
  }

  const rows = await db`
    select r.rank, r.points, r.rating, r.tournaments, r.matches, r.wins, r.losses, r.is_champion,
           p.id, p.full_name as name, p.slug, p.country_code, p.photo_url, p.player_code, d.code as division_code,
           coalesce(s.rating_visible, false) as rating_visible,
           count(*) over() as total
    from monthly_rankings r
    join players p on p.id = r.player_id
    left join divisions d on d.id = p.division_id
    left join player_stats s on s.player_id = p.id
    where r.mode = 'individual' and ${periodCond} and ${divCond}
      ${search ? db`and (lower(p.full_name) like ${search} or lower(p.player_code) like ${search})` : db``}
    order by ${orderCol} ${orderDir}, r.rank, p.full_name
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  return { rows, total: Number(rows[0]?.total ?? 0), page, pageSize, sort, dir };
}

// ----------------------------------------------------------------- players
export async function getPlayerDirectory(opts: { q?: string; divisionId?: number | null; page?: number; pageSize?: number }) {
  const db = sql();
  const pageSize = opts.pageSize ?? 24;
  const page = Math.max(1, opts.page ?? 1);
  const search = opts.q?.trim() ? `%${opts.q.trim().toLowerCase()}%` : null;
  const rows = await db`
    select p.id, p.full_name, p.slug, p.country_code, p.photo_url, p.player_code, d.code as division_code, d.name as division_name,
           s.rating, coalesce(s.rating_visible, false) as rating_visible, s.overall_rank, s.total_points, s.matches, s.wins,
           count(*) over() as total
    from players p left join divisions d on d.id = p.division_id left join player_stats s on s.player_id = p.id
    where p.status = 'active'
      ${opts.divisionId ? db`and p.division_id = ${opts.divisionId}` : db``}
      ${search ? db`and (lower(p.full_name) like ${search} or lower(p.player_code) like ${search})` : db``}
    order by s.overall_rank nulls last, p.full_name
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  return { rows, total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export async function getPlayerProfile(slug: string) {
  const db = sql();
  const [player] = await db`
    select p.id, p.player_code, p.slug, p.full_name, p.country_code, p.nationality, p.photo_url, p.playing_side, p.status, p.created_at, p.is_demo,
           d.id as division_id, d.code as division_code, d.name as division_name,
           s.rating, coalesce(s.rating_visible, false) as rating_visible, s.overall_rank, s.division_rank, coalesce(s.total_points, 0) as total_points,
           coalesce(s.tournaments, p.base_tournaments) as tournaments, coalesce(s.matches, p.base_matches) as matches,
           coalesce(s.wins, p.base_wins) as wins, coalesce(s.losses, p.base_losses) as losses, coalesce(s.draws, 0) as draws,
           coalesce(s.titles, 0) as titles, coalesce(s.podiums, 0) as podiums, s.last_played, coalesce(s.rating_change_30d, 0) as rating_change_30d
    from players p left join divisions d on d.id = p.division_id left join player_stats s on s.player_id = p.id
    where p.slug = ${slug}`;
  if (!player) return null;

  const [ratingHistory, monthly, matches, tournaments, divisionHistory, pairs] = await Promise.all([
    db`select rated_at, rating_after, delta, match_id, adjustment_id from player_rating_history where player_id = ${player.id} order by rated_at, id`,
    db`select period, rank, points, tournaments, matches, wins, losses, is_champion from monthly_rankings
       where player_id = ${player.id} and mode = 'individual' and division_id is null and period is not null order by period`,
    db`
      select m.id, m.round_number, m.court_number, m.set_scores, m.team_a_games, m.team_b_games, m.winner, m.match_date,
             t.name as tournament_name, t.slug as tournament_slug, t.tournament_date, t.pair_type,
             me.team,
             (select json_agg(json_build_object('name', p.full_name, 'slug', p.slug, 'team', mp.team))
                from match_players mp join players p on p.id = mp.player_id where mp.match_id = m.id and mp.player_id <> ${player.id}) as others,
             h.delta as rating_delta
      from match_players me
      join matches m on m.id = me.match_id
      join tournaments t on t.id = m.tournament_id
      left join player_rating_history h on h.match_id = m.id and h.player_id = ${player.id}
      where me.player_id = ${player.id} and m.status = 'completed' and t.results_published
      order by t.tournament_date desc, m.round_number desc`,
    db`
      select t.name, t.slug, t.tournament_date, t.pair_type, d.code as division_code, tp.final_position, tp.total_points, tp.wins, tp.losses, tp.matches,
             (select count(*)::int from tournament_points x where x.tournament_id = t.id and x.entity_type = tp.entity_type) as field_size
      from tournament_points tp join tournaments t on t.id = tp.tournament_id left join divisions d on d.id = t.division_id
      where tp.player_id = ${player.id} and tp.entity_type = 'player'
      order by t.tournament_date desc`,
    db`select h.created_at, h.kind, h.reason, f.code as from_code, t.code as to_code
       from player_division_history h left join divisions f on f.id = h.from_division_id left join divisions t on t.id = h.to_division_id
       where h.player_id = ${player.id} order by h.created_at desc`,
    db`select pr.name, pr.slug, ps.total_points, ps.overall_rank, ps.rating,
              (select json_agg(json_build_object('name', p.full_name, 'slug', p.slug)) from pair_members pm2 join players p on p.id = pm2.player_id where pm2.pair_id = pr.id and pm2.player_id <> ${player.id}) as partners
       from pair_members pm join pairs pr on pr.id = pm.pair_id left join pair_stats ps on ps.pair_id = pr.id
       where pm.player_id = ${player.id}`,
  ]);

  // Partner history from match data.
  const partnerMap = new Map<string, { name: string; slug: string; matches: number; wins: number }>();
  for (const m of matches) {
    const won = m.winner === m.team;
    for (const o of (m.others ?? []) as { name: string; slug: string; team: string }[]) {
      if (o.team !== m.team) continue;
      const cur = partnerMap.get(o.slug) ?? { name: o.name, slug: o.slug, matches: 0, wins: 0 };
      cur.matches++;
      if (won) cur.wins++;
      partnerMap.set(o.slug, cur);
    }
  }
  const partners = [...partnerMap.values()].sort((a, b) => b.matches - a.matches || b.wins - a.wins);

  const championMonths = monthly.filter((m) => m.is_champion);
  const divisionChampionships = await db`
    select r.period, d.code from monthly_rankings r join divisions d on d.id = r.division_id
    where r.player_id = ${player.id} and r.mode = 'individual' and r.is_champion and r.division_id is not null order by r.period desc`;
  const bestRank = monthly.reduce<number | null>((b, m) => (b == null || m.rank < b ? m.rank : b), null);

  return { player, ratingHistory, monthly, matches, tournaments, divisionHistory, pairs, partners, championMonths, divisionChampionships, bestRank };
}

export async function getPairProfile(slug: string) {
  const db = sql();
  const [pair] = await db`
    select pr.*, d.code as division_code, d.name as division_name, ps.rating, ps.overall_rank, coalesce(ps.total_points, 0) as total_points,
           coalesce(ps.tournaments, 0) as tournaments, coalesce(ps.matches, 0) as matches, coalesce(ps.wins, 0) as wins, coalesce(ps.losses, 0) as losses, coalesce(ps.titles, 0) as titles
    from pairs pr left join divisions d on d.id = pr.division_id left join pair_stats ps on ps.pair_id = pr.id where pr.slug = ${slug}`;
  if (!pair) return null;
  const members = await db`select p.full_name, p.slug, p.country_code, p.photo_url, s.rating, coalesce(s.rating_visible,false) as rating_visible from pair_members pm join players p on p.id = pm.player_id left join player_stats s on s.player_id = p.id where pm.pair_id = ${pair.id} order by pm.position`;
  const tournaments = await db`
    select t.name, t.slug, t.tournament_date, tp.final_position, tp.total_points, tp.wins, tp.losses
    from tournament_points tp join tournaments t on t.id = tp.tournament_id where tp.pair_id = ${pair.id} order by t.tournament_date desc`;
  const monthly = await db`select period, rank, points from monthly_rankings where pair_id = ${pair.id} and mode = 'pair' and division_id is null and period is not null order by period`;
  return { pair, members, tournaments, monthly };
}

// ------------------------------------------------------------- tournaments
export async function getTournamentList(opts: { when: "upcoming" | "past" | "all"; divisionId?: number | null; pairType?: string | null }) {
  const db = sql();
  const today = todayDubai();
  return db`
    select t.id, t.slug, t.name, t.tournament_date, t.start_time, t.duration_minutes, t.format, t.pair_type, t.max_players, t.status, t.results_published, t.entry_fee, t.currency,
           c.name as club_name, d.code as division_code, d.name as division_name,
           (select count(*)::int from tournament_registrations r where r.tournament_id = t.id and r.status = 'registered') as registered,
           (select json_agg(x.name) from (
              select coalesce(pr.name, p.full_name) as name from tournament_points tp
              left join pairs pr on pr.id = tp.pair_id left join players p on p.id = tp.player_id
              where tp.tournament_id = t.id and tp.final_position = 1
                and tp.entity_type = (case when t.pair_type = 'fixed' then 'pair' else 'player' end)) x) as winners
    from tournaments t left join clubs c on c.id = t.club_id left join divisions d on d.id = t.division_id
    where t.status <> 'draft'
      ${opts.when === "upcoming" ? db`and t.tournament_date >= ${today} and t.status not in ('completed', 'cancelled')` : db``}
      ${opts.when === "past" ? db`and (t.tournament_date < ${today} or t.status in ('completed', 'cancelled'))` : db``}
      ${opts.divisionId ? db`and t.division_id = ${opts.divisionId}` : db``}
      ${opts.pairType ? db`and t.pair_type = ${opts.pairType}` : db``}
    order by ${opts.when === "upcoming" ? db`t.tournament_date asc, t.start_time asc` : db`t.tournament_date desc, t.start_time desc`}
    limit 200`;
}

export async function getTournamentDetail(slug: string) {
  const db = sql();
  const [t] = await db`
    select t.*, c.name as club_name, c.area as club_area, c.map_url as club_map_url, d.code as division_code, d.name as division_name
    from tournaments t left join clubs c on c.id = t.club_id left join divisions d on d.id = t.division_id
    where t.slug = ${slug} and t.status <> 'draft'`;
  if (!t) return null;
  const [registrations, matches, standings] = await Promise.all([
    db`select p.full_name, p.slug, p.country_code, p.photo_url, pr.name as pair_name, pr.slug as pair_slug, r.status, s.rating, coalesce(s.rating_visible, false) as rating_visible
       from tournament_registrations r join players p on p.id = r.player_id left join pairs pr on pr.id = r.pair_id left join player_stats s on s.player_id = p.id
       where r.tournament_id = ${t.id} and r.status <> 'withdrawn' order by r.status, pr.name nulls last, s.rating desc nulls last, p.full_name`,
    db`select m.id, m.round_number, m.court_number, m.set_scores, m.team_a_games, m.team_b_games, m.winner, m.status, m.duration_minutes,
              pa.name as pair_a, pb.name as pair_b,
              (select json_agg(json_build_object('name', p.full_name, 'slug', p.slug, 'team', mp.team) order by p.full_name) from match_players mp join players p on p.id = mp.player_id where mp.match_id = m.id) as players
       from matches m left join pairs pa on pa.id = m.team_a_pair_id left join pairs pb on pb.id = m.team_b_pair_id
       where m.tournament_id = ${t.id} and m.status <> 'void' order by m.round_number, m.court_number`,
    db`select tp.*, p.full_name as player_name, p.slug as player_slug, p.country_code, pr.name as pair_name, pr.slug as pair_slug
       from tournament_points tp left join players p on p.id = tp.player_id left join pairs pr on pr.id = tp.pair_id
       where tp.tournament_id = ${t.id} order by tp.entity_type, tp.final_position nulls last, tp.total_points desc`,
  ]);
  return { t, registrations, matches, standings };
}

export async function getRulesData() {
  const [{ config, name }, divisions, settings] = await Promise.all([loadActiveConfig(), getDivisions(), getSettings()]);
  return { config, rulesetName: name, divisions, rules: settings.rules };
}
