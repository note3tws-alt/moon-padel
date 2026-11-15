import Link from "next/link";
import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { getDivisions } from "@/lib/queries";
import { fmtNumber, fmtRating } from "@/lib/utils";
import { savePair } from "../league-actions";

export const metadata = { title: "Fixed pairs" };

export default async function PairsAdmin() {
  const db = sql();
  const [divisions, players, pairs] = await Promise.all([
    getDivisions(),
    db`select id, full_name || ' (' || player_code || ')' as name from players where status = 'active' order by full_name`,
    db`select pr.*, ps.rating, ps.total_points, ps.matches, ps.overall_rank,
              (select json_agg(pm.player_id order by pm.position) from pair_members pm where pm.pair_id = pr.id) as members
       from pairs pr left join pair_stats ps on ps.pair_id = pr.id order by pr.active desc, ps.overall_rank nulls last, pr.name`,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields = (p?: any) => (
    <>
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      <Field label="Pair name" hint="Optional. Defaults to both surnames."><input name="name" defaultValue={p?.name ?? ""} className="input" /></Field>
      <Field label="Player 1"><select name="player1" defaultValue={p?.members?.[0] ?? ""} className="select" required><option value="">Choose</option>{players.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Player 2"><select name="player2" defaultValue={p?.members?.[1] ?? ""} className="select" required><option value="">Choose</option>{players.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
      <Field label="Division"><select name="division_id" defaultValue={p?.division_id ?? ""} className="select"><option value="">None</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select></Field>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="accent-electric" /> Active</label>
    </>
  );
  return (
    <>
      <PageHeader title="Fixed pairs" description="Pairs have their own rating, points and leaderboard, separate from individual statistics." />
      <ActionForm action={savePair} resetOnSuccess className="card mb-6 grid gap-3 p-5 sm:grid-cols-6 sm:items-end">
        <h2 className="font-bold sm:col-span-6">New pair</h2>{fields()}<SubmitButton>Create pair</SubmitButton>
      </ActionForm>
      <div className="space-y-2">
        {pairs.map((p) => (
          <ActionForm key={p.id} action={savePair} className="card grid gap-3 p-4 sm:grid-cols-6 sm:items-end">
            {fields(p)}
            <div className="flex items-center justify-between gap-2">
              <Link href={`/pairs/${p.slug}`} target="_blank" className="text-xs text-muted hover:text-ice">#{p.overall_rank ?? "–"} · RTG {fmtRating(p.rating)} · {fmtNumber(p.total_points)} pts ↗</Link>
              <SubmitButton className="btn-sm">Save</SubmitButton>
            </div>
          </ActionForm>
        ))}
      </div>
    </>
  );
}
