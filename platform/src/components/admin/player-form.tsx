import { ActionForm, SubmitButton } from "./action-form";
import { Field } from "./page-header";
import { savePlayer } from "@/app/admin/(panel)/players/actions";
import { COUNTRIES } from "@/lib/countries";
import type { Division } from "@/lib/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PlayerForm({ player, divisions, storage }: { player?: any; divisions: Division[]; storage: boolean }) {
  const p = player ?? {};
  return (
    <ActionForm action={savePlayer} className="space-y-6">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <section className="card p-5">
        <h2 className="mb-4 font-bold">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name *"><input name="full_name" required defaultValue={p.full_name} className="input" /></Field>
          <Field label="Player ID" hint={p.id ? "Public, unique." : "Leave empty to generate (MP-0001…)."}><input name="player_code" defaultValue={p.player_code} className="input" /></Field>
          <Field label="Status">
            <select name="status" defaultValue={p.status ?? "active"} className="select"><option value="active">Active</option><option value="inactive">Inactive (hidden from directory)</option></select>
          </Field>
          <Field label="Country (flag)">
            <select name="country" defaultValue={p.country_code ?? ""} className="select">
              <option value="">None</option>
              {Object.entries(COUNTRIES).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </Field>
          <Field label="Nationality"><input name="nationality" defaultValue={p.nationality ?? ""} className="input" placeholder="Optional, if different" /></Field>
          <Field label="Playing side">
            <select name="playing_side" defaultValue={p.playing_side ?? ""} className="select"><option value="">Not set</option><option value="left">Left</option><option value="right">Right</option><option value="both">Both</option></select>
          </Field>
          <Field label="Profile photo URL"><input name="photo_url" defaultValue={p.photo_url ?? ""} className="input" placeholder="https://…" /></Field>
          <Field label="Or upload a photo" hint={storage ? "PNG, JPG or WebP, under 3 MB. Stored in Supabase Storage." : "Needs Supabase Storage keys. Use a URL for now."}>
            <input name="photo_file" type="file" accept="image/png,image/jpeg,image/webp" disabled={!storage} className="input file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-silver" />
          </Field>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-bold">Division</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current division">
            <select name="division_id" defaultValue={p.division_id ?? ""} className="select">
              <option value="">Unassigned</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
            </select>
          </Field>
          <Field label="Reason for change" hint="Saved in the player's division history if the division changes."><input name="division_reason" className="input" placeholder="e.g. Promoted after October review" /></Field>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Private contact details</h2>
        <p className="mb-4 text-xs text-muted">Never shown on the public site.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Email"><input name="email" type="email" defaultValue={p.email ?? ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={p.phone ?? ""} className="input" /></Field>
          <Field label="Notes"><input name="notes" defaultValue={p.notes ?? ""} className="input" /></Field>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Starting / historical statistics</h2>
        <p className="mb-4 text-xs text-muted">Totals from before this platform. They are added to everything calculated from match results. The starting rating is where the rating engine begins for this player.</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Starting rating"><input name="base_rating" type="number" step="0.001" defaultValue={p.base_rating ?? ""} className="input" /></Field>
          <Field label="Points"><input name="base_points" type="number" step="0.01" defaultValue={p.base_points ?? 0} className="input" /></Field>
          <Field label="Tournaments"><input name="base_tournaments" type="number" min="0" defaultValue={p.base_tournaments ?? 0} className="input" /></Field>
          <Field label="Matches"><input name="base_matches" type="number" min="0" defaultValue={p.base_matches ?? 0} className="input" /></Field>
          <Field label="Wins"><input name="base_wins" type="number" min="0" defaultValue={p.base_wins ?? 0} className="input" /></Field>
          <Field label="Losses"><input name="base_losses" type="number" min="0" defaultValue={p.base_losses ?? 0} className="input" /></Field>
        </div>
      </section>
      <div className="flex justify-end"><SubmitButton>{p.id ? "Save player" : "Create player"}</SubmitButton></div>
    </ActionForm>
  );
}
