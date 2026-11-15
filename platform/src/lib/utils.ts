import { clsx, type ClassValue } from "clsx";

export function cn(...v: ClassValue[]) {
  return clsx(v);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

/** Returns a slug not present in `taken`, adding -2, -3... when needed. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const s = slugify(base);
  if (!taken.has(s)) { taken.add(s); return s; }
  let i = 2;
  while (taken.has(`${s}-${i}`)) i++;
  taken.add(`${s}-${i}`);
  return `${s}-${i}`;
}

export function flagEmoji(code?: string | null): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  const c = code.toUpperCase();
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "–";
  return n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtRating(n: number | null | undefined, visible = true, decimals = 2): string {
  if (n == null || !visible) return "–";
  return n.toFixed(decimals);
}

export function winPct(wins: number, matches: number): string {
  if (!matches) return "–";
  return `${Math.round((wins / matches) * 100)}%`;
}

export function fmtDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return date.toLocaleDateString("en-GB", { timeZone: "Asia/Dubai", ...opts });
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "–";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function fmtMonth(period: string): string {
  return new Date(`${period.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function currentPeriod(now = new Date()): string {
  const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function todayDubai(now = new Date()): string {
  const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export const FORMAT_LABELS: Record<string, string> = {
  ladder: "Ladder",
  americano: "Americano",
  mexicano: "Mexicano",
  round_robin: "Round robin",
  groups_knockout: "Groups + knockout",
  knockout: "Knockout",
};
export const PAIR_TYPE_LABELS: Record<string, string> = { fixed: "Fixed pairs", non_fixed: "Non-fixed pairs" };
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  registration_open: "Registration open",
  full: "Full",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Parses "6-4, 3-6, 10-8" or "6-4 6-3" into [[6,4],[3,6],[10,8]]. */
export function parseSetScores(input: string): number[][] | null {
  const parts = input.trim().split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return null;
  const sets: number[][] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})\s*[-:\/]\s*(\d{1,2})$/);
    if (!m) return null;
    sets.push([Number(m[1]), Number(m[2])]);
  }
  return sets;
}

export function summariseSets(sets: number[][]): { gamesA: number; gamesB: number; setsA: number; setsB: number; winner: "A" | "B" | "D" } {
  let gamesA = 0, gamesB = 0, setsA = 0, setsB = 0;
  for (const [a, b] of sets) {
    gamesA += a; gamesB += b;
    if (a > b) setsA++; else if (b > a) setsB++;
  }
  const winner = setsA > setsB ? "A" : setsB > setsA ? "B" : gamesA > gamesB ? "A" : gamesB > gamesA ? "B" : "D";
  return { gamesA, gamesB, setsA, setsB, winner };
}

export function setsToString(sets: unknown): string {
  if (!Array.isArray(sets)) return "";
  return sets.map((s) => (Array.isArray(s) ? `${s[0]}-${s[1]}` : "")).join(", ");
}
