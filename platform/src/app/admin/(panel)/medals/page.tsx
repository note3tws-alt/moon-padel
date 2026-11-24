import Link from "next/link";
import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { adjustPoints, saveMedalTier } from "../levels/actions";
import { medalIssued } from "../events/actions";

export const metadata = { title: "Medals & lifetime points" };

export default async function Medals({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const show = sp.show ?? "pending";
  const db = sql();
  const [tiers, awards, leaders, players] = await Promise.all([
    db`select t.*, (select count(*)::int from player_medals m where m.medal_tier_id = t.id) as unlocked from medal_tiers t order by threshold`,
    db`select m.id, m.unlocked_at, m.issued_at, m.issued_by, m.points_at_unlock, t.name as medal, t.threshold, p.full_name, p.id as player_id, e.title as event_title
       from player_medals m join medal_tiers t on t.id = m.medal_tier_id join players p on p.id = m.player_id left join ladder_events e on e.id = m.event_id
       where ${show === "pending" ? db`m.issued_at is null` : db`true`} order by m.unlocked_at desc limit 300`,
    db`select p.id, p.full_name, st.code as level, sum(l.points)::int as points, count(distinct l.event_id)::int as events
       from player_points_ledger l join players p on p.id = l.player_id left join skill_tiers st on st.id = p.skill_tier_id
       group by p.id, st.code order by points desc limit 50`,
    db`select id, full_name, player_code from players where status = 'active' order by full_name`,
  ]);
  return (
    <>
      <PageHeader title="Medals & lifetime points" description="Every finalised event adds each player's games to a permanent lifetime total. Crossing a milestone unlocks its medal once. Record here when the physical medal is handed over."
        actions={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page
          <a href="/api/admin/export/medals" className="btn-ghost btn-sm">Export CSV</a>} />

      <section className="card mb-6 p-5">
        <h2 className="mb-1 font-bold">Milestones</h2>
        <p className="mb-4 text-xs text-muted">10 to 15 levels recommended. Names and thresholds are working values until the founders approve them.</p>
        <div className="space-y-2">
          {tiers.map((t) => (
            <ActionForm key={t.id} action={saveMedalTier} className="grid items-end gap-2 sm:grid-cols-[1fr_110px_80px_1fr_70px_80px_auto]">
              <input type="hidden" name="id" value={t.id} />
              <Field label="Name"><input name="name" defaultValue={t.name} className="input py-1.5" /></Field>
              <Field label="Points"><input name="threshold" type="number" defaultValue={t.threshold} className="input py-1.5" /></Field>
              <Field label="Sort"><input name="sort_order" type="number" defaultValue={t.sort_order} className="input py-1.5" /></Field>
              <Field label="Medal image URL"><input name="image_url" defaultValue={t.image_url ?? ""} className="input py-1.5" placeholder="optional" /></Field>
              <label className="flex items-center gap-2 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={t.active} className="accent-electric" />On</label>
              <span className="pb-2 text-xs text-muted">{t.unlocked} unlocked</span>
              <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Save</SubmitButton>
            </ActionForm>
          ))}
        </div>
        <ActionForm action={saveMedalTier} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <Field label="New milestone name"><input name="name" required className="input" placeholder="Milestone 500" /></Field>
          <Field label="Points"><input name="threshold" type="number" min={1} required className="input w-28" /></Field>
          <input type="hidden" name="sort_order" value={tiers.length + 1} />
          <input type="hidden" name="image_url" value="" />
          <SubmitButton>Add milestone</SubmitButton>
        </ActionForm>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Medals {show === "pending" ? "to hand over" : "(all)"}</h2>
            <div className="flex gap-1.5">
              <Link href="/admin/medals?show=pending" className={`chip ${show === "pending" ? "border-electric text-white" : "text-muted"}`}>To hand over</Link>
              <Link href="/admin/medals?show=all" className={`chip ${show === "all" ? "border-electric text-white" : "text-muted"}`}>All</Link>
            </div>
          </div>
          {awards.length ? (
            <table className="table-base text-sm">
              <thead><tr><th>Player</th><th>Medal</th><th>Unlocked</th><th></th></tr></thead>
              <tbody>{awards.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/players/${a.player_id}`} className="font-semibold hover:text-white">{a.full_name}</Link></td>
                  <td>{a.medal} <span className="text-xs text-muted">({a.threshold})</span></td>
                  <td className="text-xs text-muted">{fmtDate(a.unlocked_at)}{a.event_title ? ` · ${a.event_title}` : ""}</td>
                  <td className="text-right">
                    <ActionForm action={medalIssued}>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="issued" value={a.issued_at ? "0" : "1"} />
                      <SubmitButton variant={a.issued_at ? "ghost" : "primary"} className="btn-sm" pendingText="…">{a.issued_at ? `Handed over ${fmtDate(a.issued_at, { day: "numeric", month: "short" })}` : "Mark handed over"}</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="text-sm text-muted">Nothing waiting.</p>}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Lifetime points</h2>
          <table className="table-base text-sm">
            <thead><tr><th>#</th><th>Player</th><th>Level</th><th className="text-right">Events</th><th className="text-right">Points</th></tr></thead>
            <tbody>{leaders.map((l, i) => (
              <tr key={l.id}><td className="text-muted">{i + 1}</td><td><Link href={`/admin/players/${l.id}`} className="font-semibold hover:text-white">{l.full_name}</Link></td><td className="text-xs">{l.level ?? "–"}</td><td className="text-right tabular-nums">{l.events}</td><td className="text-right font-extrabold tabular-nums">{l.points}</td></tr>
            ))}</tbody>
          </table>
          <ActionForm action={adjustPoints} resetOnSuccess className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_100px]">
            <p className="text-xs font-semibold text-muted sm:col-span-2">Manual adjustment (kept in the permanent log)</p>
            <select name="player_id" className="select">{players.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.player_code}</option>)}</select>
            <input name="points" type="number" required className="input" placeholder="+/-" />
            <input name="reason" required className="input sm:col-span-2" placeholder="Reason" />
            <SubmitButton variant="ghost" className="btn-sm sm:col-span-2">Apply adjustment</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
