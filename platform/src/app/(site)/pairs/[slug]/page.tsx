import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, StatTile } from "@/components/ui";
import { MonthlyBarChart } from "@/components/charts";
import { getPairProfile } from "@/lib/queries";
import { fmtDate, fmtNumber, fmtRating, winPct } from "@/lib/utils";

type Params = { slug: string };
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPairProfile(slug);
  return { title: d ? `${d.pair.name} (pair)` : "Pair not found" };
}

export default async function PairPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getPairProfile(decodeURIComponent(slug));
  if (!data) notFound();
  const { pair, members, tournaments, monthly } = data;
  return (
    <main className="container-page py-12">
      <Link href="/leaderboard?type=pairs" className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-silver">← Pairs leaderboard</Link>
      <section className="card mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2"><DivisionBadge code={pair.division_code} name={pair.division_name} size="md" /><span className="chip text-muted">Fixed pair</span></div>
        <h1 className="h-display mt-3 text-4xl sm:text-5xl">{pair.name}</h1>
        <div className="mt-6 flex flex-wrap gap-4">
          {members.map((m) => (
            <Link key={m.slug} href={`/players/${m.slug}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-electric/40">
              <Avatar name={m.full_name} src={m.photo_url} size={44} />
              <span><span className="block font-bold"><Flag code={m.country_code} className="mr-1" />{m.full_name}</span><span className="text-xs text-muted">RTG {fmtRating(m.rating, m.rating_visible)}</span></span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Ranking" value={pair.overall_rank ? `#${pair.overall_rank}` : "–"} />
        <StatTile label="Pair rating" value={fmtRating(pair.rating)} accent />
        <StatTile label="Points" value={fmtNumber(pair.total_points)} />
        <StatTile label="Matches" value={pair.matches} />
        <StatTile label="W-L" value={`${pair.wins}-${pair.losses}`} hint={winPct(pair.wins, pair.matches)} />
        <StatTile label="Titles" value={pair.titles} />
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5"><h2 className="mb-3 font-bold">Monthly points</h2><MonthlyBarChart unit="pts" data={monthly.map((m) => ({ label: new Date(`${m.period}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), value: Number(m.points) }))} /></div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Tournaments</h2>
          {tournaments.length ? (
            <table className="table-base"><thead><tr><th className="!px-0">Date</th><th>Tournament</th><th className="text-right">Finish</th><th className="text-right">Pts</th></tr></thead>
              <tbody>{tournaments.map((t) => (
                <tr key={t.slug}><td className="!px-0 text-muted">{fmtDate(t.tournament_date)}</td><td><Link className="hover:text-white" href={`/tournaments/${t.slug}`}>{t.name}</Link></td>
                  <td className={`text-right font-bold ${t.final_position === 1 ? "text-gold" : ""}`}>{t.final_position ?? "–"}</td><td className="text-right text-ice">{fmtNumber(t.total_points, 1)}</td></tr>
              ))}</tbody></table>
          ) : <EmptyState title="No fixed-pair tournaments yet" />}
        </div>
      </section>
    </main>
  );
}
