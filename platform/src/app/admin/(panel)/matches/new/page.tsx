import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { MatchForm } from "@/components/admin/match-form";
import { UrlSelect } from "@/components/url-select";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Add match" };

export default async function NewMatch({ searchParams }: { searchParams: Promise<{ tournament?: string }> }) {
  const { tournament } = await searchParams;
  const db = sql();
  const tournaments = await db`select id, name, tournament_date, pair_type from tournaments where status <> 'cancelled' order by tournament_date desc limit 200`;
  const t = tournaments.find((x) => x.id === tournament);
  const [players, pairs] = t ? await Promise.all([
    db`select p.id, p.full_name || ' (' || p.player_code || ')' as name from players p where p.status = 'active' order by p.full_name`,
    db`select id, name from pairs where active order by name`,
  ]) : [[], []];
  return (
    <>
      <PageHeader title="Add match" description="Choose the tournament first." />
      <div className="mb-4"><UrlSelect name="tournament" label="Tournament" value={tournament ?? ""} options={[{ value: "", label: "Choose a tournament" }, ...tournaments.map((x) => ({ value: x.id, label: `${x.name} · ${fmtDate(x.tournament_date)}` }))]} /></div>
      {t ? <MatchForm tournament={t as unknown as { id: string; name: string; pair_type: string }} players={players as unknown as { id: string; name: string }[]} pairs={pairs as unknown as { id: string; name: string }[]} redirectTo={`/admin/tournaments/${t.id}`} />
        : <p className="text-sm text-muted">No tournament selected. <Link className="text-ice" href="/admin/tournaments/new">Create a tournament</Link></p>}
    </>
  );
}
