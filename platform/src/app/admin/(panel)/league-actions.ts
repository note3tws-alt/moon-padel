"use server";
import { z } from "zod";
import { adminMutation, formObject, type ActionState } from "@/lib/admin/action";
import { uniqueSlugFor } from "@/lib/admin/players";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { parseScoringConfig, TIE_BREAKERS, FINISH_ORDER } from "@/lib/scoring/config";
import { seedDemoData, removeDemoData } from "@/lib/demo";
import { refreshPublicSite } from "@/lib/cache";
import { assertAdmin } from "@/lib/auth";
import { toError } from "@/lib/admin/action";

const blank = (v: unknown) => (v === "" || v == null ? null : v);

// ---------------------------------------------------------------- recalculate
export async function recalculateNow(): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    await audit(tx, admin, "rankings.recalculate", "rankings", null);
    return "Rankings, ratings and statistics recalculated";
  }, { recalc: true, trigger: "manual" });
}

// ------------------------------------------------------------------ divisions
const divisionSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().trim().min(1).max(40),
  code: z.string().trim().min(1).max(6),
  sort_order: z.coerce.number().int().min(1),
  description: z.preprocess(blank, z.string().max(400).nullable()),
  color: z.preprocess(blank, z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2E8BEA").nullable()),
  min_rating: z.preprocess(blank, z.coerce.number().nullable()),
  max_rating: z.preprocess(blank, z.coerce.number().nullable()),
  promote_top_n: z.coerce.number().int().min(0).default(0),
  relegate_bottom_n: z.coerce.number().int().min(0).default(0),
  promotion_min_tournaments: z.coerce.number().int().min(0).default(0),
  use_rating_thresholds: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveDivision(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const v = divisionSchema.parse(formObject(fd));
    if (v.min_rating != null && v.max_rating != null && v.min_rating > v.max_rating) throw new Error("Minimum rating is above the maximum.");
    const [before] = await tx`select * from divisions where id = ${v.id}`;
    const { id, ...fields } = v;
    const [after] = await tx`update divisions set ${tx(fields)} where id = ${id} returning *`;
    await audit(tx, admin, "division.update", "division", String(id), before, after);
    return `${v.code} saved`;
  }, { recalc: false });
}

export async function addDivision(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const code = String(fd.get("code") ?? "").trim();
    const name = String(fd.get("name") ?? "").trim();
    if (!code || !name) throw new Error("Code and name are required.");
    const [{ next }] = await tx`select coalesce(max(sort_order), 0) + 1 as next from divisions`;
    const [row] = await tx`insert into divisions (code, name, sort_order) values (${code}, ${name}, ${next}) returning *`;
    await audit(tx, admin, "division.create", "division", String(row.id), undefined, row);
    return `${code} added`;
  });
}

/** Applies selected promotion / relegation suggestions. Values look like "playerId:toDivisionId:kind". */
export async function applyDivisionMoves(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const moves = fd.getAll("move").map(String).filter(Boolean);
  const note = String(fd.get("note") ?? "").trim();
  return adminMutation(async ({ admin, tx }) => {
    if (!moves.length) throw new Error("Tick at least one move to apply.");
    for (const m of moves) {
      const [playerId, toDiv, kind] = m.split(":");
      const [p] = await tx`select id, division_id from players where id = ${playerId} for update`;
      if (!p) continue;
      await tx`update players set division_id = ${Number(toDiv)}, updated_at = now() where id = ${playerId}`;
      await tx`insert into player_division_history (player_id, from_division_id, to_division_id, kind, reason, changed_by)
               values (${playerId}, ${p.division_id}, ${Number(toDiv)}, ${kind === "relegation" ? "relegation" : "promotion"}, ${note || "Monthly division review"}, ${admin.id})`;
    }
    await audit(tx, admin, "division.moves", "division", null, undefined, { moves, note });
    return `${moves.length} division change${moves.length > 1 ? "s" : ""} applied`;
  }, { recalc: true, trigger: "division-moves" });
}

