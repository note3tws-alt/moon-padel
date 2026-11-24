import "server-only";
import { sql, type Tx } from "../db";
import type { AdminUser } from "../auth";
import { slugify, uniqueSlug } from "../utils";
import {
  computeStandings, LadderError, milestonesToUnlock, nextRound, podium, roundBlockers, seedFirstRound,
  type CourtAssignment, type CourtResult, type LadderPlayer, type Pair, type RoundInput, type TeamIndex,
} from "./engine";
import { notifyEvent } from "./realtime";

/**
 * All writes for Ladder Americano events. Every function runs in one
 * transaction and locks the event row first, so two devices acting at the
 * same moment are applied one after the other and a score can only commit once.
 */

export type Actor = { kind: "admin"; admin: AdminUser } | { kind: "kiosk" } | { kind: "system" };

export const actorLabel = (a: Actor) => (a.kind === "admin" ? `admin:${a.admin.email}` : a.kind);
const isOwner = (a: Actor) => a.kind === "admin" && a.admin.role === "admin";

export const EVENT_STATES = ["draft", "checkin_open", "ready", "round_live", "score_collection", "round_locked", "completed", "cancelled"] as const;
export type EventState = (typeof EVENT_STATES)[number];

export const STATE_LABELS: Record<EventState, string> = {
  draft: "Draft",
  checkin_open: "Check-in open",
  ready: "Ready",
  round_live: "Round live",
  score_collection: "Score collection",
  round_locked: "Round locked",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface EventRow {
  id: string; slug: string; title: string; club_id: string | null; venue_name: string | null; club_name: string | null;
  event_date: string; start_time: string | null; duration_minutes: number; court_count: number; player_cap: number;
  round_count: number; round_minutes: number; transition_minutes: number; tie_rule: "admin" | "golden_point";
  eligible_tier_ids: number[]; require_pin: boolean; state: EventState; current_round: number;
  round_started_at: Date | null; round_ends_at: Date | null; paused_remaining_seconds: number | null;
  manual_order: Record<string, number>; kiosk_token: string; tv_token: string; tv_mode: string; tv_cycle_seconds: number;
  is_public: boolean; count_in_league: boolean; tournament_id: string | null; notes: string | null; public_note: string | null;
  version: number; finalized_at: Date | null; is_demo: boolean;
}

export interface ParticipantRow {
  player_id: string; full_name: string; player_code: string; status: "confirmed" | "reserve" | "removed";
  checked_in_at: Date | null; checked_in_via: string | null; tier_code: string | null; tier_order: number | null; tier_id: number | null;
}

export interface MatchRow {
  id: string; round_no: number; court_no: number; team1: string[]; team2: string[];
  status: "scheduled" | "live" | "awaiting" | "pending" | "disputed" | "confirmed" | "locked";
  team1_games: number | null; team2_games: number | null; advancing: 1 | 2 | null;
  submitted_by_team: 1 | 2 | null; submitted_at: Date | null; confirmed_by: string | null; confirmed_at: Date | null; revision: number;
}

export interface Bundle { event: EventRow; participants: ParticipantRow[]; matches: MatchRow[] }

type Db = Tx | ReturnType<typeof sql>;

export async function loadBundle(db: Db, eventId: string, lock = false): Promise<Bundle> {
  const [event] = lock
    ? await db`select e.*, c.name as club_name from ladder_events e left join clubs c on c.id = e.club_id where e.id = ${eventId} for update of e`
    : await db`select e.*, c.name as club_name from ladder_events e left join clubs c on c.id = e.club_id where e.id = ${eventId}`;
  if (!event) throw new LadderError("Event not found.", "not_found");
  const participants = await db`
    select lp.player_id, p.full_name, p.player_code, lp.status, lp.checked_in_at, lp.checked_in_via,
           st.code as tier_code, st.numeric_order as tier_order, st.id as tier_id
    from ladder_participants lp join players p on p.id = lp.player_id
    left join skill_tiers st on st.id = coalesce(lp.tier_id_at_event, p.skill_tier_id)
    where lp.event_id = ${eventId} and lp.status <> 'removed'
    order by st.numeric_order nulls last, p.full_name`;
  const matches = await db`select id, round_no, court_no, team1, team2, status, team1_games, team2_games, advancing,
      submitted_by_team, submitted_at, confirmed_by, confirmed_at, revision
    from ladder_matches where event_id = ${eventId} order by round_no, court_no`;
  return { event: event as unknown as EventRow, participants: participants as unknown as ParticipantRow[], matches: matches as unknown as MatchRow[] };
}

/** Runs a mutation with the event locked, then tells every screen to refresh. */
async function mutate<T>(eventId: string, fn: (tx: Tx, b: Bundle) => Promise<T>): Promise<T> {
  let tokens: { tv: string; kiosk: string; id: string } | null = null;
  const out = await sql().begin(async (tx) => {
    const b = await loadBundle(tx, eventId, true);
    tokens = { tv: b.event.tv_token, kiosk: b.event.kiosk_token, id: b.event.id };
    return fn(tx, b);
  });
  if (tokens) await notifyEvent(tokens);
  return out as T;
}

async function log(tx: Tx, eventId: string, matchId: string | null, action: string, actor: string, oldV?: unknown, newV?: unknown, reason?: string | null) {
  await tx`insert into ladder_score_log (event_id, match_id, action, old_value, new_value, actor, reason)
           values (${eventId}, ${matchId}, ${action}, ${oldV === undefined ? null : tx.json(oldV as never)}, ${newV === undefined ? null : tx.json(newV as never)}, ${actor}, ${reason ?? null})`;
}

function need(cond: unknown, message: string, code = "state"): asserts cond {
  if (!cond) throw new LadderError(message, code);
}

const confirmed = (b: Bundle) => b.participants.filter((p) => p.status === "confirmed");
const roundMatches = (b: Bundle, round: number) => b.matches.filter((m) => m.round_no === round);

export function toCourtResult(m: MatchRow): CourtResult {
  return {
    court: m.court_no, team1: m.team1 as Pair, team2: m.team2 as Pair,
    team1Games: m.team1_games, team2Games: m.team2_games, advancing: m.advancing,
    confirmed: m.status === "confirmed" || m.status === "locked",
  };
}

export function roundsOf(b: Bundle): RoundInput[] {
  const byRound = new Map<number, CourtResult[]>();
  for (const m of b.matches) {
    if (!byRound.has(m.round_no)) byRound.set(m.round_no, []);
    byRound.get(m.round_no)!.push(toCourtResult(m));
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, courts]) => ({ round, courts }));
}

