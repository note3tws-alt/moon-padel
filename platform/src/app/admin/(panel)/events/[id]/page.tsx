import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader, Field } from "@/components/admin/page-header";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EventStateChip } from "@/components/admin/events/state-chip";
import { AutoRefresh, CopyLink, Countdown } from "@/components/admin/events/live-bits";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { buildLiveState } from "@/lib/ladder/live";
import { loadBundle } from "@/lib/ladder/service";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { duplicateEvent, eventOp } from "../actions";

export const metadata = { title: "Event control centre" };
export const dynamic = "force-dynamic";

function Op({ id, op, children, variant = "primary", confirm, extra, className }: { id: string; op: string; children: ReactNode; variant?: "primary" | "ghost" | "danger"; confirm?: string; extra?: Record<string, string>; className?: string }) {
  return (
    <ActionForm action={eventOp} confirm={confirm} className={className}>
      <input type="hidden" name="event_id" value={id} />
      <input type="hidden" name="op" value={op} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} className="btn-sm" pendingText="…">{children}</SubmitButton>
    </ActionForm>
  );
}

const MATCH_LABEL: Record<string, string> = {
  scheduled: "Up next", live: "Playing", awaiting: "No score yet", pending: "Waiting for confirmation",
  disputed: "Disputed", confirmed: "Confirmed", locked: "Locked",
};

