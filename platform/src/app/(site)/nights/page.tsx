import type { Metadata } from "next";
import Link from "next/link";
import { MoonMark } from "@/components/brand";
import { EmptyState, SectionHeading } from "@/components/ui";
import { publicEventsFeed } from "@/lib/ladder/public";
import { fmtDate, fmtTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Ladder nights",
  description: "MoonPadel Ladder Americano nights in Dubai: 16 players, 4 courts, 6 rounds, rotating partners. Upcoming nights, podiums and lifetime points.",
};

export default async function Nights() {
  const feed = await publicEventsFeed();
  return (
    <div className="container-page py-10">
      <p className="label">MoonPadel Ladder Americano</p>
      <h1 className="h-display mt-3 max-w-3xl text-4xl sm:text-5xl">16 players. 4 courts. 6 rounds. One ladder.</h1>
      <p className="mt-4 max-w-2xl text-muted">Partners change every round. Win and your pair moves up a court; lose and you move down. Every game your team wins is yours to keep, tonight and on your lifetime total.</p>

      <section className="mt-12">
        <SectionHeading eyebrow="Coming up" title="Next nights" />
        {feed.upcoming.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feed.upcoming.map((e) => {
              const live = ["checkin_open", "ready", "round_live", "score_collection", "round_locked"].includes(e.state);
              return (
                <div key={e.slug} className="card flex flex-col p-5">
                  <p className="label">{fmtDate(e.event_date, { weekday: "short", day: "numeric", month: "short" })}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ""}</p>
                  <p className="mt-2 text-lg font-bold">{e.title}</p>
                  <p className="text-sm text-muted">{e.venue ?? "[VENUE]"}{e.levels?.length ? ` · Levels ${e.levels.join(", ")}` : ""}</p>
                  <p className="mt-3 text-sm">{e.confirmed}/{e.player_cap} players · {e.court_count} courts · {e.round_count} x {e.round_minutes} min</p>
                  {e.public_note && <p className="mt-2 text-sm text-ice">{e.public_note}</p>}
                  {live && <Link href={`/live/${e.slug}`} className="btn-primary btn-sm mt-4 self-start">Follow live</Link>}
                </div>
              );
            })}
          </div>
        ) : <EmptyState title="Dates coming soon" body="Message MOON on WhatsApp to hear about the next night first." />}
      </section>

      {feed.recent.length > 0 && (
        <section className="mt-14">
          <SectionHeading eyebrow="Results" title="Latest podiums" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feed.recent.map((e) => (
              <Link key={e.slug} href={`/live/${e.slug}`} className="card block p-5 transition hover:border-ice/30">
                <p className="label">{fmtDate(e.event_date)}</p>
                <p className="mt-2 font-bold">{e.title}</p>
                <ol className="mt-3 space-y-1 text-sm">
                  {(e.podium ?? []).map((p: { medal: string; name: string; total: number }) => (
                    <li key={p.medal} className="flex justify-between"><span><span className={p.medal === "gold" ? "text-gold" : "text-muted"}>{p.medal}</span> · {p.name}</span><b className="tabular-nums">{p.total}</b></li>
                  ))}
                </ol>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14 grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Lifetime" title="Points that never reset" />
          <p className="text-muted">Every finalised night adds your games to one permanent total. Cross a milestone and you unlock its medal, collected at the desk.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {feed.milestones.map((m) => <span key={m.threshold} className="chip text-ice"><MoonMark size={14} />{m.threshold} pts</span>)}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="mb-3 font-bold">Top lifetime points</h3>
          {feed.lifetime.length ? (
            <ol className="space-y-1.5 text-sm">
              {feed.lifetime.map((p, i) => (
                <li key={p.slug} className="flex items-center justify-between gap-3">
                  <Link href={`/players/${p.slug}`} className="truncate hover:text-white"><span className="mr-2 text-muted">{i + 1}</span>{p.name}{p.level ? <span className="ml-2 text-xs text-muted">{p.level}</span> : null}</Link>
                  <span className="shrink-0 tabular-nums"><b>{p.points}</b>{p.medals ? <span className="ml-2 text-xs text-gold">{p.medals} medal{p.medals > 1 ? "s" : ""}</span> : null}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted">Totals appear after the first night.</p>}
        </div>
      </section>
    </div>
  );
}
