import { z } from "zod";

/**
 * Scoring ruleset. Stored as JSON in scoring_settings.config and edited in
 * Admin > Scoring settings. Every value here is configurable; the defaults are
 * a demo ruleset only, so the platform works before the official MoonPadel
 * rules are decided.
 */

export const RATING_METHODS = ["elo", "weighted", "manual"] as const;
export const TIE_BREAKERS = ["points", "wins", "winPct", "gameDiff", "rating", "fewerTournaments", "moreTournaments"] as const;
export const FINISH_ORDER = ["winPoints", "totalPoints", "gameDiff", "gamesWon", "wins", "rating"] as const;

export type RatingMethod = (typeof RATING_METHODS)[number];
export type TieBreaker = (typeof TIE_BREAKERS)[number];
export type FinishKey = (typeof FINISH_ORDER)[number];

const num = (d: number) => z.coerce.number().finite().default(d);

export const scoringConfigSchema = z.object({
  version: z.number().int().default(1),
  rating: z
    .object({
      method: z.enum(RATING_METHODS).default("elo"),
      initial: num(3),
      min: num(0),
      max: num(7),
      decimals: z.coerce.number().int().min(0).max(4).default(2),
      elo: z
        .object({
          k: num(0.12),
          spread: num(1.5),
          marginOfVictory: z.boolean().default(true),
        })
        .default({}),
      provisional: z
        .object({ matches: z.coerce.number().int().min(0).default(10), kMultiplier: num(1.5) })
        .default({}),
      weighted: z
        .object({ halfLifeDays: num(60), windowMatches: z.coerce.number().int().min(1).default(40) })
        .default({}),
      visibleAfterMatches: z.coerce.number().int().min(0).default(5),
      visibleAfterTournaments: z.coerce.number().int().min(0).default(1),
    })
    .default({}),
  points: z
    .object({
      win: num(3),
      draw: num(1),
      loss: num(0),
      perGameWon: num(0),
      /** Court number -> multiplier. "default" applies to courts not listed. Court 1 is the top court. */
      courtMultipliers: z.record(z.coerce.number().finite()).default({ default: 1 }),
      /** Points by final position: index 0 = winner. */
      placement: z.array(z.coerce.number().finite()).default([]),
      participation: num(0),
    })
    .default({}),
  standings: z
    .object({
      bestTournamentsMonthly: z.coerce.number().int().min(0).default(3), // 0 = count all
      bestTournamentsAllTime: z.coerce.number().int().min(0).default(10),
      tieBreakers: z.array(z.enum(TIE_BREAKERS)).default(["points", "wins", "winPct", "gameDiff", "rating"]),
      individualIncludesFixedPairs: z.boolean().default(false),
    })
    .default({}),
  tournament: z
    .object({
      finishOrder: z.array(z.enum(FINISH_ORDER)).default(["winPoints", "gameDiff", "gamesWon", "rating"]),
    })
    .default({}),
});

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export function parseScoringConfig(raw: unknown): ScoringConfig {
  return scoringConfigSchema.parse(raw ?? {});
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = parseScoringConfig({});

export function courtMultiplier(cfg: ScoringConfig, court: number): number {
  const m = cfg.points.courtMultipliers;
  const v = m[String(court)];
  if (typeof v === "number") return v;
  return typeof m.default === "number" ? m.default : 1;
}