export function standingsOf(b: Bundle, confirmedOnly = true) {
  const players = confirmed(b).map((p) => ({ id: p.player_id, name: p.full_name }));
  const played = roundsOf(b).filter((r) => r.round <= b.event.current_round);
  return computeStandings(players, played, { roundCount: b.event.round_count, confirmedOnly, manualOrder: b.event.manual_order ?? {} });
}

export function allRoundsLocked(b: Bundle) {
  if (b.event.current_round !== b.event.round_count) return false;
  const last = roundMatches(b, b.event.round_count);
  return last.length > 0 && last.every((m) => m.status === "locked");
}

export function podiumOf(b: Bundle) {
  return podium(standingsOf(b), allRoundsLocked(b));
}

// ---------------------------------------------------------------------------
// Event setup.
// ---------------------------------------------------------------------------

export interface EventInput {
  title: string; club_id: string | null; venue_name: string | null; event_date: string; start_time: string | null;
  duration_minutes: number; court_count: number; player_cap: number; round_count: number; round_minutes: number;
  transition_minutes: number; tie_rule: "admin" | "golden_point"; eligible_tier_ids: number[]; require_pin: boolean;
  is_public: boolean; count_in_league: boolean; notes: string | null; public_note: string | null; tv_cycle_seconds: number;
}

export async function createEvent(input: EventInput, actor: Actor): Promise<string> {
  need(actor.kind === "admin", "Only admins can create events.", "forbidden");
  if (input.player_cap !== input.court_count * 4) throw new LadderError(`Ladder Americano needs exactly 4 players per court: ${input.court_count} courts means ${input.court_count * 4} players.`, "capacity");
  return sql().begin(async (tx) => {
    const taken = new Set((await tx`select slug from ladder_events`).map((r) => r.slug as string));
    const slug = uniqueSlug(slugify(`${input.title}-${input.event_date}`), taken);
    const [row] = await tx`insert into ladder_events ${tx({ ...input, eligible_tier_ids: input.eligible_tier_ids, slug, created_by: actor.admin.id } as never)} returning id`;
    await log(tx, row.id, null, "event_created", actorLabel(actor), undefined, input);
    return row.id as string;
  });
}

export async function updateEvent(eventId: string, input: EventInput, actor: Actor) {
  need(actor.kind === "admin", "Only admins can edit events.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    const started = b.matches.length > 0;
    if (started && (input.court_count !== b.event.court_count || input.player_cap !== b.event.player_cap)) {
      throw new LadderError("Courts and capacity cannot change after courts are drawn.", "state");
    }
    if (started && input.round_count < b.event.current_round) throw new LadderError("Rounds cannot go below the rounds already played.", "state");
    if (input.player_cap !== input.court_count * 4) throw new LadderError(`Ladder Americano needs exactly 4 players per court: ${input.court_count} courts means ${input.court_count * 4} players.`, "capacity");
    await tx`update ladder_events set ${tx(input as never)} where id = ${eventId}`;
    await log(tx, eventId, null, "event_updated", actorLabel(actor), undefined, input);
  });
}

export async function duplicateEvent(eventId: string, newDate: string, actor: Actor): Promise<string> {
  need(actor.kind === "admin", "Only admins can create events.", "forbidden");
  const b = await loadBundle(sql(), eventId);
  const e = b.event;
  const id = await createEvent({
    title: e.title, club_id: e.club_id, venue_name: e.venue_name, event_date: newDate, start_time: e.start_time,
    duration_minutes: e.duration_minutes, court_count: e.court_count, player_cap: e.player_cap, round_count: e.round_count,
    round_minutes: e.round_minutes, transition_minutes: e.transition_minutes, tie_rule: e.tie_rule, eligible_tier_ids: e.eligible_tier_ids,
    require_pin: e.require_pin, is_public: e.is_public, count_in_league: e.count_in_league, notes: e.notes, public_note: e.public_note,
    tv_cycle_seconds: e.tv_cycle_seconds,
  }, actor);
  await sql()`insert into ladder_participants (event_id, player_id, tier_id_at_event)
              select ${id}, player_id, tier_id_at_event from ladder_participants where event_id = ${eventId} and status = 'confirmed'`;
  return id;
}

