"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveState } from "@/lib/ladder/live";
import { MoonMark, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { fmtClock, useCountdown, useLive } from "./use-live";
import { ConnectionDot } from "./tv";

type Court = LiveState["rounds"][number]["courts"][number];
type View =
  | { kind: "home" }
  | { kind: "confirmCheckin"; playerId: string }
  | { kind: "checkedIn"; playerId: string }
  | { kind: "whereAmI"; playerId: string }
  | { kind: "court"; matchId: string }
  | { kind: "score"; matchId: string; playerId: string }
  | { kind: "respond"; matchId: string; playerId: string };

const IDLE_MS = 25000;

export function KioskScreen({ initial, token, topic }: { initial: LiveState; token: string; topic: string | null }) {
  const { state, conn, refresh, now } = useLive(initial, `/api/live/${token}`, topic);
  const left = useCountdown(state, now);
  const [view, setView] = useState<View>({ kind: "home" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back to the start screen after a short idle, so the next player starts clean.
  useEffect(() => {
    const reset = () => {
      clearTimeout(idle.current);
      idle.current = setTimeout(() => { setView({ kind: "home" }); setQuery(""); setError(null); }, IDLE_MS);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    return () => { clearTimeout(idle.current); window.removeEventListener("pointerdown", reset); };
  }, []);

  const names = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);
  const name = (id: string) => names.get(id)?.name ?? "Player";
  // Same first name twice? Show the level tag so players can tell each other apart.
  const firstNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of state.players) counts.set(p.name.toLowerCase(), (counts.get(p.name.toLowerCase()) ?? 0) + 1);
    return counts;
  }, [state.players]);

  const e = state.event;
  const current = state.rounds.find((r) => r.round === e.currentRound);
  const upcoming = e.upcomingRound ? state.rounds.find((r) => r.round === e.upcomingRound) : null;
  const findMatch = (id: string) => state.rounds.flatMap((r) => r.courts).find((c) => c.id === id);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/kiosk/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "That did not go through. Try again."); await refresh(true); return false; }
      await refresh(true);
      return true;
    } catch {
      setError("No connection. Check the Wi-Fi and try again. Nothing was saved twice.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const checkinOpen = ["checkin_open", "ready"].includes(e.state);
  const scoring = e.state === "score_collection";
  const checked = state.players.filter((p) => p.checkedIn).length;

  return (
    <div className="flex h-[100dvh] select-none flex-col overflow-hidden bg-space bg-night-fade text-silver">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3 sm:px-8">
        <button className="flex items-center gap-3" onClick={() => { setView({ kind: "home" }); setError(null); }} aria-label="Start screen">
          <MoonMark size={44} />
          <span className="text-left">
            <Wordmark className="block text-xl leading-none" />
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-label text-muted">{e.title}</span>
          </span>
        </button>
        <div className="flex items-center gap-5">
          {e.state === "round_live" && <span className="rounded-xl border border-electric/40 bg-electric/10 px-3 py-1 text-2xl font-extrabold tabular-nums">{fmtClock(left)}</span>}
          <span className="hidden text-right sm:block">
            <span className="block text-[11px] font-bold uppercase tracking-label text-ice">{e.currentRound ? `Round ${e.currentRound} / ${e.rounds}` : `${e.courts} courts · ${e.rounds} rounds`}</span>
            <span className="block text-xs text-muted">{checked}/{e.cap} checked in</span>
          </span>
          <ConnectionDot conn={conn} className="text-[11px]" />
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-5 mt-4 rounded-2xl border border-loss/40 bg-loss/10 px-5 py-4 text-lg font-semibold text-[#f2a08c] sm:mx-8">{error}</div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {view.kind === "home" && (
          <>
            {scoring ? (
              <ScoreHome round={current} name={name} onPick={(id) => setView({ kind: "court", matchId: id })} />
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="label">{checkinOpen ? "Welcome" : e.state === "draft" ? "Not open yet" : "Find your court"}</p>
                    <h1 className="h-display mt-2 text-4xl sm:text-5xl">{checkinOpen ? "Tap your name to check in" : e.state === "round_live" || e.state === "round_locked" ? "Tap your name to see your court" : e.state === "completed" ? "Thanks for playing" : "Check-in opens soon"}</h1>
                  </div>
                  {state.players.length > 12 && (
                    <input className="input max-w-xs text-lg" placeholder="Search your name" value={query} onChange={(ev) => setQuery(ev.target.value)} aria-label="Search your name" />
                  )}
                </div>
                {e.state !== "draft" && e.state !== "completed" && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {state.players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).map((p) => (
                      <button key={p.id} disabled={busy}
                        onClick={() => setView(checkinOpen && !p.checkedIn ? { kind: "confirmCheckin", playerId: p.id } : { kind: "whereAmI", playerId: p.id })}
                        className={cn("flex min-h-[84px] items-center justify-between gap-3 rounded-2xl border px-5 text-left transition active:scale-[0.98]", p.checkedIn ? "border-electric/50 bg-electric/10" : "border-line bg-night/80 hover:border-ice/40")}>
                        <span className="min-w-0">
                          <span className="block truncate text-xl font-bold">{p.name}</span>
                          {(firstNames.get(p.name.toLowerCase()) ?? 0) > 1 && p.tier && <span className="text-xs font-bold uppercase tracking-label text-muted">Level {p.tier}</span>}
                        </span>
                        <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider", p.checkedIn ? "bg-electric/20 text-ice" : "border border-line text-muted")}>{p.checkedIn ? "Checked in" : checkinOpen ? "Check in" : "Not in"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view.kind === "confirmCheckin" && (
          <ConfirmCheckin player={names.get(view.playerId)!} requirePin={e.requirePin} busy={busy}
            onCancel={() => setView({ kind: "home" })}
            onConfirm={async (pin) => { if (await post({ action: "checkin", playerId: view.playerId, pin })) setView({ kind: "checkedIn", playerId: view.playerId }); }} />
        )}

        {view.kind === "checkedIn" && (
          <Centered>
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-electric/20 text-5xl text-ice" aria-hidden>✓</div>
            <h1 className="h-display text-5xl">Checked in</h1>
            <p className="mt-3 text-2xl font-bold">{name(view.playerId)}</p>
            <p className="mt-2 text-muted">{new Date(names.get(view.playerId)?.checkedInAt ?? Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })} · {checked}/{e.cap} players here</p>
            <p className="mt-6 text-lg text-ice">Watch the TV for your court and partner.</p>
            <button className="btn-primary mt-8 px-10 py-4 text-base" onClick={() => setView({ kind: "home" })}>Done</button>
          </Centered>
        )}

        {view.kind === "whereAmI" && (
          <WhereAmI playerId={view.playerId} name={name} round={e.state === "round_locked" || e.state === "ready" ? upcoming ?? current : current} label={e.state === "round_locked" || e.state === "ready" ? "Next round" : "This round"} onBack={() => setView({ kind: "home" })} />
        )}

        {view.kind === "court" && (() => {
          const m = findMatch(view.matchId);
          if (!m) return null;
          return (
            <Centered>
              <p className="label">Court {m.court}</p>
              <h1 className="h-display mt-2 text-4xl">Who are you?</h1>
              <p className="mt-2 text-muted">{m.status === "pending" ? "The other team confirms the score." : "One player enters the score for both teams."}</p>
              <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3">
                {[...m.team1, ...m.team2].map((pid) => (
                  <button key={pid} className="min-h-[84px] rounded-2xl border border-line bg-night/80 px-4 text-xl font-bold hover:border-ice/40 active:scale-[0.98]"
                    onClick={() => setView(m.status === "pending" ? { kind: "respond", matchId: m.id, playerId: pid } : { kind: "score", matchId: m.id, playerId: pid })}>
                    {name(pid)}
                    <span className="block text-[11px] font-bold uppercase tracking-label text-muted">Team {m.team1.includes(pid) ? 1 : 2}</span>
                  </button>
                ))}
              </div>
              <button className="btn-ghost mt-8" onClick={() => setView({ kind: "home" })}>Back</button>
            </Centered>
          );
        })()}

        {view.kind === "score" && (() => {
          const m = findMatch(view.matchId);
          if (!m) return null;
          if (!["awaiting", "disputed"].includes(m.status)) {
            return <Centered><h1 className="h-display text-4xl">{m.status === "pending" ? "Waiting for the other team" : "Score saved"}</h1><p className="mt-3 text-muted">Court {m.court}: {m.team1Games} - {m.team2Games}</p><button className="btn-primary mt-8" onClick={() => setView({ kind: "home" })}>Done</button></Centered>;
          }
          return <ScoreEntry court={m} name={name} goldenPoint={e.tieRule === "golden_point"} requirePin={e.requirePin} busy={busy}
            onCancel={() => setView({ kind: "home" })}
            onSubmit={async (t1, t2, gp, pin) => { await post({ action: "submit", matchId: m.id, playerId: view.playerId, team1Games: t1, team2Games: t2, goldenPoint: gp, revision: m.revision, pin }); }} />;
        })()}

        {view.kind === "respond" && (() => {
          const m = findMatch(view.matchId);
          if (!m) return null;
          const myTeam = m.team1.includes(view.playerId) ? 1 : 2;
          if (m.status !== "pending") {
            return <Centered><h1 className="h-display text-4xl">{m.status === "confirmed" || m.status === "locked" ? "Score confirmed" : m.status === "disputed" ? "Sent to the organiser" : "Nothing to confirm"}</h1><button className="btn-primary mt-8" onClick={() => setView({ kind: "home" })}>Done</button></Centered>;
          }
          if (myTeam === m.submittedByTeam) {
            return <Centered><h1 className="h-display text-4xl">Waiting for the other team</h1><p className="mt-3 text-xl">{m.team1Games} - {m.team2Games}</p><p className="mt-2 text-muted">Your team entered this score. Someone from the other team confirms it.</p><button className="btn-primary mt-8" onClick={() => setView({ kind: "home" })}>Done</button></Centered>;
          }
          return <Respond court={m} name={name} requirePin={e.requirePin} busy={busy}
            onCancel={() => setView({ kind: "home" })}
            onAnswer={async (agree, pin) => { await post({ action: agree ? "confirm" : "dispute", matchId: m.id, playerId: view.playerId, revision: m.revision, pin }); }} />;
        })()}
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-6 text-center">{children}</div>;
}

function PinPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mx-auto mt-6 w-72">
      <p className="mb-3 text-sm font-bold uppercase tracking-label text-muted">Your 4-digit code</p>
      <div className="mb-4 flex justify-center gap-3">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-4 w-4 rounded-full", i < value.length ? "bg-electric" : "bg-white/10")} />)}</div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => (
          <button key={k} disabled={!k} className="h-16 rounded-2xl border border-line bg-night/80 text-2xl font-bold disabled:invisible active:scale-95"
            onClick={() => onChange(k === "⌫" ? value.slice(0, -1) : (value + k).slice(0, 4))}>{k}</button>
        ))}
      </div>
    </div>
  );
}

