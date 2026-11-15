import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { DivisionBadge } from "@/components/brand";
import { EmptyState, Flag, Pagination } from "@/components/ui";
import { sql } from "@/lib/db";
import { getDivisions } from "@/lib/queries";
import { cn, fmtNumber, fmtRating } from "@/lib/utils";

export const metadata = { title: "Players" };

export default async function AdminPlayers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = sql();
  const divisions = await getDivisions();
  const division = divisions.find((d) => d.code === sp.division) ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 50;
  const q = sp.q?.trim() ? `%${sp.q.trim().toLowerCase()}%` : null;
  const rows = await db`
    select p.id, p.player_code, p.full_name, p.country_code, p.status, p.is_demo, d.code as division_code, s.rating, s.matches, s.overall_rank, s.total_points,
           pp.email, pp.phone, count(*) over() as total
    from players p left join divisions d on d.id = p.division_id left join player_stats s on s.player_id = p.id left join player_private pp on pp.player_id = p.id
    where true
      ${division ? db`and p.division_id = ${division.id}` : db``}
      ${sp.status ? db`and p.status = ${sp.status}` : db``}
      ${q ? db`and (lower(p.full_name) like ${q} or lower(p.player_code) like ${q} or lower(coalesce(pp.email::text, '')) like ${q} or coalesce(pp.phone, '') like ${q})` : db``}
    order by p.full_name limit ${pageSize} offset ${(page - 1) * pageSize}`;
  const total = Number(rows[0]?.total ?? 0);
  const href = (patch: Record<string, string | undefined>) => { const n = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) n.set(k, v); return `/admin/players?${n}`; };
  return (
    <>
      <PageHeader title="Players" description={`${total} players${division ? ` in ${division.code}` : ""}. Contact details are private to admins.`}
        actions={<><Link href="/admin/players/new" className="btn-primary btn-sm">Add player</Link><Link href="/admin/upload?kind=players" className="btn-ghost btn-sm">Bulk upload</Link><a href="/api/admin/export/players" className="btn-ghost btn-sm">Export CSV</a></>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex gap-2" action="/admin/players">
          {division && <input type="hidden" name="division" value={division.code} />}
          <input name="q" defaultValue={sp.q} placeholder="Name, ID, email or phone" className="input w-64" />
          <button className="btn-ghost btn-sm">Search</button>
        </form>
        <Link href={href({ division: undefined, page: undefined })} className={cn("chip", !division ? "border-electric text-white" : "text-muted")}>All</Link>
        {divisions.map((d) => <Link key={d.id} href={href({ division: d.code, page: undefined })} className={cn("chip", division?.id === d.id ? "border-electric text-white" : "text-muted")}>{d.code}</Link>)}
        <Link href={href({ status: sp.status === "inactive" ? undefined : "inactive", page: undefined })} className={cn("chip", sp.status === "inactive" ? "border-electric text-white" : "text-muted")}>Inactive only</Link>
      </div>
      {rows.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>ID</th><th>Name</th><th>Division</th><th className="text-right">RTG</th><th className="text-right">Rank</th><th className="text-right">Pts</th><th className="text-right">Matches</th><th>Email</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-muted">{p.player_code}</td>
                  <td><Link href={`/admin/players/${p.id}`} className="font-semibold hover:text-white"><Flag code={p.country_code} className="mr-1.5" />{p.full_name}</Link>{p.is_demo && <span className="ml-2 chip text-muted">demo</span>}</td>
                  <td><DivisionBadge code={p.division_code} /></td>
                  <td className="text-right tabular-nums">{fmtRating(p.rating)}</td>
                  <td className="text-right tabular-nums">{p.overall_rank ?? "–"}</td>
                  <td className="text-right tabular-nums">{fmtNumber(p.total_points)}</td>
                  <td className="text-right tabular-nums">{p.matches ?? 0}</td>
                  <td className="text-xs text-muted">{p.email ?? "–"}</td>
                  <td className={p.status === "active" ? "text-ice" : "text-muted"}>{p.status}</td>
                  <td><Link href={`/admin/players/${p.id}`} className="btn-ghost btn-sm">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No players found" body="Add players one by one or upload a spreadsheet." action={<Link href="/admin/upload?kind=players" className="btn-primary btn-sm">Upload players</Link>} />}
      <Pagination page={page} total={total} pageSize={pageSize} hrefFor={(n) => href({ page: String(n) })} />
    </>
  );
}