export async function setParticipants(eventId: string, add: string[], remove: string[], actor: Actor) {
  need(actor.kind === "admin", "Only staff can change the roster.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(!b.matches.length, "The roster is frozen once courts are drawn. A late join needs a separate admin decision.");
    need(!["completed", "cancelled"].includes(b.event.state), "This event is closed.");
    for (const pid of remove) {
      await tx`delete from ladder_participants where event_id = ${eventId} and player_id = ${pid}`;
      await log(tx, eventId, null, "participant_removed", actorLabel(actor), { player_id: pid });
    }
    const current = confirmed(b).filter((p) => !remove.includes(p.player_id)).length;
    const fresh = add.filter((pid) => !b.participants.some((p) => p.player_id === pid));
    if (current + fresh.length > b.event.player_cap) throw new LadderError(`This event holds ${b.event.player_cap} players. Remove someone first.`, "capacity");
    for (const pid of fresh) {
      await tx`insert into ladder_participants (event_id, player_id, tier_id_at_event)
               select ${eventId}, id, skill_tier_id from players where id = ${pid}
               on conflict (event_id, player_id) do update set status = 'confirmed'`;
      await log(tx, eventId, null, "participant_added", actorLabel(actor), undefined, { player_id: pid });
    }
  });
}

/** Swap a no-show for another player before courts are drawn. */
export async function replaceParticipant(eventId: string, outId: string, inId: string, actor: Actor) {
  return setParticipants(eventId, [inId], [outId], actor);
}

export async function setState(eventId: string, to: "checkin_open" | "draft" | "cancelled", actor: Actor, reason?: string) {
  need(actor.kind === "admin", "Only staff can do that.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    const from = b.event.state;
    if (to === "checkin_open") need(["draft"].includes(from), "Check-in can only open from a draft.");
    if (to === "draft") need(from === "checkin_open" && !b.matches.length, "Only an event with check-in open and no courts drawn can go back to draft.");
    if (to === "cancelled") need(!["completed", "cancelled"].includes(from), "This event is already closed.");
    await tx`update ladder_events set state = ${to} where id = ${eventId}`;
    await log(tx, eventId, null, `state_${to}`, actorLabel(actor), { state: from }, { state: to }, reason);
  });
}

// ---------------------------------------------------------------------------
// Check-in.
// ---------------------------------------------------------------------------

export async function checkIn(eventId: string, playerId: string, actor: Actor, opts: { pin?: string; undo?: boolean } = {}) {
  return mutate(eventId, async (tx, b) => {
    const p = b.participants.find((x) => x.player_id === playerId && x.status === "confirmed");
    need(p, "That player is not on tonight's list.", "not_found");
    if (actor.kind === "kiosk") {
      need(["checkin_open", "ready"].includes(b.event.state) || (b.event.state === "draft" && false), "Check-in is not open yet.");
      need(!opts.undo, "Ask the organiser to undo a check-in.", "forbidden");
      if (b.event.require_pin) {
        const [priv] = await tx`select checkin_pin from player_private where player_id = ${playerId}`;
        if (priv?.checkin_pin && priv.checkin_pin !== opts.pin) throw new LadderError("That code is not right. Ask the organiser if you forgot it.", "pin");
      }
    } else {
      need(!["completed", "cancelled"].includes(b.event.state), "This event is closed.");
    }
    if (opts.undo) {
      need(!b.matches.length, "Courts are drawn. Replace the player from the roster instead.");
      await tx`update ladder_participants set checked_in_at = null, checked_in_via = null where event_id = ${eventId} and player_id = ${playerId}`;
      await log(tx, eventId, null, "check_in_undone", actorLabel(actor), { player_id: playerId });
      return { checkedInAt: null };
    }
    if (p.checked_in_at) return { checkedInAt: p.checked_in_at, already: true };
    const [row] = await tx`update ladder_participants set checked_in_at = now(), checked_in_via = ${actorLabel(actor)}
                           where event_id = ${eventId} and player_id = ${playerId} and checked_in_at is null returning checked_in_at`;
    await log(tx, eventId, null, "check_in", actorLabel(actor), undefined, { player_id: playerId });
    return { checkedInAt: row?.checked_in_at ?? new Date() };
  });
}

// ---------------------------------------------------------------------------
// Courts and rounds.
// ---------------------------------------------------------------------------

async function insertRound(tx: Tx, eventId: string, round: number, courts: CourtAssignment[], status: MatchRow["status"] = "scheduled") {
  for (const c of courts) {
    const [m] = await tx`insert into ladder_matches (event_id, round_no, court_no, team1, team2, status)
                         values (${eventId}, ${round}, ${c.court}, ${c.team1 as unknown as string[]}, ${c.team2 as unknown as string[]}, ${status}) returning id`;
    for (const [team, ids] of [[1, c.team1], [2, c.team2]] as const) {
      for (const pid of ids) {
        await tx`insert into ladder_match_players (match_id, event_id, round_no, player_id, team) values (${m.id}, ${eventId}, ${round}, ${pid}, ${team})`;
      }
    }
  }
}

