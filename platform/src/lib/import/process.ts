/**
 * Spreadsheet import engine.
 *
 * The same code runs for the preview and for the real import. The preview
 * performs every write inside a transaction and then rolls it back, so what
 * you see (new, updated, duplicate, error) is exactly what will happen.
 * The real import runs in one transaction: valid rows are saved together or
 * not at all, and rankings are rebuilt inside the same transaction.
 */
import "server-only";
import { sql, type Tx } from "../db";
import { recalculateAll } from "../recalc";
import { audit } from "../audit";
import type { AdminUser } from "../auth";
import { toCountryCode } from "../countries";
import { parseSetScores, slugify, summariseSets } from "../utils";
import { nextPlayerCode, uniquePlayerSlug, uniqueSlugFor } from "../admin/players";
import { FIELDS, type ImportKind } from "./fields";

export type ImportMode = "add_new" | "update";
export interface ImportOptions {
  mode: ImportMode;
  matchByName?: boolean;      // players: treat an exact name match as the same player
  strict?: boolean;           // cancel everything if any row has an error
  publishResults?: boolean;   // matches: publish the tournaments touched
  createMissingPlayers?: boolean; // matches/history: create players that do not exist yet
}
export interface RowResult {
  row: number; // spreadsheet row number (header is row 1)
  status: "insert" | "update" | "skip" | "error";
  message: string;
  changes?: string[];
  warnings?: string[];
}
export interface ImportResult {
  results: RowResult[];
  counts: { insert: number; update: number; skip: number; error: number };
  committed: boolean;
  importId?: string;
  recalc?: { matchesProcessed: number };
}

class Rollback extends Error { constructor(public payload: ImportResult) { super("rollback"); } }
class RowError extends Error {}

// ------------------------------------------------------------------ helpers
const clean = (v: unknown) => (v == null ? "" : String(v).trim());
const isBlank = (v: unknown) => clean(v) === "";

