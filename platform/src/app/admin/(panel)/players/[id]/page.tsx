import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Field } from "@/components/admin/page-header";
import { PlayerForm } from "@/components/admin/player-form";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { getDivisions } from "@/lib/queries";
import { supabaseStorageConfigured } from "@/lib/supabase/config";
import { fmtDate, fmtRating } from "@/lib/utils";
import { addRatingAdjustment, deletePlayer, deleteRatingAdjustment } from "../actions";

export const metadata = { title: "Edit player" };

export default async function EditPlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = sql();
  const [player] = await db`select p.*, pp.email, pp.phone, pp.notes, pp.checkin_pin, s.rating, s.matches, s.overall_rank from players p left join player_private pp on pp.player_id = p.id left join player_stats s on s.player_id = p.id where p.id = ${id}`;
  if (!player) notFound();
  const [divisions, adjustments, tiers, ladder, medals, ledger] = await Promise.all([
    getDivisions(),
    db`select a.*, u.email as by_email from rating_adjustments a left join users u on u.id = a.created_by where a.player_id = ${id} order by a.effective_at desc`,
    db`select id, code from skill_tiers where active order by numeric_order`,
    db`select e.id, e.title, e.event_date, coalesce(c.name, e.venue_name) as venue, r.rank, r.total, r.round_scores, r.medal
       from ladder_results r join ladder_events e on e.id = r.event_id left join clubs c on c.id = e.club_id where r.player_id = ${id} order by e.event_date desc`,
    db`select m.unlocked_at, m.issued_at, t.name, t.threshold from player_medals m join medal_tiers t on t.id = m.medal_tier_id where m.player_id = ${id} order by t.threshold`,
    db`select kind, points, reason, created_by, created_at from player_points_ledger where player_id = ${id} order by created_at desc`,
  ]);
  const lifetime = ledger.reduce((a, l) => a + Number(l.points), 0);
  return (
    <>
      <PageHeader title={player.full_name} description={<>Player ID {player.player_code} · RTG {fmtRating(player.rating)} · {player.matches ?? 0} matches{player.overall_rank ? ` · rank #${player.overall_rank}` : ""}</>}
        actions={<Link href={`/players/${player.slug}`} target="_blank" className="btn-ghost btn-sm">Public profile ↗</Link>} />
      <PlayerForm player={player} divisions={divisions} storage={supabaseStorageConfigured()} tiers={tiers as never} />

      <section className="card mt-6 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Ladder nights and medals</h2>
          <p className="text-sm">Lifetime points <b className="text-xl tabular-nums">{lifetime}</b></p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {medals.length ? medals.map((m) => <span key={m.name} className={`chip ${m.issued_at ? "text-ice" : "border-gold/40 text-gold"}`}>{m.name} · {m.issued_at ? "handed over" : "to hand over"}</span>) : <span className="text-xs text-muted">No milestone medals yet.</span>}
        </div>
        {ladder.length > 0 && (
          <table className="table-base text-sm">
            <thead><tr><th>Date</th><th>Event</th><th>Rounds</th><th className="text-right">Total</th><th className="text-right">Place</th></tr></thead>
            <tbody>{ladder.map((l) => (
              <tr key={l.id}><td className="text-muted">{fmtDate(l.event_date)}</td><td><Link href={`/admin/events/${l.id}`} className="font-semibold hover:text-white">{l.title}</Link><span className="text-xs text-muted"> · {l.venue ?? ""}</span></td>
                <td className="tabular-nums text-muted">{(l.round_scores as number[]).join(" · ")}</td><td className="text-right font-bold tabular-nums">{l.total}</td>
                <td className="text-right">{l.medal ? <span className="capitalize text-gold">{l.medal}</span> : `#${l.rank}`}</td></tr>
            ))}</tbody>
          </table>
        )}
        {ledger.some((l) => l.kind === "adjustment") && <p className="mt-3 text-xs text-muted">Includes manual adjustments: {ledger.filter((l) => l.kind === "adjustment").map((l) => `${l.points > 0 ? "+" : ""}${l.points} (${l.reason})`).join(", ")}</p>}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-1 font-bold">Rating adjustments</h2>
        <p className="mb-4 text-xs text-muted">Manual corrections are applied by the rating engine at their effective date and kept in the audit trail.</p>
        <ActionForm action={addRatingAdjustment} resetOnSuccess className="grid gap-3 sm:grid-cols-[140px_120px_1fr_180px_auto] sm:items-end">
          <input type="hidden" name="player_id" value={id} />
          <Field label="Type"><select name="kind" className="select"><option value="delta">Add / subtract</option><option value="set">Set to</option></select></Field>
          <Field label="Value"><input name="value" type="number" step="0.01" required className="input" /></Field>
          <Field label="Reason"><input name="reason" required className="input" placeholder="e.g. Placement after assessment" /></Field>
          <Field label="Effective"><input name="effective_at" type="datetime-local" className="input" /></Field>
          <SubmitButton>Apply</SubmitButton>
        </ActionForm>
        {adjustments.length > 0 && (
          <table className="table-base mt-4">
            <thead><tr><th>Effective</th><th>Change</th><th>Reason</th><th>By</th><th></th></tr></thead>
            <tbody>{adjustments.map((a) => (
              <tr key={a.id}>
                <td className="text-muted">{fmtDate(a.effective_at)}</td>
                <td className="font-semibold">{a.kind === "set" ? `Set to ${a.value}` : `${a.value > 0 ? "+" : ""}${a.value}`}</td>
                <td>{a.reason}</td><td className="text-xs text-muted">{a.by_email ?? "–"}</td>
                <td><ActionForm action={deleteRatingAdjustment} confirm="Remove this adjustment?"><input type="hidden" name="id" value={a.id} /><SubmitButton variant="ghost" className="btn-sm" pendingText="…">Remove</SubmitButton></ActionForm></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="card mt-6 border-loss/20 p-5">
        <h2 className="font-bold">Delete player</h2>
        <p className="mb-4 mt-1 text-xs text-muted">Only possible when the player has no recorded matches. Otherwise set the status to inactive.</p>
        <ActionForm action={deletePlayer} confirm={`Delete ${player.full_name}? This cannot be undone.`}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="danger" pendingText="Deleting…">Delete player</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
