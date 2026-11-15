import Link from "next/link";
import type { Metadata } from "next";
import { DivisionBadge } from "@/components/brand";
import { EmptyState, StatusChip } from "@/components/ui";
import { TournamentCard, type TournamentCardData } from "@/components/tournament-card";
import { getDivisions, getTournamentList } from "@/lib/queries";
import { cn, FORMAT_LABELS, PAIR_TYPE_LABELS, fmtDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Tournaments", description: "Upcoming MoonPadel tournaments and past results." };

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const divisions = await getDivisions();
  const division = divisions.find((d) => d.code.toLowerCase() === (sp.division ?? "").toLowerCase()) ?? null;
  const pairType = sp.pairs === "fixed" || sp.pairs === "non_fixed" ? sp.pairs : null;
  const list = await getTournamentList({ when, divisionId: division?.id, pairType });
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    return `/tournaments?${next}`;
  };
  const chip = (active: boolean) => cn("chip", active ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver");
  return (
    <main className="container-page py-12">
      <p className="label">Schedule and results</p>
      <h1 className="h-display mt-3 text-4xl sm:text-5xl">Tournaments</h1>
      <div className="mt-8 flex flex-col gap-3">
        <div className="inline-flex w-fit rounded-full border border-line bg-night p-1">
          {(["upcoming", "past"] as const).map((w) => (
            <Link key={w} href={href({ when: w === "upcoming" ? undefined : w })} className={cn("rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider", when === w ? "bg-electric text-white" : "text-muted hover:text-silver")}>{w === "upcoming" ? "Upcoming" : "Results"}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ division: undefined })} className={chip(!division)}>All divisions</Link>
          {divisions.map((d) => <Link key={d.id} href={href({ division: d.code })} className={chip(division?.id === d.id)}>{d.code}</Link>)}
          <span className="mx-2 hidden w-px bg-line sm:block" />
          <Link href={href({ pairs: undefined })} className={chip(!pairType)}>All formats</Link>
          <Link href={href({ pairs: "non_fixed" })} className={chip(pairType === "non_fixed")}>Non-fixed</Link>
          <Link href={href({ pairs: "fixed" })} className={chip(pairType === "fixed")}>Fixed pairs</Link>
        </div>
      </div>

      <div className="mt-8">
        {!list.length ? (
          <EmptyState title={when === "upcoming" ? "No upcoming tournaments for this filter" : "No results for this filter"} body="New dates are announced on Instagram and WhatsApp first." />
        ) : when === "upcoming" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((t) => <TournamentCard key={t.id} t={t as unknown as TournamentCardData} />)}</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Tournament</th><th>Division</th><th>Format</th><th>Venue</th><th>Winner</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="text-muted">{fmtDate(t.tournament_date)}</td>
                    <td><Link href={`/tournaments/${t.slug}`} className="font-semibold hover:text-white">{t.name}</Link></td>
                    <td><DivisionBadge code={t.division_code} /></td>
                    <td className="text-muted">{FORMAT_LABELS[t.format]} · {PAIR_TYPE_LABELS[t.pair_type]}</td>
                    <td className="text-muted">{t.club_name ?? "–"}</td>
                    <td className="font-semibold">{(t.winners ?? []).join(" & ") || <span className="text-muted">–</span>}</td>
                    <td><StatusChip status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
