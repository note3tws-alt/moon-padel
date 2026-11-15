import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { MatchForm } from "@/components/admin/match-form";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { deleteMatch } from "../../tournaments/actions";

export const metadata = { title: "Edit match" };

export default async function EditMatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = sql();
  const [m] = await db`select m.*, coalesce(array_agg(mp.player_id) filter (where mp.team = 'A'), '{}') as team_a, coalesce(array_agg(mp.player_id) filter (where mp.team = 'B'), '{}') as team_b
                       from matches m left join match_players mp on mp.match_id = m.id where m.id = ${id} group by m.id`;
  if (!m) notFound();
  const [t] = await db`select id, name, pair_type from tournaments where id = ${m.tournament_id}`;
  const [players, pairs, history] = await Promise.all([
    db`select p.id, p.full_name || ' (' || p.player_code || ')' as name from players p order by p.full_name`,
    db`select id, name from pairs order by name`,
    db`select created_at, actor_email, action from admin_audit_logs where entity = 'match' and entity_id = ${id} order by created_at desc limit 20`,
  ]);
  return (
    <>
      <PageHeader title={`Round ${m.round_number}, court ${m.court_number}`} description={<Link className="text-ice" href={`/admin/tournaments/${t.id}`}>{t.name}</Link>} />
      <MatchForm match={m} tournament={t as { id: string; name: string; pair_type: string }} players={players as unknown as { id: string; name: string }[]} pairs={pairs as unknown as { id: string; name: string }[]} redirectTo={`/admin/tournaments/${t.id}`} />
      {history.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="mb-3 font-bold">Edit history</h2>
          <ul className="space-y-1 text-sm">{history.map((h, i) => <li key={i}><span className="text-muted">{fmtDate(h.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> · {h.action} · {h.actor_email ?? "system"}</li>)}</ul>
          <Link href={`/admin/audit?entity=match&id=${id}`} className="mt-2 inline-block text-xs text-ice">Full details in the audit log</Link>
        </section>
      )}
      <section className="card mt-6 border-loss/20 p-5">
        <ActionForm action={deleteMatch} confirm="Delete this match?"><input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={`/admin/tournaments/${t.id}`} /><SubmitButton variant="danger" pendingText="Deleting…">Delete match</SubmitButton></ActionForm>
      </section>
    </>
  );
}
