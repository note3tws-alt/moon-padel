import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Field } from "@/components/admin/page-header";
import { TournamentForm } from "@/components/admin/tournament-form";
import { MatchForm } from "@/components/admin/match-form";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { StatusChip } from "@/components/ui";
import { sql } from "@/lib/db";
import { getDivisions } from "@/lib/queries";
import { fmtNumber, fmtRating, setsToString } from "@/lib/utils";
import { addRegistrations, deleteMatch, deleteTournament, generateRound, quickScore, setPublished, updateRegistration } from "../actions";

export const metadata = { title: "Manage tournament" };

export default async function AdminTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = sql();
  const [t] = await db`select * from tournaments where id = ${id}`;
  if (!t) notFound();
  const fixed = t.pair_type === "fixed";
  const [divisions, clubs, regs, matches, allPlayers, allPairs, standings] = await Promise.all([
    getDivisions(),
    db`select id, name from clubs order by name`,
    db`select r.id, r.status, r.final_position_override, r.pair_id, p.id as player_id, p.full_name, p.player_code, pr.name as pair_name, s.rating
       from tournament_registrations r join players p on p.id = r.player_id left join pairs pr on pr.id = r.pair_id left join player_stats s on s.player_id = p.id
       where r.tournament_id = ${id} order by r.status, pr.name nulls last, s.rating desc nulls last, p.full_name`,
    db`select m.*, pa.name as pair_a_name, pb.name as pair_b_name,
              (select json_agg(json_build_object('name', p.full_name, 'team', mp.team) order by p.full_name) from match_players mp join players p on p.id = mp.player_id where mp.match_id = m.id) as players
       from matches m left join pairs pa on pa.id = m.team_a_pair_id left join pairs pb on pb.id = m.team_b_pair_id
       where m.tournament_id = ${id} order by m.round_number, m.court_number`,
    db`select p.id, p.full_name || ' (' || p.player_code || ')' as name, p.division_id from players p where p.status = 'active' order by (p.division_id = ${t.division_id}) desc nulls last, p.full_name`,
    db`select id, name from pairs where active order by (division_id = ${t.division_id}) desc nulls last, name`,
    db`select tp.final_position, tp.total_points, tp.wins, tp.losses, coalesce(pr.name, p.full_name) as name from tournament_points tp
       left join players p on p.id = tp.player_id left join pairs pr on pr.id = tp.pair_id
       where tp.tournament_id = ${id} and tp.entity_type = ${fixed ? "pair" : "player"} order by tp.final_position nulls last limit 10`,
  ]);
  const registered = regs.filter((r) => r.status === "registered");
  const regIds = new Set(regs.map((r) => r.player_id));
  const rounds = [...new Set(matches.map((m) => m.round_number))];
  const open = matches.filter((m) => m.status === "scheduled").length;
  const done = matches.filter((m) => m.status === "completed").length;
  const matchPlayers = (registered.length ? registered.map((r) => ({ id: r.player_id, name: r.full_name })) : allPlayers.map((p) => ({ id: p.id, name: p.name })));
  const regPairs = [...new Map(registered.filter((r) => r.pair_id).map((r) => [r.pair_id, { id: r.pair_id, name: r.pair_name }])).values()];

  return (
    <>
      <PageHeader title={t.name} description={<span className="inline-flex flex-wrap items-center gap-2"><StatusChip status={t.status} /> {registered.length} registered · {done} results · {open} scheduled · {t.results_published ? "results published" : "results not published"}</span>}
        actions={<>{t.status !== "draft" && <Link href={`/tournaments/${t.slug}`} target="_blank" className="btn-ghost btn-sm">Public page ↗</Link>}<Link href={`/admin/upload?kind=matches`} className="btn-ghost btn-sm">Upload results</Link></>} />

      {/* Publish */}
      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-4 p-5 ${t.results_published ? "border-electric/30" : ""}`}>
        <div>
          <h2 className="font-bold">{t.results_published ? "Results are live" : "Publish results"}</h2>
          <p className="mt-1 text-sm text-muted">{t.results_published
            ? "Rankings, player profiles and the homepage include this tournament. Any score change recalculates everything automatically."
            : "When every match has a result, publish to update ratings, points, monthly rankings and player profiles in one step."}</p>
        </div>
        <ActionForm action={setPublished} confirm={t.results_published ? "Unpublish these results? They will be removed from all rankings." : undefined}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="publish" value={t.results_published ? "0" : "1"} />
          <SubmitButton variant={t.results_published ? "ghost" : "primary"} pendingText="Recalculating…">{t.results_published ? "Unpublish" : "Publish results"}</SubmitButton>
        </ActionForm>
      </section>

      {standings.length > 0 && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 font-bold">Calculated standings</h2>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {standings.map((s, i) => <li key={i}><span className={`mr-2 font-bold ${s.final_position === 1 ? "text-gold" : "text-muted"}`}>{s.final_position}</span>{s.name} <span className="text-muted">· {s.wins}-{s.losses} · {fmtNumber(s.total_points, 1)} pts</span></li>)}
          </ol>
        </section>
      )}

      <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
        {/* Registrations */}
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Players ({registered.length}{t.max_players ? ` / ${t.max_players}` : ""})</h2>
          <ActionForm action={addRegistrations} resetOnSuccess className="mb-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <input type="hidden" name="tournament_id" value={id} />
            {fixed ? (
              <Field label="Add pairs" hint="Hold Ctrl / Cmd to choose several.">
                <select name="pair_ids" multiple size={5} className="input">{allPairs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </Field>
            ) : (
              <Field label="Add players" hint="Hold Ctrl / Cmd to choose several.">
                <select name="player_ids" multiple size={6} className="input">{allPlayers.filter((p) => !regIds.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </Field>
            )}
            <Field label="As"><select name="status" className="select"><option value="registered">Registered</option><option value="waitlist">Waitlist</option></select></Field>
            <SubmitButton>Add</SubmitButton>
          </ActionForm>
          {regs.length ? (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Player</th>{fixed && <th>Pair</th>}<th className="text-right">RTG</th><th>Status</th><th>Finish override</th><th></th></tr></thead>
                <tbody>
                  {regs.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.full_name}</td>
                      {fixed && <td className="text-muted">{r.pair_name ?? "–"}</td>}
                      <td className="text-right tabular-nums">{fmtRating(r.rating)}</td>
                      <td>
                        <ActionForm action={updateRegistration} className="flex gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <select name="action" defaultValue={r.status} className="select !py-1 !text-xs">
                            <option value="registered">Registered</option><option value="waitlist">Waitlist</option><option value="withdrawn">Withdrawn</option>
                          </select>
                          <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Set</SubmitButton>
                        </ActionForm>
                      </td>
                      <td>
                        <ActionForm action={updateRegistration} className="flex gap-1">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="position" />
                          <input name="position" type="number" min="1" defaultValue={r.final_position_override ?? ""} placeholder="auto" className="input !w-20 !py-1 !text-xs" />
                          <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Set</SubmitButton>
                        </ActionForm>
                      </td>
                      <td>
                        <ActionForm action={updateRegistration} confirm={`Remove ${r.full_name}?`}>
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="remove" />
                          <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Remove</SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No registrations yet.</p>}
        </section>

        {/* Rounds */}
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Rounds and results</h2>
            <ActionForm action={generateRound}>
              <input type="hidden" name="tournament_id" value={id} />
              <SubmitButton variant="ghost" className="btn-sm" pendingText="Generating…">Generate round {rounds.length + 1}</SubmitButton>
            </ActionForm>
          </div>
          <p className="mb-4 text-xs text-muted">{fixed ? "Fixed pairs: round robin pairings." : t.format === "ladder" ? "Ladder: round 1 is seeded by rating, then winners move up a court and losers move down." : "Partners rotate each round."} Enter scores as &quot;6-4&quot; or &quot;6-4, 3-6, 10-8&quot; (Team A first).</p>
          {rounds.length ? rounds.map((r) => (
            <div key={r} className="mb-4">
              <p className="label mb-2">Round {r}</p>
              <div className="space-y-2">
                {matches.filter((m) => m.round_number === r).map((m) => {
                  const ps = (m.players ?? []) as { name: string; team: string }[];
                  const side = (x: string) => (fixed ? `${x === "A" ? m.pair_a_name : m.pair_b_name}: ` : "") + ps.filter((p) => p.team === x).map((p) => p.name).join(" & ");
                  return (
                    <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.status === "void" ? "border-dashed border-line opacity-60" : "border-line"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Court {m.court_number} · {m.status}{!m.verified && " · unverified"}</p>
                          <p className={m.winner === "A" ? "font-bold" : "text-muted"}>A: {side("A")}</p>
                          <p className={m.winner === "B" ? "font-bold" : "text-muted"}>B: {side("B")}</p>
                        </div>
                        <ActionForm action={quickScore} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={m.id} />
                          <input name="set_scores" defaultValue={setsToString(m.set_scores)} placeholder="6-4" className="input !w-32 !py-1.5 !text-xs" aria-label="Score" />
                          <SubmitButton variant="ghost" className="btn-sm" pendingText="…">Save</SubmitButton>
                        </ActionForm>
                        <div className="flex gap-1">
                          <Link href={`/admin/matches/${m.id}`} className="btn-ghost btn-sm">Edit</Link>
                          <ActionForm action={deleteMatch} confirm="Delete this match?"><input type="hidden" name="id" value={m.id} /><SubmitButton variant="ghost" className="btn-sm" pendingText="…">×</SubmitButton></ActionForm>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : <p className="text-sm text-muted">No matches yet. Generate round 1 or add a match below.</p>}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-bold">Add a match manually</h2>
        <MatchForm tournament={{ id, pair_type: t.pair_type, name: t.name }} players={matchPlayers as { id: string; name: string }[]} pairs={(regPairs.length ? regPairs : allPairs) as { id: string; name: string }[]} match={{ round_number: Math.max(1, rounds.length), court_number: 1, status: "completed", verified: true }} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-bold">Tournament details</h2>
        <TournamentForm t={t} divisions={divisions} clubs={clubs as unknown as { id: string; name: string }[]} />
      </section>

      <section className="card mt-6 border-loss/20 p-5">
        <h2 className="font-bold">Delete tournament</h2>
        <p className="mb-4 mt-1 text-xs text-muted">Deletes its registrations and matches, then recalculates every ranking. To keep the history, set the status to cancelled instead.</p>
        <ActionForm action={deleteTournament} confirm={`Delete ${t.name} and all its matches? This cannot be undone.`}>
          <input type="hidden" name="id" value={id} /><SubmitButton variant="danger" pendingText="Deleting…">Delete tournament</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
