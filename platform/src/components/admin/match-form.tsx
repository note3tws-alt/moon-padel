import { ActionForm, SubmitButton } from "./action-form";
import { Field } from "./page-header";
import { saveMatch } from "@/app/admin/(panel)/tournaments/actions";
import { setsToString } from "@/lib/utils";

type Opt = { id: string; name: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MatchForm({ match, tournament, players, pairs, redirectTo }: { match?: any; tournament: { id: string; pair_type: string; name: string }; players: Opt[]; pairs: Opt[]; redirectTo?: string }) {
  const m = match ?? { round_number: 1, court_number: 1, status: "completed", verified: true };
  const a = (m.team_a ?? []) as string[];
  const b = (m.team_b ?? []) as string[];
  const fixed = tournament.pair_type === "fixed";
  const sel = (name: string, value: string | undefined) => (
    <select name={name} defaultValue={value ?? ""} className="select"><option value="">Choose player</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
  );
  const pairSel = (name: string, value: string | undefined) => (
    <select name={name} defaultValue={value ?? ""} className="select" required><option value="">Choose pair</option>{pairs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
  );
  return (
    <ActionForm action={saveMatch} redirectTo={redirectTo} className="card space-y-4 p-5">
      {m.id && <input type="hidden" name="id" value={m.id} />}
      <input type="hidden" name="tournament_id" value={tournament.id} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Round"><input name="round_number" type="number" min="1" required defaultValue={m.round_number} className="input" /></Field>
        <Field label="Court"><input name="court_number" type="number" min="1" required defaultValue={m.court_number} className="input" /></Field>
        <Field label="Match date / time"><input name="match_date" type="datetime-local" defaultValue={m.match_date ? new Date(m.match_date).toISOString().slice(0, 16) : ""} className="input" /></Field>
        <Field label="Duration (min)"><input name="duration_minutes" type="number" min="0" defaultValue={m.duration_minutes ?? ""} className="input" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <p className="label mb-3">Team A</p>
          {fixed ? pairSel("pair_a", m.team_a_pair_id) : <div className="grid gap-2">{sel("a1", a[0])}{sel("a2", a[1])}</div>}
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="label mb-3">Team B</p>
          {fixed ? pairSel("pair_b", m.team_b_pair_id) : <div className="grid gap-2">{sel("b1", b[0])}{sel("b2", b[1])}</div>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Set scores (Team A first)" hint='e.g. "6-4, 3-6, 10-8"' className="sm:col-span-2"><input name="set_scores" defaultValue={setsToString(m.set_scores)} className="input" placeholder="6-4, 6-3" /></Field>
        <Field label="Winner">
          <select name="winner" defaultValue="auto" className="select"><option value="auto">From the score</option><option value="A">Team A</option><option value="B">Team B</option><option value="D">Draw</option></select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={m.status} className="select"><option value="completed">Completed</option><option value="scheduled">Scheduled</option><option value="void">Void (ignored)</option></select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" defaultChecked={m.verified} className="h-4 w-4 accent-electric" /> Verified result (only verified results count)</label>
      <div className="flex justify-end"><SubmitButton>{m.id ? "Save match" : "Add match"}</SubmitButton></div>
    </ActionForm>
  );
}