async function deleteRound(tx: Tx, eventId: string, round: number) {
  await tx`delete from ladder_matches where event_id = ${eventId} and round_no = ${round}`;
}

/** Level-aware round 1 draw. Requires every seat filled and checked in. */
export async function drawCourts(eventId: string, actor: Actor, seed?: number) {
  need(actor.kind === "admin", "Only staff can draw courts.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(["checkin_open", "ready"].includes(b.event.state), "Open check-in before drawing courts.");
    need(!b.matches.some((m) => m.round_no === 1 && m.status !== "scheduled"), "Round 1 has started. Its courts are frozen.");
    const roster = confirmed(b);
    const missing = roster.filter((p) => !p.checked_in_at);
    const need16 = b.event.court_count * 4;
    if (roster.length !== need16 || missing.length) {
      const parts = [`${roster.filter((p) => p.checked_in_at).length}/${need16} checked in.`];
      if (roster.length < need16) parts.push(`${need16 - roster.length} seat(s) empty on the roster.`);
      if (missing.length) parts.push(`Waiting for ${missing.map((p) => p.full_name).join(", ")}. Check them in, replace them, or change capacity.`);
      throw new LadderError(parts.join(" "), "roster_size");
    }
    const players: LadderPlayer[] = roster.map((p) => ({ id: p.player_id, name: p.full_name, tierOrder: p.tier_order }));
    const rand = seed === undefined ? Math.random : (await import("./engine")).seededRandom(seed);
    const courts = seedFirstRound(players, b.event.court_count, rand);
    await deleteRound(tx, eventId, 1);
    await insertRound(tx, eventId, 1, courts);
    await tx`update ladder_events set state = 'ready', current_round = 1 where id = ${eventId}`;
    await log(tx, eventId, null, "courts_drawn", actorLabel(actor), undefined, courts);
    return courts;
  });
}

/** Swap two players in the next (not yet started) round. Used for manual court placement. */
export async function swapPlayers(eventId: string, a: string, c: string, actor: Actor) {
  need(actor.kind === "admin", "Only staff can move players.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    const target = upcomingRound(b);
    need(target, "There is no upcoming round to adjust.");
    const ms = roundMatches(b, target);
    need(ms.every((m) => m.status === "scheduled"), "That round has started.");
    const swap = (ids: string[]) => ids.map((x) => (x === a ? c : x === c ? a : x));
    for (const m of ms) {
      if ([...m.team1, ...m.team2].some((x) => x === a || x === c)) {
        await tx`update ladder_matches set team1 = ${swap(m.team1)}, team2 = ${swap(m.team2)}, revision = revision + 1 where id = ${m.id}`;
      }
    }
    // Rebuild the per-player rows so the one-court-per-round constraint never trips mid-swap.
    await rebuildMatchPlayers(tx, eventId, target);
    await log(tx, eventId, null, "players_swapped", actorLabel(actor), undefined, { round: target, a, b: c });
  });
}

async function rebuildMatchPlayers(tx: Tx, eventId: string, round: number) {
  await tx`delete from ladder_match_players where event_id = ${eventId} and round_no = ${round}`;
  const ms = await tx`select id, team1, team2 from ladder_matches where event_id = ${eventId} and round_no = ${round}`;
  for (const m of ms) {
    for (const [team, ids] of [[1, m.team1], [2, m.team2]] as const) {
      for (const pid of ids as string[]) await tx`insert into ladder_match_players (match_id, event_id, round_no, player_id, team) values (${m.id}, ${eventId}, ${round}, ${pid}, ${team})`;
    }
  }
}

/** The round that is drawn but not started yet, if any. */
export function upcomingRound(b: Bundle): number | null {
  const scheduled = b.matches.filter((m) => m.status === "scheduled").map((m) => m.round_no);
  return scheduled.length ? Math.min(...scheduled) : null;
}

/** Rebuild the upcoming round from the last locked round (after a correction) or redraw round 1. */
export async function regeneratePairings(eventId: string, actor: Actor) {
  need(actor.kind === "admin", "Only staff can regenerate pairings.", "forbidden");
  const pre = await loadBundle(sql(), eventId);
  const target = upcomingRound(pre);
  need(target, "There is no upcoming round to regenerate.");
  if (target === 1) return drawCourts(eventId, actor);
  return mutate(eventId, async (tx, b) => {
    const rounds = roundsOf(b);
    const prev = rounds.find((r) => r.round === target - 1)!;
    const courts = nextRound(prev, rounds.filter((r) => r.round < target - 1));
    await deleteRound(tx, eventId, target);
    await insertRound(tx, eventId, target, courts);
    await log(tx, eventId, null, "pairings_regenerated", actorLabel(actor), undefined, { round: target, courts });
    return courts;
  });
}

export async function startRound(eventId: string, actor: Actor) {
  need(actor.kind === "admin", "Only staff can start a round.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(["ready", "round_locked"].includes(b.event.state), b.event.state === "round_live" ? "A round is already live." : "Draw courts and lock the previous round first.");
    const target = upcomingRound(b);
    need(target, b.event.current_round >= b.event.round_count ? "All rounds are played. Finalise the event." : "The next round is not drawn yet.");
    const minutes = b.event.round_minutes;
    await tx`update ladder_matches set status = 'live', revision = revision + 1 where event_id = ${eventId} and round_no = ${target}`;
    await tx`update ladder_events set state = 'round_live', current_round = ${target}, round_started_at = now(),
             round_ends_at = now() + make_interval(mins => ${minutes}), paused_remaining_seconds = null where id = ${eventId}`;
    await log(tx, eventId, null, "round_started", actorLabel(actor), undefined, { round: target });
  });
}

