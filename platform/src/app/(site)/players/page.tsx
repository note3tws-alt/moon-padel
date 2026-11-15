import Link from "next/link";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, Pagination } from "@/components/ui";
import { getDivisions, getPlayerDirectory } from "@/lib/queries";
import { cn, fmtNumber, fmtRating } from "@/lib/utils";

export const metadata: Metadata = { title: "Players", description: "Search MoonPadel players and open their profiles." };

export default async function PlayersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const divisions = await getDivisions();
  const division = divisions.find((d) => d.code.toLowerCase() === (sp.division ?? "").toLowerCase()) ?? null;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await getPlayerDirectory({ q: sp.q, divisionId: division?.id, page });
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    return `/players?${next}`;
  };
  return (
    <main className="container-page py-12">
      <p className="label">Community</p>
      <h1 className="h-display mt-3 text-4xl sm:text-5xl">Players</h1>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ division: undefined, page: undefined })} className={cn("chip", !division ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver")}>All</Link>
          {divisions.map((d) => (
            <Link key={d.id} href={href({ division: d.code, page: undefined })} className={cn("chip", division?.id === d.id ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver")}>{d.code} {d.name}</Link>
          ))}
        </div>
        <form action="/players" className="flex w-full gap-2 sm:w-auto" role="search">
          {division && <input type="hidden" name="division" value={division.code} />}
          <input name="q" defaultValue={sp.q} placeholder="Search by name or player ID" className="input sm:w-72" aria-label="Search players" />
          <button className="btn-ghost btn-sm">Search</button>
        </form>
      </div>
      <div className="mt-6">
        {data.rows.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.rows.map((p) => (
              <Link key={p.id} href={`/players/${p.slug}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-electric/40">
                <Avatar name={p.full_name} src={p.photo_url} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold"><Flag code={p.country_code} className="mr-1" />{p.full_name}</p>
                  <div className="mt-1 flex items-center gap-2"><DivisionBadge code={p.division_code} /><span className="text-[11px] text-muted">{p.player_code}</span></div>
                  <p className="mt-1.5 text-xs text-muted">RTG <span className="font-semibold text-silver">{fmtRating(p.rating, p.rating_visible)}</span> · {fmtNumber(p.total_points)} pts{p.overall_rank ? ` · #${p.overall_rank}` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No players found" body={sp.q ? "Try another name or player ID." : "Players appear here once they are added in the admin dashboard."} />}
        <Pagination page={data.page} total={data.total} pageSize={data.pageSize} hrefFor={(p) => href({ page: String(p) })} />
      </div>
    </main>
  );
}
