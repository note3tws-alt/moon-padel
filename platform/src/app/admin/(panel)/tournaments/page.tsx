import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { DivisionBadge } from "@/components/brand";
import { EmptyState, StatusChip } from "@/components/ui";
import { sql } from "@/lib/db";
import { cn, fmtDate, PAIR_TYPE_LABELS } from "@/lib/utils";

export const metadata = { title: "Tournaments" };

export default async function AdminTournaments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = sql();
  const filter = sp.filter ?? "all";
  const rows = await db`
    select t.id, t.name, t.slug, t.tournament_date, t.status, t.results_published, t.pair_type, t.max_players, t.is_demo, d.code as division_code, c.name as club_name,
      (select count(*)::int from tournament_registrations r where r.tournament_id = t.id and r.status = 'registered') as registered,
      (select count(*)::int from matches m where m.tournament_id = t.id and m.status = 'completed') as done,
      (select count(*)::int from matches m where m.tournament_id = t.id and m.status = 'scheduled') as open
    from tournaments t left join divisions d on d.id = t.division_id left join clubs c on c.id = t.club_id
    where true
      ${filter === "upcoming" ? db`and t.tournament_date >= current_date and t.status not in ('completed', 'cancelled')` : db``}
      ${filter === "unpublished" ? db`and not t.results_published and t.status <> 'cancelled' and t.tournament_date <= current_date` : db``}
      ${filter === "drafts" ? db`and t.status = 'draft'` : db``}
    order by t.tournament_date desc limit 300`;
  return (
    <>
      <PageHeader title="Tournaments" description="Create events, manage registrations, schedule rounds, enter results and publish them to the rankings."
        actions={<><Link href="/admin/tournaments/new" className="btn-primary btn-sm">New tournament</Link><Link href="/admin/upload?kind=tournaments" className="btn-ghost btn-sm">Bulk upload</Link></>} />
      <div className="mb-4 flex gap-1.5">
        {["all", "upcoming", "unpublished", "drafts"].map((f) => <Link key={f} href={`/admin/tournaments?filter=${f}`} className={cn("chip", filter === f ? "border-electric text-white" : "text-muted")}>{f}</Link>)}
      </div>
      {rows.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Name</th><th>Div</th><th>Pairs</th><th>Venue</th><th className="text-right">Players</th><th className="text-right">Matches</th><th>Status</th><th>Results</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="text-muted">{fmtDate(t.tournament_date)}</td>
                  <td><Link href={`/admin/tournaments/${t.id}`} className="font-semibold hover:text-white">{t.name}</Link>{t.is_demo && <span className="ml-2 chip text-muted">demo</span>}</td>
                  <td><DivisionBadge code={t.division_code} /></td>
                  <td className="text-xs text-muted">{PAIR_TYPE_LABELS[t.pair_type]}</td>
                  <td className="text-xs text-muted">{t.club_name ?? "–"}</td>
                  <td className="text-right tabular-nums">{t.registered}{t.max_players ? `/${t.max_players}` : ""}</td>
                  <td className="text-right tabular-nums">{t.done}{t.open ? <span className="text-muted"> +{t.open}</span> : ""}</td>
                  <td><StatusChip status={t.status} /></td>
                  <td>{t.results_published ? <span className="text-xs font-semibold text-ice">Published</span> : <span className="text-xs text-muted">Not published</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No tournaments" action={<Link href="/admin/tournaments/new" className="btn-primary btn-sm">Create one</Link>} />}
    </>
  );
}
