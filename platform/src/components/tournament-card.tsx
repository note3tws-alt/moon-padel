import Link from "next/link";
import { DivisionBadge } from "./brand";
import { StatusChip } from "./ui";
import { FORMAT_LABELS, PAIR_TYPE_LABELS, fmtDate, fmtTime } from "@/lib/utils";

export interface TournamentCardData {
  slug: string; name: string; tournament_date: string; start_time: string | null; duration_minutes: number | null;
  format: string; pair_type: string; max_players: number | null; status: string; registered: number;
  club_name: string | null; division_code: string | null; division_name: string | null; entry_fee?: number | null; currency?: string;
}

export function TournamentCard({ t }: { t: TournamentCardData }) {
  const pct = t.max_players ? Math.min(100, Math.round((t.registered / t.max_players) * 100)) : 0;
  const d = new Date(`${t.tournament_date}T12:00:00Z`);
  return (
    <Link href={`/tournaments/${t.slug}`} className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-electric/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-space/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ice">{d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
            <span className="text-xl font-extrabold leading-none">{d.getUTCDate()}</span>
          </div>
          <div>
            <h3 className="font-bold leading-tight group-hover:text-white">{t.name}</h3>
            <p className="mt-1 text-xs text-muted">{fmtDate(t.tournament_date, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(t.start_time)}{t.duration_minutes ? ` · ${t.duration_minutes} min` : ""}</p>
          </div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div><dt className="text-muted">Venue</dt><dd className="font-semibold">{t.club_name ?? "To be confirmed"}</dd></div>
        <div><dt className="text-muted">Division</dt><dd className="mt-0.5"><DivisionBadge code={t.division_code} /></dd></div>
        <div><dt className="text-muted">Format</dt><dd className="font-semibold">{FORMAT_LABELS[t.format] ?? t.format}</dd></div>
        <div><dt className="text-muted">Pairs</dt><dd className="font-semibold">{PAIR_TYPE_LABELS[t.pair_type]}</dd></div>
      </dl>
      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold tabular-nums">{t.registered}{t.max_players ? ` / ${t.max_players}` : ""} players</span>
          <StatusChip status={t.status} />
        </div>
        {t.max_players ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Registration">
            <div className="h-full rounded-full bg-gradient-to-r from-court to-electric" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
