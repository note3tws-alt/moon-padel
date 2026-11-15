import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { StatTile, StatusChip } from "@/components/ui";
import { sql } from "@/lib/db";
import { getLeagueStats, getUpcomingTournaments } from "@/lib/queries";
import { fmtDate, fmtNumber, fmtTime } from "@/lib/utils";

export default async function AdminDashboard() {
  const db = sql();
  const [stats, upcoming, activity, [recent], [lastRun], pending] = await Promise.all([
    getLeagueStats(),
    getUpcomingTournaments(6),
    db`select created_at, actor_email, action, entity, entity_id from admin_audit_logs order by created_at desc limit 12`,
    db`select count(distinct mp.player_id)::int as n from match_players mp join matches m on m.id = mp.match_id join tournaments t on t.id = m.tournament_id where t.tournament_date >= current_date - 30`,
    db`select finished_at, matches_processed, trigger from recalc_runs order by id desc limit 1`,
    db`select t.id, t.name, t.tournament_date, (select count(*)::int from matches m where m.tournament_id = t.id) as matches
       from tournaments t where not t.results_published and t.tournament_date <= current_date and t.status not in ('cancelled', 'draft') order by t.tournament_date desc limit 5`,
  ]);
  return (
    <>
      <PageHeader title="Dashboard" description="Everything at a glance. Upload a spreadsheet or publish results and the public site updates straight away."
        actions={<><Link href="/admin/upload" className="btn-primary btn-sm">Upload data</Link><Link href="/admin/tournaments/new" className="btn-ghost btn-sm">New tournament</Link></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total players" value={fmtNumber(stats.players)} />
        <StatTile label="Active players" value={fmtNumber(recent?.n ?? 0)} hint="Played in the last 30 days" />
        <StatTile label="Tournaments" value={fmtNumber(stats.tournaments)} hint="Completed and published" />
        <StatTile label="Matches played" value={fmtNumber(stats.matches)} />
        <StatTile label="Active divisions" value={stats.divisions} />
        <StatTile label="Venues" value={stats.clubs} />
      </div>

      {pending.length > 0 && (
        <div className="card mt-6 border-electric/30 p-5">
          <h2 className="font-bold">Results waiting to be published</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pending.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span>{t.name} <span className="text-muted">· {fmtDate(t.tournament_date)} · {t.matches} matches</span></span>
                <Link href={`/admin/tournaments/${t.id}`} className="btn-ghost btn-sm">Open</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Upcoming tournaments</h2><Link className="text-xs font-semibold text-ice" href="/admin/tournaments">Manage</Link></div>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <Link href={`/admin/tournaments/${t.id}`} className="font-semibold hover:text-white">{t.name}</Link>
                  <span className="flex items-center gap-3 text-xs text-muted">{fmtDate(t.tournament_date)} {fmtTime(t.start_time)} · {t.registered}/{t.max_players ?? "∞"} <StatusChip status={t.status} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nothing scheduled.</p>}
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Recent activity</h2><Link className="text-xs font-semibold text-ice" href="/admin/audit">Audit log</Link></div>
          {activity.length ? (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="font-semibold">{a.action}</span> <span className="text-muted">{a.entity}</span></span>
                  <span className="text-xs text-muted">{a.actor_email ?? "system"} · {fmtDate(a.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No admin activity yet.</p>}
          {lastRun && <p className="mt-4 text-xs text-muted">Rankings last recalculated {fmtDate(lastRun.finished_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ({lastRun.matches_processed} matches, {lastRun.trigger}).</p>}
        </section>
      </div>
    </>
  );
}
