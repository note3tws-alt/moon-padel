import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { Avatar, EmptyState, Flag, StatTile, StatusChip } from "@/components/ui";
import { getTournamentDetail } from "@/lib/queries";
import { FORMAT_LABELS, PAIR_TYPE_LABELS, fmtDate, fmtNumber, fmtRating, fmtTime, setsToString } from "@/lib/utils";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getTournamentDetail(slug);
  return d ? { title: d.t.name, description: `${d.t.name}: players, rounds, results and winners.` } : { title: "Tournament not found" };
}

export default async function TournamentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const data = await getTournamentDetail(decodeURIComponent(slug));
  if (!data) notFound();
  const { t, registrations, matches, standings } = data;
  const fixed = t.pair_type === "fixed";
  const table = standings.filter((s) => s.entity_type === (fixed ? "pair" : "player"));
  const winners = table.filter((s) => s.final_position === 1);
  const rounds = [...new Set(matches.map((m) => m.round_number))].sort((a, b) => a - b);
  const registered = registrations.filter((r) => r.status === "registered");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const totalGames = matches.reduce((s, m) => s + m.team_a_games + m.team_b_games, 0);
  const completed = matches.filter((m) => m.status === "completed");

  return (
    <main className="container-page py-12">
      <Link href="/tournaments" className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-silver">← All tournaments</Link>
      <section className="card relative mt-4 overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-night-fade" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2"><StatusChip status={t.status} /><DivisionBadge code={t.division_code} name={t.division_name} size="md" /></div>
          <h1 className="h-display mt-4 text-3xl sm:text-5xl">{t.name}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Info k="Date" v={fmtDate(t.tournament_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
            <Info k="Start" v={`${fmtTime(t.start_time)}${t.duration_minutes ? ` · ${t.duration_minutes} min` : ""}`} />
            <Info k="Venue" v={t.club_map_url ? <a href={t.club_map_url} target="_blank" rel="noreferrer" className="text-ice hover:underline">{t.club_name}</a> : t.club_name ?? "To be confirmed"} />
            <Info k="Format" v={`${FORMAT_LABELS[t.format]} · ${PAIR_TYPE_LABELS[t.pair_type]}`} />
            <Info k="Players" v={`${registered.length}${t.max_players ? ` / ${t.max_players}` : ""}`} />
            <Info k="Entry fee" v={t.entry_fee != null ? `${t.currency} ${fmtNumber(t.entry_fee, 0)}` : "To be announced"} />
          </dl>
          {t.description && <p className="mt-6 max-w-3xl text-sm text-muted">{t.description}</p>}
        </div>
      </section>

      {t.results_published && winners.length > 0 && (
        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="card border-gold/30 bg-gradient-to-br from-gold/10 to-night p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gold">Champion{winners.length > 1 && !fixed ? "s" : ""}</p>
            {winners.map((w) => (
              <Link key={w.id} href={fixed ? `/pairs/${w.pair_slug}` : `/players/${w.player_slug}`} className="mt-3 block">
                <p className="text-2xl font-extrabold"><Flag code={w.country_code} className="mr-2" />{fixed ? w.pair_name : w.player_name}</p>
                <p className="text-sm text-muted">{w.wins}W {w.losses}L · {fmtNumber(w.total_points, 1)} pts</p>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Matches" value={completed.length} />
            <StatTile label="Rounds" value={rounds.length} />
            <StatTile label="Games played" value={totalGames} />
            <StatTile label={fixed ? "Pairs" : "Players"} value={table.length} />
          </div>
        </section>
      )}

      {t.results_published && table.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-4 font-bold">Final standings</h2>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>#</th><th>{fixed ? "Pair" : "Player"}</th><th className="text-right">M</th><th className="text-right">W</th><th className="text-right">L</th><th className="text-right">Games</th><th className="text-right">Win pts</th><th className="text-right">Place pts</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {table.map((s) => (
                  <tr key={s.id}>
                    <td className={`font-extrabold ${s.final_position === 1 ? "text-gold" : "text-muted"}`}>{s.final_position ?? "–"}</td>
                    <td><Link href={fixed ? `/pairs/${s.pair_slug}` : `/players/${s.player_slug}`} className="font-semibold hover:text-white"><Flag code={s.country_code} className="mr-1.5" />{fixed ? s.pair_name : s.player_name}</Link></td>
                    <td className="text-right tabular-nums">{s.matches}</td>
                    <td className="text-right tabular-nums">{s.wins}</td>
                    <td className="text-right tabular-nums text-muted">{s.losses}</td>
                    <td className="text-right tabular-nums">{s.games_won}-{s.games_lost}</td>
                    <td className="text-right tabular-nums">{fmtNumber(s.win_points, 1)}</td>
                    <td className="text-right tabular-nums">{fmtNumber(s.placement_points, 1)}</td>
                    <td className="text-right font-bold tabular-nums text-ice">{fmtNumber(s.total_points, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rounds.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-4 font-bold">Rounds and results</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rounds.map((r) => (
              <div key={r} className="card p-4">
                <p className="label mb-3">Round {r}</p>
                <div className="space-y-2">
                  {matches.filter((m) => m.round_number === r).map((m) => {
                    const ps = (m.players ?? []) as { name: string; slug: string; team: string }[];
                    const team = (x: "A" | "B") => (
                      <span className={`block truncate ${m.winner === x ? "font-bold text-silver" : "text-muted"}`}>
                        {fixed && (x === "A" ? m.pair_a : m.pair_b) ? <span className="mr-1 text-ice">{x === "A" ? m.pair_a : m.pair_b}:</span> : null}
                        {ps.filter((p) => p.team === x).map((p, i) => <span key={p.slug}>{i > 0 && " & "}<Link href={`/players/${p.slug}`} className="hover:text-white">{p.name}</Link></span>)}
                      </span>
                    );
                    return (
                      <div key={m.id} className="rounded-xl border border-line bg-space/50 p-3 text-sm">
                        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
                          <span>Court {m.court_number}</span>
                          <span>{m.status === "completed" ? setsToString(m.set_scores) : m.status === "scheduled" ? "Scheduled" : ""}</span>
                        </div>
                        {team("A")}
                        <span className="my-0.5 block text-[10px] text-muted">vs</span>
                        {team("B")}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-6 p-5">
        <h2 className="mb-4 font-bold">Participating players <span className="text-muted">({registered.length})</span></h2>
        {registered.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {registered.map((r) => (
              <Link key={r.slug} href={`/players/${r.slug}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 hover:border-electric/40">
                <Avatar name={r.full_name} src={r.photo_url} size={34} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold"><Flag code={r.country_code} className="mr-1" />{r.full_name}</span>
                  <span className="block text-xs text-muted">{r.pair_name ? `${r.pair_name} · ` : ""}RTG {fmtRating(r.rating, r.rating_visible)}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="No players registered yet" />}
        {waitlist.length > 0 && <p className="mt-4 text-sm text-muted">Waitlist: {waitlist.map((w) => w.full_name).join(", ")}</p>}
      </section>
    </main>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>;
}
