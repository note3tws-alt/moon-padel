import { ActionForm, SubmitButton } from "./action-form";
import { Field } from "./page-header";
import { saveTournament } from "@/app/admin/(panel)/tournaments/actions";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/utils";
import type { Division } from "@/lib/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TournamentForm({ t, divisions, clubs }: { t?: any; divisions: Division[]; clubs: { id: string; name: string }[] }) {
  const v = t ?? { status: "upcoming", format: "ladder", pair_type: "non_fixed", currency: "AED" };
  return (
    <ActionForm action={saveTournament} className="card p-5">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tournament name *" className="sm:col-span-2"><input name="name" required defaultValue={v.name} className="input" /></Field>
        <Field label="Date *"><input name="tournament_date" type="date" required defaultValue={v.tournament_date} className="input" /></Field>
        <Field label="Start time"><input name="start_time" type="time" defaultValue={v.start_time?.slice(0, 5)} className="input" /></Field>
        <Field label="Venue / club">
          <select name="club_id" defaultValue={v.club_id ?? ""} className="select"><option value="">To be confirmed</option>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label="Division">
          <select name="division_id" defaultValue={v.division_id ?? ""} className="select"><option value="">Open (all divisions)</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}</select>
        </Field>
        <Field label="Format">
          <select name="format" defaultValue={v.format} className="select">{Object.entries(FORMAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Pairs">
          <select name="pair_type" defaultValue={v.pair_type} className="select"><option value="non_fixed">Non-fixed (rotating partners)</option><option value="fixed">Fixed pairs</option></select>
        </Field>
        <Field label="Max players"><input name="max_players" type="number" min="1" defaultValue={v.max_players ?? ""} className="input" /></Field>
        <Field label="Courts"><input name="courts_count" type="number" min="1" defaultValue={v.courts_count ?? ""} className="input" /></Field>
        <Field label="Rounds"><input name="rounds_count" type="number" min="1" defaultValue={v.rounds_count ?? ""} className="input" /></Field>
        <Field label="Duration (minutes)"><input name="duration_minutes" type="number" min="1" defaultValue={v.duration_minutes ?? ""} className="input" /></Field>
        <Field label="Entry fee" hint="Leave empty until confirmed."><input name="entry_fee" type="number" step="0.01" min="0" defaultValue={v.entry_fee ?? ""} className="input" /></Field>
        <Field label="Currency"><input name="currency" defaultValue={v.currency ?? "AED"} maxLength={3} className="input uppercase" /></Field>
        <Field label="Status">
          <select name="status" defaultValue={v.status} className="select">{Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Description" className="sm:col-span-2 lg:col-span-4"><textarea name="description" rows={3} defaultValue={v.description ?? ""} className="input" /></Field>
      </div>
      <p className="mt-3 text-xs text-muted">Drafts are hidden from the public site. Results count towards rankings only after you publish them.</p>
      <div className="mt-4 flex justify-end"><SubmitButton>{v.id ? "Save tournament" : "Create tournament"}</SubmitButton></div>
    </ActionForm>
  );
}
