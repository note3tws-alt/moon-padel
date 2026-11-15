import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DivisionBadge, MoonMark } from "@/components/brand";
import { Avatar, Flag, ResultPill, StatTile } from "@/components/ui";
import { StateForm, Submit } from "@/components/account/state-form";
import { sql } from "@/lib/db";
import { COUNTRIES, countryName } from "@/lib/countries";
import { getPlayerProfile } from "@/lib/queries";
import {
  getLastDecidedClaim, getLinkedPlayer, getPendingClaim, getPlayerUser, linkByVerifiedEmail, searchClaimablePlayers, type PlayerUser,
} from "@/lib/player-auth";
import { fmtDate, fmtNumber, fmtRating, fmtTime, setsToString, todayDubai, winPct } from "@/lib/utils";
import { signOutPlayer } from "../login/actions";
import { cancelClaim, submitClaim, updateMyProfile } from "./actions";

export const metadata: Metadata = { title: "My profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getPlayerUser();
  if (!user) redirect("/login?next=/account");
  const linked = (await getLinkedPlayer(user.id)) ?? (await linkByVerifiedEmail(user));
  const { q } = await searchParams;

  return (
    <main className="container-page py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">My MoonPadel</p>
          <p className="mt-1 text-sm text-muted">Signed in as <span className="text-silver">{user.email ?? user.name ?? "player"}</span></p>
        </div>
        <form action={signOutPlayer}><button className="btn-ghost btn-sm">Sign out</button></form>
      </div>
      {linked ? <LinkedView slug={linked.slug} /> : <ClaimView user={user} q={q ?? ""} />}
    </main>
  );
}

