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
  const [player] = await db`select p.*, pp.email, pp.phone, pp.notes, s.rating, s.matches, s.overall_rank from players p left join player_private pp on pp.player_id = p.id left join player_stats s on s.player_id = p.id where p.id = ${id}`;
  if (!player) notFound();
  const [divisions, adjustments] = await Promise.all([
    getDivisions(),
    db`select a.*, u.email as by_email from rating_adjustments a left join users u on u.id = a.created_by where a.player_id = ${id} order by a.effective_at desc`,
  ]);
  return (
    <>
      <PageHeader title={player.full_name} description={<>Player ID {player.player_code} · RTG {fmtRating(player.rating)} · {player.matches ?? 0} matches{player.overall_rank ? ` · rank #${player.overall_rank}` : ""}</>}
        actions={<Link href={`/players/${player.slug}`} target="_blank" className="btn-ghost btn-sm">Public profile ↗</Link>} />
      <PlayerForm player={player} divisions={divisions} storage={supabaseStorageConfigured()} />

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
