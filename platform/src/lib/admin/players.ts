import "server-only";
import type { Tx } from "../db";
import { slugify } from "../utils";

export async function nextPlayerCode(tx: Tx): Promise<string> {
  const [r] = await tx`select coalesce(max((regexp_match(player_code, '^MP-(\\d+)$'))[1]::int), 0) as n from players`;
  return `MP-${String(Number(r.n) + 1).padStart(4, "0")}`;
}

export async function uniquePlayerSlug(tx: Tx, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  const rows = await tx`select slug from players where (slug = ${base} or slug like ${base + "-%"}) ${excludeId ? tx`and id <> ${excludeId}` : tx``}`;
  const taken = new Set(rows.map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function uniqueSlugFor(tx: Tx, table: "tournaments" | "clubs" | "pairs", name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  const rows = await tx`select slug from ${tx(table)} where (slug = ${base} or slug like ${base + "-%"}) ${excludeId ? tx`and id <> ${excludeId}` : tx``}`;
  const taken = new Set(rows.map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
