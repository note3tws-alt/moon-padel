import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState, Pagination } from "@/components/ui";
import { UrlSelect } from "@/components/url-select";
import { sql } from "@/lib/db";
import { fmtDate, setsToString } from "@/lib/utils";

export const metadata = { title: "Matches & results" };

export default async function AdminMatches({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = sql();
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 50;
  const tournaments = await db`select id, name, tournament_date from tournaments order by tournament_date desc limit 200`;
  const tid = sp.tournament && /^[0-9a-f-]{36}$/.test(sp.tournament) ? sp.tournament : null;
  const rows = await db`
    select m.id, m.round_number, m.court_number, m.set_scores, m.winner, m.status, m.verified, m.updated_at, t.name as tournament_name, t.id as tournament_id, t.tournament_date, t.results_published,
           (select string_agg(p.full_name, ' & ' order by p.full_name) from match_players mp join players p on p.id = mp.player_id where mp.match_id = m.id and mp.team = 'A') as team_a,
           (select string_agg(p.full_name, ' & ' order by p.full_name) from match_players mp join players p on p.id = mp.player_id where mp.match_id = m.id and mp.team = 'B') as team_b,
           count(*) over() as total
    from matches m join tournaments t on t.id = m.tournament_id
    where true ${tid ? db`and t.id = ${tid}` : db``} ${sp.status ? db`and m.status = ${sp.status}` : db``} ${sp.unverified ? db`and not m.verified` : db``}
    order by t.tournament_date desc, m.round_number, m.court_number
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  const total = Number(rows[0]?.total ?? 0);
  return (
    <>
      <PageHeader title="Matches & results" description="Every edit is recorded in the audit log. Editing a match in a published tournament recalculates ratings and rankings automatically."
        actions={<><Link href={`/admin/matches/new${tid ? `?tournament=${tid}` : ""}`} className="btn-primary btn-sm">Add match</Link><Link href="/admin/upload?kind=matches" className="btn-ghost btn-sm">Upload results</Link></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <UrlSelect name="tournament" label="Tournament" value={tid ?? ""} options={[{ value: "", label: "All tournaments" }, ...tournaments.map((t) => ({ value: t.id, label: `${t.name} · ${fmtDate(t.tournament_date)}` }))]} />
        <UrlSelect name="status" label="Status" value={sp.status ?? ""} options={[{ value: "", label: "Any status" }, { value: "completed", label: "Completed" }, { value: "scheduled", label: "Scheduled" }, { value: "void", label: "Void" }]} />
      </div>
      {rows.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Tournament</th><th>R/C</th><th>Team A</th><th>Team B</th><th>Score</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/admin/tournaments/${m.tournament_id}`} className="hover:text-white">{m.tournament_name}</Link><span className="block text-xs text-muted">{fmtDate(m.tournament_date)}{m.results_published ? " · published" : ""}</span></td>
                  <td className="tabular-nums text-muted">R{m.round_number} C{m.court_number}</td>
                  <td className={m.winner === "A" ? "font-semibold" : "text-muted"}>{m.team_a}</td>
                  <td className={m.winner === "B" ? "font-semibold" : "text-muted"}>{m.team_b}</td>
                  <td className="tabular-nums">{setsToString(m.set_scores) || "–"}</td>
                  <td className="text-xs">{m.status}{!m.verified && <span className="ml-1 text-[#f2a08c]">unverified</span>}</td>
                  <td><Link href={`/admin/matches/${m.id}`} className="btn-ghost btn-sm">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No matches" />}
      <Pagination page={page} total={total} pageSize={pageSize} hrefFor={(n) => { const q = new URLSearchParams(Object.entries({ ...sp, page: String(n) }).filter(([, v]) => v) as [string, string][]); return `/admin/matches?${q}`; }} />
    </>
  );
}
