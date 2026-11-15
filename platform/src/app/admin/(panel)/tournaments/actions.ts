"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminMutation, formObject, type ActionState } from "@/lib/admin/action";
import { uniqueSlugFor } from "@/lib/admin/players";
import { generateNextRound, matchInputSchema, upsertMatch } from "@/lib/admin/matches";
import { audit } from "@/lib/audit";

const blankToNull = (v: unknown) => (v === "" || v == null ? null : v);
const tournamentSchema = z.object({
  name: z.string().trim().min(3, "Name is required").max(140),
  tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  start_time: z.preprocess(blankToNull, z.string().regex(/^\d{2}:\d{2}/).nullable()),
  duration_minutes: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  club_id: z.preprocess(blankToNull, z.string().uuid().nullable()),
  division_id: z.preprocess(blankToNull, z.coerce.number().int().nullable()),
  format: z.enum(["ladder", "americano", "mexicano", "round_robin", "groups_knockout", "knockout"]),
  pair_type: z.enum(["fixed", "non_fixed"]),
  courts_count: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  rounds_count: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  max_players: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable()),
  entry_fee: z.preprocess(blankToNull, z.coerce.number().min(0).nullable()),
  currency: z.string().trim().length(3).default("AED"),
  status: z.enum(["draft", "upcoming", "registration_open", "full", "in_progress", "completed", "cancelled"]),
  description: z.preprocess(blankToNull, z.string().max(4000).nullable()),
});

export async function saveTournament(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = (fd.get("id") as string) || null;
  let created: string | null = null;
  const res = await adminMutation(async ({ admin, tx }) => {
    const v = tournamentSchema.parse(formObject(fd));
    if (id) {
      const [before] = await tx`select * from tournaments where id = ${id} for update`;
      if (!before) throw new Error("Tournament not found");
      const slug = before.name === v.name ? before.slug : await uniqueSlugFor(tx, "tournaments", v.name, id);
      const published = v.status === "cancelled" ? false : before.results_published;
      const [after] = await tx`update tournaments set ${tx({ ...v, slug, results_published: published, updated_at: new Date() })} where id = ${id} returning *`;
      await audit(tx, admin, "tournament.update", "tournament", id, before, after);
      return { message: "Tournament saved", data: { recalc: before.results_published } };
    }
    const slug = await uniqueSlugFor(tx, "tournaments", v.name);
    const [row] = await tx`insert into tournaments ${tx({ ...v, slug })} returning *`;
    await audit(tx, admin, "tournament.create", "tournament", row.id, undefined, row);
    created = row.id;
    return { message: "Tournament created", data: { recalc: false } };
  }, { recalc: (r) => Boolean((r as { data?: { recalc?: boolean } })?.data?.recalc), trigger: "tournament-save" });
  if (res?.ok && created) redirect(`/admin/tournaments/${created}`);
  return res;
}

export async function deleteTournament(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const res = await adminMutation(async ({ admin, tx }) => {
    const [before] = await tx`delete from tournaments where id = ${id} returning *`;
    await audit(tx, admin, "tournament.delete", "tournament", id, before);
    return "Tournament deleted";
  }, { recalc: true, trigger: "tournament-delete" });
  if (res?.ok) redirect("/admin/tournaments");
  return res;
}

export async function setPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const publish = fd.get("publish") === "1";
  return adminMutation(async ({ admin, tx }) => {
    const [t] = await tx`select * from tournaments where id = ${id} for update`;
    if (!t) throw new Error("Tournament not found");
    if (publish) {
      const [{ open }] = await tx`select count(*)::int as open from matches where tournament_id = ${id} and status = 'scheduled'`;
      if (open > 0) throw new Error(`${open} match${open > 1 ? "es are" : " is"} still scheduled without a result. Enter or void them first.`);
      const [{ done }] = await tx`select count(*)::int as done from matches where tournament_id = ${id} and status = 'completed'`;
      if (done === 0) throw new Error("There are no completed matches to publish.");
    }
    await tx`update tournaments set results_published = ${publish}, status = ${publish ? "completed" : t.status === "completed" ? "in_progress" : t.status}, updated_at = now() where id = ${id}`;
    await audit(tx, admin, publish ? "results.publish" : "results.unpublish", "tournament", id, { results_published: t.results_published }, { results_published: publish });
    return publish ? "Results published. Rankings, profiles and the homepage are updated." : "Results unpublished and removed from rankings.";
  }, { recalc: true, trigger: publish ? "publish" : "unpublish" });
}

export async function addRegistrations(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const tournamentId = String(fd.get("tournament_id"));
  const playerIds = fd.getAll("player_ids").map(String).filter(Boolean);
  const pairIds = fd.getAll("pair_ids").map(String).filter(Boolean);
  const status = fd.get("status") === "waitlist" ? "waitlist" : "registered";
  return adminMutation(async ({ admin, tx }) => {
    let n = 0;
    for (const pid of playerIds) {
      await tx`insert into tournament_registrations (tournament_id, player_id, status) values (${tournamentId}, ${pid}, ${status}) on conflict (tournament_id, player_id) do update set status = excluded.status`;
      n++;
    }
    for (const pairId of pairIds) {
      const members = await tx`select player_id from pair_members where pair_id = ${pairId}`;
      for (const m of members) {
        await tx`insert into tournament_registrations (tournament_id, player_id, pair_id, status) values (${tournamentId}, ${m.player_id}, ${pairId}, ${status})
                 on conflict (tournament_id, player_id) do update set pair_id = excluded.pair_id, status = excluded.status`;
        n++;
      }
    }
    if (!n) throw new Error("Choose at least one player or pair.");
    const [t] = await tx`select max_players, status, (select count(*)::int from tournament_registrations where tournament_id = ${tournamentId} and status = 'registered') as reg from tournaments where id = ${tournamentId}`;
    if (t.max_players && t.reg >= t.max_players && t.status === "registration_open") await tx`update tournaments set status = 'full' where id = ${tournamentId}`;
    await audit(tx, admin, "registration.add", "tournament", tournamentId, undefined, { playerIds, pairIds, status });
    return `${n} registration${n > 1 ? "s" : ""} saved`;
  }, { recalc: false });
}