// ------------------------------------------------------------- linked player
async function LinkedView({ slug }: { slug: string }) {
  const data = await getPlayerProfile(slug);
  if (!data) return null;
  const { player: p, matches, tournaments } = data;
  const [priv] = await sql()`select phone from player_private where player_id = ${p.id}`;
  const upcoming = await sql()`
    select t.name, t.slug, t.tournament_date, t.start_time, r.status, c.name as club_name
    from tournament_registrations r join tournaments t on t.id = r.tournament_id left join clubs c on c.id = t.club_id
    where r.player_id = ${p.id} and r.status <> 'withdrawn' and t.status <> 'draft' and t.status <> 'cancelled' and t.tournament_date >= ${todayDubai()}
    order by t.tournament_date, t.start_time nulls last limit 6`;

  return (
    <>
      <section className="card overflow-hidden">
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-night-fade opacity-80" aria-hidden />
          <div className="relative"><Avatar name={p.full_name} src={p.photo_url} size={104} ring /></div>
          <div className="relative flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <DivisionBadge code={p.division_code} name={p.division_name} size="md" />
              <span className="chip text-muted">ID {p.player_code}</span>
            </div>
            <h1 className="h-display mt-3 text-4xl sm:text-5xl">{p.full_name}</h1>
            <p className="mt-2 text-sm text-muted">
              {p.country_code && <><Flag code={p.country_code} className="mr-1.5" />{countryName(p.country_code)}</>}
              {p.playing_side && <> · Plays {p.playing_side === "both" ? "both sides" : `${p.playing_side} side`}</>}
            </p>
            <Link href={`/players/${p.slug}`} className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-ice hover:text-white">View my public profile →</Link>
          </div>
          <div className="relative grid grid-cols-2 gap-6 text-right sm:grid-cols-1">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Rating</p>
              <p className="text-gradient-padel text-4xl font-extrabold tabular-nums">{fmtRating(p.rating, p.rating_visible)}</p>
              {!p.rating_visible && <p className="text-[11px] text-muted">Shown after more matches</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Ranking</p>
              <p className="text-4xl font-extrabold tabular-nums">{p.overall_rank ? `#${p.overall_rank}` : "–"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total points" value={fmtNumber(p.total_points)} accent />
        <StatTile label="Matches" value={p.matches} />
        <StatTile label="Won" value={p.wins} />
        <StatTile label="Lost" value={p.losses} />
        <StatTile label="Win %" value={winPct(p.wins, p.matches)} />
        <StatTile label="Tournaments" value={p.tournaments} hint={p.podiums ? `${p.podiums} podium${p.podiums > 1 ? "s" : ""}` : undefined} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-4 font-bold">My upcoming tournaments</h2>
          {upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((t) => (
                <li key={t.slug}>
                  <Link href={`/tournaments/${t.slug}`} className="block rounded-xl border border-line px-3 py-2 text-sm hover:border-electric/40">
                    <span className="font-bold">{t.name}</span>
                    <span className="block text-xs text-muted">{fmtDate(t.tournament_date)}{t.start_time ? ` · ${fmtTime(t.start_time)}` : ""}{t.club_name ? ` · ${t.club_name}` : ""}{t.status === "waitlist" ? " · Waitlist" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">You are not entered in an upcoming tournament. <Link href="/tournaments" className="text-ice hover:text-white">See what is coming up</Link>.</p>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Recent matches</h2>
          {matches.length ? (
            <ul className="space-y-2 text-sm">
              {matches.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block truncate">{m.tournament_name}</span><span className="text-xs text-muted">{fmtDate(m.tournament_date)} · {setsToString(m.set_scores)}</span></span>
                  <ResultPill won={m.winner === m.team} draw={m.winner === "D"} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Your matches show here once results are published.</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Tournament finishes</h2>
          {tournaments.length ? (
            <ul className="space-y-2 text-sm">
              {tournaments.slice(0, 6).map((t) => (
                <li key={t.slug} className="flex items-center justify-between gap-3">
                  <Link href={`/tournaments/${t.slug}`} className="min-w-0 truncate hover:text-white">{t.name}</Link>
                  <span className={`shrink-0 font-bold tabular-nums ${t.final_position === 1 ? "text-gold" : ""}`}>{t.final_position ? `#${t.final_position}` : "–"}<span className="ml-2 font-normal text-ice">{fmtNumber(t.total_points)} pts</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No finished tournaments yet.</p>}
        </div>
      </section>

      <section className="card mt-6 p-6">
        <h2 className="font-bold">Edit my profile</h2>
        <p className="mt-1 text-sm text-muted">Your name, division, rating and results are managed by MoonPadel. Message us on WhatsApp if something needs fixing.</p>
        <StateForm action={updateMyProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Country (flag)</span>
            <select name="country" defaultValue={p.country_code ?? ""} className="select">
              <option value="">Not set</option>
              {Object.entries(COUNTRIES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Nationality</span>
            <input name="nationality" defaultValue={p.nationality ?? ""} maxLength={60} className="input" placeholder="Optional" />
          </label>
          <label className="block">
            <span className="field-label">Playing side</span>
            <select name="playing_side" defaultValue={p.playing_side ?? ""} className="select">
              <option value="">Not set</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Phone (private)</span>
            <input name="phone" type="tel" defaultValue={priv?.phone ?? ""} maxLength={30} className="input" placeholder="+971 ..." />
            <span className="mt-1 block text-[11px] text-muted">Only MoonPadel admins see this. It is never shown on the site.</span>
          </label>
          <div className="sm:col-span-2">
            <span className="field-label">Profile photo</span>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={p.full_name} src={p.photo_url} size={56} />
              <input name="photo_file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm text-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-silver" />
              {p.photo_url && <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="remove_photo" className="accent-electric" /> Remove photo</label>}
            </div>
            <span className="mt-1 block text-[11px] text-muted">PNG, JPG or WebP, under 3 MB. A clear face photo works best. This photo is public.</span>
          </div>
          <div className="sm:col-span-2 flex justify-end"><Submit>Save profile</Submit></div>
        </StateForm>
      </section>
    </>
  );
}

// ----------------------------------------------------------- not linked yet
async function ClaimView({ user, q }: { user: PlayerUser; q: string }) {
  const [pending, rejected] = await Promise.all([getPendingClaim(user.id), getLastDecidedClaim(user.id)]);

  if (pending) {
    return (
      <section className="card mx-auto max-w-xl p-8 text-center">
        <MoonMark size={64} phase="half" glow className="mx-auto" />
        <h1 className="h-display mt-6 text-3xl">Request sent</h1>
        <p className="mt-3 text-sm text-muted">
          {pending.player_id
            ? <>You asked to connect <span className="text-silver">{pending.full_name}</span> ({pending.player_code}) to this account.</>
            : <>You asked to be added as <span className="text-silver">{pending.requested_name}</span>.</>}
          {" "}An admin will check it and connect your profile. Sent {fmtDate(pending.created_at)}.
        </p>
        <form action={cancelClaim} className="mt-6"><button className="btn-ghost btn-sm">Cancel request</button></form>
      </section>
    );
  }

  const results = q ? await searchClaimablePlayers(q) : [];
  const suggestedName = user.name ?? "";

  return (
    <section className="mx-auto max-w-2xl">
      <div className="text-center">
        <MoonMark size={64} phase="crescent" glow className="mx-auto" />
        <h1 className="h-display mt-6 text-3xl sm:text-4xl">Find your player profile</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted">Search for your name, pick your profile and send a request. An admin checks every request before connecting it, so nobody can take over someone else&apos;s profile.</p>
      </div>
      {rejected && (
        <p className="mt-6 rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-[#f2a08c]">
          Your last request{rejected.full_name ? ` for ${rejected.full_name}` : ""} was not approved.{rejected.decision_note ? ` Note from MoonPadel: ${rejected.decision_note}` : ""}
        </p>
      )}

      <form className="card mt-8 flex gap-2 p-3" role="search">
        <input name="q" defaultValue={q} minLength={2} placeholder="Your name or player ID" className="input" aria-label="Search players" />
        <button className="btn-primary shrink-0">Search</button>
      </form>

      {q && (
        <div className="mt-4 space-y-2">
          {results.length ? results.map((r) => (
            <StateForm key={r.id} action={submitClaim} className="card flex flex-wrap items-center gap-4 p-4">
              <input type="hidden" name="player_id" value={r.id} />
              <Avatar name={r.full_name} src={r.photo_url} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-bold"><Flag code={r.country_code} className="mr-1.5" />{r.full_name}</p>
                <p className="text-xs text-muted">ID {r.player_code}{r.division_code ? ` · ${r.division_code} ${r.division_name}` : ""}</p>
              </div>
              <Submit className="btn-primary btn-sm" pendingText="Sending…">This is me</Submit>
            </StateForm>
          )) : <p className="card p-5 text-center text-sm text-muted">No free profile matches &ldquo;{q}&rdquo;. If you have played with us, try another spelling, or ask to be added below.</p>}
        </div>
      )}

      <div className="card mt-8 p-6">
        <h2 className="font-bold">Not on the list yet?</h2>
        <p className="mt-1 text-sm text-muted">New players are added by MoonPadel. Send your name and we will set up your profile.</p>
        <StateForm action={submitClaim} className="mt-4 grid gap-3">
          <label className="block"><span className="field-label">Full name</span><input name="requested_name" required minLength={2} maxLength={120} defaultValue={suggestedName} className="input" /></label>
          <label className="block"><span className="field-label">Anything we should know? (optional)</span><textarea name="message" maxLength={500} rows={3} className="input" placeholder="For example your level or where you usually play" /></label>
          <div className="flex justify-end"><Submit pendingText="Sending…">Ask to be added</Submit></div>
        </StateForm>
      </div>
    </section>
  );
}
