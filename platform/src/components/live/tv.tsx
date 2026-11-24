"use client";
import { useEffect, useMemo, useState } from "react";
import type { LiveState } from "@/lib/ladder/live";
import { MoonMark, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { fmtClock, useCountdown, useLive, type Connection } from "./use-live";

type Mode = "checkin" | "courts" | "leaderboard" | "results" | "podium";

/** Which screens the TV rotates through in auto mode, based on where the night is. */
export function autoModes(s: LiveState): Mode[] {
  switch (s.event.state) {
    case "draft":
    case "checkin_open": return ["checkin"];
    case "ready": return ["courts", "checkin"];
    case "round_live": return ["courts"];
    case "score_collection": return ["courts", "leaderboard"];
    case "round_locked": return s.event.allLocked ? ["leaderboard", "results"] : ["results", "leaderboard", "courts"];
    case "completed": return ["podium", "leaderboard"];
    default: return ["leaderboard"];
  }
}

const STATE_LINE: Record<string, string> = {
  draft: "Check-in opens soon",
  checkin_open: "Check in at the tablet",
  ready: "Courts are set. Find your court",
  round_live: "Round in play",
  score_collection: "Enter your score at the tablet",
  round_locked: "Round locked",
  completed: "Final results",
  cancelled: "Event cancelled",
};

export function TvScreen({ initial, endpoint, topic }: { initial: LiveState; endpoint: string; topic: string | null }) {
  const { state, conn, now } = useLive(initial, endpoint, topic);
  const left = useCountdown(state, now);
  const modes = useMemo<Mode[]>(() => (state.event.tvMode === "auto" ? autoModes(state) : [state.event.tvMode as Mode]), [state]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (modes.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % modes.length), state.event.tvCycleSeconds * 1000);
    return () => clearInterval(t);
  }, [modes, state.event.tvCycleSeconds]);
  const mode = modes[idx % modes.length];

  return (
    <div className="tv-root flex h-[100dvh] w-full flex-col overflow-hidden bg-space bg-night-fade text-silver">
      <TvHeader state={state} left={left} conn={conn} />
      <div className="relative min-h-0 flex-1 px-[3vmin] pb-[3vmin]">
        {mode === "checkin" && <CheckinView state={state} />}
        {mode === "courts" && <CourtsView state={state} />}
        {mode === "leaderboard" && <LeaderboardView state={state} />}
        {mode === "results" && <ResultsView state={state} />}
        {mode === "podium" && <PodiumView state={state} />}
      </div>
      {modes.length > 1 && (
        <div className="flex justify-center gap-2 pb-[1.5vmin]" aria-hidden>
          {modes.map((m, i) => <span key={m} className={cn("h-[0.6vmin] w-[4vmin] rounded-full", i === idx % modes.length ? "bg-electric" : "bg-white/10")} />)}
        </div>
      )}
    </div>
  );
}

export function ConnectionDot({ conn, className }: { conn: Connection; className?: string }) {
  const label = conn === "offline" ? "Reconnecting…" : conn === "live" ? "Live" : "Live (polling)";
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold uppercase tracking-label", conn === "offline" ? "text-[#f2a08c]" : "text-ice", className)}>
      <span className={cn("h-[1em] w-[1em] max-h-3 max-w-3 rounded-full", conn === "offline" ? "bg-loss" : "animate-pulse bg-electric")} />
      {label}
    </span>
  );
}