function ConfirmCheckin({ player, requirePin, busy, onConfirm, onCancel }: { player: LiveState["players"][number]; requirePin: boolean; busy: boolean; onConfirm: (pin?: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <Centered>
      <p className="label">Check in</p>
      <h1 className="h-display mt-2 text-5xl">{player.name}</h1>
      {player.tier && <p className="mt-2 text-muted">Level {player.tier}</p>}
      {requirePin && <PinPad value={pin} onChange={setPin} />}
      <div className="mt-8 flex gap-3">
        <button className="btn-ghost px-8 py-4 text-base" onClick={onCancel}>Not me</button>
        <button className="btn-primary px-10 py-4 text-base" disabled={busy || (requirePin && pin.length !== 4)} onClick={() => onConfirm(requirePin ? pin : undefined)}>{busy ? "Saving…" : "Yes, check me in"}</button>
      </div>
    </Centered>
  );
}

function WhereAmI({ playerId, name, round, label, onBack }: { playerId: string; name: (id: string) => string; round: LiveState["rounds"][number] | null | undefined; label: string; onBack: () => void }) {
  const c = round?.courts.find((x) => x.team1.includes(playerId) || x.team2.includes(playerId));
  if (!c) return <Centered><h1 className="h-display text-4xl">Courts are not drawn yet</h1><p className="mt-3 text-muted">Watch the TV. The organiser draws courts once everyone is here.</p><button className="btn-primary mt-8" onClick={onBack}>Done</button></Centered>;
  const mine = c.team1.includes(playerId) ? c.team1 : c.team2;
  const them = c.team1.includes(playerId) ? c.team2 : c.team1;
  const partner = mine.find((x) => x !== playerId)!;
  return (
    <Centered>
      <p className="label">{label} · Round {round!.round}</p>
      <p className="mt-4 text-sm font-bold uppercase tracking-label text-muted">Court</p>
      <p className="text-[120px] font-extrabold leading-none text-gradient-padel">{c.court}</p>
      <p className="mt-6 text-2xl font-bold">{name(playerId)} + {name(partner)}</p>
      <p className="my-2 text-sm font-bold uppercase tracking-label text-muted">versus</p>
      <p className="text-2xl font-bold">{them.map(name).join(" + ")}</p>
      <button className="btn-primary mt-10 px-10 py-4 text-base" onClick={onBack}>Done</button>
    </Centered>
  );
}

function ScoreHome({ round, name, onPick }: { round: LiveState["rounds"][number] | undefined; name: (id: string) => string; onPick: (id: string) => void }) {
  if (!round) return null;
  const label: Record<string, string> = { awaiting: "Enter score", pending: "Confirm score", disputed: "Disputed", confirmed: "Confirmed", locked: "Locked" };
  return (
    <>
      <p className="label">Round {round.round} finished</p>
      <h1 className="h-display mb-6 mt-2 text-4xl sm:text-5xl">Tap your court</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {round.courts.map((c) => {
          const actionable = ["awaiting", "pending", "disputed"].includes(c.status);
          return (
            <button key={c.id} disabled={!actionable} onClick={() => onPick(c.id)}
              className={cn("flex items-stretch overflow-hidden rounded-2xl border text-left transition active:scale-[0.99]", actionable ? "border-electric/40 bg-night/80" : "border-line bg-night/40 opacity-70")}>
              <span className="flex w-24 shrink-0 flex-col items-center justify-center bg-court/40">
                <span className="text-[10px] font-bold uppercase tracking-label text-ice">Court</span>
                <span className="text-5xl font-extrabold">{c.court}</span>
              </span>
              <span className="min-w-0 flex-1 px-5 py-4">
                <span className="block truncate text-lg font-bold">{c.team1.map(name).join(" + ")}</span>
                <span className="block text-xs font-bold uppercase tracking-label text-muted">vs</span>
                <span className="block truncate text-lg font-bold">{c.team2.map(name).join(" + ")}</span>
                <span className={cn("mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider", c.status === "awaiting" ? "bg-electric text-white" : c.status === "pending" ? "bg-gold/20 text-gold" : c.status === "disputed" ? "bg-loss/20 text-[#f2a08c]" : "bg-white/5 text-muted")}>
                  {label[c.status] ?? c.status}{c.team1Games !== null && c.status !== "awaiting" ? ` · ${c.team1Games}-${c.team2Games}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="card flex flex-1 flex-col items-center p-5">
      <p className="mb-3 min-h-[3.5rem] text-center text-lg font-bold">{label}</p>
      <div className="flex items-center gap-4">
        <button className="h-20 w-20 rounded-2xl border border-line bg-space text-4xl font-bold active:scale-95" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Lower ${label}`}>−</button>
        <span className="w-24 text-center text-7xl font-extrabold tabular-nums">{value}</span>
        <button className="h-20 w-20 rounded-2xl bg-electric text-4xl font-bold text-white active:scale-95" onClick={() => onChange(Math.min(99, value + 1))} aria-label={`Raise ${label}`}>+</button>
      </div>
    </div>
  );
}

function ScoreEntry({ court, name, goldenPoint, requirePin, busy, onSubmit, onCancel }: {
  court: Court; name: (id: string) => string; goldenPoint: boolean; requirePin: boolean; busy: boolean;
  onSubmit: (t1: number, t2: number, gp: 1 | 2 | null, pin?: string) => void; onCancel: () => void;
}) {
  const [t1, setT1] = useState(court.team1Games ?? 0);
  const [t2, setT2] = useState(court.team2Games ?? 0);
  const [gp, setGp] = useState<1 | 2 | null>(null);
  const [pin, setPin] = useState("");
  const level = t1 === t2;
  return (
    <div className="mx-auto max-w-4xl">
      <p className="label">Court {court.court} · games won this round</p>
      <h1 className="h-display mb-6 mt-2 text-4xl">Enter the score</h1>
      {court.status === "disputed" && <p className="mb-4 rounded-xl border border-loss/40 bg-loss/10 p-3 text-[#f2a08c]">The last score was disputed. Agree on it together, or ask the organiser.</p>}
      <div className="flex flex-col gap-4 md:flex-row">
        <Stepper label={court.team1.map(name).join(" + ")} value={t1} onChange={setT1} />
        <Stepper label={court.team2.map(name).join(" + ")} value={t2} onChange={setT2} />
      </div>
      {level && (
        <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
          {goldenPoint ? (
            <>
              <p className="font-bold text-gold">Level score. Play one golden point, then tap who won it.</p>
              <div className="mt-3 flex justify-center gap-3">
                {[1, 2].map((t) => (
                  <button key={t} onClick={() => setGp(t as 1 | 2)} className={cn("rounded-full border px-5 py-3 font-bold", gp === t ? "border-electric bg-electric text-white" : "border-line")}>
                    {(t === 1 ? court.team1 : court.team2).map(name).join(" + ")}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="font-bold text-gold">Level score. You can submit it: the organiser decides which pair moves up.</p>
          )}
        </div>
      )}
      {requirePin && <PinPad value={pin} onChange={setPin} />}
      <div className="mt-8 flex justify-center gap-3">
        <button className="btn-ghost px-8 py-4 text-base" onClick={onCancel}>Cancel</button>
        <button className="btn-primary px-10 py-4 text-base" disabled={busy || (level && goldenPoint && !gp) || (requirePin && pin.length !== 4)}
          onClick={() => onSubmit(t1, t2, level ? gp : null, requirePin ? pin : undefined)}>
          {busy ? "Sending…" : `Submit ${t1} - ${t2}`}
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-muted">The other team confirms it before it counts.</p>
    </div>
  );
}

function Respond({ court, name, requirePin, busy, onAnswer, onCancel }: { court: Court; name: (id: string) => string; requirePin: boolean; busy: boolean; onAnswer: (agree: boolean, pin?: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  return (
    <Centered>
      <p className="label">Court {court.court} · confirm the score</p>
      <div className="mt-6 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="text-right text-xl font-bold">{court.team1.map(name).join(" + ")}</p>
        <p className="text-6xl font-extrabold tabular-nums">{court.team1Games} - {court.team2Games}</p>
        <p className="text-left text-xl font-bold">{court.team2.map(name).join(" + ")}</p>
      </div>
      {court.team1Games === court.team2Games && court.advancing && <p className="mt-3 text-gold">Golden point: {(court.advancing === 1 ? court.team1 : court.team2).map(name).join(" + ")}</p>}
      {requirePin && <PinPad value={pin} onChange={setPin} />}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="btn-ghost px-6 py-4 text-base" onClick={onCancel}>Back</button>
        <button className="btn-danger px-6 py-4 text-base" disabled={busy || (requirePin && pin.length !== 4)} onClick={() => onAnswer(false, requirePin ? pin : undefined)}>That is wrong</button>
        <button className="btn-primary px-10 py-4 text-base" disabled={busy || (requirePin && pin.length !== 4)} onClick={() => onAnswer(true, requirePin ? pin : undefined)}>{busy ? "Saving…" : "Confirm"}</button>
      </div>
    </Centered>
  );
}