export async function pauseRound(eventId: string, actor: Actor, resume = false) {
  need(actor.kind === "admin", "Only staff can pause.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(b.event.state === "round_live", "No round is live.");
    if (resume) {
      need(b.event.paused_remaining_seconds !== null, "The clock is not paused.");
      await tx`update ladder_events set round_ends_at = now() + make_interval(secs => ${b.event.paused_remaining_seconds}), paused_remaining_seconds = null where id = ${eventId}`;
    } else {
      need(b.event.paused_remaining_seconds === null, "The clock is already paused.");
      const left = Math.max(0, Math.round(((b.event.round_ends_at?.getTime() ?? Date.now()) - Date.now()) / 1000));
      await tx`update ladder_events set paused_remaining_seconds = ${left} where id = ${eventId}`;
    }
    await log(tx, eventId, null, resume ? "clock_resumed" : "clock_paused", actorLabel(actor));
  });
}

/** The whistle: play stops and the tablet switches to score entry. */
export async function endRound(eventId: string, actor: Actor) {
  need(actor.kind === "admin", "Only staff can end a round.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(b.event.state === "round_live", "No round is live.");
    await tx`update ladder_matches set status = 'awaiting', revision = revision + 1 where event_id = ${eventId} and round_no = ${b.event.current_round} and status = 'live'`;
    await tx`update ladder_events set state = 'score_collection', round_ends_at = least(round_ends_at, now()), paused_remaining_seconds = null where id = ${eventId}`;
    await log(tx, eventId, null, "round_ended", actorLabel(actor), undefined, { round: b.event.current_round });
  });
}

// ---------------------------------------------------------------------------
// Scores.
// ---------------------------------------------------------------------------

function teamOf(m: MatchRow, playerId: string): TeamIndex | null {
  if (m.team1.includes(playerId)) return 1;
  if (m.team2.includes(playerId)) return 2;
  return null;
}

async function checkPin(tx: Tx, b: Bundle, playerId: string, pin?: string) {
  if (!b.event.require_pin) return;
  const [priv] = await tx`select checkin_pin from player_private where player_id = ${playerId}`;
  if (priv?.checkin_pin && priv.checkin_pin !== pin) throw new LadderError("That code is not right.", "pin");
}

export interface ScoreInput {
  matchId: string;
  playerId: string;
  team1Games: number;
  team2Games: number;
  /** Golden point winner when the games are level and the event uses golden point. */
  goldenPoint?: TeamIndex | null;
  revision: number;
  pin?: string;
}

/** A player enters the score for their own court. It stays pending until the other team confirms. */
export async function submitScore(eventId: string, input: ScoreInput, actor: Actor) {
  return mutate(eventId, async (tx, b) => {
    const m = b.matches.find((x) => x.id === input.matchId);
    need(m, "Match not found.", "not_found");
    need(b.event.state === "score_collection" && m.round_no === b.event.current_round, "Score entry opens when the organiser blows the whistle.");
    const team = teamOf(m, input.playerId);
    need(team, "Only a player on this court can enter its score.", "forbidden");
    for (const g of [input.team1Games, input.team2Games]) need(Number.isInteger(g) && g >= 0 && g <= 99, "Scores must be whole numbers from 0.", "invalid");
    let advancing: TeamIndex | null = null;
    if (input.team1Games === input.team2Games) {
      if (b.event.tie_rule === "golden_point") {
        need(input.goldenPoint === 1 || input.goldenPoint === 2, "Level score: play golden point and pick who won it.", "tie");
        advancing = input.goldenPoint;
      }
    }
    // Same score sent twice (double tap, retry after Wi-Fi drop): already done, nothing changes.
    if (m.status === "pending" && m.team1_games === input.team1Games && m.team2_games === input.team2Games && m.submitted_by_team === team) {
      return { status: m.status, duplicate: true };
    }
    need(["awaiting", "disputed"].includes(m.status), m.status === "pending" ? "A score is already waiting for the other team to confirm." : "This score is already confirmed. Ask the organiser to correct it.", "conflict");
    need(m.revision === input.revision, "Someone else just updated this court. Check the score shown and try again.", "conflict");
    await checkPin(tx, b, input.playerId, input.pin);
    const res = await tx`update ladder_matches set status = 'pending', team1_games = ${input.team1Games}, team2_games = ${input.team2Games},
        advancing = ${advancing}, submitted_by_team = ${team}, submitted_by_player = ${input.playerId}, submitted_at = now(),
        confirmed_by = null, confirmed_at = null, revision = revision + 1, updated_at = now()
      where id = ${m.id} and revision = ${input.revision} returning revision`;
    need(res.length === 1, "Someone else just updated this court. Try again.", "conflict");
    await log(tx, eventId, m.id, "submit", `${actorLabel(actor)}:player:${input.playerId}`,
      { status: m.status, team1_games: m.team1_games, team2_games: m.team2_games }, { team1_games: input.team1Games, team2_games: input.team2Games, advancing, team });
    return { status: "pending" as const };
  });
}