// ---------------------------------------------------------------------- clubs
const clubSchema = z.object({
  id: z.preprocess(blank, z.string().uuid().nullable()),
  name: z.string().trim().min(2).max(120),
  area: z.preprocess(blank, z.string().max(120).nullable()),
  city: z.preprocess(blank, z.string().max(80).nullable()),
  address: z.preprocess(blank, z.string().max(300).nullable()),
  map_url: z.preprocess(blank, z.string().url("Map link must be a full URL").nullable()),
  website: z.preprocess(blank, z.string().url("Website must be a full URL").nullable()),
  courts: z.preprocess(blank, z.coerce.number().int().positive().nullable()),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveClub(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const { id, ...v } = clubSchema.parse(formObject(fd));
    if (id) {
      const [before] = await tx`select * from clubs where id = ${id}`;
      const slug = before.name === v.name ? before.slug : await uniqueSlugFor(tx, "clubs", v.name, id);
      const [after] = await tx`update clubs set ${tx({ ...v, slug })} where id = ${id} returning *`;
      await audit(tx, admin, "club.update", "club", id, before, after);
      return `${v.name} saved`;
    }
    const slug = await uniqueSlugFor(tx, "clubs", v.name);
    const [row] = await tx`insert into clubs ${tx({ ...v, slug })} returning *`;
    await audit(tx, admin, "club.create", "club", row.id, undefined, row);
    return `${v.name} added`;
  });
}

export async function deleteClub(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const id = String(fd.get("id"));
    const [before] = await tx`delete from clubs where id = ${id} returning *`;
    await audit(tx, admin, "club.delete", "club", id, before);
    return "Venue removed (its tournaments now show the venue as to be confirmed)";
  });
}

// ---------------------------------------------------------------------- pairs
export async function savePair(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const o = formObject(fd);
    const id = o.id || null;
    const p1 = o.player1, p2 = o.player2;
    if (!p1 || !p2 || p1 === p2) throw new Error("Choose two different players.");
    const division = o.division_id ? Number(o.division_id) : null;
    let name = (o.name ?? "").trim();
    if (!name) {
      const ps = await tx`select id, full_name from players where id in ${tx([p1, p2])}`;
      const last = (pid: string) => (ps.find((x) => x.id === pid)?.full_name ?? "").split(" ").slice(-1)[0];
      name = `${last(p1)} / ${last(p2)}`;
    }
    if (id) {
      const [before] = await tx`select * from pairs where id = ${id}`;
      const [{ n }] = await tx`select count(*)::int as n from matches where team_a_pair_id = ${id} or team_b_pair_id = ${id}`;
      const members = await tx`select player_id from pair_members where pair_id = ${id} order by position`;
      const changed = members[0]?.player_id !== p1 || members[1]?.player_id !== p2;
      if (n > 0 && changed) throw new Error("This pair already has matches, so its players cannot change. Create a new pair instead.");
      const slug = before.name === name ? before.slug : await uniqueSlugFor(tx, "pairs", name, id);
      await tx`update pairs set name = ${name}, slug = ${slug}, division_id = ${division}, active = ${o.active === "on"} where id = ${id}`;
      if (changed) {
        await tx`delete from pair_members where pair_id = ${id}`;
        await tx`insert into pair_members (pair_id, player_id, position) values (${id}, ${p1}, 1), (${id}, ${p2}, 2)`;
      }
      await audit(tx, admin, "pair.update", "pair", id, before, { name, division, p1, p2 });
      return `${name} saved`;
    }
    const slug = await uniqueSlugFor(tx, "pairs", name);
    const [row] = await tx`insert into pairs (slug, name, division_id) values (${slug}, ${name}, ${division}) returning id`;
    await tx`insert into pair_members (pair_id, player_id, position) values (${row.id}, ${p1}, 1), (${row.id}, ${p2}, 2)`;
    await audit(tx, admin, "pair.create", "pair", row.id, undefined, { name, division, p1, p2 });
    return `${name} created`;
  }, { recalc: true, trigger: "pair-save" });
}