function TvHeader({ state, left, conn }: { state: LiveState; left: number | null; conn: Connection }) {
  const e = state.event;
  const roundNo = e.state === "ready" || (e.state === "round_locked" && e.upcomingRound) ? (e.state === "ready" ? 1 : e.upcomingRound) : e.currentRound;
  const roundLabel = e.state === "round_locked" && e.upcomingRound ? `Next: round ${e.upcomingRound}` : roundNo ? `Round ${roundNo} / ${e.rounds}` : `${e.rounds} rounds`;
  return (
    <header className="flex items-center justify-between gap-[2vmin] px-[3vmin] py-[2.2vmin]">
      <div className="flex min-w-0 items-center gap-[1.6vmin]">
        <MoonMark size={64} phase={e.state === "completed" || e.state === "round_live" ? "full" : "gibbous"} className="!h-[7vmin] !w-[7vmin]" />
        <div className="min-w-0">
          <Wordmark className="block text-[3.2vmin] leading-none" />
          <p className="mt-[0.6vmin] truncate text-[1.9vmin] font-semibold uppercase tracking-label text-muted">
            {e.title}{e.venue ? ` · ${e.venue}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-[3vmin]">
        <div className="text-right">
          <p className="text-[1.7vmin] font-bold uppercase tracking-label text-ice">{STATE_LINE[e.state] ?? ""}</p>
          <p className="h-display text-[3.6vmin] text-white">{roundLabel}</p>
        </div>
        {e.state === "round_live" && (
          <div className={cn("rounded-[1.6vmin] border px-[2vmin] py-[0.8vmin] text-center", left !== null && left <= 60 ? "border-loss/60 bg-loss/10" : "border-electric/40 bg-electric/10")}>
            <p className="text-[1.4vmin] font-bold uppercase tracking-label text-muted">{e.pausedRemaining !== null ? "Paused" : "Time left"}</p>
            <p className="font-extrabold tabular-nums text-white text-[6vmin] leading-none">{fmtClock(left)}</p>
          </div>
        )}
        <ConnectionDot conn={conn} className="hidden text-[1.4vmin] sm:inline-flex" />
      </div>
    </header>
  );
}

const nameOf = (s: LiveState) => {
  const m = new Map(s.players.map((p) => [p.id, p.name]));
  return (id: string) => m.get(id) ?? "Player";
};

function CheckinView({ state }: { state: LiveState }) {
  const n = state.players.filter((p) => p.checkedIn).length;
  return (
    <section className="flex h-full flex-col">
      <div className="mb-[2vmin] flex items-end justify-between">
        <h2 className="h-display text-[5vmin]">Check-in</h2>
        <p className="font-extrabold tabular-nums text-[5vmin]"><span className="text-gradient-padel">{n}</span><span className="text-muted"> / {state.event.cap}</span></p>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-[1.2vmin] landscape:grid-cols-4">
        {state.players.map((p) => (
          <div key={p.id} className={cn("flex items-center justify-between rounded-[1.4vmin] border px-[2vmin]", p.checkedIn ? "border-electric/50 bg-electric/10" : "border-line bg-night/70")}>
            <span className="truncate text-[2.6vmin] font-bold">{p.name}</span>
            <span className={cn("ml-2 shrink-0 text-[1.5vmin] font-bold uppercase tracking-label", p.checkedIn ? "text-ice" : "text-muted")}>{p.checkedIn ? "In" : "Waiting"}</span>
          </div>
        ))}
        {Array.from({ length: Math.max(0, state.event.cap - state.players.length) }, (_, i) => (
          <div key={`e${i}`} className="rounded-[1.4vmin] border border-dashed border-line" />
        ))}
      </div>
    </section>
  );
}

function scoreLabel(c: LiveState["rounds"][number]["courts"][number]) {
  if (c.status === "scheduled") return "Up next";
  if (c.status === "live") return "Playing";
  if (c.status === "awaiting") return "Score needed";
  if (c.status === "pending") return "Awaiting confirmation";
  if (c.status === "disputed") return "Disputed: organiser checking";
  if (c.status === "confirmed") return "Confirmed";
  return "Locked";
}

function courtRound(state: LiveState) {
  const e = state.event;
  if (e.state === "round_locked" && e.upcomingRound) return e.upcomingRound;
  if (e.state === "ready") return 1;
  return e.currentRound;
}

function CourtsView({ state }: { state: LiveState }) {
  const round = state.rounds.find((r) => r.round === courtRound(state));
  const name = nameOf(state);
  if (!round) return <Waiting text="Courts appear here once the organiser draws them." />;
  return (
    <section className="grid h-full auto-rows-fr gap-[1.6vmin] portrait:grid-cols-1 landscape:grid-cols-2">
      {round.courts.map((c) => {
        const showScore = c.team1Games !== null && !["scheduled", "live"].includes(c.status);
        const w = showScore ? (c.team1Games! > c.team2Games! ? 1 : c.team2Games! > c.team1Games! ? 2 : c.advancing) : null;
        return (
          <div key={c.id} className="card flex min-h-0 items-stretch overflow-hidden">
            <div className="flex w-[13vmin] shrink-0 flex-col items-center justify-center bg-court/40">
              <span className="text-[1.5vmin] font-bold uppercase tracking-label text-ice">Court</span>
              <span className="font-extrabold leading-none text-white text-[9vmin]">{c.court}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1vmin] px-[2.4vmin]">
              {[1, 2].map((t) => (
                <div key={t} className={cn("flex items-center justify-between gap-3", w && w !== t && "opacity-60")}>
                  <p className="min-w-0 truncate text-[3vmin] font-bold">
                    {(t === 1 ? c.team1 : c.team2).map(name).join("  +  ")}
                  </p>
                  {showScore && <span className={cn("shrink-0 font-extrabold tabular-nums text-[4.4vmin]", w === t ? "text-gradient-padel" : "text-muted")}>{t === 1 ? c.team1Games : c.team2Games}</span>}
                </div>
              ))}
              <p className={cn("text-[1.5vmin] font-bold uppercase tracking-label", c.status === "disputed" ? "text-[#f2a08c]" : c.status === "pending" || c.status === "awaiting" ? "text-gold" : "text-muted")}>{scoreLabel(c)}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function LeaderboardView({ state }: { state: LiveState }) {
  const rows = state.standings;
  const pending = state.rounds.some((r) => r.courts.some((c) => ["pending", "disputed", "awaiting"].includes(c.status)));
  return (
    <section className="flex h-full flex-col">
      <div className="mb-[1.4vmin] flex items-end justify-between">
        <h2 className="h-display text-[4.4vmin]">Leaderboard</h2>
        <p className="text-[1.6vmin] font-bold uppercase tracking-label text-muted">{pending ? "Confirmed scores only. More coming in" : "Games won, all rounds"}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[1.6vmin] border border-line bg-night/70">
        <div className="grid h-full" style={{ gridTemplateRows: `auto repeat(${rows.length || 1}, minmax(0, 1fr))` }}>
          <div className="grid items-center gap-[1vmin] border-b border-line px-[2vmin] py-[0.8vmin] text-[1.5vmin] font-bold uppercase tracking-label text-muted" style={{ gridTemplateColumns: `6vmin minmax(0,1fr) repeat(${state.event.rounds}, 6vmin) 9vmin` }}>
            <span>#</span><span>Player</span>
            {Array.from({ length: state.event.rounds }, (_, i) => <span key={i} className="text-center">R{i + 1}</span>)}
            <span className="text-right">Total</span>
          </div>
          {rows.map((r) => (
            <div key={r.playerId} className={cn("grid items-center gap-[1vmin] border-b border-line/50 px-[2vmin]", r.rank <= 3 && "bg-white/[0.03]")} style={{ gridTemplateColumns: `6vmin minmax(0,1fr) repeat(${state.event.rounds}, 6vmin) 9vmin` }}>
              <span className={cn("inline-flex h-[4vmin] w-[4vmin] items-center justify-center rounded-full text-[1.9vmin] font-extrabold", r.rank === 1 ? "bg-gold text-space" : r.rank === 2 ? "bg-silver text-space" : r.rank === 3 ? "bg-[#B07A4A] text-space" : "text-muted")}>{r.rank}</span>
              <span className="truncate text-[2.4vmin] font-bold">{r.name}{r.tied && <span className="ml-2 text-[1.4vmin] text-muted">tie</span>}</span>
              {r.rounds.map((g, i) => <span key={i} className="text-center text-[2.2vmin] tabular-nums text-muted">{g ?? "·"}</span>)}
              <span className="text-right text-[3vmin] font-extrabold tabular-nums text-white">{r.total}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultsView({ state }: { state: LiveState }) {
  const done = state.rounds.filter((r) => r.courts.every((c) => c.status === "locked"));
  const round = done[done.length - 1];
  const name = nameOf(state);
  if (!round) return <Waiting text="Round results appear here once a round is locked." />;
  return (
    <section className="flex h-full flex-col">
      <h2 className="h-display mb-[2vmin] text-[4.4vmin]">Round {round.round} results</h2>
      <div className="grid min-h-0 flex-1 auto-rows-fr gap-[1.4vmin] landscape:grid-cols-2">
        {round.courts.map((c) => {
          const w = c.team1Games! > c.team2Games! ? 1 : c.team2Games! > c.team1Games! ? 2 : c.advancing;
          return (
            <div key={c.id} className="card flex flex-col justify-center gap-[1vmin] px-[2.4vmin]">
              <p className="text-[1.6vmin] font-bold uppercase tracking-label text-ice">Court {c.court}</p>
              {[1, 2].map((t) => (
                <div key={t} className="flex items-center justify-between gap-3">
                  <p className={cn("truncate text-[2.8vmin] font-bold", w !== t && "text-muted")}>
                    {(t === 1 ? c.team1 : c.team2).map(name).join(" + ")}
                    <span className="ml-3 text-[1.5vmin] font-bold uppercase tracking-label">{w === t ? (c.court === 1 ? "Stay on court 1" : "Up") : c.court === state.event.courts ? "Stay" : "Down"}</span>
                  </p>
                  <span className={cn("font-extrabold tabular-nums text-[4vmin]", w === t ? "text-gradient-padel" : "text-muted")}>{t === 1 ? c.team1Games : c.team2Games}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const MEDAL_STYLE: Record<string, string> = {
  gold: "from-[#E6C878] to-gold text-space",
  silver: "from-white to-[#C9D3E0] text-space",
  bronze: "from-[#D49A68] to-[#9A6A3E] text-space",
};

export function PodiumView({ state }: { state: LiveState }) {
  const p = state.podium;
  if (!p.ready) return <Waiting text={p.reason ?? "Final results are being confirmed."} />;
  const order = [p.places[1], p.places[0], p.places[2]].filter(Boolean);
  const heights: Record<string, string> = { gold: "h-[44%]", silver: "h-[32%]", bronze: "h-[24%]" };
  return (
    <section className="flex h-full flex-col items-center">
      <p className="text-[1.8vmin] font-medium uppercase tracking-brand text-ice">Play beyond</p>
      <h2 className="h-display mt-[1vmin] text-[5.4vmin] text-white">The podium</h2>
      <p className="mt-[0.6vmin] text-[1.8vmin] font-semibold uppercase tracking-label text-muted">{new Date(state.event.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <div className="mt-[3vmin] flex min-h-0 w-full max-w-[150vmin] flex-1 items-end justify-center gap-[2.4vmin]">
        {order.map((pl) => (
          <div key={pl.playerId} className="flex h-full w-1/3 flex-col items-center justify-end">
            <MoonMark size={120} phase="full" glow={pl.medal === "gold"} className="!mb-[1.6vmin] !h-[11vmin] !w-[11vmin]" />
            <p className="max-w-full truncate text-center text-[3.4vmin] font-extrabold">{pl.name}</p>
            <p className="mb-[1.4vmin] text-[2.2vmin] font-bold tabular-nums text-ice">{pl.total} games</p>
            <div className={cn("flex w-full flex-col items-center justify-start rounded-t-[1.6vmin] bg-gradient-to-b pt-[2vmin]", MEDAL_STYLE[pl.medal], heights[pl.medal])}>
              <span className="text-[2vmin] font-extrabold uppercase tracking-label">{pl.medal}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <MoonMark size={160} phase="crescent" className="!h-[16vmin] !w-[16vmin] opacity-80" />
      <p className="mt-[3vmin] max-w-[80vmin] text-[3vmin] font-bold text-muted">{text}</p>
    </div>
  );
}
