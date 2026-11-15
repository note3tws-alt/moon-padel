import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps /admin behind a sign-in. The admin layout re-checks the user against
 * public.users on every request; this is the first, cheap gate and also
 * refreshes Supabase sessions.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";
  const res = NextResponse.next({ request: req });
  let signedIn = false;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } else {
    signedIn = Boolean(req.cookies.get("mp_admin")?.value);
  }

  if (!signedIn && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  if (!signedIn && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
