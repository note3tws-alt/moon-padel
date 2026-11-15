"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { playerLoginMethods, safeNext, siteOrigin } from "@/lib/player-auth";
import { supabaseServer } from "@/lib/supabase/server";

export type EmailState = { sent?: boolean; email?: string; error?: string } | null;

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithGoogle(fd: FormData) {
  const next = safeNext(fd.get("next"));
  if (!playerLoginMethods().google) redirect("/login?error=method");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await siteOrigin(), next), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email(), next: z.string().optional() });

export async function sendEmailLink(_prev: EmailState, fd: FormData): Promise<EmailState> {
  if (!playerLoginMethods().email) return { error: "Email sign-in is not switched on yet." };
  const parsed = emailSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const { email } = parsed.data;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(await siteOrigin(), safeNext(parsed.data.next)), shouldCreateUser: true },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate") || error.status === 429) return { error: "Too many emails were sent just now. Wait a minute and try again.", email };
    if (msg.includes("signup") || msg.includes("not allowed")) return { error: "New player accounts are not open yet. Please check back soon.", email };
    console.error("signInWithOtp", error);
    return { error: "We could not send the email. Please try again.", email };
  }
  return { sent: true, email };
}

const codeSchema = z.object({ email: z.string().trim().toLowerCase().email(), token: z.string().trim().regex(/^\d{6,10}$/), next: z.string().optional() });

export async function verifyEmailCode(_prev: EmailState, fd: FormData): Promise<EmailState> {
  const parsed = codeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { sent: true, email: String(fd.get("email") ?? ""), error: "Enter the code from the email." };
  const { email, token } = parsed.data;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { sent: true, email, error: "That code is wrong or has expired. Ask for a new email." };
  redirect(safeNext(parsed.data.next));
}

export async function signOutPlayer() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
