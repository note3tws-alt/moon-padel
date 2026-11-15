import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, flagEmoji, initials, STATUS_LABELS } from "@/lib/utils";
import { countryName } from "@/lib/countries";

export function Flag({ code, className }: { code?: string | null; className?: string }) {
  const f = flagEmoji(code);
  if (!f) return null;
  return <span className={cn("leading-none", className)} title={countryName(code)} aria-label={countryName(code)} role="img">{f}</span>;
}

export function Avatar({ name, src, size = 40, ring = false, gold = false }: { name: string; src?: string | null; size?: number; ring?: boolean; gold?: boolean }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-court to-night-3 font-bold text-ice",
        ring && "ring-2 ring-electric/60 ring-offset-2 ring-offset-space", gold && "ring-2 ring-gold ring-offset-2 ring-offset-space")}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? <Image src={src} alt={name} fill sizes={`${size}px`} className="object-cover" unoptimized /> : initials(name)}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="label mb-2">{eyebrow}</p>}
        <h2 className="h-display text-2xl sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-2 text-3xl font-extrabold tracking-tightish tabular-nums", accent && "text-gradient-padel")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 h-12 w-12 rounded-full border border-dashed border-ice/30" aria-hidden />
      <p className="font-bold">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const statusStyle: Record<string, string> = {
  registration_open: "border-electric/40 text-ice bg-electric/10",
  full: "border-ice/40 text-ice bg-ice/10",
  upcoming: "border-line text-silver",
  in_progress: "border-electric/60 text-white bg-electric/20",
  completed: "border-line text-muted",
  cancelled: "border-loss/40 text-[#f2a08c]",
  draft: "border-dashed border-line text-muted",
};
export function StatusChip({ status }: { status: string }) {
  return <span className={cn("chip", statusStyle[status] ?? "border-line")}>{status === "in_progress" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric" />}{STATUS_LABELS[status] ?? status}</span>;
}

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-muted">Showing {(page - 1) * pageSize + 1} to {Math.min(total, page * pageSize)} of {total}</p>
      <div className="flex items-center gap-1">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>Prev</PageLink>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <PageLink href={hrefFor(n)} active={n === page}>{n}</PageLink>
          </span>
        ))}
        <PageLink href={hrefFor(page + 1)} disabled={page >= pages}>Next</PageLink>
      </div>
    </nav>
  );
}
function PageLink({ href, children, active, disabled }: { href: string; children: ReactNode; active?: boolean; disabled?: boolean }) {
  if (disabled) return <span className="rounded-lg px-3 py-1.5 text-muted/50">{children}</span>;
  return <Link href={href} scroll={false} className={cn("rounded-lg px-3 py-1.5 font-semibold transition", active ? "bg-electric text-white" : "text-silver hover:bg-white/5")}>{children}</Link>;
}

export function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "bg-gold text-space" : rank === 2 ? "bg-silver/90 text-space" : rank === 3 ? "bg-[#B07A4A] text-space" : "";
  return (
    <span className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums", medal || "text-muted")}>{rank}</span>
  );
}

export function ResultPill({ won, draw }: { won: boolean; draw?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold", draw ? "bg-muted/20 text-muted" : won ? "bg-electric/20 text-ice" : "bg-loss/15 text-[#f2a08c]")} title={draw ? "Draw" : won ? "Win" : "Loss"}>
      {draw ? "D" : won ? "W" : "L"}
    </span>
  );
}
