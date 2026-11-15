import Link from "next/link";
import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { UrlSelect } from "@/components/url-select";
import { sql } from "@/lib/db";
import { getAvailablePeriods, getDivisions } from "@/lib/queries";
import { fmtMonth } from "@/lib/utils";
import { addDivision, applyDivisionMoves, saveDivision } from "../league-actions";

export const metadata = { title: "Divisions" };

function prevPeriod() { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return `${d.toISOString().slice(0, 7)}-01`; }

export default async function DivisionsAdmin({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const db = sql();
  const [divisions, periods] = await Promise.all([getDivisions(), getAvailablePeriods()]);
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? `${sp.period}-01` : prevPeriod();
  const counts = await db`select division_id, count(*)::int as n from players where status = 'active' group by division_id`;
  const ranked = await db`
    select r.division_id, r.rank, r.points, r.tournaments, p.id as player_id, p.full_name, p.division_id as current_division, s.rating
    from monthly_rankings r join players p on p.id = r.player_id left join player_stats s on s.player_id = p.id
    where r.mode = 'individual' and r.period = ${period} and r.division_id is not null order by r.division_id, r.rank`;
  const champions = await db`
    select r.period, d.code, coalesce(p.full_name, pr.name) as name, r.mode from monthly_rankings r join divisions d on d.id = r.division_id
    left join players p on p.id = r.player_id left join pairs pr on pr.id = r.pair_id
    where r.is_champion and r.division_id is not null order by r.period desc, d.sort_order, r.mode limit 48`;

  // Suggestions from the configured rules. Nothing moves until an admin applies it.
  const ordered = divisions.filter((d) => d.active).sort((a, b) => a.sort_order - b.sort_order);
  type Move = { playerId: string; name: string; from: string; to: string; toId: number; kind: "promotion" | "relegation"; why: string };
  const moves: Move[] = [];
  ordered.forEach((d, i) => {
    const up = ordered[i - 1], down = ordered[i + 1];
    const rows = ranked.filter((r) => r.division_id === d.id && r.current_division === d.id);
    if (up && d.promote_top_n > 0) rows.filter((r) => r.tournaments >= d.promotion_min_tournaments).slice(0, d.promote_top_n)
      .forEach((r) => moves.push({ playerId: r.player_id, name: r.full_name, from: d.code, to: up.code, toId: up.id, kind: "promotion", why: `#${r.rank} in ${d.code} with ${r.points} pts` }));
    if (down && d.relegate_bottom_n > 0) rows.slice(-d.relegate_bottom_n).filter((r) => !moves.some((m) => m.playerId === r.player_id))
      .forEach((r) => moves.push({ playerId: r.player_id, name: r.full_name, from: d.code, to: down.code, toId: down.id, kind: "relegation", why: `#${r.rank} of ${rows.length} in ${d.code}` }));
  });
  if (ordered.some((d) => d.use_rating_thresholds)) {
    const players = await db`select p.id, p.full_name, p.division_id, s.rating from players p join player_stats s on s.player_id = p.id where p.status = 'active' and s.rating_visible`;
    for (const p of players) {
      const i = ordered.findIndex((d) => d.id === p.division_id);
      const d = ordered[i];
      if (!d?.use_rating_thresholds || moves.some((m) => m.playerId === p.id)) continue;
      if (d.max_rating != null && p.rating > d.max_rating && ordered[i - 1]) moves.push({ playerId: p.id, name: p.full_name, from: d.code, to: ordered[i - 1].code, toId: ordered[i - 1].id, kind: "promotion", why: `Rating ${p.rating} above ${d.max_rating}` });
      else if (d.min_rating != null && p.rating < d.min_rating && ordered[i + 1]) moves.push({ playerId: p.id, name: p.full_name, from: d.code, to: ordered[i + 1].code, toId: ordered[i + 1].id, kind: "relegation", why: `Rating ${p.rating} below ${d.min_rating}` });
    }
  }

  return (
    <>
      <PageHeader title="Divisions" description="Names, rating bands and promotion rules. Players only change division when you assign them or apply a reviewed move below." />
      <div className="space-y-3">
        {divisions.map((d) => (
          <ActionForm key={d.id} action={saveDivision} className="card grid gap-3 p-4 sm:grid-cols-4 lg:grid-cols-8 lg:items-end">
            <input type="hidden" name="id" value={d.id} />
            <Field label="Code"><input name="code" defaultValue={d.code} className="input" /></Field>
            <Field label="Name"><input name="name" defaultValue={d.name} className="input" /></Field>
            <Field label="Order (1 = top)"><input name="sort_order" type="number" min="1" defaultValue={d.sort_order} className="input" /></Field>
            <Field label="Min rating"><input name="min_rating" type="number" step="0.01" defaultValue={d.min_rating ?? ""} className="input" /></Field>
            <Field label="Max rating"><input name="max_rating" type="number" step="0.01" defaultValue={d.max_rating ?? ""} className="input" /></Field>
            <Field label="Promote top N"><input name="promote_top_n" type="number" min="0" defaultValue={d.promote_top_n} className="input" /></Field>
            <Field label="Relegate bottom N"><input name="relegate_bottom_n" type="number" min="0" defaultValue={d.relegate_bottom_n} className="input" /></Field>
            <Field label="Min tournaments"><input name="promotion_min_tournaments" type="number" min="0" defaultValue={d.promotion_min_tournaments} className="input" /></Field>
            <Field label="Description" className="sm:col-span-2 lg:col-span-4"><input name="description" defaultValue={d.description ?? ""} className="input" /></Field>
            <Field label="Colour"><input name="color" defaultValue={d.color ?? ""} className="input" placeholder="#2E8BEA" /></Field>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="use_rating_thresholds" defaultChecked={d.use_rating_thresholds} className="accent-electric" /> Use rating band</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="active" defaultChecked={d.active} className="accent-electric" /> Active</label>
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">{counts.find((c) => c.division_id === d.id)?.n ?? 0} players</span><SubmitButton className="btn-sm">Save</SubmitButton></div>
          </ActionForm>
        ))}
        <ActionForm action={addDivision} resetOnSuccess className="card flex flex-wrap items-end gap-3 p-4">
          <Field label="New division code"><input name="code" className="input w-28" placeholder="D5" /></Field>
          <Field label="Name"><input name="name" className="input w-48" /></Field>
          <SubmitButton variant="ghost">Add division</SubmitButton>
        </ActionForm>
      </div>

      <section className="card mt-8 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Promotion and relegation review</h2>
            <p className="text-xs text-muted">Suggestions use the rules above and the monthly division standings. Tick the moves you agree with.</p>
          </div>
          <UrlSelect name="period" label="Month" value={period.slice(0, 7)} options={periods.map((p) => ({ value: p.slice(0, 7), label: fmtMonth(p) }))} />
        </div>
        {moves.length ? (
          <ActionForm action={applyDivisionMoves}>
            <table className="table-base">
              <thead><tr><th></th><th>Player</th><th>Move</th><th>Why</th></tr></thead>
              <tbody>{moves.map((m) => (
                <tr key={m.playerId + m.kind}>
                  <td><input type="checkbox" name="move" value={`${m.playerId}:${m.toId}:${m.kind}`} className="h-4 w-4 accent-electric" /></td>
                  <td><Link href={`/admin/players/${m.playerId}`} className="font-semibold hover:text-white">{m.name}</Link></td>
                  <td className={m.kind === "promotion" ? "text-ice" : "text-[#f2a08c]"}>{m.from} → {m.to} ({m.kind})</td>
                  <td className="text-muted">{m.why}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-end gap-3"><Field label="Note for history"><input name="note" className="input w-72" defaultValue={`${fmtMonth(period)} review`} /></Field><SubmitButton>Apply selected moves</SubmitButton></div>
          </ActionForm>
        ) : <p className="text-sm text-muted">No suggestions for {fmtMonth(period)}. Set &quot;Promote top N&quot; or &quot;Relegate bottom N&quot; above to get suggestions, or change divisions on each player&apos;s page.</p>}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Division champions</h2>
        {champions.length ? (
          <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">{champions.map((c, i) => <p key={i}><span className="text-muted">{fmtMonth(c.period)} · {c.code} {c.mode === "pair" ? "pair" : "player"}:</span> <span className="font-semibold">{c.name}</span></p>)}</div>
        ) : <p className="text-sm text-muted">Champions appear once a month with results has ended.</p>}
      </section>
    </>
  );
}
