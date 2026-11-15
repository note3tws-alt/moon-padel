import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/player-auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OTP_TYPES = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

/**
 * Finishes a player sign-in. Handles both:
 *   ?code=...                      Google, and email links opened in the same browser (PKCE)
 *   ?token_hash=...&type=email     email links from the recommended template (work on any device)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) => {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", reason);
    if (next !== "/account") to.searchParams.set("next", next);
    return NextResponse.redirect(to, { headers: { "Cache-Control": "private, no-store" } });
  };

  if (url.searchParams.get("error")) return fail("callback");

  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link");
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (error) return fail("link");
  } else {
    return fail("callback");
  }
  return NextResponse.redirect(new URL(next, url.origin), { headers: { "Cache-Control": "private, no-store" } });
}