export default async function EventControl({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const admin = await requireAdmin();
  const db = sql();
  const bundle = await loadBundle(db, id).catch(() => null);
  if (!bundle) notFound();
  const s = buildLiveState(bundle, "admin");
  const e = bundle.event;
  const [directory, log] = await Promise.all([
    db`select p.id, p.full_name, p.player_code, st.code as tier from players p left join skill_tiers st on st.id = p.skill_tier_id
       where p.status = 'active' and p.id not in (select player_id from ladder_participants where event_id = ${id} and status <> 'removed')
       order by st.numeric_order nulls last, p.full_name`,
    db`select action, actor, reason, created_at, match_id from ladder_score_log where event_id = ${id} order by created_at desc limit 40`,
  ]);
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const name = (pid: string) => s.players.find((p) => p.id === pid)?.name ?? "Player";
  const isOwner = admin.role === "admin";
  const checked = s.players.filter((p) => p.checkedIn).length;
  const drawn = bundle.matches.length > 0;
  const current = s.rounds.find((r) => r.round === e.current_round);
  const upcoming = s.event.upcomingRound ? s.rounds.find((r) => r.round === s.event.upcomingRound) : null;
  const closed = e.state === "completed" || e.state === "cancelled";

  // The one thing to do next, by state.
  let next: ReactNode = null;
  switch (e.state) {
    case "draft":
      next = <><p className="text-sm text-muted">Add {e.player_cap} players, then open check-in on the venue tablet.</p><Op id={id} op="open_checkin">Open check-in</Op></>;
      break;
    case "checkin_open":
      next = (
        <>
          <p className="text-sm text-muted">{checked}/{e.player_cap} checked in. {s.players.length < e.player_cap ? `${e.player_cap - s.players.length} seat(s) still empty. ` : ""}Draw courts once everyone is here: the strongest levels start on court 1.</p>
          <div className="flex flex-wrap gap-2"><Op id={id} op="draw">Draw courts</Op>{!drawn && <Op id={id} op="back_to_draft" variant="ghost">Back to draft</Op>}</div>
        </>
      );
      break;
    case "ready":
      next = <><p className="text-sm text-muted">Round 1 courts are on the TV. Swap players below if needed, then start the clock.</p><div className="flex flex-wrap gap-2"><Op id={id} op="start">Start round 1</Op><Op id={id} op="regenerate" variant="ghost" confirm="Redraw all round 1 courts?">Redraw courts</Op></div></>;
      break;
    case "round_live":
      next = (
        <>
          <p className="text-3xl font-extrabold"><Countdown endsAt={s.event.roundEndsAt} paused={s.event.pausedRemaining} /></p>
          <div className="flex flex-wrap gap-2">
            <Op id={id} op="end" confirm="End the round now? The tablet switches to score entry.">Whistle: end round {e.current_round}</Op>
            <Op id={id} op={s.event.pausedRemaining !== null ? "resume" : "pause"} variant="ghost">{s.event.pausedRemaining !== null ? "Resume clock" : "Pause clock"}</Op>
          </div>
        </>
      );
      break;
    case "score_collection": {
      const b = current?.blockers ?? [];
      next = (
        <>
          <p className="text-sm text-muted">Players enter and confirm scores on the tablet. The round locks by itself when all {e.court_count} courts are confirmed{b.some((x) => x.reason === "tie") ? ", and every tie has a pair chosen to move up" : ""}.</p>
          <p className="text-sm">{b.length ? <>Waiting on: {b.map((x) => `court ${x.court} (${x.reason === "tie" ? "tie" : x.reason === "unconfirmed" ? "not confirmed" : "no score"})`).join(", ")}</> : "All courts confirmed."}</p>
          <Op id={id} op="lock" variant="ghost">Lock round now</Op>
        </>
      );
      break;
    }
    case "round_locked":
      next = s.event.upcomingRound
        ? <><p className="text-sm text-muted">Round {e.current_round} is locked. Round {s.event.upcomingRound} courts and partners are on the TV.</p><div className="flex flex-wrap gap-2"><Op id={id} op="start">Start round {s.event.upcomingRound}</Op><Op id={id} op="regenerate" variant="ghost" confirm="Rebuild the next round from the latest scores?">Regenerate pairings</Op></div></>
        : <><p className="text-sm text-muted">All {e.round_count} rounds are locked. {s.podium.ready ? "Finalise to award gold, silver and bronze and add points to lifetime totals." : s.podium.reason}</p><Op id={id} op="finalize" confirm="Finalise the event? Points are added to lifetime totals and milestone medals unlock.">Finalise event</Op></>;
      break;
    case "completed":
      next = <p className="text-sm text-muted">Finalised {e.finalized_at ? fmtDate(e.finalized_at) : ""}. Podium and lifetime points are live on the TV, website and player profiles.</p>;
      break;
    case "cancelled":
      next = <p className="text-sm text-muted">This event was cancelled.</p>;
  }

  const showRound = upcoming && (e.state === "ready" || e.state === "round_locked") ? upcoming : current;

  return (
    <>
      <PageHeader
        title={e.title}
        description={<>{fmtDate(e.event_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{e.start_time ? ` · ${fmtTime(e.start_time)}` : ""} · {e.club_name ?? e.venue_name ?? "[VENUE]"} · {e.court_count} courts · {e.round_count} x {e.round_minutes} min</>}
        actions={<>
          <AutoRefresh eventId={id} version={s.version} />
          <EventStateChip state={e.state} round={e.current_round} rounds={e.round_count} />
          <Link href={`/admin/events/${id}/edit`} className="btn-ghost btn-sm">Settings</Link>
          <Link href={`/admin/events/${id}/report`} className="btn-ghost btn-sm">Report & exports</Link>
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card border-electric/30 p-5">
            <p className="label mb-3">Next step</p>
            <div className="space-y-3">{next}</div>
          </section>

          {showRound && (
            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{showRound === upcoming ? `Round ${showRound.round} courts (not started)` : `Round ${showRound.round}`}</h2>
                {showRound.round > 1 && <span className="text-xs text-muted">Winners move up, losers move down, partners change.</span>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {showRound.courts.map((c) => {
                  const level = c.team1Games !== null && c.team1Games === c.team2Games;
                  return (
                    <div key={c.id} className={cn("rounded-xl border p-4", c.status === "disputed" ? "border-loss/50 bg-loss/5" : c.status === "pending" || (level && !c.advancing && c.status !== "scheduled") ? "border-gold/40 bg-gold/5" : "border-line bg-space/40")}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-label text-ice">Court {c.court}</span>
                        <span className={cn("text-[11px] font-bold uppercase tracking-wider", c.status === "disputed" ? "text-[#f2a08c]" : c.status === "pending" ? "text-gold" : "text-muted")}>{MATCH_LABEL[c.status]}</span>
                      </div>
                      {[1, 2].map((t) => (
                        <div key={t} className="flex items-center justify-between py-0.5">
                          <span className="text-sm font-semibold">{(t === 1 ? c.team1 : c.team2).map(name).join(" + ")}{c.submittedByTeam === t && c.status === "pending" ? <span className="ml-2 text-[10px] uppercase text-muted">entered</span> : null}{c.advancing === t ? <span className="ml-2 text-[10px] uppercase text-gold">moves up</span> : null}</span>
                          <span className="text-lg font-extrabold tabular-nums">{(t === 1 ? c.team1Games : c.team2Games) ?? "–"}</span>
                        </div>
                      ))}
                      {!["scheduled", "live"].includes(c.status) && !closed && (c.status !== "locked" || isOwner) && (
                        <details className="mt-3" open={c.status === "disputed" || (level && !c.advancing)}>
                          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-silver">{c.status === "locked" ? "Correct locked score" : c.status === "confirmed" ? "Change score" : "Enter / approve score"}</summary>
                          <ActionForm action={eventOp} className="mt-3 grid grid-cols-2 gap-2">
                            <input type="hidden" name="event_id" value={id} />
                            <input type="hidden" name="op" value="set_score" />
                            <input type="hidden" name="match_id" value={c.id} />
                            <Field label="Team 1"><input name="team1_games" type="number" min={0} max={99} required defaultValue={c.team1Games ?? ""} className="input" /></Field>
                            <Field label="Team 2"><input name="team2_games" type="number" min={0} max={99} required defaultValue={c.team2Games ?? ""} className="input" /></Field>
                            <Field label="If level, moves up" className="col-span-2">
                              <select name="advancing" defaultValue={c.advancing ?? ""} className="select">
                                <option value="">Not level / decide later</option>
                                <option value="1">{c.team1.map(name).join(" + ")}</option>
                                <option value="2">{c.team2.map(name).join(" + ")}</option>
                              </select>
                            </Field>
                            <Field label={c.status === "locked" ? "Reason (required)" : "Reason (optional)"} className="col-span-2"><input name="reason" className="input" required={c.status === "locked"} placeholder="e.g. Both teams agreed at the desk" /></Field>
                            <div className="col-span-2 flex justify-end"><SubmitButton className="btn-sm">{c.status === "pending" || c.status === "disputed" || c.status === "awaiting" ? "Approve this score" : "Save correction"}</SubmitButton></div>
                          </ActionForm>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
              {showRound === upcoming || e.state === "ready" ? (
                <ActionForm action={eventOp} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="op" value="swap" />
                  <Field label="Swap player"><select name="a" className="select min-w-44">{s.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                  <Field label="with"><select name="b" className="select min-w-44">{s.players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                  <SubmitButton variant="ghost" className="btn-sm">Swap</SubmitButton>
                </ActionForm>
              ) : null}
            </section>
          )}

          <section className="card overflow-x-auto p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Rankings</h2>
              <span className="text-xs text-muted">Total games, then wins, then game difference, then organiser decision</span>
            </div>
            <table className="table-base">
              <thead><tr><th>#</th><th>Player</th>{Array.from({ length: e.round_count }, (_, i) => <th key={i} className="text-center">R{i + 1}</th>)}<th className="text-right">W</th><th className="text-right">+/-</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {s.standings.map((r) => (
                  <tr key={r.playerId}>
                    <td className={cn("font-bold", r.rank === 1 ? "text-gold" : "text-muted")}>{r.rank}{r.tied ? "=" : ""}</td>
                    <td className="font-semibold">{r.name}</td>
                    {r.rounds.map((g, i) => <td key={i} className="text-center tabular-nums text-muted">{g ?? "·"}</td>)}
                    <td className="text-right tabular-nums">{r.wins}</td>
                    <td className="text-right tabular-nums">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                    <td className="text-right font-extrabold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.standings.some((r) => r.tied && r.rank <= 3) && !closed && (
              <ActionForm action={eventOp} className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4">
                <input type="hidden" name="event_id" value={id} />
                <input type="hidden" name="op" value="tie_order" />
                <p className="mb-3 text-sm font-semibold text-gold">Tie on a medal place. Set the order for tied players (1 = higher) under your published rule.</p>
                <div className="flex flex-wrap gap-3">
                  {s.standings.filter((r) => r.tied && r.rank <= 3).map((r) => (
                    <Field key={r.playerId} label={r.name}><input name={`order_${r.playerId}`} type="number" min={1} defaultValue={e.manual_order?.[r.playerId] ?? ""} className="input w-24" /></Field>
                  ))}
                </div>
                <SubmitButton className="btn-sm mt-3">Save order</SubmitButton>
              </ActionForm>
            )}
          </section>

          {(e.state === "completed" || s.event.allLocked) && (
            <section className="card p-5">
              <h2 className="mb-3 font-bold">Podium</h2>
              {s.podium.ready ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {s.podium.places.map((p) => (
                    <div key={p.playerId} className={cn("rounded-xl p-4 text-space", p.medal === "gold" ? "bg-gold" : p.medal === "silver" ? "bg-silver" : "bg-[#B07A4A]")}>
                      <p className="text-xs font-extrabold uppercase tracking-label">{p.medal}</p>
                      <p className="mt-1 text-lg font-extrabold">{p.name}</p>
                      <p className="text-sm font-bold">{p.total} games</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted">{s.podium.reason}</p>}
              {e.state === "completed" && isOwner && (
                <ActionForm action={eventOp} confirm="Reopen this event? Its lifetime points are removed until you finalise again." className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value="reopen" />
                  <Field label="Reason to reopen"><input name="reason" required minLength={3} className="input min-w-72" /></Field>
                  <SubmitButton variant="danger" className="btn-sm">Reopen event</SubmitButton>
                </ActionForm>
              )}
            </section>
          )}

          {!drawn && !closed && (
            <section className="card p-5">
              <h2 className="mb-1 font-bold">Roster ({s.players.length}/{e.player_cap})</h2>
              <p className="mb-4 text-xs text-muted">Players are identified by their permanent player ID, so points add up across events and venues.</p>
              {s.players.length < e.player_cap && (
                <ActionForm action={eventOp} resetOnSuccess className="mb-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value="add_players" />
                  <Field label="Add players (Ctrl/Cmd-click for several)" className="min-w-72 flex-1">
                    <select name="player_ids" multiple size={8} className="input">
                      {directory.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.player_code}{p.tier ? ` · ${p.tier}` : ""}</option>)}
                    </select>
                  </Field>
                  <SubmitButton className="btn-sm">Add</SubmitButton>
                </ActionForm>
              )}
              {!directory.length && <p className="mb-4 text-xs text-muted">Everyone in the directory is already on this event. <Link href="/admin/players/new" className="text-ice underline">Add a player</Link>.</p>}
            </section>
          )}

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Activity</h2>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-xs">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3"><span className="w-16 shrink-0 tabular-nums text-muted">{new Date(l.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Dubai" })}</span><span className="font-semibold">{l.action.replace(/_/g, " ")}</span><span className="truncate text-muted">{String(l.actor).replace(/player:([0-9a-f-]{36})/, (_: string, pid: string) => name(pid))}{l.reason ? ` · ${l.reason}` : ""}</span></li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-2 p-5">
            <h2 className="mb-1 font-bold">Screens</h2>
            <p className="mb-2 text-xs text-muted">Open these on the venue tablet and the TV. No login needed; keep the links private.</p>
            <CopyLink label="Check-in tablet" url={`${base}/kiosk/${e.kiosk_token}`} />
            <CopyLink label="TV display" url={`${base}/tv/${e.tv_token}`} />
            {e.is_public && <CopyLink label="Public live page" url={`${base}/live/${e.slug}`} />}
            {isOwner && <Op id={id} op="rotate_links" variant="ghost" confirm="Create new links? The old tablet and TV links stop working." className="pt-1">Reset screen links</Op>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">TV shows</h2>
            <div className="flex flex-wrap gap-1.5">
              {[["auto", "Auto"], ["checkin", "Check-in"], ["courts", "Courts"], ["leaderboard", "Leaderboard"], ["results", "Round results"], ["podium", "Podium"]].map(([m, label]) => (
                <ActionForm key={m} action={eventOp}>
                  <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value="tv_mode" /><input type="hidden" name="mode" value={m} />
                  <button className={cn("chip", e.tv_mode === m ? "border-electric bg-electric/15 text-white" : "text-muted hover:text-silver")}>{label}</button>
                </ActionForm>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Auto switches by stage and rotates every {e.tv_cycle_seconds}s.</p>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Check-in</h2>
              <span className="text-sm font-extrabold tabular-nums">{checked}<span className="text-muted">/{e.player_cap}</span></span>
            </div>
            <ul className="space-y-1">
              {s.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="text-[11px] text-muted">{p.tier ?? "No level"}{p.checkedInAt ? ` · in ${new Date(p.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })}` : ""}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {!closed && !drawn && (p.checkedIn
                      ? <Op id={id} op="uncheck" variant="ghost" extra={{ player_id: p.id }}>Undo</Op>
                      : <Op id={id} op="checkin" extra={{ player_id: p.id }}>Check in</Op>)}
                    {drawn && <span className={cn("chip", p.checkedIn ? "text-ice" : "text-muted")}>{p.checkedIn ? "In" : "Out"}</span>}
                    {!drawn && !closed && <Op id={id} op="remove_player" variant="ghost" extra={{ player_id: p.id }} confirm={`Remove ${p.name} from this event?`}>✕</Op>}
                  </span>
                </li>
              ))}
              {Array.from({ length: Math.max(0, e.player_cap - s.players.length) }, (_, i) => <li key={i} className="rounded-lg border border-dashed border-line px-2 py-2 text-xs text-muted">Empty seat</li>)}
            </ul>
            {!drawn && !closed && s.players.some((p) => !p.checkedIn) && directory.length > 0 && (
              <ActionForm action={eventOp} className="mt-4 space-y-2 border-t border-line pt-4">
                <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value="replace_player" />
                <p className="text-xs font-semibold text-muted">Replace a no-show</p>
                <select name="player_id" className="select">{s.players.filter((p) => !p.checkedIn).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <select name="replacement_id" className="select">{directory.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.tier ? ` · ${p.tier}` : ""}</option>)}</select>
                <SubmitButton variant="ghost" className="btn-sm">Replace</SubmitButton>
              </ActionForm>
            )}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">More</h2>
            <ActionForm action={duplicateEvent} className="flex items-end gap-2">
              <input type="hidden" name="id" value={id} />
              <Field label="Copy to a new date" className="flex-1"><input name="event_date" type="date" required className="input" /></Field>
              <SubmitButton variant="ghost" className="btn-sm">Duplicate</SubmitButton>
            </ActionForm>
            {!closed && (
              <ActionForm action={eventOp} confirm="Cancel this event? The tablet and TV will show it as cancelled." className="flex items-end gap-2">
                <input type="hidden" name="event_id" value={id} /><input type="hidden" name="op" value="cancel" />
                <Field label="Cancel event (reason)" className="flex-1"><input name="reason" className="input" /></Field>
                <SubmitButton variant="danger" className="btn-sm">Cancel</SubmitButton>
              </ActionForm>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