/** The other team confirms (or disputes) the pending score. */
export async function respondToScore(eventId: string, input: { matchId: string; playerId: string; agree: boolean; revision: number; pin?: string }, actor: Actor) {
  const result = await mutate(eventId, async (tx, b) => {
    const m = b.matches.find((x) => x.id === input.matchId);
    need(m, "Match not found.", "not_found");
    if (input.agree && m.status === "confirmed") return { status: m.status, duplicate: true };
    need(m.status === "pending", "There is no score waiting on this court.", "conflict");
    need(b.event.state === "score_collection" && m.round_no === b.event.current_round, "This round is closed.");
    const team = teamOf(m, input.playerId);
    need(team, "Only a player on this court can confirm its score.", "forbidden");
    need(team !== m.submitted_by_team, "The other team needs to confirm the score.", "forbidden");
    need(m.revision === input.revision, "The score just changed. Check it again.", "conflict");
    await checkPin(tx, b, input.playerId, input.pin);
    const status = input.agree ? "confirmed" : "disputed";
    await tx`update ladder_matches set status = ${status}, confirmed_by = ${input.agree ? `player:${input.playerId}` : null},
        confirmed_at = ${input.agree ? new Date() : null}, revision = revision + 1, updated_at = now() where id = ${m.id}`;
    await log(tx, eventId, m.id, input.agree ? "confirm" : "dispute", `${actorLabel(actor)}:player:${input.playerId}`, { status: m.status }, { status });
    return { status };
  });
  if (result.status === "confirmed") await tryLockRound(eventId);
  return result;
}

/** Organiser sets or corrects a score. Locked rounds need an owner and a reason. */
export async function adminSetScore(eventId: string, input: { matchId: string; team1Games: number; team2Games: number; advancing?: TeamIndex | null; reason?: string }, actor: Actor) {
  need(actor.kind === "admin", "Only staff can override a score.", "forbidden");
  const r = await mutate(eventId, async (tx, b) => {
    const m = b.matches.find((x) => x.id === input.matchId);
    need(m, "Match not found.", "not_found");
    need(b.event.state !== "completed", "This event is finalised. Reopen it to correct a score.");
    need(!["scheduled", "live"].includes(m.status), "This round has not finished yet.");
    for (const g of [input.team1Games, input.team2Games]) need(Number.isInteger(g) && g >= 0 && g <= 99, "Scores must be whole numbers from 0.", "invalid");
    const level = input.team1Games === input.team2Games;
    const advancing = level ? (input.advancing ?? null) : null;
    if (m.status === "locked") {
      need(isOwner(actor), "Only an owner/admin can correct a locked round.", "forbidden");
      need(input.reason && input.reason.trim().length >= 3, "Give a reason for correcting a locked score.", "invalid");
      need(!level || advancing, "A level score needs the pair that moved up.", "tie");
    }
    const keepLocked = m.status === "locked";
    await tx`update ladder_matches set team1_games = ${input.team1Games}, team2_games = ${input.team2Games}, advancing = ${advancing},
        status = ${keepLocked ? "locked" : "confirmed"}, confirmed_by = ${actorLabel(actor)}, confirmed_at = now(),
        revision = revision + 1, updated_at = now() where id = ${m.id}`;
    await log(tx, eventId, m.id, keepLocked ? "correction" : "override", actorLabel(actor),
      { status: m.status, team1_games: m.team1_games, team2_games: m.team2_games, advancing: m.advancing },
      { team1_games: input.team1Games, team2_games: input.team2Games, advancing }, input.reason ?? null);
    const laterStarted = b.matches.some((x) => x.round_no > m.round_no && x.status !== "scheduled");
    return { keepLocked, laterStarted };
  });
  if (!r.keepLocked) await tryLockRound(eventId);
  return r;
}

/** Locks the current round when every court has one confirmed, decided score, then draws the next round. */
export async function tryLockRound(eventId: string, actor: Actor = { kind: "system" }) {
  return mutate(eventId, async (tx, b) => {
    if (b.event.state !== "score_collection") return { locked: false, blockers: [] };
    const ms = roundMatches(b, b.event.current_round);
    const blockers = roundBlockers(ms.map(toCourtResult));
    if (blockers.length) return { locked: false, blockers };
    await tx`update ladder_matches set status = 'locked', locked_at = now(), revision = revision + 1 where event_id = ${eventId} and round_no = ${b.event.current_round}`;
    await tx`update ladder_events set state = 'round_locked' where id = ${eventId}`;
    await log(tx, eventId, null, "round_locked", actorLabel(actor), undefined, { round: b.event.current_round });
    if (b.event.current_round < b.event.round_count) {
      const rounds = roundsOf(b).map((r) => (r.round === b.event.current_round ? { ...r, courts: r.courts.map((c) => ({ ...c, confirmed: true })) } : r));
      const cur = rounds.find((r) => r.round === b.event.current_round)!;
      const courts = nextRound(cur, rounds.filter((r) => r.round < b.event.current_round));
      await deleteRound(tx, eventId, b.event.current_round + 1);
      await insertRound(tx, eventId, b.event.current_round + 1, courts);
      await log(tx, eventId, null, "next_round_drawn", "system", undefined, { round: b.event.current_round + 1, courts });
    }
    return { locked: true, blockers: [] };
  });
}

