import Link from "next/link";
import { MoonMark, DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, SectionHeading, StatTile } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { TournamentCard, type TournamentCardData } from "@/components/tournament-card";
import {
  getDivisions, getLatestChampions, getLeagueStats, getMonthlyChampions, getRisingPlayers, getSettings, getTopByDivision, getUpcomingTournaments,
} from "@/lib/queries";
import { currentPeriod, fmtDate, fmtMonth, fmtNumber } from "@/lib/utils";

function previousPeriod(p: string) {
  const d = new Date(`${p}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.toISOString().slice(0, 7)}-01`;
}

export default async function HomePage() {
  const period = currentPeriod();
  const lastPeriod = previousPeriod(period);
  const [{ general }, divisions, upcoming, top, champs, latest, rising7, rising30, stats] = await Promise.all([
    getSettings(), getDivisions(), getUpcomingTournaments(6), getTopByDivision(period), getMonthlyChampions(lastPeriod),
    getLatestChampions(), getRisingPlayers(7, 5), getRisingPlayers(30, 5), getLeagueStats(),
  ]);
  const rising = rising7.length ? rising7 : rising30;
  const risingWindow = rising7.length ? 7 : 30;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <p className="label">{general.city} padel league</p>
            <h1 className="h-display mt-5 text-5xl sm:text-7xl lg:text-8xl">
              {general.heroTitle.split(" ").map((w, i, arr) => (
                <span key={i} className={i === arr.length - 1 ? "text-gradient-padel" : ""}>{w}{i < arr.length - 1 ? " " : ""}</span>
              ))}
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">{general.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/leaderboard" className="btn-primary">View leaderboard</Link>
              <Link href="/tournaments" className="btn-ghost">Explore tournaments</Link>
            </div>
            <p className="mt-10 text-xs font-medium uppercase tracking-brand text-ice/70">{general.tagline.replace(/\.$/, "")}</p>
          </Reveal>
          <Reveal delay={0.15} className="relative mx-auto">
            <div className="relative h-64 w-64 sm:h-80 sm:w-80 lg:h-[26rem] lg:w-[26rem]">
              <div className="absolute inset-0 rounded-full bg-electric/10 blur-3xl" aria-hidden />
              <MoonMark size={416} glow priority className="!h-full !w-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* League stats */}
      <section className="container-page">
        <Reveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Registered players" value={fmtNumber(stats.players)} />
          <StatTile label="Tournaments played" value={fmtNumber(stats.tournaments)} />
          <StatTile label="Matches played" value={fmtNumber(stats.matches)} />
          <StatTile label="Active divisions" value={fmtNumber(stats.divisions)} />
          <StatTile label="Partner venues" value={fmtNumber(stats.clubs)} />
        </Reveal>
      </section>

      {/* Upcoming */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow="Book your night" title="Upcoming tournaments" action={<Link href="/tournaments" className="btn-ghost btn-sm">All tournaments</Link>} />
        {upcoming.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((t, i) => <Reveal key={t.slug} delay={i * 0.05}><TournamentCard t={t as unknown as TournamentCardData} /></Reveal>)}
          </div>
        ) : (
          <EmptyState title="No tournaments scheduled yet" body="New dates are announced on Instagram and WhatsApp first." />
        )}
      </section>

      {/* Live monthly standings */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow={`Live · ${fmtMonth(period)}`} title="Monthly standings" action={<Link href="/leaderboard" className="btn-ghost btn-sm">Full leaderboard</Link>} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {divisions.filter((d) => d.active).map((d, i) => {
            const rows = top.filter((r) => r.division_id === d.id);
            return (
              <Reveal key={d.id} delay={i * 0.05} className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <DivisionBadge code={d.code} name={d.name} sortOrder={d.sort_order} size="md" />
                  <Link href={`/leaderboard?division=${d.code}`} className="text-xs font-semibold text-ice hover:text-white">View</Link>
                </div>
                {rows.length ? (
                  <ol className="space-y-1">
                    {rows.map((r) => (
                      <li key={r.slug}>
                        <Link href={`/players/${r.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                          <span className={`w-5 text-center text-sm font-extrabold tabular-nums ${r.rank === 1 ? "text-gold" : "text-muted"}`}>{r.rank}</span>
                          <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-semibold"><Flag code={r.country_code} />{r.name}</span>
                          <span className="text-sm font-bold tabular-nums text-ice">{fmtNumber(r.points)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : <p className="py-6 text-center text-sm text-muted">No results this month yet.</p>}
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Monthly champions */}
      <section className="container-page mt-20">
        <SectionHeading eyebrow={fmtMonth(lastPeriod)} title="Monthly champions" />
        {champs.players.length || champs.pairs.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {divisions.map((d, i) => {
              const p = champs.players.find((c) => c.division_id === d.id);
              const pr = champs.pairs.find((c) => c.division_id === d.id);
              if (!p && !pr) return null;
              return (
                <Reveal key={d.id} delay={i * 0.05} className="card relative overflow-hidden p-5">
                  <div className="absolute -right-8 -top-8 opacity-20"><MoonMark size={120} phase="full" /></div>
                  <DivisionBadge code={d.code} name={d.name} sortOrder={d.sort_order} />
                  {p && (
                    <Link href={`/players/${p.slug}`} className="mt-5 flex items-center gap-3">
                      <Avatar name={p.name} src={p.photo_url} size={56} gold />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Player of the month</p>
                        <p className="font-bold"><Flag code={p.country_code} className="mr-1" />{p.name}</p>
                        <p className="text-xs text-muted">{fmtNumber(p.points)} pts · {p.tournaments} tournaments · {p.wins}W</p>
                      </div>
                    </Link>
                  )}
                  {pr && (
                    <Link href={`/pairs/${pr.slug}`} className="mt-4 block rounded-xl border border-line px-3 py-2.5 hover:border-gold/40">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gold">Pair of the month</p>
                      <p className="text-sm font-bold">{pr.name}</p>
                      <p className="text-xs text-muted">{fmtNumber(pr.points)} pts · {pr.wins}W</p>
                    </Link>
                  )}
                </Reveal>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Champions appear when a month closes" body="The top player and pair of each division are crowned automatically on the first day of the next month." />
        )}
      </section>

      <section className="container-page mt-20 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Latest champions */}
        <div>
          <SectionHeading eyebrow="Results" title="Latest tournament champions" />
          {latest.length ? (
            <div className="card divide-y divide-line">
              {latest.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.slug}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-white/[0.03]">
                  <DivisionBadge code={t.division_code} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {((t.winners ?? []) as { name: string; country?: string }[]).map((w, i) => (
                        <span key={i}>{i > 0 && " & "}<Flag code={w.country} className="mr-1" />{w.name}</span>
                      ))}
                      {!(t.winners ?? []).length && <span className="text-muted">Winner pending</span>}
                    </p>
                    <p className="truncate text-xs text-muted">{t.name}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted">{fmtDate(t.tournament_date, { day: "numeric", month: "short" })}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No results published yet" />}
        </div>

        {/* Rising players */}
        <div>
          <SectionHeading eyebrow={`Last ${risingWindow} days`} title="Rising players" />
          {rising.length ? (
            <div className="card divide-y divide-line">
              {rising.map((p, i) => (
                <Link key={p.slug} href={`/players/${p.slug}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03]">
                  <span className="w-4 text-sm font-bold text-muted">{i + 1}</span>
                  <Avatar name={p.name} src={p.photo_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold"><Flag code={p.country_code} className="mr-1" />{p.name}</p>
                    <p className="text-xs text-muted">{p.division_code} · RTG {p.rating?.toFixed(2)}</p>
                  </div>
                  <span className="rounded-full bg-electric/15 px-2.5 py-1 text-xs font-extrabold tabular-nums text-ice">+{Number(p.change).toFixed(2)}</span>
                </Link>
              ))}
            </div>
          ) : <EmptyState title="No rating changes in this window" />}
        </div>
      </section>
    </main>
  );
}
