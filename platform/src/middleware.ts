import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PRIVATE = "private, no-store, max-age=0";

/**
 * Admin: keeps /admin behind a sign-in. The admin layout re-checks the user
 * against public.users on every request (a signed-in player is NOT an admin);
 * this is the first, cheap gate and also refreshes Supabase sessions.
 *
 * Players: refreshes the Supabase session on the player pages, sends signed-out
 * visitors from /account to /login, and marks these per-person pages as never
 * cacheable so a CDN can never serve one player's page to someone else.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const res = NextResponse.next({ request: req });
  res.headers.set("Cache-Control", PRIVATE);
  let signedIn = false;
  const supabaseOn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (supabaseOn) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } else if (isAdminArea) {
    signedIn = Boolean(req.cookies.get("mp_admin")?.value);
  }

  const redirectTo = (path: string, next: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    url.searchParams.set("next", next);
    const r = NextResponse.redirect(url);
    r.headers.set("Cache-Control", PRIVATE);
    return r;
  };

  if (isAdminArea) {
    if (!signedIn && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authorised" }, { status: 401, headers: { "Cache-Control": PRIVATE } });
    }
    if (!signedIn && pathname !== "/admin/login") return redirectTo("/admin/login", pathname);
    return res;
  }

  if (pathname.startsWith("/account") && supabaseOn && !signedIn) return redirectTo("/login", pathname);
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*", "/account/:path*", "/account", "/login"] };
