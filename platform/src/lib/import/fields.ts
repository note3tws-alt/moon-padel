/** Spreadsheet import definitions: target fields, aliases used for auto-mapping, and template examples. */

export type ImportKind = "players" | "tournaments" | "matches" | "history";

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  hint?: string;
  example: string;
}

export const IMPORT_KINDS: { kind: ImportKind; label: string; description: string }[] = [
  { kind: "players", label: "Players", description: "Create or update player profiles, divisions, contact details and starting statistics." },
  { kind: "matches", label: "Match results", description: "Results per round and court. Updates ratings, points, rankings and profiles." },
  { kind: "tournaments", label: "Tournaments", description: "Schedule tournaments in bulk, with venue, division, format and capacity." },
  { kind: "history", label: "Historical monthly stats", description: "Monthly points and records from before the platform, shown in historical rankings." },
];

export const FIELDS: Record<ImportKind, FieldDef[]> = {
  players: [
    { key: "player_code", label: "Player ID", aliases: ["player id", "playerid", "id", "code", "player code", "member id"], hint: "Unique. Used to match existing players. Generated if empty.", example: "MP-0101" },
    { key: "full_name", label: "Player name", required: true, aliases: ["name", "player name", "full name", "player", "fullname"], example: "Sample Player" },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email address", "mail"], hint: "Private. Also used to match existing players.", example: "sample.player@example.com" },
    { key: "phone", label: "Phone number", aliases: ["phone", "phone number", "mobile", "whatsapp", "tel", "telephone"], hint: "Private.", example: "+971 50 000 0000" },
    { key: "country", label: "Country", aliases: ["country", "country code", "flag"], hint: "2-letter code (AE) or English name.", example: "AE" },
    { key: "nationality", label: "Nationality", aliases: ["nationality"], example: "Emirati" },
    { key: "photo_url", label: "Profile image URL", aliases: ["photo", "photo url", "image", "image url", "profile image", "profile image url", "picture", "avatar"], example: "https://example.com/photo.jpg" },
    { key: "division", label: "Division", aliases: ["division", "div", "level", "category"], hint: "Code (D1) or name (Elite).", example: "D3" },
    { key: "rating", label: "Rating", aliases: ["rating", "rtg", "level rating"], hint: "Starting rating for the rating engine.", example: "3.25" },
    { key: "points", label: "Points", aliases: ["points", "pts", "total points"], hint: "Historical points from before the platform.", example: "120" },
    { key: "tournaments_played", label: "Tournaments played", aliases: ["tournaments", "tournaments played", "events", "t"], example: "8" },
    { key: "matches_played", label: "Matches played", aliases: ["matches", "matches played", "games played", "played", "mp"], example: "40" },
    { key: "wins", label: "Wins", aliases: ["wins", "won", "w"], example: "22" },
    { key: "losses", label: "Losses", aliases: ["losses", "lost", "l"], example: "18" },
    { key: "playing_side", label: "Playing side", aliases: ["side", "playing side", "position"], hint: "left, right or both.", example: "right" },
    { key: "status", label: "Status", aliases: ["status", "active"], hint: "active or inactive.", example: "active" },
  ],
  tournaments: [
    { key: "name", label: "Tournament name", required: true, aliases: ["name", "tournament", "tournament name", "event", "event name", "title"], example: "Sample Night D2" },
    { key: "date", label: "Date", required: true, aliases: ["date", "tournament date", "event date", "day"], hint: "YYYY-MM-DD or DD/MM/YYYY.", example: "2026-12-05" },
    { key: "start_time", label: "Start time", aliases: ["time", "start", "start time", "starts"], example: "19:30" },
    { key: "venue", label: "Venue / club", aliases: ["venue", "club", "location", "court", "venue / club"], hint: "Matched by name; new names create a venue.", example: "[VENUE]" },
    { key: "division", label: "Division", aliases: ["division", "div", "level", "category"], example: "D2" },
    { key: "format", label: "Format", aliases: ["format", "type", "tournament format"], hint: "ladder, americano, mexicano, round robin, groups knockout, knockout", example: "ladder" },
    { key: "pair_type", label: "Pairs", aliases: ["pairs", "pair type", "fixed", "partner type", "fixed pairs"], hint: "fixed or non-fixed", example: "non-fixed" },
    { key: "max_players", label: "Max players", aliases: ["max players", "capacity", "max", "spots", "players"], example: "16" },
    { key: "courts", label: "Courts", aliases: ["courts", "courts count", "number of courts"], example: "4" },
    { key: "rounds", label: "Rounds", aliases: ["rounds", "number of rounds"], example: "6" },
    { key: "entry_fee", label: "Entry fee", aliases: ["fee", "entry fee", "price", "cost"], hint: "Leave empty until confirmed.", example: "" },
    { key: "duration", label: "Duration (minutes)", aliases: ["duration", "minutes", "length"], example: "120" },
    { key: "status", label: "Status", aliases: ["status", "state"], hint: "draft, upcoming, registration open, full, in progress, completed, cancelled", example: "upcoming" },
    { key: "description", label: "Description", aliases: ["description", "notes", "details", "info"], example: "" },
  ],
  matches: [
    { key: "tournament", label: "Tournament", required: true, aliases: ["tournament", "tournament name", "event", "tournament slug"], hint: "Exact tournament name.", example: "Sample Night D2" },
    { key: "tournament_date", label: "Tournament date", aliases: ["tournament date", "date", "event date"], hint: "Helps when two tournaments share a name.", example: "2026-12-05" },
    { key: "round", label: "Round number", required: true, aliases: ["round", "round number", "rnd", "r"], example: "1" },
    { key: "court", label: "Court number", required: true, aliases: ["court", "court number", "ct", "c"], example: "1" },
    { key: "team_a_player_1", label: "Team A player 1", required: true, aliases: ["team a player 1", "a1", "player a1", "team a 1", "team1 player1", "team 1 player 1"], hint: "Player ID or exact name.", example: "MP-0101" },
    { key: "team_a_player_2", label: "Team A player 2", required: true, aliases: ["team a player 2", "a2", "player a2", "team a 2", "team1 player2", "team 1 player 2"], example: "MP-0102" },
    { key: "team_b_player_1", label: "Team B player 1", required: true, aliases: ["team b player 1", "b1", "player b1", "team b 1", "team2 player1", "team 2 player 1"], example: "MP-0103" },
    { key: "team_b_player_2", label: "Team B player 2", required: true, aliases: ["team b player 2", "b2", "player b2", "team b 2", "team2 player2", "team 2 player 2"], example: "MP-0104" },
    { key: "set_scores", label: "Set scores", aliases: ["score", "scores", "set scores", "result", "sets"], hint: "Team A first: 6-4, 3-6, 10-8. Empty = scheduled.", example: "6-4, 6-3" },
    { key: "winner", label: "Winning team", aliases: ["winner", "winning team", "won by"], hint: "A or B. Worked out from the score if empty.", example: "A" },
    { key: "duration", label: "Match duration (minutes)", aliases: ["duration", "minutes", "match duration"], example: "18" },
    { key: "match_date", label: "Match date / time", aliases: ["match date", "match time", "played at", "datetime"], example: "" },
  ],
  history: [
    { key: "player", label: "Player", required: true, aliases: ["player", "player id", "name", "player name", "id"], hint: "Player ID or exact name.", example: "MP-0101" },
    { key: "month", label: "Month", required: true, aliases: ["month", "period", "date"], hint: "YYYY-MM.", example: "2026-09" },
    { key: "division", label: "Division", aliases: ["division", "div"], example: "D3" },
    { key: "points", label: "Points", aliases: ["points", "pts"], example: "54" },
    { key: "tournaments", label: "Tournaments", aliases: ["tournaments", "events", "t"], example: "3" },
    { key: "matches", label: "Matches", aliases: ["matches", "played", "mp"], example: "15" },
    { key: "wins", label: "Wins", aliases: ["wins", "w", "won"], example: "9" },
    { key: "losses", label: "Losses", aliases: ["losses", "l", "lost"], example: "6" },
    { key: "rating", label: "Rating at month end", aliases: ["rating", "rtg"], example: "3.40" },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-./]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Suggests a mapping from spreadsheet headers to fields. */
export function suggestMapping(kind: ImportKind, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of FIELDS[kind]) {
    const candidates = [f.key, f.label, ...f.aliases].map(norm);
    const h = headers.find((x) => !used.has(x) && candidates.includes(norm(x)));
    if (h) { mapping[f.key] = h; used.add(h); }
  }
  return mapping;
}