// -------------------------------------------------------------------- scoring
function num(fd: FormData, k: string) { const v = fd.get(k); return v === null || v === "" ? undefined : Number(v); }

export async function saveScoring(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const courtMultipliers: Record<string, number> = { default: num(fd, "court_default") ?? 1 };
    String(fd.get("court_multipliers") ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean).forEach((pair) => {
      const m = pair.match(/^(\d+)\s*[:=]\s*([\d.]+)$/);
      if (!m) throw new Error(`Court multiplier "${pair}" should look like 1:1.5`);
      courtMultipliers[m[1]] = Number(m[2]);
    });
    const placement = String(fd.get("placement") ?? "").split(/[,\s]+/).filter(Boolean).map((x) => {
      const n = Number(x);
      if (!Number.isFinite(n)) throw new Error(`Placement value "${x}" is not a number`);
      return n;
    });
    const tieBreakers = fd.getAll("tieBreakers").map(String).filter((x) => (TIE_BREAKERS as readonly string[]).includes(x));
    const finishOrder = fd.getAll("finishOrder").map(String).filter((x) => (FINISH_ORDER as readonly string[]).includes(x));
    const config = parseScoringConfig({
      version: 1,
      rating: {
        method: fd.get("method"), initial: num(fd, "initial"), min: num(fd, "min"), max: num(fd, "max"), decimals: num(fd, "decimals"),
        elo: { k: num(fd, "k"), spread: num(fd, "spread"), marginOfVictory: fd.get("marginOfVictory") === "on" },
        provisional: { matches: num(fd, "provisionalMatches"), kMultiplier: num(fd, "provisionalK") },
        weighted: { halfLifeDays: num(fd, "halfLifeDays"), windowMatches: num(fd, "windowMatches") },
        visibleAfterMatches: num(fd, "visibleAfterMatches"), visibleAfterTournaments: num(fd, "visibleAfterTournaments"),
      },
      points: { win: num(fd, "win"), draw: num(fd, "draw"), loss: num(fd, "loss"), perGameWon: num(fd, "perGameWon"), courtMultipliers, placement, participation: num(fd, "participation") },
      standings: {
        bestTournamentsMonthly: num(fd, "bestMonthly"), bestTournamentsAllTime: num(fd, "bestAllTime"),
        tieBreakers: tieBreakers.length ? tieBreakers : undefined, individualIncludesFixedPairs: fd.get("individualIncludesFixedPairs") === "on",
      },
      tournament: { finishOrder: finishOrder.length ? finishOrder : undefined },
    });
    if (config.rating.min >= config.rating.max) throw new Error("Rating minimum must be below the maximum.");
    const name = String(fd.get("name") ?? "").trim() || "Custom ruleset";
    const [before] = await tx`select * from scoring_settings where is_active`;
    await tx`update scoring_settings set is_active = false where is_active`;
    const [row] = await tx`insert into scoring_settings (name, config, is_active, notes, created_by) values (${name}, ${tx.json(config)}, true, ${String(fd.get("notes") ?? "") || null}, ${admin.id}) returning *`;
    await audit(tx, admin, "scoring.update", "scoring_settings", String(row.id), before, row);
    return "Ruleset saved. Every rating, point and ranking has been recalculated with it.";
  }, { recalc: true, trigger: "scoring-change" });
}

export async function activateRuleset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const id = Number(fd.get("id"));
    await tx`update scoring_settings set is_active = false where is_active`;
    const [row] = await tx`update scoring_settings set is_active = true where id = ${id} returning *`;
    if (!row) throw new Error("Ruleset not found");
    await audit(tx, admin, "scoring.activate", "scoring_settings", String(id), undefined, row);
    return `Ruleset "${row.name}" is active and rankings were recalculated`;
  }, { recalc: true, trigger: "scoring-change" });
}

