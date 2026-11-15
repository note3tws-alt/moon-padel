import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { deleteClub, saveClub } from "../league-actions";

export const metadata = { title: "Clubs / venues" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClubFields({ c }: { c?: any }) {
  return (
    <>
      {c?.id && <input type="hidden" name="id" value={c.id} />}
      <Field label="Name *"><input name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="Area"><input name="area" defaultValue={c?.area ?? ""} className="input" /></Field>
      <Field label="City"><input name="city" defaultValue={c?.city ?? "Dubai"} className="input" /></Field>
      <Field label="Courts"><input name="courts" type="number" min="1" defaultValue={c?.courts ?? ""} className="input" /></Field>
      <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={c?.address ?? ""} className="input" /></Field>
      <Field label="Map link"><input name="map_url" defaultValue={c?.map_url ?? ""} className="input" placeholder="https://maps…" /></Field>
      <Field label="Website"><input name="website" defaultValue={c?.website ?? ""} className="input" /></Field>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="accent-electric" /> Active</label>
    </>
  );
}

export default async function ClubsAdmin() {
  const clubs = await sql()`select c.*, (select count(*)::int from tournaments t where t.club_id = c.id) as tournaments from clubs c order by c.active desc, c.name`;
  return (
    <>
      <PageHeader title="Clubs / venues" description="Partner venues where MoonPadel hosts tournaments." />
      <ActionForm action={saveClub} resetOnSuccess className="card mb-6 grid gap-3 p-5 sm:grid-cols-4 sm:items-end">
        <h2 className="font-bold sm:col-span-4">Add a venue</h2>
        <ClubFields />
        <div className="sm:col-span-3 flex justify-end"><SubmitButton>Add venue</SubmitButton></div>
      </ActionForm>
      <div className="space-y-3">
        {clubs.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{c.name} {c.is_demo && <span className="chip ml-2 text-muted">demo</span>}</h3><span className="text-xs text-muted">{c.tournaments} tournaments</span></div>
            <ActionForm action={saveClub} className="grid gap-3 sm:grid-cols-4 sm:items-end">
              <ClubFields c={c} />
              <div className="flex justify-end gap-2 sm:col-span-3"><SubmitButton className="btn-sm">Save</SubmitButton></div>
            </ActionForm>
            <ActionForm action={deleteClub} confirm={`Remove ${c.name}?`} className="mt-2 flex justify-end"><input type="hidden" name="id" value={c.id} /><SubmitButton variant="ghost" className="btn-sm" pendingText="…">Remove venue</SubmitButton></ActionForm>
          </div>
        ))}
      </div>
    </>
  );
}
