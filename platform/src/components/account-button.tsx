"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn, initials } from "@/lib/utils";

type Me = { signedIn: boolean; name?: string | null; photo?: string | null };

/**
 * Login / My profile button. Public pages stay fully cached, so the signed-in
 * state is looked up in the browser. Visitors without a Supabase session
 * cookie never call the server.
 */
export function useMe() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me>({ signedIn: false });
  useEffect(() => {
    if (!/(^|;\s*)sb-[^=]+-auth-token/.test(document.cookie)) { setMe({ signedIn: false }); return; }
    let live = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((d: Me) => { if (live) setMe(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);
  return me;
}

export function AccountButton({ me, className }: { me: Me; className?: string }) {
  if (!me.signedIn) {
    return <Link href="/login" className={cn("btn-primary btn-sm", className)}>Login</Link>;
  }
  const label = me.name ? me.name.split(" ")[0] : "My profile";
  return (
    <Link href="/account" className={cn("btn-ghost btn-sm !pl-1.5", className)} aria-label="My profile">
      <span className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-court to-night-3 text-[10px] font-bold text-ice">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {me.photo ? <img src={me.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials(me.name ?? "Me")}
      </span>
      <span className="max-w-[9rem] truncate">{label}</span>
    </Link>
  );
}