// ------------------------------------------------------------------- settings
export async function saveGeneralSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const o = formObject(fd);
    const value = {
      leagueName: o.leagueName?.trim() || "MoonPadel",
      tagline: o.tagline?.trim() ?? "",
      heroTitle: o.heroTitle?.trim() || "PLAY. COMPETE. RISE.",
      heroSubtitle: o.heroSubtitle?.trim() ?? "",
      city: o.city?.trim() ?? "",
      whatsappNumber: (o.whatsappNumber ?? "").replace(/[^\d+]/g, ""),
      instagramHandle: o.instagramHandle?.trim() ?? "",
      contactEmail: o.contactEmail?.trim() ?? "",
      showDemoBanner: o.showDemoBanner === "on",
    };
    if (value.contactEmail && !z.string().email().safeParse(value.contactEmail).success) throw new Error("Contact email is not valid.");
    const [before] = await tx`select value from site_settings where key = 'general'`;
    await tx`insert into site_settings (key, value) values ('general', ${tx.json(value)}) on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await audit(tx, admin, "settings.general", "site_settings", "general", before?.value, value);
    return "Website settings saved";
  });
}

export async function saveRulesSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const titles = fd.getAll("section_title").map(String);
    const bodies = fd.getAll("section_body").map(String);
    const sections = titles.map((title, i) => ({ title: title.trim(), body: (bodies[i] ?? "").trim() })).filter((s) => s.title && s.body);
    const value = { intro: String(fd.get("intro") ?? "").trim(), sections };
    await tx`insert into site_settings (key, value) values ('rules', ${tx.json(value)}) on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await audit(tx, admin, "settings.rules", "site_settings", "rules", undefined, value);
    return "Rules page saved";
  });
}

export async function addAdminUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (!z.string().email().safeParse(email).success) throw new Error("Enter a valid email.");
    const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!supabase && password.length < 10) throw new Error("Local admins need a password of at least 10 characters.");
    const [row] = await tx`insert into users (email, display_name, role, password_hash) values (${email}, ${String(fd.get("display_name") ?? "") || null}, 'admin', ${supabase ? null : hashPassword(password)})
                           on conflict (email) do update set role = 'admin' returning id, email`;
    await audit(tx, admin, "admin.add", "user", row.id, undefined, { email });
    return supabase ? `${email} added. They sign in with their Supabase account (create it in Supabase > Authentication if needed).` : `${email} can now sign in`;
  });
}

export async function removeAdminUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const id = String(fd.get("id"));
    if (id === admin.id) throw new Error("You cannot remove yourself.");
    const [{ n }] = await tx`select count(*)::int as n from users`;
    if (n <= 1) throw new Error("At least one administrator is required.");
    const [before] = await tx`delete from users where id = ${id} returning id, email`;
    await audit(tx, admin, "admin.remove", "user", id, before);
    return "Administrator removed";
  });
}

// ------------------------------------------------------------------ demo data
export async function loadDemo(): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const r = await seedDemoData();
    const { sql } = await import("@/lib/db");
    await sql().begin((tx) => audit(tx, admin, "demo.load", "demo", null, undefined, r));
    refreshPublicSite();
    return { ok: true, message: `Demo data loaded: ${r.players} players, ${r.tournaments} tournaments` };
  } catch (e) { return toError(e); }
}

export async function removeDemo(): Promise<ActionState> {
  return adminMutation(async ({ admin, tx }) => {
    const r = await removeDemoData(tx);
    await audit(tx, admin, "demo.remove", "demo", null, undefined, r);
    return `Demo data removed: ${r.players} players, ${r.tournaments} tournaments, ${r.clubs} venues`;
  });
}