// ---------------------------------------------------------------------------
// Finish, reopen and lifetime medals.
// ---------------------------------------------------------------------------

export async function setManualOrder(eventId: string, order: Record<string, number>, actor: Actor) {
  need(actor.kind === "admin", "Only staff can decide a tie.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(b.event.state !== "completed", "Reopen the event first.");
    await tx`update ladder_events set manual_order = ${tx.json(order)} where id = ${eventId}`;
    await log(tx, eventId, null, "tie_order", actorLabel(actor), b.event.manual_order, order);
  });
}

export async function finalizeEvent(eventId: string, actor: Actor) {
  need(actor.kind === "admin", "Only staff can finalise.", "forbidden");
  return mutate(eventId, async (tx, b) => {
    need(b.event.state === "round_locked" && allRoundsLocked(b), "Finish and lock every round first.");
    const standings = standingsOf(b);
    const pod = podium(standings, true);
    need(pod.ready, pod.reason ?? "The podium is not decided yet.", "tie");
    const medalOf = new Map(pod.places.map((p) => [p.playerId, p.medal]));
    await tx`delete from ladder_results where event_id = ${eventId}`;
    for (const r of standings) {
      await tx`insert into ladder_results (event_id, player_id, rank, total, wins, games_for, games_against, round_scores, medal)
               values (${eventId}, ${r.playerId}, ${r.rank}, ${r.total}, ${r.wins}, ${r.gamesFor}, ${r.gamesAgainst}, ${r.rounds.map((x) => x ?? 0)}, ${medalOf.get(r.playerId) ?? null})`;
      await tx`insert into player_points_ledger (player_id, event_id, kind, points, reason, created_by)
               values (${r.playerId}, ${eventId}, 'event', ${r.total}, ${`Event total: ${b.event.title}`}, ${actorLabel(actor)})
               on conflict (player_id, event_id) where kind = 'event' do update set points = excluded.points, created_at = now()`;
    }
    const unlocked = await syncMedals(tx, standings.map((r) => r.playerId), actorLabel(actor), eventId);
    if (b.event.count_in_league) await publishToLeague(tx, b, standings);
    await tx`update ladder_events set state = 'completed', finalized_at = now() where id = ${eventId}`;
    await log(tx, eventId, null, "finalized", actorLabel(actor), undefined, { podium: pod.places, unlocked });
    return { podium: pod.places, unlocked };
  });
}

export async function reopenEvent(eventId: string, reason: string, actor: Actor) {
  need(isOwner(actor), "Only an owner/admin can reopen a finalised event.", "forbidden");
  need(reason.trim().length >= 3, "Give a reason for reopening.", "invalid");
  return mutate(eventId, async (tx, b) => {
    need(b.event.state === "completed", "Only a completed event can be reopened.");
    const ids = (await tx`select player_id from ladder_results where event_id = ${eventId}`).map((r) => r.player_id as string);
    await tx`delete from ladder_results where event_id = ${eventId}`;
    await tx`delete from player_points_ledger where event_id = ${eventId} and kind = 'event'`;
    await syncMedals(tx, ids, actorLabel(actor), null, `Event reopened: ${reason}`);
    if (b.event.tournament_id) {
      await tx`delete from tournaments where id = ${b.event.tournament_id}`;
      await tx`update ladder_events set tournament_id = null where id = ${eventId}`;
    }
    await tx`update ladder_events set state = 'round_locked', finalized_at = null where id = ${eventId}`;
    await log(tx, eventId, null, "reopened", actorLabel(actor), undefined, undefined, reason);
  });
}

/**
 * Brings each player's unlocked milestones in line with their lifetime total:
 * newly reached levels unlock (all of them, once). A correction that drops a
 * player below a level revokes it only if the physical medal was not handed
 * over yet; handed-over medals stay and are logged.
 */
export async function syncMedals(tx: Tx, playerIds: string[], actor: string, eventId: string | null, reason?: string) {
  if (!playerIds.length) return [];
  const tiers = await tx`select id, threshold, active, name from medal_tiers`;
  const totals = await tx`select p.id, coalesce(sum(l.points), 0)::int as total from players p
                          left join player_points_ledger l on l.player_id = p.id where p.id in ${tx(playerIds)} group by p.id`;
  const heldRows = await tx`select id, player_id, medal_tier_id, issued_at from player_medals where player_id in ${tx(playerIds)}`;
  const unlocked: { playerId: string; medal: string }[] = [];
  for (const t of totals) {
    const held = heldRows.filter((h) => h.player_id === t.id);
    const toUnlock = milestonesToUnlock(tiers.map((x) => ({ id: x.id, threshold: x.threshold, active: x.active })), t.total, new Set(held.map((h) => h.medal_tier_id)));
    for (const tierId of toUnlock) {
      const ins = await tx`insert into player_medals (player_id, medal_tier_id, event_id, points_at_unlock) values (${t.id}, ${tierId}, ${eventId}, ${t.total})
                           on conflict (player_id, medal_tier_id) do nothing returning id`;
      if (ins.length) {
        await tx`insert into medal_log (player_id, medal_tier_id, action, actor, reason) values (${t.id}, ${tierId}, 'unlocked', ${actor}, ${reason ?? null})`;
        unlocked.push({ playerId: t.id, medal: tiers.find((x) => x.id === tierId)?.name });
      }
    }
    for (const h of held) {
      const tier = tiers.find((x) => x.id === h.medal_tier_id);
      if (tier && t.total < tier.threshold) {
        if (h.issued_at) {
          await tx`insert into medal_log (player_id, medal_tier_id, action, actor, reason) values (${t.id}, ${tier.id}, 'below_threshold_kept', ${actor}, ${reason ?? "Total fell below threshold after a correction; medal already handed over"})`;
        } else {
          await tx`delete from player_medals where id = ${h.id}`;
          await tx`insert into medal_log (player_id, medal_tier_id, action, actor, reason) values (${t.id}, ${tier.id}, 'revoked', ${actor}, ${reason ?? "Total fell below threshold after a correction"})`;
        }
      }
    }
  }
  return unlocked;
}

