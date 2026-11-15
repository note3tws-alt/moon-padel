import "server-only";
import { headers } from "next/headers";
import { sql, type Sql, type Tx } from "./db";
import { supabaseAuthConfigured } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

/** A signed-in person on the public site (player side). Never an admin check. */
export interface PlayerUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export interface LinkedPlayer {
  id: string;
  slug: string;
  full_name: string;
  player_code: string;
  photo_url: string | null;
  country_code: string | null;
  nationality: string | null;
  playing_side: string | null;
  linked_via: string;
}

/** Which sign-in methods the player login page offers. Each one must also be switched on in Supabase. */
export function playerLoginMethods() {
  const on = supabaseAuthConfigured();
  return {
    google: on && process.env.PLAYER_LOGIN_GOOGLE === "true",
    email: on && process.env.PLAYER_LOGIN_EMAIL === "true",
  };
}

export function playerLoginEnabled() {
  const m = playerLoginMethods();
  return m.google || m.email;
}

/** The signed-in player, verified with Supabase Auth (not just read from the cookie). */
export async function getPlayerUser(): Promise<PlayerUser | null> {
  if (!supabaseAuthConfigured()) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? null,
    emailVerified: Boolean(u.email_confirmed_at),
    name: typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
}

export async function getLinkedPlayer(userId: string, db: Sql | Tx = sql()): Promise<LinkedPlayer | null> {
  const [row] = await db`
    select p.id, p.slug, p.full_name, p.player_code, p.photo_url, p.country_code, p.nationality, p.playing_side, a.linked_via
    from player_accounts a join players p on p.id = a.player_id
    where a.auth_user_id = ${userId}`;
  return (row as unknown as LinkedPlayer) ?? null;
}

/**
 * Invite by email: if an admin stored this verified email on exactly one
 * player who has no account yet, connect them. Returns the player or null.
 */
export async function linkByVerifiedEmail(user: Pick<PlayerUser, "id" | "email" | "emailVerified">, db: Sql = sql()): Promise<LinkedPlayer | null> {
  if (!user.email || !user.emailVerified) return null;
  const linked = await db.begin(async (tx) => {
    const existing = await getLinkedPlayer(user.id, tx);
    if (existing) return existing;
    const matches = await tx`
      select pp.player_id from player_private pp
      join players p on p.id = pp.player_id
      where pp.email = ${user.email} and p.status = 'active'
        and not exists (select 1 from player_accounts a where a.player_id = pp.player_id)
      for update of pp`;
    if (matches.length !== 1) return null;
    const inserted = await tx`
      insert into player_accounts (auth_user_id, player_id, email, linked_via)
      values (${user.id}, ${matches[0].player_id}, ${user.email}, 'email_match')
      on conflict do nothing returning player_id`;
    if (!inserted.length) return null;
    await tx`update player_claims set status = 'cancelled', decided_at = now(), decision_note = 'Linked by matching email'
             where auth_user_id = ${user.id} and status = 'pending'`;
    return getLinkedPlayer(user.id, tx);
  });
  return linked;
}

/** Open claim for this sign-in, if any. */
export async function getPendingClaim(userId: string) {
  const [row] = await sql()`
    select c.id, c.player_id, c.requested_name, c.message, c.created_at, p.full_name, p.slug, p.player_code
    from player_claims c left join players p on p.id = c.player_id
    where c.auth_user_id = ${userId} and c.status = 'pending'`;
  return row ?? null;
}

export async function getLastDecidedClaim(userId: string) {
  const [row] = await sql()`
    select c.status, c.decision_note, c.decided_at, p.full_name
    from player_claims c left join players p on p.id = c.player_id
    where c.auth_user_id = ${userId} and c.status = 'rejected'
    order by c.decided_at desc nulls last limit 1`;
  return row ?? null;
}

/** Active players a person can claim: public fields only, and never profiles that already have an account. */
export async function searchClaimablePlayers(q: string) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  return sql()`
    select p.id, p.full_name, p.slug, p.player_code, p.country_code, p.photo_url, d.code as division_code, d.name as division_name, d.sort_order
    from players p left join divisions d on d.id = p.division_id
    where p.status = 'active'
      and (lower(p.full_name) like ${`%${term}%`} or lower(p.player_code) = ${term})
      and not exists (select 1 from player_accounts a where a.player_id = p.id)
    order by p.full_name limit 12`;
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: unknown, fallback = "/account"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/api") || next.startsWith("/auth")) return fallback;
  return next;
}

/** Public origin for auth redirect links. Uses NEXT_PUBLIC_SITE_URL when set, so the link matches Supabase's allow list. */
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !env.includes("localhost")) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
