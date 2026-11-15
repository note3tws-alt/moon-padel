"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authMode, createLocalSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1), next: z.string().optional() });

export async function login(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string } | null> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;
  const next = parsed.data.next?.startsWith("/admin") ? parsed.data.next : "/admin";
  const mode = authMode();

  if (mode === "supabase") {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: "Email or password is incorrect." };
    // Email fallback only for verified addresses (players can sign up themselves).
    const verifiedEmail = data.user.email_confirmed_at ? email : null;
    const [admin] = await sql()`select id from users where id = ${data.user.id} or (${verifiedEmail}::citext is not null and email = ${verifiedEmail}) limit 1`;
    if (!admin) {
      await supabase.auth.signOut();
      return { error: "This account is not an administrator." };
    }
    await sql()`update users set last_login_at = now() where id = ${admin.id}`;
    redirect(next);
  }
  if (mode === "local") {
    const [user] = await sql()`select id, password_hash from users where email = ${email}`;
    // Constant-ish time: always run the hash check.
    const ok = verifyPassword(password, user?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    if (!user || !ok) return { error: "Email or password is incorrect." };
    await createLocalSession(user.id);
    await sql()`update users set last_login_at = now() where id = ${user.id}`;
    redirect(next);
  }
  return { error: "Sign-in is not configured. Set the Supabase keys (see README)." };
}

export async function logout() {
  if (authMode() === "supabase") {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  const { cookies } = await import("next/headers");
  (await cookies()).delete("mp_admin");
  redirect("/admin/login");
}
