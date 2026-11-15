/**
 * Rating models. Each model keeps the current rating of every entity and
 * updates it one match at a time, in chronological order.
 *
 * To add the official MoonPadel formula: implement RatingModel, add its key to
 * RATING_METHODS in config.ts and return it from createRatingModel.
 */
import type { ScoringConfig } from "./config";

export interface MatchForRating {
  teamA: string[];
  teamB: string[];
  scoreA: number; // 1 win, 0.5 draw, 0 loss
  gamesA: number;
  gamesB: number;
  at: string;
}
export interface RatingChange { id: string; before: number; after: number }

export interface RatingModel {
  get(id: string): number;
  has(id: string): boolean;
  rateMatch(m: MatchForRating): RatingChange[];
  adjust(id: string, kind: "delta" | "set", value: number): number;
}

export function createRatingModel(cfg: ScoringConfig, base: (id: string) => number | null): RatingModel {
  switch (cfg.rating.method) {
    case "weighted": return new WeightedPerformanceModel(cfg, base);
    case "manual": return new ManualModel(cfg, base);
    case "elo":
    default: return new EloModel(cfg, base);
  }
}

abstract class BaseModel implements RatingModel {
  protected ratings = new Map<string, number>();
  protected played = new Map<string, number>();
  constructor(protected cfg: ScoringConfig, private base: (id: string) => number | null) {}
  protected clamp(v: number) { return Math.min(this.cfg.rating.max, Math.max(this.cfg.rating.min, v)); }
  protected init(id: string) {
    if (!this.ratings.has(id)) this.ratings.set(id, this.clamp(this.base(id) ?? this.cfg.rating.initial));
  }
  has(id: string) { return this.ratings.has(id); }
  get(id: string) { this.init(id); return this.ratings.get(id)!; }
  adjust(id: string, kind: "delta" | "set", value: number) {
    const v = this.clamp(kind === "set" ? value : this.get(id) + value);
    this.ratings.set(id, v);
    return v;
  }
  protected teamAvg(ids: string[]) { return ids.reduce((s, id) => s + this.get(id), 0) / Math.max(1, ids.length); }
  abstract rateMatch(m: MatchForRating): RatingChange[];
}

/**
 * Team Elo on the configured scale. Team strength is the average of its
 * players. Expected score uses a logistic curve where `spread` rating points
 * mean 10:1 odds. Optional margin-of-victory factor (1.0 to 1.5) and a higher
 * K for provisional players.
 */
export class EloModel extends BaseModel {
  rateMatch(m: MatchForRating): RatingChange[] {
    const { k, spread, marginOfVictory } = this.cfg.rating.elo;
    const ra = this.teamAvg(m.teamA);
    const rb = this.teamAvg(m.teamB);
    const expectedA = 1 / (1 + 10 ** ((rb - ra) / spread));
    const totalGames = m.gamesA + m.gamesB;
    const mov = marginOfVictory && totalGames > 0 ? 1 + 0.5 * Math.min(1, Math.abs(m.gamesA - m.gamesB) / Math.max(6, totalGames / 2)) : 1;
    const out: RatingChange[] = [];
    const apply = (ids: string[], score: number, expected: number) => {
      for (const id of ids) {
        const before = this.get(id);
        const n = this.played.get(id) ?? 0;
        const kk = k * (n < this.cfg.rating.provisional.matches ? this.cfg.rating.provisional.kMultiplier : 1);
        const after = this.clamp(before + kk * mov * (score - expected));
        this.ratings.set(id, after);
        this.played.set(id, n + 1);
        out.push({ id, before, after });
      }
    };
    apply(m.teamA, m.scoreA, expectedA);
    apply(m.teamB, 1 - m.scoreA, 1 - expectedA);
    return out;
  }
}

/**
 * Weighted performance rating. Each match produces a performance value
 * (opponent average +/- spread/2 for a win/loss). The rating is the
 * time-weighted average of the last `windowMatches` performances, where a
 * match loses half its weight every `halfLifeDays`. The starting rating counts
 * as one match of weight 1 so a single result cannot swing it too far.
 */
export class WeightedPerformanceModel extends BaseModel {
  private perfs = new Map<string, { at: number; value: number }[]>();
  private starts = new Map<string, number>();
  rateMatch(m: MatchForRating): RatingChange[] {
    const { halfLifeDays, windowMatches } = this.cfg.rating.weighted;
    const spread = this.cfg.rating.elo.spread;
    const ra = this.teamAvg(m.teamA);
    const rb = this.teamAvg(m.teamB);
    const at = new Date(m.at).getTime();
    const out: RatingChange[] = [];
    const record = (ids: string[], opp: number, score: number) => {
      for (const id of ids) {
        const before = this.get(id);
        if (!this.starts.has(id)) this.starts.set(id, before);
        const list = this.perfs.get(id) ?? [];
        list.push({ at, value: opp + (score - 0.5) * spread });
        while (list.length > windowMatches) list.shift();
        this.perfs.set(id, list);
        let wsum = 1, vsum = this.starts.get(id)!;
        for (const p of list) {
          const w = 0.5 ** ((at - p.at) / (halfLifeDays * 86400_000));
          wsum += w; vsum += w * p.value;
        }
        const after = this.clamp(vsum / wsum);
        out.push({ id, before, after });
      }
    };
    record(m.teamA, rb, m.scoreA);
    record(m.teamB, ra, 1 - m.scoreA);
    for (const c of out) this.ratings.set(c.id, c.after);
    return out;
  }
}

/** Ratings only change through imports and manual adjustments. */
export class ManualModel extends BaseModel {
  rateMatch(): RatingChange[] { return []; }
}
