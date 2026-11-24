import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { saveTier } from "./actions";

export const metadata = { title: "Skill levels" };

export default async function Levels() {
  const tiers = await sql()`select t.*, (select count(*)::int from players p where p.skill_tier_id = t.id) as players from skill_tiers t order by numeric_order, code`;
  return (
    <>
      <PageHeader title="Skill levels" description="Approved level tags staff give each player (e.g. D-, D, D+). Order 1 is the strongest: it decides who starts on court 1. Set a player's level on their player page." />
      <div className="card overflow-x-auto p-5">
        <table className="table-base">
          <thead><tr><th>Order</th><th>Code</th><th>Name</th><th>Active</th><th>Usable in events</th><th className="text-right">Players</th><th></th></tr></thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td colSpan={7} className="p-0">
                  <ActionForm action={saveTier} className="grid grid-cols-[70px_90px_1fr_70px_120px_70px_auto] items-center gap-2 py-1.5">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="numeric_order" type="number" defaultValue={t.numeric_order} className="input py-1.5" />
                    <input name="code" defaultValue={t.code} className="input py-1.5" />
                    <input name="display_name" defaultValue={t.display_name} className="input py-1.5" />
                    <input type="checkbox" name="active" defaultChecked={t.active} className="h-4 w-4 accent-electric" />
                    <input type="checkbox" name="event_eligible" defaultChecked={t.event_eligible} className="h-4 w-4 accent-electric" />
                    <span className="text-right tabular-nums text-muted">{t.players}</span>
                    <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Save</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={saveTier} resetOnSuccess className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <Field label="Order"><input name="numeric_order" type="number" min={1} required className="input w-24" /></Field>
          <Field label="Code"><input name="code" required className="input w-28" placeholder="B-" /></Field>
          <Field label="Name"><input name="display_name" required className="input w-48" /></Field>
          <SubmitButton>Add level</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
