import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { loadActiveConfig } from "@/lib/recalc";
import { FINISH_ORDER, TIE_BREAKERS } from "@/lib/scoring/config";
import { fmtDate } from "@/lib/utils";
import { activateRuleset, saveScoring } from "../league-actions";

export const metadata = { title: "Scoring settings" };

const TIE_LABELS: Record<string, string> = { points: "Points", wins: "Wins", winPct: "Win %", gameDiff: "Game difference", rating: "Rating", fewerTournaments: "Fewer tournaments", moreTournaments: "More tournaments" };
const FINISH_LABELS: Record<string, string> = { winPoints: "Win points", totalPoints: "Match points total", gameDiff: "Game difference", gamesWon: "Games won", wins: "Wins", rating: "Rating" };

export default async function ScoringAdmin() {
  const [{ config: c, name }, versions] = await Promise.all([
    loadActiveConfig(),
    sql()`select s.id, s.name, s.is_active, s.created_at, s.notes, u.email from scoring_settings s left join users u on u.id = s.created_by order by s.id desc limit 20`,
  ]);
  const mults = Object.entries(c.points.courtMultipliers).filter(([k]) => k !== "default").map(([k, v]) => `${k}:${v}`).join(", ");
  return (
    <>
      <PageHeader title="Scoring settings" description="The scoring engine is fully configurable. Saving creates a new version of the ruleset and recalculates every rating, point and ranking from the full match history." />
      <ActionForm action={saveScoring} confirm="Save this ruleset and recalculate all rankings?" className="space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Ruleset name"><input name="name" defaultValue={name} className="input" /></Field>
          <Field label="Notes"><input name="notes" className="input" placeholder="What changed and why" /></Field>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-bold">Rating calculation</h2>
          <p className="mb-4 text-xs text-muted">Elo: team average against team average, K controls speed, spread is the rating gap that means 10:1 odds. Weighted: time-weighted average of recent performances. Manual: only imports and adjustments change ratings.</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Method"><select name="method" defaultValue={c.rating.method} className="select"><option value="elo">Team Elo</option><option value="weighted">Weighted recent performance</option><option value="manual">Manual only</option></select></Field>
            <Field label="Starting rating"><input name="initial" type="number" step="0.01" defaultValue={c.rating.initial} className="input" /></Field>
            <Field label="Minimum"><input name="min" type="number" step="0.01" defaultValue={c.rating.min} className="input" /></Field>
            <Field label="Maximum"><input name="max" type="number" step="0.01" defaultValue={c.rating.max} className="input" /></Field>
            <Field label="Decimals"><input name="decimals" type="number" min="0" max="4" defaultValue={c.rating.decimals} className="input" /></Field>
            <Field label="K factor (Elo)"><input name="k" type="number" step="0.001" defaultValue={c.rating.elo.k} className="input" /></Field>
            <Field label="Spread"><input name="spread" type="number" step="0.01" defaultValue={c.rating.elo.spread} className="input" /></Field>
            <Field label="Provisional matches"><input name="provisionalMatches" type="number" min="0" defaultValue={c.rating.provisional.matches} className="input" /></Field>
            <Field label="Provisional K ×"><input name="provisionalK" type="number" step="0.1" defaultValue={c.rating.provisional.kMultiplier} className="input" /></Field>
            <Field label="Recent weighting half-life (days)" hint="Weighted method"><input name="halfLifeDays" type="number" min="1" defaultValue={c.rating.weighted.halfLifeDays} className="input" /></Field>
            <Field label="Matches in window" hint="Weighted method"><input name="windowMatches" type="number" min="1" defaultValue={c.rating.weighted.windowMatches} className="input" /></Field>
            <label className="flex items-center gap-2 self-center text-xs"><input type="checkbox" name="marginOfVictory" defaultChecked={c.rating.elo.marginOfVictory} className="accent-electric" /> Bigger wins move ratings more</label>
            <Field label="Show rating after matches"><input name="visibleAfterMatches" type="number" min="0" defaultValue={c.rating.visibleAfterMatches} className="input" /></Field>
            <Field label="…and tournaments"><input name="visibleAfterTournaments" type="number" min="0" defaultValue={c.rating.visibleAfterTournaments} className="input" /></Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">Tournament points</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Win"><input name="win" type="number" step="0.01" defaultValue={c.points.win} className="input" /></Field>
            <Field label="Draw"><input name="draw" type="number" step="0.01" defaultValue={c.points.draw} className="input" /></Field>
            <Field label="Loss"><input name="loss" type="number" step="0.01" defaultValue={c.points.loss} className="input" /></Field>
            <Field label="Per game won"><input name="perGameWon" type="number" step="0.01" defaultValue={c.points.perGameWon} className="input" /></Field>
            <Field label="Participation"><input name="participation" type="number" step="0.01" defaultValue={c.points.participation} className="input" /></Field>
            <Field label="Default court ×"><input name="court_default" type="number" step="0.01" defaultValue={c.points.courtMultipliers.default ?? 1} className="input" /></Field>
            <Field label="Court multipliers" hint="Court:multiplier, e.g. 1:1.5, 2:1.25. Court 1 is the top court." className="sm:col-span-3"><input name="court_multipliers" defaultValue={mults} className="input" /></Field>
            <Field label="Placement points by finish" hint="1st, 2nd, 3rd… separated by commas." className="sm:col-span-3"><input name="placement" defaultValue={c.points.placement.join(", ")} className="input" /></Field>
          </div>
          <div className="mt-4">
            <p className="field-label">Tournament finish order (tick in priority order is not needed: order shown is used)</p>
            <div className="flex flex-wrap gap-3">{FINISH_ORDER.map((k) => <label key={k} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="finishOrder" value={k} defaultChecked={c.tournament.finishOrder.includes(k)} className="accent-electric" />{FINISH_LABELS[k]}</label>)}</div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">Standings</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Best tournaments counted per month" hint="0 counts all."><input name="bestMonthly" type="number" min="0" defaultValue={c.standings.bestTournamentsMonthly} className="input" /></Field>
            <Field label="Best tournaments counted all-time" hint="0 counts all."><input name="bestAllTime" type="number" min="0" defaultValue={c.standings.bestTournamentsAllTime} className="input" /></Field>
            <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" name="individualIncludesFixedPairs" defaultChecked={c.standings.individualIncludesFixedPairs} className="accent-electric" /> Fixed-pair events also count for individual points</label>
          </div>
          <div className="mt-4">
            <p className="field-label">Tie-breakers (applied in this order)</p>
            <div className="flex flex-wrap gap-3">{TIE_BREAKERS.map((k) => <label key={k} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="tieBreakers" value={k} defaultChecked={c.standings.tieBreakers.includes(k)} className="accent-electric" />{TIE_LABELS[k]}</label>)}</div>
          </div>
        </section>
        <div className="flex justify-end"><SubmitButton pendingText="Recalculating…">Save ruleset and recalculate</SubmitButton></div>
      </ActionForm>

      <section className="card mt-8 p-5">
        <h2 className="mb-3 font-bold">Ruleset versions</h2>
        <table className="table-base"><thead><tr><th className="!px-0">Name</th><th>Saved</th><th>By</th><th>Notes</th><th></th></tr></thead>
          <tbody>{versions.map((v) => (
            <tr key={v.id}><td className="!px-0 font-semibold">{v.name}{v.is_active && <span className="chip ml-2 border-electric text-ice">active</span>}</td><td className="text-muted">{fmtDate(v.created_at)}</td><td className="text-xs text-muted">{v.email ?? "–"}</td><td className="text-xs text-muted">{v.notes ?? ""}</td>
              <td>{!v.is_active && <ActionForm action={activateRuleset} confirm="Switch to this ruleset and recalculate?"><input type="hidden" name="id" value={v.id} /><SubmitButton variant="ghost" className="btn-sm" pendingText="…">Activate</SubmitButton></ActionForm>}</td></tr>
          ))}</tbody></table>
        <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer">Active ruleset as JSON</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-space p-3">{JSON.stringify(c, null, 2)}</pre></details>
      </section>
    </>
  );
}
