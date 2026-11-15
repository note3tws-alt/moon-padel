"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "../brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/upload", label: "Upload data" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/matches", label: "Matches & results" },
  { href: "/admin/leaderboard", label: "Leaderboard management" },
  { href: "/admin/divisions", label: "Divisions" },
  { href: "/admin/clubs", label: "Clubs / venues" },
  { href: "/admin/pairs", label: "Fixed pairs" },
  { href: "/admin/scoring", label: "Scoring settings" },
  { href: "/admin/settings", label: "Website settings" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminSidebar({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={cn("rounded-lg px-3 py-2 text-sm font-semibold transition", isActive(n.href) ? "bg-electric/15 text-white ring-1 ring-electric/30" : "text-muted hover:bg-white/5 hover:text-silver")}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-space/90 px-4 backdrop-blur lg:hidden">
        <Link href="/admin"><Logo /></Link>
        <button className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Close" : "Menu"}</button>
      </div>
      {open && <div className="border-b border-line bg-night p-3 lg:hidden">{nav}</div>}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-night/60 p-4 lg:flex">
        <Link href="/admin" className="mb-6 px-2 pt-2"><Logo /></Link>
        <p className="label mb-2 px-3">Admin</p>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 border-t border-line pt-4">
          <Link href="/" className="block rounded-lg px-3 py-2 text-sm text-muted hover:text-silver" target="_blank">View public site ↗</Link>
          <p className="truncate px-3 py-1 text-xs text-muted">{email}</p>
          <form action={signOut}><button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-white/5 hover:text-silver">Sign out</button></form>
        </div>
      </aside>
    </>
  );
}