function num(v: string, label: string, opts: { int?: boolean; min?: number } = {}): number | null {
  if (isBlank(v)) return null;
  const n = Number(String(v).replace(/,/g, "").replace(/\s/g, ""));
  if (!Number.isFinite(n)) throw new RowError(`${label} "${v}" is not a number`);
  if (opts.int && !Number.isInteger(n)) throw new RowError(`${label} must be a whole number`);
  if (opts.min != null && n < opts.min) throw new RowError(`${label} cannot be below ${opts.min}`);
  return n;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const monthNum = (w: string) => MONTHS[w.slice(0, 4).toLowerCase()] ?? MONTHS[w.slice(0, 3).toLowerCase()];
export function parseDate(v: string): string | null {
  const s = clean(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // DD/MM/YYYY (UAE)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/); // 15 Nov 2026
  if (m) { const mo = monthNum(m[2]); if (mo) return valid(+m[3], mo, +m[1]); }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/); // Nov 15, 2026
  if (m) { const mo = monthNum(m[1]); if (mo) return valid(+m[3], mo, +m[2]); }
  return null;
  function valid(y: number, mo: number, d: number) {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt.toISOString().slice(0, 10);
  }
}
export function parseTime(v: string): string | null {
  const s = clean(v).toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/) ?? s.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function parseMonth(v: string): string | null {
  const s = clean(v);
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  const d = parseDate(s);
  return d ? `${d.slice(0, 7)}-01` : null;
}
const FORMAT_MAP: Record<string, string> = { ladder: "ladder", americano: "americano", mexicano: "mexicano", "round robin": "round_robin", roundrobin: "round_robin", round_robin: "round_robin", league: "round_robin", "groups knockout": "groups_knockout", "groups + knockout": "groups_knockout", groups_knockout: "groups_knockout", knockout: "knockout", "knock out": "knockout", elimination: "knockout" };
const STATUS_MAP: Record<string, string> = { draft: "draft", upcoming: "upcoming", scheduled: "upcoming", open: "registration_open", "registration open": "registration_open", registration_open: "registration_open", full: "full", "sold out": "full", "in progress": "in_progress", in_progress: "in_progress", live: "in_progress", completed: "completed", complete: "completed", finished: "completed", done: "completed", cancelled: "cancelled", canceled: "cancelled" };
function pairType(v: string): "fixed" | "non_fixed" {
  const s = clean(v).toLowerCase();
  if (!s) return "non_fixed";
  if (/^(fixed|fixed pairs?|yes|true|y)$/.test(s)) return "fixed";
  if (/^(non[- ]?fixed|rotating|mixed|no|false|n|individual)$/.test(s)) return "non_fixed";
  throw new RowError(`Pairs "${v}" should be fixed or non-fixed`);
}

interface Ctx {
  tx: Tx;
  admin: AdminUser;
  options: ImportOptions;
  divisions: { id: number; code: string; name: string }[];
  importId: string;
  touchedTournaments: Set<string>;
  seen: Map<string, number>;
  currentRow: number;
}

function division(ctx: Ctx, v: string): number | null {
  const s = clean(v).toLowerCase();
  if (!s) return null;
  const d = ctx.divisions.find((x) => x.code.toLowerCase() === s || x.name.toLowerCase() === s || `${x.code} ${x.name}`.toLowerCase() === s || s === x.code.toLowerCase().replace("d", "division "));
  if (!d) throw new RowError(`Unknown division "${v}". Use ${ctx.divisions.map((x) => x.code).join(", ")}`);
  return d.id;
}

async function findPlayer(ctx: Ctx, ref: string): Promise<{ id: string; full_name: string } | null> {
  const s = clean(ref);
  if (!s) return null;
  const byCode = await ctx.tx`select id, full_name from players where lower(player_code) = ${s.toLowerCase()}`;
  if (byCode.length) return byCode[0] as unknown as { id: string; full_name: string };
  const byName = await ctx.tx`select id, full_name from players where lower(full_name) = ${s.toLowerCase()}`;
  if (byName.length > 1) throw new RowError(`"${s}" matches ${byName.length} players. Use the player ID instead.`);
  return (byName[0] as unknown as { id: string; full_name: string }) ?? null;
}

async function resolvePlayer(ctx: Ctx, ref: string, label: string, warnings: string[]): Promise<string> {
  if (isBlank(ref)) throw new RowError(`${label} is empty`);
  const p = await findPlayer(ctx, ref);
  if (p) return p.id;
  if (!ctx.options.createMissingPlayers) throw new RowError(`${label} "${ref}" was not found. Import players first, or tick "create missing players".`);
  if (/^MP-/i.test(ref)) throw new RowError(`${label}: player ID "${ref}" does not exist`);
  const code = await nextPlayerCode(ctx.tx);
  const slug = await uniquePlayerSlug(ctx.tx, ref);
  const [row] = await ctx.tx`insert into players (player_code, slug, full_name) values (${code}, ${slug}, ${clean(ref)}) returning id`;
  warnings.push(`New player "${ref}" created (${code})`);
  return row.id;
}

// ---------------------------------------------------------------- players
async function importPlayer(ctx: Ctx, r: Record<string, string>): Promise<Omit<RowResult, "row">> {
  const { tx, options } = ctx;
  const warnings: string[] = [];
  const name = clean(r.full_name).replace(/\s+/g, " ");
  if (!name) throw new RowError("Player name is required");
  if (name.length > 120) throw new RowError("Player name is too long");
  const code = clean(r.player_code) || null;
  if (code && !/^[A-Za-z0-9-_]{2,30}$/.test(code)) throw new RowError(`Player ID "${code}" can only use letters, numbers and dashes`);
  const email = clean(r.email).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RowError(`Email "${email}" is not valid`);
  const country = isBlank(r.country) ? null : toCountryCode(r.country);
  if (!isBlank(r.country) && !country) throw new RowError(`Unknown country "${r.country}". Use a 2-letter code like AE`);
  const photo = clean(r.photo_url) || null;
  if (photo && !/^https?:\/\//i.test(photo)) throw new RowError("Profile image URL must start with http:// or https://");
  const side = clean(r.playing_side).toLowerCase() || null;
  if (side && !["left", "right", "both"].includes(side)) throw new RowError(`Playing side "${r.playing_side}" should be left, right or both`);
  const status = clean(r.status).toLowerCase();
  const statusVal = !status ? null : ["active", "yes", "true", "1"].includes(status) ? "active" : ["inactive", "no", "false", "0"].includes(status) ? "inactive" : (() => { throw new RowError(`Status "${r.status}" should be active or inactive`); })();
  const divisionId = division(ctx, r.division);
  const rating = num(r.rating, "Rating");
  const points = num(r.points, "Points");
  const tournaments = num(r.tournaments_played, "Tournaments played", { int: true, min: 0 });
  const matches = num(r.matches_played, "Matches played", { int: true, min: 0 });
  const wins = num(r.wins, "Wins", { int: true, min: 0 });
  const losses = num(r.losses, "Losses", { int: true, min: 0 });
  if (matches != null && wins != null && losses != null && wins + losses > matches) throw new RowError(`Wins + losses (${wins + losses}) is more than matches played (${matches})`);

  // The same player twice in one file is almost always a mistake.
  for (const key of [code && `code:${code.toLowerCase()}`, email && `email:${email}`, !code && !email && `name:${name.toLowerCase()}`].filter(Boolean) as string[]) {
    const first = ctx.seen.get(key);
    if (first) throw new RowError(`Duplicate of row ${first} in this file (same ${key.split(":")[0] === "code" ? "player ID" : key.split(":")[0]})`);
    ctx.seen.set(key, ctx.currentRow);
  }

  // Find an existing player: ID first, then email, then (optionally) exact name.
  let existing: Record<string, unknown> | undefined;
  let matchedBy = "";
  if (code) { [existing] = await tx`select p.*, pp.email from players p left join player_private pp on pp.player_id = p.id where lower(p.player_code) = ${code.toLowerCase()}`; matchedBy = "player ID"; }
  if (!existing && email) { [existing] = await tx`select p.*, pp.email from players p join player_private pp on pp.player_id = p.id where pp.email = ${email}`; matchedBy = "email"; }
  if (!existing) {
    const sameName = await tx`select p.*, pp.email from players p left join player_private pp on pp.player_id = p.id where lower(p.full_name) = ${name.toLowerCase()}`;
    if (sameName.length) {
      if (options.matchByName && sameName.length === 1 && !code) { existing = sameName[0]; matchedBy = "name"; }
      else return { status: "skip", message: `Possible duplicate of ${sameName.map((s) => `${s.full_name} (${s.player_code})`).join(", ")}. Add the player ID or email to update them, or tick "match by name".` };
    }
  }

  if (existing) {
    if (options.mode === "add_new") return { status: "skip", message: `Already exists (matched by ${matchedBy}: ${existing.player_code}). Skipped in add-new-only mode.` };
    // Update only the cells that have a value; never blank out existing data.
    const set: Record<string, unknown> = {};
    const changes: string[] = [];
    const cmp = (field: string, label: string, value: unknown) => {
      if (value == null) return;
      const before = existing![field];
      if (String(before ?? "") !== String(value)) { set[field] = value; changes.push(`${label}: ${before ?? "empty"} → ${value}`); }
    };
    if (matchedBy !== "name") cmp("full_name", "Name", name);
    if (code && matchedBy !== "player ID") cmp("player_code", "Player ID", code);
    cmp("country_code", "Country", country);
    cmp("nationality", "Nationality", clean(r.nationality) || null);
    cmp("photo_url", "Photo", photo);
    cmp("playing_side", "Side", side);
    cmp("status", "Status", statusVal);
    cmp("division_id", "Division", divisionId);
    cmp("base_rating", "Starting rating", rating);
    cmp("base_points", "Points", points);
    cmp("base_tournaments", "Tournaments", tournaments);
    cmp("base_matches", "Matches", matches);
    cmp("base_wins", "Wins", wins);
    cmp("base_losses", "Losses", losses);
    const privateChanges: Record<string, unknown> = {};
    if (email && email !== existing.email) { privateChanges.email = email; changes.push(`Email: ${existing.email ?? "empty"} → ${email}`); }
    if (!isBlank(r.phone)) privateChanges.phone = clean(r.phone);
    if (!changes.length && !privateChanges.phone) return { status: "skip", message: `No changes for ${existing.full_name} (${existing.player_code})` };
    if (set.full_name) set.slug = await uniquePlayerSlug(tx, name, existing.id as string);
    if (Object.keys(set).length) await tx`update players set ${tx({ ...set, updated_at: new Date() })} where id = ${existing.id as string}`;
    if (Object.keys(privateChanges).length) {
      await tx`insert into player_private ${tx({ player_id: existing.id as string, ...privateChanges })}
               on conflict (player_id) do update set ${tx({ ...privateChanges, updated_at: new Date() })}`;
      if (privateChanges.phone && !changes.some((c) => c.startsWith("Phone"))) changes.push("Phone updated");
    }
    if (set.division_id !== undefined) {
      await tx`insert into player_division_history (player_id, from_division_id, to_division_id, kind, reason, changed_by) values (${existing.id as string}, ${existing.division_id as number | null}, ${divisionId}, 'import', 'Spreadsheet import', ${ctx.admin.id})`;
    }
    return { status: "update", message: `${existing.full_name} (${existing.player_code}) updated`, changes, warnings };
  }

  const newCode = code ?? (await nextPlayerCode(tx));
  const slug = await uniquePlayerSlug(tx, name);
  const [row] = await tx`insert into players ${tx({
    player_code: newCode, slug, full_name: name, country_code: country, nationality: clean(r.nationality) || null, photo_url: photo, playing_side: side,
    status: statusVal ?? "active", division_id: divisionId, base_rating: rating, base_points: points ?? 0, base_tournaments: tournaments ?? 0,
    base_matches: matches ?? 0, base_wins: wins ?? 0, base_losses: losses ?? 0,
  })} returning id`;
  await tx`insert into player_private (player_id, email, phone) values (${row.id}, ${email}, ${clean(r.phone) || null})`;
  if (divisionId) await tx`insert into player_division_history (player_id, to_division_id, kind, reason, changed_by) values (${row.id}, ${divisionId}, 'import', 'Spreadsheet import', ${ctx.admin.id})`;
  if (!divisionId) warnings.push("No division set");
  return { status: "insert", message: `${name} added as ${newCode}`, warnings };
}

// ------------------------------------------------------------ tournaments
async function importTournament(ctx: Ctx, r: Record<string, string>): Promise<Omit<RowResult, "row">> {
  const { tx, options } = ctx;
  const warnings: string[] = [];
  const name = clean(r.name);
  if (!name) throw new RowError("Tournament name is required");
  const date = parseDate(r.date);
  if (!date) throw new RowError(isBlank(r.date) ? "Date is required" : `Date "${r.date}" is not valid. Use YYYY-MM-DD or DD/MM/YYYY`);
  const time = isBlank(r.start_time) ? null : parseTime(r.start_time);
  if (!isBlank(r.start_time) && !time) throw new RowError(`Start time "${r.start_time}" is not valid. Use 19:30 or 7:30 PM`);
  const fmt = isBlank(r.format) ? "ladder" : FORMAT_MAP[clean(r.format).toLowerCase()];
  if (!fmt) throw new RowError(`Format "${r.format}" is not recognised`);
  const status = isBlank(r.status) ? "upcoming" : STATUS_MAP[clean(r.status).toLowerCase()];
  if (!status) throw new RowError(`Status "${r.status}" is not recognised`);
  let clubId: string | null = null;
  const venue = clean(r.venue);
  if (venue && !/^\[.*\]$/.test(venue)) {
    const [club] = await tx`select id from clubs where lower(name) = ${venue.toLowerCase()} or slug = ${slugify(venue)}`;
    if (club) clubId = club.id;
    else {
      const slug = await uniqueSlugFor(tx, "clubs", venue);
      const [c] = await tx`insert into clubs (slug, name, city) values (${slug}, ${venue}, 'Dubai') returning id`;
      clubId = c.id;
      warnings.push(`New venue "${venue}" will be created`);
    }
  }
  const values = {
    name, tournament_date: date, start_time: time, club_id: clubId, division_id: division(ctx, r.division), format: fmt, pair_type: pairType(r.pair_type),
    max_players: num(r.max_players, "Max players", { int: true, min: 1 }), courts_count: num(r.courts, "Courts", { int: true, min: 1 }),
    rounds_count: num(r.rounds, "Rounds", { int: true, min: 1 }), entry_fee: num(r.entry_fee, "Entry fee", { min: 0 }),
    duration_minutes: num(r.duration, "Duration", { int: true, min: 1 }), status, description: clean(r.description) || null,
  };
  const [existing] = await tx`select * from tournaments where lower(name) = ${name.toLowerCase()} and tournament_date = ${date}`;
  if (existing) {
    if (options.mode === "add_new") return { status: "skip", message: `Already exists on ${date}. Skipped in add-new-only mode.` };
    const set: Record<string, unknown> = {};
    const changes: string[] = [];
    for (const [k, v] of Object.entries(values)) {
      if (v == null || k === "name" || k === "tournament_date") continue;
      if (k === "start_time" && existing.start_time?.slice(0, 5) === v) continue;
      if (String(existing[k] ?? "") !== String(v)) { set[k] = v; changes.push(`${k.replace(/_/g, " ")}: ${existing[k] ?? "empty"} → ${v}`); }
    }
    if (!changes.length) return { status: "skip", message: "No changes" };
    await tx`update tournaments set ${tx({ ...set, updated_at: new Date() })} where id = ${existing.id}`;
    if (existing.results_published) ctx.touchedTournaments.add(existing.id);
    return { status: "update", message: `${name} updated`, changes, warnings };
  }
  const slug = await uniqueSlugFor(tx, "tournaments", name);
  await tx`insert into tournaments ${tx({ ...values, slug })}`;
  return { status: "insert", message: `${name} on ${date} added`, warnings };
}

// ----------------------------------------------------------------- matches
async function importMatch(ctx: Ctx, r: Record<string, string>): Promise<Omit<RowResult, "row">> {
  const { tx, options } = ctx;
  const warnings: string[] = [];
  const tName = clean(r.tournament);
  if (!tName) throw new RowError("Tournament is required");
  const tDate = isBlank(r.tournament_date) ? null : parseDate(r.tournament_date);
  if (!isBlank(r.tournament_date) && !tDate) throw new RowError(`Tournament date "${r.tournament_date}" is not valid`);
  const ts = await tx`select id, name, pair_type, tournament_date from tournaments where (lower(name) = ${tName.toLowerCase()} or slug = ${tName.toLowerCase()}) ${tDate ? tx`and tournament_date = ${tDate}` : tx``}`;
  if (!ts.length) throw new RowError(`Tournament "${tName}"${tDate ? ` on ${tDate}` : ""} not found. Create or import it first.`);
  if (ts.length > 1) throw new RowError(`${ts.length} tournaments are called "${tName}". Add the tournament date column.`);
  const t = ts[0];
  const round = num(r.round, "Round", { int: true, min: 1 });
  const court = num(r.court, "Court", { int: true, min: 1 });
  if (round == null) throw new RowError("Round number is required");
  if (court == null) throw new RowError("Court number is required");

  const a1 = await resolvePlayer(ctx, r.team_a_player_1, "Team A player 1", warnings);
  const a2 = await resolvePlayer(ctx, r.team_a_player_2, "Team A player 2", warnings);
  const b1 = await resolvePlayer(ctx, r.team_b_player_1, "Team B player 1", warnings);
  const b2 = await resolvePlayer(ctx, r.team_b_player_2, "Team B player 2", warnings);
  if (new Set([a1, a2, b1, b2]).size !== 4) throw new RowError("The same player appears twice in this match");

  let sets: number[][] = [];
  let status: "scheduled" | "completed" = "scheduled";
  let winner: "A" | "B" | "D" | null = null;
  let gamesA = 0, gamesB = 0;
  if (!isBlank(r.set_scores)) {
    const parsed = parseSetScores(r.set_scores);
    if (!parsed) throw new RowError(`Score "${r.set_scores}" is not valid. Use 6-4, 3-6, 10-8 (Team A first)`);
    sets = parsed;
    const s = summariseSets(parsed);
    gamesA = s.gamesA; gamesB = s.gamesB; status = "completed";
    const w = clean(r.winner).toUpperCase();
    if (w && !["A", "B", "D", "DRAW"].includes(w)) throw new RowError(`Winning team "${r.winner}" should be A or B`);
    winner = w ? (w === "DRAW" ? "D" : (w as "A" | "B" | "D")) : s.winner;
    if (w && w !== "DRAW" && s.winner !== "D" && w !== s.winner) throw new RowError(`Winner ${w} does not match the score (${s.winner} won more sets)`);
  }

  // Fixed-pair tournaments: link each side to its pair, creating one if needed.
  let pairA: string | null = null, pairB: string | null = null;
  if (t.pair_type === "fixed") {
    const pairFor = async (x: string, y: string) => {
      const [p] = await tx`select pm1.pair_id from pair_members pm1 join pair_members pm2 on pm2.pair_id = pm1.pair_id where pm1.player_id = ${x} and pm2.player_id = ${y}`;
      if (p) return p.pair_id as string;
      const names = await tx`select id, full_name from players where id in ${tx([x, y])}`;
      const last = (id: string) => (names.find((n) => n.id === id)?.full_name ?? "").split(" ").slice(-1)[0];
      const name = `${last(x)} / ${last(y)}`;
      const slug = await uniqueSlugFor(tx, "pairs", name);
      const [np] = await tx`insert into pairs (slug, name) values (${slug}, ${name}) returning id`;
      await tx`insert into pair_members (pair_id, player_id, position) values (${np.id}, ${x}, 1), (${np.id}, ${y}, 2)`;
      warnings.push(`New fixed pair "${name}" created`);
      return np.id as string;
    };
    pairA = await pairFor(a1, a2);
    pairB = await pairFor(b1, b2);
  }

  const clash = await tx`select p.full_name from match_players mp join matches m on m.id = mp.match_id join players p on p.id = mp.player_id
                         where m.tournament_id = ${t.id} and m.round_number = ${round} and m.court_number <> ${court} and m.status <> 'void' and mp.player_id in ${tx([a1, a2, b1, b2])}`;
  if (clash.length) throw new RowError(`${clash.map((c) => c.full_name).join(", ")} already ${clash.length > 1 ? "play" : "plays"} on another court in round ${round}`);

  const matchDate = isBlank(r.match_date) ? null : new Date(clean(r.match_date));
  if (matchDate && Number.isNaN(matchDate.getTime())) throw new RowError(`Match date "${r.match_date}" is not valid`);
  const values = {
    tournament_id: t.id, round_number: round, court_number: court, set_scores: tx.json(sets), team_a_games: gamesA, team_b_games: gamesB,
    winner, status, verified: true, team_a_pair_id: pairA, team_b_pair_id: pairB,
    duration_minutes: num(r.duration, "Duration", { int: true, min: 0 }), match_date: matchDate, updated_at: new Date(),
  };
  const fileKey = `${t.id}:${round}:${court}`;
  const firstRow = ctx.seen.get(fileKey);
  if (firstRow) throw new RowError(`Round ${round}, court ${court} already appears in row ${firstRow} of this file`);
  ctx.seen.set(fileKey, ctx.currentRow);
  const [existing] = await tx`select id, set_scores, winner from matches where tournament_id = ${t.id} and round_number = ${round} and court_number = ${court}`;
  let id: string;
  let result: Omit<RowResult, "row">;
  if (existing) {
    if (options.mode === "add_new") return { status: "skip", message: `A match already exists in round ${round}, court ${court}. Skipped in add-new-only mode.` };
    await tx`update matches set ${tx(values as never)} where id = ${existing.id}`;
    await tx`delete from match_players where match_id = ${existing.id}`;
    id = existing.id;
    const before = (existing.set_scores as number[][]).map((s) => s.join("-")).join(", ") || "no score";
    result = { status: "update", message: `${t.name} R${round} C${court} updated`, changes: [`Score: ${before} → ${sets.map((s) => s.join("-")).join(", ") || "no score"}`], warnings };
  } else {
    const [row] = await tx`insert into matches ${tx(values as never)} returning id`;
    id = row.id;
    result = { status: "insert", message: `${t.name} R${round} C${court}: ${status === "completed" ? `${sets.map((s) => s.join("-")).join(", ")} (Team ${winner})` : "scheduled"}`, warnings };
  }
  for (const [p, team, pair] of [[a1, "A", pairA], [a2, "A", pairA], [b1, "B", pairB], [b2, "B", pairB]] as const) {
    await tx`insert into match_players (match_id, player_id, team) values (${id}, ${p}, ${team})`;
    await tx`insert into tournament_registrations (tournament_id, player_id, pair_id) values (${t.id}, ${p}, ${pair})
             on conflict (tournament_id, player_id) do update set status = 'registered', pair_id = coalesce(excluded.pair_id, tournament_registrations.pair_id)`;
  }
  ctx.touchedTournaments.add(t.id);
  return result;
}

// ----------------------------------------------------------------- history
async function importHistory(ctx: Ctx, r: Record<string, string>): Promise<Omit<RowResult, "row">> {
  const { tx, options } = ctx;
  const warnings: string[] = [];
  const playerId = await resolvePlayer(ctx, r.player, "Player", warnings);
  const month = parseMonth(r.month);
  if (!month) throw new RowError(isBlank(r.month) ? "Month is required" : `Month "${r.month}" is not valid. Use YYYY-MM`);
  const values = {
    player_id: playerId, month, division_id: division(ctx, r.division), points: num(r.points, "Points") ?? 0,
    tournaments: num(r.tournaments, "Tournaments", { int: true, min: 0 }) ?? 0, matches: num(r.matches, "Matches", { int: true, min: 0 }) ?? 0,
    wins: num(r.wins, "Wins", { int: true, min: 0 }) ?? 0, losses: num(r.losses, "Losses", { int: true, min: 0 }) ?? 0, rating: num(r.rating, "Rating"), import_id: ctx.importId,
  };
  if (values.wins + values.losses > values.matches && values.matches > 0) throw new RowError("Wins + losses is more than matches");
  const [existing] = await tx`select id, points from historical_monthly_stats where player_id = ${playerId} and month = ${month}`;
  if (existing) {
    if (options.mode === "add_new") return { status: "skip", message: `${month.slice(0, 7)} already has stats for this player. Skipped in add-new-only mode.` };
    await tx`update historical_monthly_stats set ${tx(values)} where id = ${existing.id}`;
    return { status: "update", message: `${month.slice(0, 7)} updated`, changes: [`Points: ${existing.points} → ${values.points}`], warnings };
  }
  await tx`insert into historical_monthly_stats ${tx(values)}`;
  return { status: "insert", message: `${month.slice(0, 7)}: ${values.points} pts`, warnings };
}

const HANDLERS: Record<ImportKind, (ctx: Ctx, r: Record<string, string>) => Promise<Omit<RowResult, "row">>> = {
  players: importPlayer, tournaments: importTournament, matches: importMatch, history: importHistory,
};

// ------------------------------------------------------------------- runner
export function applyMapping(kind: ImportKind, rows: Record<string, string>[], mapping: Record<string, string>) {
  return rows.map((raw) => {
    const out: Record<string, string> = {};
    for (const f of FIELDS[kind]) out[f.key] = mapping[f.key] ? clean(raw[mapping[f.key]]) : "";
    return out;
  });
}

export function mappingErrors(kind: ImportKind, mapping: Record<string, string>): string[] {
  return FIELDS[kind].filter((f) => f.required && !mapping[f.key]).map((f) => `Map a column to "${f.label}"`);
}

export async function runImport(args: {
  kind: ImportKind; rows: Record<string, string>[]; mapping: Record<string, string>; options: ImportOptions;
  admin: AdminUser; commit: boolean; fileName?: string;
}): Promise<ImportResult> {
  const { kind, mapping, options, admin, commit } = args;
  const errs = mappingErrors(kind, mapping);
  if (errs.length) throw new Error(errs.join(". "));
  const rows = applyMapping(kind, args.rows, mapping);
  const db = sql();

  const work = async (tx: Tx): Promise<ImportResult> => {
    await tx`select pg_advisory_xact_lock(424244)`; // one import at a time
    const [log] = await tx`insert into import_logs (kind, filename, mode, status, total_rows, created_by) values (${kind}, ${args.fileName ?? null}, ${options.mode}, 'completed', ${rows.length}, ${admin.id}) returning id`;
    const divisions = (await tx`select id, code, name from divisions`) as unknown as Ctx["divisions"];
    const ctx: Ctx = { tx, admin, options, divisions, importId: log.id, touchedTournaments: new Set(), seen: new Map(), currentRow: 0 };
    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2;
      try {
        // A savepoint per row: a failing row is rolled back on its own.
        ctx.currentRow = rowNo;
        const res = await tx.savepoint(async (sp) => HANDLERS[kind]({ ...ctx, tx: sp as unknown as Tx }, rows[i]));
        results.push({ row: rowNo, ...res });
      } catch (e) {
        const msg = e instanceof RowError ? e.message : friendlyDbError(e);
        results.push({ row: rowNo, status: "error", message: msg });
      }
    }
    const counts = { insert: 0, update: 0, skip: 0, error: 0 };
    for (const r of results) counts[r.status]++;
    const result: ImportResult = { results, counts, committed: false, importId: log.id };

    if (!commit) throw new Rollback(result);
    if (options.strict && counts.error > 0) throw new Rollback({ ...result, committed: false });

    if (kind === "matches" && options.publishResults && ctx.touchedTournaments.size) {
      const ids = [...ctx.touchedTournaments];
      const open = await tx`select t.name from tournaments t where t.id in ${tx(ids)} and exists (select 1 from matches m where m.tournament_id = t.id and m.status = 'scheduled')`;
      await tx`update tournaments set results_published = true, status = 'completed', updated_at = now()
               where id in ${tx(ids)} and not exists (select 1 from matches m where m.tournament_id = tournaments.id and m.status = 'scheduled')`;
      if (open.length) result.results.push({ row: 0, status: "skip", message: `Not published because some matches have no score yet: ${open.map((o) => o.name).join(", ")}` });
    }
    const failedRows = results.filter((r) => r.status === "error").map((r) => ({ ...args.rows[r.row - 2], __row: r.row, __error: r.message }));
    await tx`update import_logs set inserted = ${counts.insert}, updated = ${counts.update}, skipped = ${counts.skip}, failed = ${counts.error},
             summary = ${tx.json({ options: { ...options }, mapping, failedRows: failedRows.slice(0, 2000), messages: results.slice(0, 2000) } as never)} where id = ${log.id}`;
    await audit(tx, admin, "import.commit", "import", log.id, undefined, { kind, fileName: args.fileName, counts, options });
    const recalc = counts.insert + counts.update > 0 ? await recalculateAll(`import-${kind}`, tx) : undefined;
    return { ...result, committed: true, recalc: recalc ? { matchesProcessed: recalc.matchesProcessed } : undefined };
  };

  try {
    return await db.begin(work);
  } catch (e) {
    if (e instanceof Rollback) return e.payload;
    throw e;
  }
}

function friendlyDbError(e: unknown): string {
  const err = e as { code?: string; message?: string; constraint_name?: string };
  if (err?.code === "23505") {
    if (err.constraint_name?.includes("email")) return "This email already belongs to another player";
    if (err.constraint_name?.includes("player_code")) return "This player ID is already used by another player";
    return "Duplicate value";
  }
  if (err?.code === "23503") return "Refers to a record that does not exist";
  if (err?.code === "22003" || err?.code === "23514") return "A value is out of range";
  console.error("import row error", e);
  return err?.message ?? "Could not save this row";
}
