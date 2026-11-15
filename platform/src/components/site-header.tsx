"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "./brand";
import { AccountButton, useMe } from "./account-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/players", label: "Players" },
  { href: "/rules", label: "Rankings & Rules" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const me = useMe();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-space/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="MoonPadel home" onClick={() => setOpen(false)}><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("relative rounded-full px-4 py-2 text-[13px] font-semibold uppercase tracking-wider transition", active(n.href) ? "text-white" : "text-muted hover:text-silver")}>
              {active(n.href) && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/[0.06] ring-1 ring-line" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AccountButton me={me} />
          <button className="rounded-lg p-2 text-silver lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line lg:hidden" aria-label="Mobile">
            <div className="container-page flex flex-col py-3">
              {[...NAV, me.signedIn ? { href: "/account", label: "My profile" } : { href: "/login", label: "Player login" }].map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wider", active(n.href) ? "bg-white/5 text-white" : "text-muted")}>{n.label}</Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
