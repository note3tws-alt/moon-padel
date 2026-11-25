"use client";
import type { LiveState } from "@/lib/ladder/live";
import { cn } from "@/lib/utils";
import { fmtClock, useCountdown, useLive } from "./use-live";
import { ConnectionDot } from "./tv";

const LINE: Record<string, string> = {
  draft: "Not started", checkin_open: "Check-in open", ready: "Courts drawn", round_live: "Round in play",
  score_collection: "Scores coming in", round_locked: "Between rounds", completed: "Final results", cancelled: "Cancelled",
};

/** Phone-friendly live view for players and friends. Same data as the venue TV. */
export function PublicLive({ initial, slug }: { initial: LiveState; slug: string }) {
  const { state, conn, now } = useLive(initial, `/api/live/e/${slug}`, `mp-pub-${initial.event.id}`);
  const left = useCountdown(state, now);
  const e = state.event;
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? "Player";
  const roundNo = e.state === "round_locked" && e.upcomingRound ? e.upcomingRound : e.state === "ready" ? 1 : e.currentRound;
  const round = state.rounds.find((r) => r.round === roundNo);
  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">{LINE[e.state]}{e.currentRound ? ` · Round ${e.currentRound} of ${e.rounds}` : ""}</p>
          <h1 className="h-display mt-2 text-3xl sm:text-4xl">{e.title}</h1>
          <p className="mt-1 text-sm text-muted">{e.venue ?? "[VENUE]"} · {new Date(e.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
        </div>
        <div className="flex items-center gap-4">
          {e.state === "round_live" && <span className="rounded-xl border border-electric/40 bg-electric/10 px-3 py-1 text-2xl font-extrabold tabular-nums">{fmtClock(left)}</span>}
          <ConnectionDot conn={conn} className="text-[11px]" />
        </div>
      </div>

      {e.state === "completed" && state.podium.ready && (
        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          {state.podium.places.map((p) => (
            <div key={p.playerId} className={cn("rounded-2xl p-5 text-space", p.medal === "gold" ? "bg-gold" : p.medal === "silver" ? "bg-silver" : "bg-[#B07A4A]")}>
              <p className="text-xs font-extrabold uppercase tracking-label">{p.medal}</p>
              <p className="mt-1 text-xl font-extrabold">{p.name}</p>
              <p className="text-sm font-bold">{p.total} games</p>
            </div>
          ))}
        </section>
      )}

      {round && e.state !== "completed" && (
        <section className="mb-8">
          <h2 className="mb-3 font-bold">{roundNo === e.currentRound && e.state !== "ready" ? `Round ${roundNo}` : `Next: round ${roundNo}`}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {round.courts.map((c) => (
              <div key={c.id} className="card flex items-stretch overflow-hidden">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-court/40"><span className="text-[9px] font-bold uppercase tracking-label text-ice">Court</span><span className="text-3xl font-extrabold">{c.court}</span></div>
                <div className="min-w-0 flex-1 space-y-1 px-4 py-3 text-sm">
                  {[1, 2].map((t) => (
                    <div key={t} className="flex justify-between gap-2">
                      <span className="truncate font-semibold">{(t === 1 ? c.team1 : c.team2).map(name).join(" + ")}</span>
                      {c.team1Games !== null && !["scheduled", "live", "awaiting"].includes(c.status) && <span className="font-extrabold tabular-nums">{t === 1 ? c.team1Games : c.team2Games}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {state.standings.some((r) => r.total > 0) && (
        <section className="card overflow-x-auto p-4 sm:p-5">
          <h2 className="mb-3 font-bold">Leaderboard</h2>
          <table className="table-base">
            <thead><tr><th>#</th><th>Player</th>{Array.from({ length: e.rounds }, (_, i) => <th key={i} className="hidden text-center sm:table-cell">R{i + 1}</th>)}<th className="text-right">Total</th></tr></thead>
            <tbody>{state.standings.map((r) => (
              <tr key={r.playerId}>
                <td className={cn("font-bold", r.rank <= 3 ? "text-gold" : "text-muted")}>{r.rank}</td>
                <td className="font-semibold">{r.name}</td>
                {r.rounds.map((g, i) => <td key={i} className="hidden text-center tabular-nums text-muted sm:table-cell">{g ?? "·"}</td>)}
                <td className="text-right font-extrabold tabular-nums">{r.total}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
      {e.state === "checkin_open" && (
        <p className="text-sm text-muted">{state.players.filter((p) => p.checkedIn).length} of {e.cap} players checked in.</p>
      )}
    </div>
  );
}