export async function setMedalIssued(playerMedalId: number, issued: boolean, actor: Actor) {
  need(actor.kind === "admin", "Only staff can record medals.", "forbidden");
  return sql().begin(async (tx) => {
    const [m] = await tx`update player_medals set issued_at = ${issued ? new Date() : null}, issued_by = ${issued ? actorLabel(actor) : null}
                         where id = ${playerMedalId} and (issued_at is null) = ${issued} returning player_id, medal_tier_id`;
    need(m, issued ? "That medal is already marked as handed over." : "That medal is not marked as handed over.", "conflict");
    await tx`insert into medal_log (player_id, medal_tier_id, action, actor) values (${m.player_id}, ${m.medal_tier_id}, ${issued ? "issued" : "unissued"}, ${actorLabel(actor)})`;
  });
}

/** Writes the night into the league (tournament + matches) so rankings and profiles include it. */
async function publishToLeague(tx: Tx, b: Bundle, standings: ReturnType<typeof standingsOf>) {
  const e = b.event;
  if (e.tournament_id) await tx`delete from tournaments where id = ${e.tournament_id}`;
  const taken = new Set((await tx`select slug from tournaments`).map((r) => r.slug as string));
  const slug = uniqueSlug(slugify(`${e.title}-${e.event_date}`), taken);
  const [t] = await tx`insert into tournaments (slug, name, tournament_date, start_time, duration_minutes, club_id, format, pair_type,
      courts_count, rounds_count, max_players, status, results_published, description, is_demo)
    values (${slug}, ${e.title}, ${e.event_date}, ${e.start_time}, ${e.duration_minutes}, ${e.club_id}, 'ladder', 'non_fixed',
      ${e.court_count}, ${e.round_count}, ${e.player_cap}, 'completed', true, ${"MoonPadel Ladder Americano night. Results synced from the live event."}, ${e.is_demo})
    returning id`;
  for (const m of b.matches) {
    const winner = m.team1_games! > m.team2_games! ? "A" : m.team2_games! > m.team1_games! ? "B" : m.advancing === 1 ? "A" : m.advancing === 2 ? "B" : "D";
    const [row] = await tx`insert into matches (tournament_id, round_number, court_number, set_scores, team_a_games, team_b_games, winner, status, verified)
      values (${t.id}, ${m.round_no}, ${m.court_no}, ${tx.json([[m.team1_games, m.team2_games]] as never)}, ${m.team1_games}, ${m.team2_games}, ${winner}, 'completed', true) returning id`;
    for (const p of m.team1) await tx`insert into match_players (match_id, player_id, team) values (${row.id}, ${p}, 'A')`;
    for (const p of m.team2) await tx`insert into match_players (match_id, player_id, team) values (${row.id}, ${p}, 'B')`;
  }
  for (const r of standings) {
    await tx`insert into tournament_registrations (tournament_id, player_id, final_position_override) values (${t.id}, ${r.playerId}, ${r.rank})
             on conflict (tournament_id, player_id) do nothing`;
  }
  await tx`update ladder_events set tournament_id = ${t.id} where id = ${e.id}`;
  const { recalculateAll } = await import("../recalc");
  await recalculateAll("ladder_event_finalized", tx);
}

export async function setTvMode(eventId: string, mode: string, cycleSeconds: number | null, actor: Actor) {
  need(actor.kind === "admin", "Only staff can change the TV.", "forbidden");
  need(["auto", "checkin", "courts", "leaderboard", "results", "podium"].includes(mode), "Unknown TV mode.", "invalid");
  return mutate(eventId, async (tx) => {
    await tx`update ladder_events set tv_mode = ${mode}, tv_cycle_seconds = coalesce(${cycleSeconds}, tv_cycle_seconds) where id = ${eventId}`;
  });
}

export async function rotateTokens(eventId: string, actor: Actor) {
  need(isOwner(actor), "Only an owner/admin can reset screen links.", "forbidden");
  return mutate(eventId, async (tx) => {
    await tx`update ladder_events set kiosk_token = replace(gen_random_uuid()::text, '-', ''), tv_token = replace(gen_random_uuid()::text, '-', '') where id = ${eventId}`;
    await log(tx, eventId, null, "screen_links_reset", actorLabel(actor));
  });
}
