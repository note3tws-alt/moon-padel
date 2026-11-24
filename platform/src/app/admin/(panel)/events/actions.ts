"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { refreshPublicSite } from "@/lib/cache";
import { formObject, toError, type ActionState } from "@/lib/admin/action";
import { LadderError } from "@/lib/ladder/engine";
import * as svc from "@/lib/ladder/service";

const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);
const eventSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(140),
  club_id: z.preprocess(blankToNull, z.string().uuid().nullable()),
  venue_name: z.preprocess(blankToNull, z.string().trim().max(140).nullable()),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  start_time: z.preprocess(blankToNull, z.string().regex(/^\d{2}:\d{2}/).nullable()),
  duration_minutes: z.coerce.number().int().min(15).max(600),
  court_count: z.coerce.number().int().min(1).max(12),
  round_count: z.coerce.number().int().min(1).max(20),
  round_minutes: z.coerce.number().int().min(1).max(120),
  transition_minutes: z.coerce.number().int().min(0).max(30),
  tie_rule: z.enum(["admin", "golden_point"]),
  tv_cycle_seconds: z.coerce.number().int().min(5).max(120).default(12),
  notes: z.preprocess(blankToNull, z.string().max(4000).nullable()),
  public_note: z.preprocess(blankToNull, z.string().max(400).nullable()),
});

function parseEvent(fd: FormData): svc.EventInput {
  const v = eventSchema.parse(formObject(fd));
  return {
    ...v,
    player_cap: v.court_count * 4,
    eligible_tier_ids: fd.getAll("eligible_tier_ids").map(Number).filter(Number.isFinite),
    require_pin: fd.get("require_pin") === "on",
    is_public: fd.get("is_public") === "on",
    count_in_league: fd.get("count_in_league") === "on",
  };
}

async function run(fn: (actor: svc.Actor) => Promise<string | void>): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const msg = await fn({ kind: "admin", admin });
    await refreshPublicSite();
    return { ok: true, message: msg || "Done" };
  } catch (e) {
    if (e instanceof LadderError) return { ok: false, error: e.message };
    return toError(e);
  }
}

export async function saveEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get("id") as string) || null;
  let created: string | null = null;
  const res = await run(async (actor) => {
    const input = parseEvent(fd);
    if (id) { await svc.updateEvent(id, input, actor); return "Event saved"; }
    created = await svc.createEvent(input, actor);
    return "Event created";
  });
  if (res?.ok && created) redirect(`/admin/events/${created}`);
  return res;
}

export async function duplicateEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let created: string | null = null;
  const res = await run(async (actor) => {
    const date = String(fd.get("event_date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new LadderError("Pick a date for the copy.", "invalid");
    created = await svc.duplicateEvent(String(fd.get("id")), date, actor);
    return "Event copied with the same roster";
  });
  if (res?.ok && created) redirect(`/admin/events/${created}`);
  return res;
}

/** One entry point for the control centre buttons. `op` picks the action. */
export async function eventOp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("event_id"));
  const op = String(fd.get("op"));
  const str = (k: string) => String(fd.get(k) ?? "");
  const num = (k: string) => Number(fd.get(k));
  return run(async (actor) => {
    switch (op) {
      case "open_checkin": await svc.setState(id, "checkin_open", actor); return "Check-in is open";
      case "back_to_draft": await svc.setState(id, "draft", actor); return "Back to draft";
      case "cancel": await svc.setState(id, "cancelled", actor, str("reason")); return "Event cancelled";
      case "add_players": {
        const ids = fd.getAll("player_ids").map(String).filter(Boolean);
        if (!ids.length) throw new LadderError("Pick at least one player.", "invalid");
        await svc.setParticipants(id, ids, [], actor);
        return `${ids.length} player${ids.length > 1 ? "s" : ""} added`;
      }
      case "remove_player": await svc.setParticipants(id, [], [str("player_id")], actor); return "Player removed";
      case "replace_player": await svc.replaceParticipant(id, str("player_id"), str("replacement_id"), actor); return "Player replaced";
      case "checkin": await svc.checkIn(id, str("player_id"), actor); return "Checked in";
      case "uncheck": await svc.checkIn(id, str("player_id"), actor, { undo: true }); return "Check-in undone";
      case "draw": await svc.drawCourts(id, actor); return "Courts drawn. Check them, then start round 1";
      case "regenerate": await svc.regeneratePairings(id, actor); return "Pairings regenerated";
      case "swap": await svc.swapPlayers(id, str("a"), str("b"), actor); return "Players swapped";
      case "start": await svc.startRound(id, actor); return "Round started";
      case "pause": await svc.pauseRound(id, actor); return "Clock paused";
      case "resume": await svc.pauseRound(id, actor, true); return "Clock running";
      case "end": await svc.endRound(id, actor); return "Whistle! Score entry is open on the tablet";
      case "set_score": {
        const adv = str("advancing");
        const r = await svc.adminSetScore(id, { matchId: str("match_id"), team1Games: num("team1_games"), team2Games: num("team2_games"), advancing: adv === "1" ? 1 : adv === "2" ? 2 : null, reason: str("reason") || undefined }, actor);
        return r.laterStarted ? "Score corrected. Later rounds were already drawn from the old result and stay as played" : "Score saved";
      }
      case "lock": {
        const r = await svc.tryLockRound(id, actor);
        if (!r.locked) throw new LadderError(`Cannot lock yet: ${r.blockers.map((b) => `court ${b.court} ${b.reason === "tie" ? "is tied" : b.reason === "unconfirmed" ? "is not confirmed" : "has no score"}`).join(", ")}.`, "blocked");
        return "Round locked";
      }
      case "tie_order": {
        const order: Record<string, number> = {};
        for (const [k, v] of fd.entries()) if (k.startsWith("order_") && String(v).trim()) order[k.slice(6)] = Number(v);
        await svc.setManualOrder(id, order, actor);
        return "Tie order saved";
      }
      case "finalize": {
        const r = await svc.finalizeEvent(id, actor);
        return `Event finalised. ${r.unlocked.length ? `${r.unlocked.length} milestone medal${r.unlocked.length > 1 ? "s" : ""} unlocked.` : "No new milestone medals."}`;
      }
      case "reopen": await svc.reopenEvent(id, str("reason"), actor); return "Event reopened";
      case "tv_mode": await svc.setTvMode(id, str("mode"), fd.get("cycle") ? num("cycle") : null, actor); return "TV updated";
      case "rotate_links": await svc.rotateTokens(id, actor); return "New tablet and TV links created. Open them again on the devices";
      default: throw new LadderError("Unknown action.", "invalid");
    }
  });
}

export async function medalIssued(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const issued = fd.get("issued") === "1";
    await svc.setMedalIssued(Number(fd.get("id")), issued, actor);
    return issued ? "Marked as handed over" : "Marked as not handed over";
  });
}
