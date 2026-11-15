import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { StatTile } from "@/components/ui";
import { sql } from "@/lib/db";
import { fmtDate, fmtMonth } from "@/lib/utils";
import { recalculateNow } from "../league-actions";
import { setPublished } from "../tournaments/actions";

export const metadata = { title: "Leaderboard management" };

export default async function LeaderboardAdmin() {
  const db = sql();
  const [runs, [counts], months, tournaments, adjustments] = await Promise.all([
    db`select * from recalc_runs order by id desc limit 10`,
    db`select (select count(*)::int from monthly_rankings) as rows, (select count(distinct period)::int from monthly_rankings where period is not null) as months,
              (select count(*)::int from player_rating_history) as ratings, (select count(*)::int from tournaments where results_published) as published`,
    db`select period, count(*) filter (where mode = 'individual' and division_id is null)::int as players, count(*) filter (where mode = 'pair' and division_id is null)::int as pairs,
              (select string_agg(p.full_name, ', ') from monthly_rankings r2 join players p on p.id = r2.player_id where r2.period = r.period and r2.mode = 'individual' and r2.division_id is null and r2.rank = 1) as leader
       from monthly_rankings r where period is not null group by period order by period desc`,
    db`select id, name, tournament_date, results_published, status from tournaments where tournament_date <= current_date and status <> 'cancelled' order by tournament_date desc limit 15`,
    db`select a.*, p.full_name, u.email from rating_adjustments a join players p on p.id = a.player_id left join users u on u.id = a.created_by order by a.created_at desc limit 15`,
  ]);
  return (
    <>
      <PageHeader title="Leaderboard management" description="Rankings rebuild automatically after every change. Use recalculate after changing data directly in the database, or to check that everything is in sync."
        actions={<ActionForm action={recalculateNow}><SubmitButton pendingText="Recalculating…">Recalculate now</SubmitButton></ActionForm>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Published tournaments" value={counts.published} />
        <StatTile label="Ranked months" value={counts.months} />
        <StatTile label="Ranking rows" value={counts.rows} />
        <StatTile label="Rating history points" value={counts.ratings} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Monthly archive</h2>
          <table className="table-base"><thead><tr><th className="!px-0">Month</th><th className="text-right">Players</th><th className="text-right">Pairs</th><th>Leader</th><th></th></tr></thead>
            <tbody>{months.map((m) => (
              <tr key={m.period}><td className="!px-0">{fmtMonth(m.period)}</td><td className="text-right">{m.players}</td><td className="text-right">{m.pairs}</td><td className="text-muted">{m.leader ?? "–"}</td>
                <td><Link className="text-xs text-ice" target="_blank" href={`/leaderboard?period=${m.period.slice(0, 7)}`}>View ↗</Link></td></tr>
            ))}</tbody></table>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Results publishing</h2>
          <ul className="divide-y divide-line text-sm">
            {tournaments.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/tournaments/${t.id}`} className="hover:text-white">{t.name} <span className="text-muted">· {fmtDate(t.tournament_date)}</span></Link>
                <ActionForm action={setPublished}>
                  <input type="hidden" name="id" value={t.id} /><input type="hidden" name="publish" value={t.results_published ? "0" : "1"} />
                  <SubmitButton variant="ghost" className="btn-sm" pendingText="…">{t.results_published ? "Unpublish" : "Publish"}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Recent rating adjustments</h2>
          {adjustments.length ? (
            <ul className="space-y-1.5 text-sm">{adjustments.map((a) => <li key={a.id}><Link className="font-semibold hover:text-white" href={`/admin/players/${a.player_id}`}>{a.full_name}</Link> {a.kind === "set" ? `set to ${a.value}` : `${a.value > 0 ? "+" : ""}${a.value}`} <span className="text-muted">· {a.reason} · {a.email ?? ""}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">None. Add one from a player&apos;s page.</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Recalculation log</h2>
          <ul className="space-y-1.5 text-sm">{runs.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{r.trigger} <span className="text-muted">· {r.matches_processed} matches</span></span><span className="text-xs text-muted">{fmtDate(r.finished_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></li>)}</ul>
        </section>
      </div>
    </>
  );
}
