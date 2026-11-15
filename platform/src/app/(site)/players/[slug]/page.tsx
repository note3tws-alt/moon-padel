import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, ResultPill, StatTile } from "@/components/ui";
import { MonthlyBarChart, RatingChart, WinLossDonut } from "@/components/charts";
import { getPlayerProfile } from "@/lib/queries";
import { countryName } from "@/lib/countries";
import { fmtDate, fmtMonth, fmtNumber, fmtRating, setsToString, winPct } from "@/lib/utils";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPlayerProfile(slug);
  if (!data) return { title: "Player not found" };
  return { title: data.player.full_name, description: `${data.player.full_name}: MoonPadel rating, ranking, results and match history.` };
}

export default async function PlayerPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getPlayerProfile(decodeURIComponent(slug));
  if (!data) notFound();
  const { player: p, ratingHistory, monthly, matches, tournaments, divisionHistory, pairs, partners, divisionChampionships, bestRank } = data;

  const ratingSeries = ratingHistory.map((r) => ({ label: fmtDate(r.rated_at, { day: "numeric", month: "short" }), rating: Number(r.rating_after) }));
  const monthLabel = (period: string) => new Date(`${period}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  const pointsSeries = monthly.map((m) => ({ label: monthLabel(m.period), value: Number(m.points) }));
  const participation = monthly.map((m) => ({ label: monthLabel(m.period), value: Number(m.tournaments) }));
  const form = matches.slice(0, 10);

  return (
    <main className="container-page py-12">
      <Link href="/players" className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-silver">← All players</Link>

      {/* Header */}
      <section className="card mt-4 overflow-hidden">
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-night-fade opacity-80" aria-hidden />
          <div className="relative"><Avatar name={p.full_name} src={p.photo_url} size={112} ring /></div>
          <div className="relative flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DivisionBadge code={p.division_code} name={p.division_name} size="md" />
              <span className="chip text-muted">ID {p.player_code}</span>
              {p.titles > 0 && <span className="chip border-gold/40 text-gold">{p.titles} title{p.titles > 1 ? "s" : ""}</span>}
            </div>
            <h1 className="h-display mt-3 text-4xl sm:text-5xl">{p.full_name}</h1>
            <p className="mt-2 text-sm text-muted">
              {p.country_code && <><Flag code={p.country_code} className="mr-1.5" />{countryName(p.country_code)}</>}
              {p.nationality && p.nationality !== countryName(p.country_code) && <> · {p.nationality}</>}
              {p.playing_side && <> · Plays {p.playing_side === "both" ? "both sides" : `${p.playing_side} side`}</>}
            </p>
          </div>
          <div className="relative grid grid-cols-2 gap-6 text-right sm:grid-cols-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Rating</p>
              <p className="text-gradient-padel text-4xl font-extrabold tabular-nums">{fmtRating(p.rating, p.rating_visible)}</p>
              {!p.rating_visible && <p className="text-[11px] text-muted">Shown after more matches</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Ranking</p>
              <p className="text-4xl font-extrabold tabular-nums">{p.overall_rank ? `#${p.overall_rank}` : "–"}</p>
              {p.division_rank && <p className="text-[11px] text-muted">#{p.division_rank} in {p.division_code}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total points" value={fmtNumber(p.total_points)} accent />
        <StatTile label="Matches" value={p.matches} />
        <StatTile label="Won" value={p.wins} />
        <StatTile label="Lost" value={p.losses} />
        <StatTile label="Win %" value={winPct(p.wins, p.matches)} />
        <StatTile label="Tournaments" value={p.tournaments} hint={p.podiums ? `${p.podiums} podium${p.podiums > 1 ? "s" : ""}` : undefined} />
      </section>

      {/* Charts */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Rating progression</h2>
            {p.rating_change_30d !== 0 && <span className={`text-xs font-bold ${p.rating_change_30d > 0 ? "text-ice" : "text-[#f2a08c]"}`}>{p.rating_change_30d > 0 ? "+" : ""}{Number(p.rating_change_30d).toFixed(2)} in 30 days</span>}
          </div>
          <RatingChart data={ratingSeries} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Win / loss</h2>
          <WinLossDonut wins={p.wins} losses={p.losses} />
          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">Recent form</h3>
          {form.length ? (
            <div className="flex flex-wrap gap-1.5">{form.map((m) => <ResultPill key={m.id} won={m.winner === m.team} draw={m.winner === "D"} />)}</div>
          ) : <p className="text-sm text-muted">No matches yet.</p>}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Monthly points</h2>
          <MonthlyBarChart data={pointsSeries} unit="pts" />
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Tournament participation</h2>
          <MonthlyBarChart data={participation} unit="tournaments" />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Achievements */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Achievements</h2>
          <ul className="space-y-3 text-sm">
            {p.titles > 0 && <Achievement gold title={`${p.titles} tournament title${p.titles > 1 ? "s" : ""}`} />}
            {divisionChampionships.map((c) => <Achievement key={`${c.period}${c.code}`} gold title={`${c.code} champion`} sub={fmtMonth(c.period)} />)}
            {p.podiums > 0 && <Achievement title={`${p.podiums} podium finish${p.podiums > 1 ? "es" : ""}`} />}
            {bestRank && <Achievement title={`Best monthly rank: #${bestRank}`} />}
            {p.matches >= 50 && <Achievement title="50+ matches played" />}
            {!p.titles && !p.podiums && !bestRank && <li className="text-muted">Achievements appear as results come in.</li>}
          </ul>
        </div>

        {/* Ranking history */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Ranking history</h2>
          {monthly.length ? (
            <table className="table-base">
              <thead><tr><th className="!px-0">Month</th><th className="text-right">Rank</th><th className="text-right">Pts</th><th className="text-right !pr-0">T</th></tr></thead>
              <tbody>
                {[...monthly].reverse().map((m) => (
                  <tr key={m.period}>
                    <td className="!px-0"><Link className="hover:text-white" href={`/leaderboard?period=${m.period.slice(0, 7)}`}>{fmtMonth(m.period)}</Link></td>
                    <td className={`text-right font-bold tabular-nums ${m.is_champion ? "text-gold" : ""}`}>#{m.rank}</td>
                    <td className="text-right tabular-nums text-ice">{fmtNumber(m.points)}</td>
                    <td className="!pr-0 text-right tabular-nums">{m.tournaments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted">No ranked months yet.</p>}
        </div>

        {/* Partners */}
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Partner history</h2>
          {pairs.length > 0 && (
            <div className="mb-4 space-y-2">
              {pairs.map((pr) => (
                <Link key={pr.slug} href={`/pairs/${pr.slug}`} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm hover:border-electric/40">
                  <span><span className="font-bold">{pr.name}</span><span className="block text-xs text-muted">Fixed pair with {(pr.partners ?? []).map((x: { name: string }) => x.name).join(", ")}</span></span>
                  <span className="text-xs text-muted">{pr.overall_rank ? `#${pr.overall_rank}` : ""}</span>
                </Link>
              ))}
            </div>
          )}
          {partners.length ? (
            <ul className="space-y-1 text-sm">
              {partners.slice(0, 8).map((x) => (
                <li key={x.slug} className="flex items-center justify-between">
                  <Link href={`/players/${x.slug}`} className="hover:text-white">{x.name}</Link>
                  <span className="text-xs tabular-nums text-muted">{x.matches} played · {winPct(x.wins, x.matches)} won</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No partners yet.</p>}
        </div>
      </section>

      {/* Tournaments */}
      <section className="mt-6 card p-5">
        <h2 className="mb-4 font-bold">Tournament participation</h2>
        {tournaments.length ? (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Tournament</th><th>Div</th><th className="text-right">Finish</th><th className="text-right">W-L</th><th className="text-right">Pts</th></tr></thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.slug}>
                    <td className="text-muted">{fmtDate(t.tournament_date)}</td>
                    <td><Link href={`/tournaments/${t.slug}`} className="font-semibold hover:text-white">{t.name}</Link></td>
                    <td><DivisionBadge code={t.division_code} /></td>
                    <td className={`text-right font-bold tabular-nums ${t.final_position === 1 ? "text-gold" : ""}`}>{t.final_position ? `${t.final_position} / ${t.field_size}` : "–"}</td>
                    <td className="text-right tabular-nums">{t.wins}-{t.losses}</td>
                    <td className="text-right tabular-nums text-ice">{fmtNumber(t.total_points, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No tournaments yet" />}
      </section>

      {/* Match history */}
      <section className="mt-6 card p-5">
        <h2 className="mb-4 font-bold">Match history</h2>
        {matches.length ? (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th></th><th>Tournament</th><th>Rd / Ct</th><th>Partner</th><th>Opponents</th><th>Score</th><th className="text-right">RTG ±</th></tr></thead>
              <tbody>
                {matches.slice(0, 40).map((m) => {
                  const others = (m.others ?? []) as { name: string; slug: string; team: string }[];
                  const partner = others.filter((o) => o.team === m.team);
                  const opp = others.filter((o) => o.team !== m.team);
                  const sets = (m.set_scores as number[][]).map(([a, b]) => (m.team === "A" ? [a, b] : [b, a]));
                  return (
                    <tr key={m.id}>
                      <td><ResultPill won={m.winner === m.team} draw={m.winner === "D"} /></td>
                      <td><Link href={`/tournaments/${m.tournament_slug}`} className="hover:text-white">{m.tournament_name}</Link><span className="block text-xs text-muted">{fmtDate(m.tournament_date)}</span></td>
                      <td className="tabular-nums text-muted">R{m.round_number} · C{m.court_number}</td>
                      <td>{partner.map((o) => <Link key={o.slug} href={`/players/${o.slug}`} className="hover:text-white">{o.name}</Link>)}</td>
                      <td className="text-muted">{opp.map((o, i) => <span key={o.slug}>{i > 0 && " & "}<Link href={`/players/${o.slug}`} className="hover:text-silver">{o.name}</Link></span>)}</td>
                      <td className="font-semibold tabular-nums">{setsToString(sets)}</td>
                      <td className={`text-right tabular-nums ${m.rating_delta > 0 ? "text-ice" : m.rating_delta < 0 ? "text-[#f2a08c]" : "text-muted"}`}>{m.rating_delta != null ? `${m.rating_delta > 0 ? "+" : ""}${Number(m.rating_delta).toFixed(2)}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {matches.length > 40 && <p className="mt-3 text-xs text-muted">Showing the latest 40 of {matches.length} matches.</p>}
          </div>
        ) : <EmptyState title="No matches yet" />}
      </section>

      {divisionHistory.length > 0 && (
        <section className="mt-6 card p-5">
          <h2 className="mb-4 font-bold">Division history</h2>
          <ul className="space-y-2 text-sm">
            {divisionHistory.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="w-28 text-muted">{fmtDate(h.created_at)}</span>
                <span className="chip text-muted">{h.kind}</span>
                <span>{h.from_code ? `${h.from_code} → ` : ""}{h.to_code ?? "No division"}</span>
                {h.reason && <span className="text-muted">· {h.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Achievement({ title, sub, gold }: { title: string; sub?: string; gold?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${gold ? "bg-gold" : "bg-electric"}`} />
      <span><span className="font-semibold">{title}</span>{sub && <span className="block text-xs text-muted">{sub}</span>}</span>
    </li>
  );
}

// Rendered on first visit, then cached like the rest of the public site.
export async function generateStaticParams() {
  return [];
}