export async function updateRegistration(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const action = String(fd.get("action"));
  return adminMutation(async ({ admin, tx }) => {
    const [before] = await tx`select r.*, t.results_published from tournament_registrations r join tournaments t on t.id = r.tournament_id where r.id = ${id}`;
    if (!before) throw new Error("Registration not found");
    if (action === "remove") {
      const [{ n }] = await tx`select count(*)::int as n from match_players mp join matches m on m.id = mp.match_id where m.tournament_id = ${before.tournament_id} and mp.player_id = ${before.player_id}`;
      if (n) throw new Error("This player already has matches in this tournament. Remove those matches first, or mark the player as withdrawn.");
      await tx`delete from tournament_registrations where id = ${id}`;
    } else if (["registered", "waitlist", "withdrawn"].includes(action)) {
      await tx`update tournament_registrations set status = ${action} where id = ${id}`;
    } else if (action === "position") {
      const raw = String(fd.get("position") ?? "").trim();
      const pos = raw === "" ? null : Number(raw);
      if (pos != null && (!Number.isInteger(pos) || pos < 1)) throw new Error("Position must be a whole number from 1.");
      // Pair override applies to both members.
      if (before.pair_id) await tx`update tournament_registrations set final_position_override = ${pos} where tournament_id = ${before.tournament_id} and pair_id = ${before.pair_id}`;
      else await tx`update tournament_registrations set final_position_override = ${pos} where id = ${id}`;
    }
    await audit(tx, admin, `registration.${action}`, "tournament", before.tournament_id, before, { action, position: fd.get("position") });
    return { message: "Registration updated", data: { recalc: before.results_published } };
  }, { recalc: (r) => Boolean((r as { data?: { recalc?: boolean } })?.data?.recalc), trigger: "registration" });
}

export async function generateRound(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("tournament_id"));
  return adminMutation(async ({ admin, tx }) => {
    const r = await generateNextRound(tx, id);
    await tx`update tournaments set status = 'in_progress' where id = ${id} and status in ('upcoming', 'registration_open', 'full')`;
    await audit(tx, admin, "round.generate", "tournament", id, undefined, r);
    return `Round ${r.round} created with ${r.matches} match${r.matches === 1 ? "" : "es"}`;
  });
}

function parseMatchForm(fd: FormData) {
  const o = formObject(fd);
  return matchInputSchema.parse({
    ...o,
    team_a: [o.a1, o.a2].filter(Boolean),
    team_b: [o.b1, o.b2].filter(Boolean),
    pair_a: o.pair_a || null,
    pair_b: o.pair_b || null,
    duration_minutes: o.duration_minutes ? o.duration_minutes : null,
    match_date: o.match_date || null,
    verified: o.verified === "on" || o.verified === "true",
    status: o.status || (o.set_scores ? "completed" : "scheduled"),
  });
}

export async function saveMatch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const input = parseMatchForm(fd);
    const r = await upsertMatch(tx, input);
    await audit(tx, admin, input.id ? "match.update" : "match.create", "match", r.id, r.before, r.after);
    return { message: input.id ? "Match updated" : "Match added", data: { recalc: r.published } };
  }, { recalc: (r) => Boolean((r as { data?: { recalc?: boolean } })?.data?.recalc), trigger: "match-save" });
}

/** Quick score entry from the tournament page: only scores, winner and status. */
export async function quickScore(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  return adminMutation(async ({ admin, tx }) => {
    const [m] = await tx`select m.*, (select array_agg(player_id) filter (where team = 'A') from match_players where match_id = m.id) as a,
                                       (select array_agg(player_id) filter (where team = 'B') from match_players where match_id = m.id) as b
                          from matches m where m.id = ${id}`;
    if (!m) throw new Error("Match not found");
    const scores = String(fd.get("set_scores") ?? "").trim();
    const input = matchInputSchema.parse({
      id, tournament_id: m.tournament_id, round_number: m.round_number, court_number: m.court_number, team_a: m.a ?? [], team_b: m.b ?? [],
      pair_a: m.team_a_pair_id, pair_b: m.team_b_pair_id, set_scores: scores, winner: "auto", duration_minutes: m.duration_minutes,
      match_date: m.match_date ? new Date(m.match_date).toISOString() : null, status: scores ? "completed" : "scheduled", verified: true,
    });
    const r = await upsertMatch(tx, input);
    await audit(tx, admin, "match.score", "match", id, r.before, r.after);
    return { message: "Score saved", data: { recalc: r.published } };
  }, { recalc: (r) => Boolean((r as { data?: { recalc?: boolean } })?.data?.recalc), trigger: "match-score" });
}

export async function deleteMatch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id"));
  const back = fd.get("back") as string | null;
  const res = await adminMutation(async ({ admin, tx }) => {
    const [before] = await tx`select m.*, t.results_published from matches m join tournaments t on t.id = m.tournament_id where m.id = ${id}`;
    if (!before) throw new Error("Match not found");
    await tx`delete from matches where id = ${id}`;
    await audit(tx, admin, "match.delete", "match", id, before);
    return { message: "Match deleted", data: { recalc: before.results_published } };
  }, { recalc: (r) => Boolean((r as { data?: { recalc?: boolean } })?.data?.recalc), trigger: "match-delete" });
  if (res?.ok && back) redirect(back);
  return res;
}
