import Link from "next/link";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, Pagination, RankBadge } from "@/components/ui";
import { UrlSelect } from "@/components/url-select";
import { getAvailablePeriods, getDivisions, getLeaderboard, type SortKey } from "@/lib/queries";
import { cn, currentPeriod, fmtMonth, fmtNumber, fmtRating, winPct } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaderboard", description: "MoonPadel player and pair rankings by division, month and all time." };

type SP = Record<string, string | undefined>;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = sp.type === "pairs" ? "pair" : "individual";
  const [divisions, periods] = await Promise.all([getDivisions(), getAvailablePeriods()]);
  const periodParam = sp.period ?? currentPeriod().slice(0, 7);
  const period = periodParam === "all" ? null : /^\d{4}-\d{2}$/.test(periodParam) ? `${periodParam}-01` : currentPeriod();
  const division = divisions.find((d) => d.code.toLowerCase() === (sp.division ?? "").toLowerCase()) ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await getLeaderboard({ mode, period, divisionId: division?.id ?? null, q: sp.q, sort: sp.sort as SortKey, dir: sp.dir as "asc" | "desc", page, pageSize: 25 });

  const href = (patch: SP) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/leaderboard?${next.toString()}`;
  };
  const sortHref = (key: SortKey) => {
    const isCurrent = data.sort === key;
    const defaultDir = key === "rank" || key === "name" ? "asc" : "desc";
    const dir = isCurrent ? (data.dir === "asc" ? "desc" : "asc") : defaultDir;
    return href({ sort: key, dir, page: undefined });
  };
  const SortTh = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={className} aria-sort={data.sort === k ? (data.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={sortHref(k)} scroll={false} className={cn("inline-flex items-center gap-1 hover:text-silver", data.sort === k && "text-ice")}>
        {children}{data.sort === k && <span aria-hidden>{data.dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
  const top3 = page === 1 && !sp.q && data.sort === "rank" ? data.rows.filter((r) => r.rank <= 3).slice(0, 3) : [];

  return (
    <main className="container-page py-12">
      <p className="label">Rankings</p>
      <h1 className="h-display mt-3 text-4xl sm:text-5xl">Leaderboard</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {period ? `${fmtMonth(period)} standings` : "All-time standings"}{division ? ` for ${division.code} ${division.name}` : " across all divisions"}. Updated automatically when verified results are published.
      </p>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-night p-1" role="tablist" aria-label="Pair type">
            {[{ v: undefined, l: "Non-fixed pairs" }, { v: "pairs", l: "Fixed pairs" }].map((o) => (
              <Link key={o.l} role="tab" aria-selected={(o.v === "pairs") === (mode === "pair")} href={href({ type: o.v, page: undefined, sort: undefined, dir: undefined })} scroll={false}
                className={cn("rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition", (o.v === "pairs") === (mode === "pair") ? "bg-electric text-white" : "text-muted hover:text-silver")}>{o.l}</Link>
            ))}
          </div>
          <UrlSelect name="period" label="Period" value={period ? period.slice(0, 7) : "all"}
            options={[...periods.map((p) => ({ value: p.slice(0, 7), label: fmtMonth(p) })), { value: "all", label: "All time" }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" aria-label="Division">
            <Link href={href({ division: undefined, page: undefined })} scroll={false} className={cn("chip", !division ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver")}>Overall</Link>
            {divisions.filter((d) => d.active).map((d) => (
              <Link key={d.id} href={href({ division: d.code, page: undefined })} scroll={false} className={cn("chip", division?.id === d.id ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver")}>{d.code} {d.name}</Link>
            ))}
          </div>
          <form action="/leaderboard" className="flex w-full gap-2 sm:w-auto" role="search">
            {Object.entries(sp).filter(([k, v]) => v && !["q", "page"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input name="q" defaultValue={sp.q} placeholder={mode === "pair" ? "Search pairs or players" : "Search players"} className="input sm:w-64" aria-label="Search" />
            <button className="btn-ghost btn-sm">Search</button>
          </form>
        </div>
      </div>

      {/* Podium */}
      {top3.length === 3 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {top3.map((r, i) => (
            <Link key={r.id} href={mode === "pair" ? `/pairs/${r.slug}` : `/players/${r.slug}`}
              className={cn("card flex items-center gap-4 p-5 transition hover:border-electric/40", ["sm:order-2", "sm:order-1", "sm:order-3"][i], r.rank === 1 && "border-gold/40 sm:-translate-y-2 bg-gradient-to-b from-gold/10 to-night")}>
              <RankBadge rank={r.rank} />
              {mode === "individual" && <Avatar name={r.name} src={r.photo_url} size={48} gold={r.rank === 1} />}
              <div className="min-w-0">
                <p className="truncate font-bold"><Flag code={r.country_code} className="mr-1" />{r.name}</p>
                <p className="text-xs text-muted">{fmtNumber(r.points)} pts · {r.wins}W {r.losses}L</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="mt-6">
        {data.rows.length ? (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <SortTh k="rank" className="w-14">#</SortTh>
                  <SortTh k="name">{mode === "pair" ? "Pair" : "Player"}</SortTh>
                  <SortTh k="rating" className="text-right">RTG</SortTh>
                  <SortTh k="points" className="text-right">PTS</SortTh>
                  <SortTh k="tournaments" className="text-right">T</SortTh>
                  <SortTh k="wins" className="text-right">W</SortTh>
                  <th className="text-right">L</th>
                  <SortTh k="winpct" className="text-right">Win %</SortTh>
                  <th>Div</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className={cn(r.rank <= 3 && "bg-white/[0.015]")}>
                    <td><RankBadge rank={r.rank} /></td>
                    <td>
                      <Link href={mode === "pair" ? `/pairs/${r.slug}` : `/players/${r.slug}`} className="flex items-center gap-3 font-semibold hover:text-white">
                        {mode === "individual" && <Avatar name={r.name} src={r.photo_url} size={32} />}
                        <span>
                          <Flag code={r.country_code} className="mr-1.5" />{r.name}
                          {mode === "pair" && <span className="block text-xs font-normal text-muted">{(r.members ?? []).map((m: { name: string }) => m.name).join(" & ")}</span>}
                        </span>
                        {r.is_champion && <span className="chip border-gold/40 text-gold">Champion</span>}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">{fmtRating(r.rating, mode === "pair" || r.rating_visible)}</td>
                    <td className="text-right font-bold tabular-nums text-ice">{fmtNumber(r.points, Number.isInteger(r.points) ? 0 : 1)}</td>
                    <td className="text-right tabular-nums">{r.tournaments}</td>
                    <td className="text-right tabular-nums">{r.wins}</td>
                    <td className="text-right tabular-nums text-muted">{r.losses}</td>
                    <td className="text-right tabular-nums">{winPct(r.wins, r.matches)}</td>
                    <td><DivisionBadge code={r.division_code} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={sp.q ? "No players match your search" : "No rankings for this selection yet"} body={sp.q ? "Try a different name or clear the search." : "Rankings appear as soon as verified results are published."} action={sp.q ? <Link href={href({ q: undefined })} className="btn-ghost btn-sm">Clear search</Link> : undefined} />
        )}
        <Pagination page={data.page} total={data.total} pageSize={data.pageSize} hrefFor={(p) => href({ page: String(p) })} />
        <p className="mt-6 text-xs text-muted">RTG is shown once a player has enough verified matches. PTS counts the best tournaments set in the ruleset. <Link href="/rules" className="text-ice hover:underline">How rankings work</Link></p>
      </div>
    </main>
  );
}
