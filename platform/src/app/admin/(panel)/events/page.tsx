import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { EventStateChip } from "@/components/admin/events/state-chip";
import { EmptyState } from "@/components/ui";
import { sql } from "@/lib/db";
import { cn, fmtDate, fmtTime, todayDubai } from "@/lib/utils";

export const metadata = { title: "Events" };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filter = sp.filter ?? "upcoming";
  const db = sql();
  const today = todayDubai();
  const rows = await db`
    select e.id, e.title, e.event_date, e.start_time, e.state, e.current_round, e.round_count, e.court_count, e.player_cap, e.is_demo,
           coalesce(c.name, e.venue_name) as venue,
           (select count(*)::int from ladder_participants p where p.event_id = e.id and p.status = 'confirmed') as confirmed,
           (select count(*)::int from ladder_participants p where p.event_id = e.id and p.status = 'confirmed' and p.checked_in_at is not null) as checked_in,
           (select array_agg(st.code order by st.numeric_order) from skill_tiers st where st.id = any(e.eligible_tier_ids)) as levels
    from ladder_events e left join clubs c on c.id = e.club_id
    where ${filter === "past" ? db`(e.event_date < ${today}::date or e.state in ('completed', 'cancelled'))` : filter === "all" ? db`true` : db`e.event_date >= ${today}::date - 1 and e.state not in ('completed', 'cancelled')`}
    order by ${filter === "past" ? db`e.event_date desc` : db`e.event_date asc`}, e.start_time nulls last limit 200`;
  return (
    <>
      <PageHeader title="Events" description="Ladder Americano nights: roster, check-in, courts, live scores, podium and medals. The venue tablet, TV and website all read from here."
        actions={<Link href="/admin/events/new" className="btn-primary btn-sm">New event</Link>} />
      <div className="mb-4 flex gap-1.5">
        {["upcoming", "past", "all"].map((f) => <Link key={f} href={`/admin/events?filter=${f}`} className={cn("chip", filter === f ? "border-electric text-white" : "text-muted")}>{f}</Link>)}
      </div>
      {rows.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <Link key={e.id} href={`/admin/events/${e.id}`} className={cn("card block p-5 transition hover:border-ice/30", e.event_date === today && "ring-1 ring-electric/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label">{e.event_date === today ? "Today" : fmtDate(e.event_date, { weekday: "short", day: "numeric", month: "short" })}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ""}</p>
                  <p className="mt-1.5 truncate text-lg font-bold">{e.title}</p>
                  <p className="truncate text-sm text-muted">{e.venue ?? "[VENUE]"}{e.levels?.length ? ` · ${e.levels.join(" / ")}` : ""}</p>
                </div>
                <EventStateChip state={e.state} round={e.current_round} rounds={e.round_count} />
              </div>
              <div className="mt-4 flex gap-6 text-sm">
                <span><b className="tabular-nums">{e.confirmed}</b><span className="text-muted">/{e.player_cap} signed up</span></span>
                <span><b className="tabular-nums">{e.checked_in}</b><span className="text-muted"> checked in</span></span>
                <span className="text-muted">{e.court_count} courts · {e.round_count} rounds</span>
              </div>
              {e.is_demo && <span className="chip mt-3 text-muted">demo</span>}
            </Link>
          ))}
        </div>
      ) : <EmptyState title={filter === "past" ? "No past events" : "No upcoming events"} body="Create a night, add 16 players, then open check-in on the venue tablet." action={<Link href="/admin/events/new" className="btn-primary btn-sm">Create an event</Link>} />}
    </>
  );
}
