import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "./db";
import { supabaseAuthConfigured } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

export const LOCAL_SESSION_COOKIE = "mp_admin";
const SESSION_HOURS = 12;

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "editor";
}

export function authMode(): "supabase" | "local" | "none" {
  if (supabaseAuthConfigured()) return "supabase";
  if (localAuthAllowed()) return "local";
  return "none";
}

export function localAuthAllowed() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) return false;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_AUTH === "true";
}

function secretKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function createLocalSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
  const store = await cookies();
  store.set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function verifyLocalToken(token: string | undefined): Promise<string | null> {
  if (!token || !localAuthAllowed()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function lookup(where: { id?: string; email?: string }): Promise<AdminUser | null> {
  const db = sql();
  const rows = where.id
    ? await db`select id, email, display_name, role from users where id = ${where.id}`
    : await db`select id, email, display_name, role from users where email = ${where.email!}`;
  const u = rows[0];
  return u ? { id: u.id, email: u.email, displayName: u.display_name, role: u.role } : null;
}

/** Returns the signed-in administrator, or null. */
export async function getAdmin(): Promise<AdminUser | null> {
  const mode = authMode();
  if (mode === "supabase") {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    // Match on auth user id first, then on email (lets you add admins by email before they first sign in).
    const byId = await lookup({ id: data.user.id });
    if (byId) return byId;
    if (data.user.email) {
      const byEmail = await lookup({ email: data.user.email });
      if (byEmail) {
        await sql()`update users set id = ${data.user.id} where id = ${byEmail.id}`;
        return { ...byEmail, id: data.user.id };
      }
    }
    return null;
  }
  if (mode === "local") {
    const store = await cookies();
    const uid = await verifyLocalToken(store.get(LOCAL_SESSION_COOKIE)?.value);
    return uid ? lookup({ id: uid }) : null;
  }
  return null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Not authorised. Please sign in again.");
  return admin;
}
