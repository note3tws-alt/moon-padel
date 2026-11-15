import { isDatabaseConfigured } from "@/lib/db";
import { DivisionBadge } from "@/components/brand";
import { getRulesData } from "@/lib/queries";

const TIE_LABELS: Record<string, string> = { points: "Points", wins: "Wins", winPct: "Win percentage", gameDiff: "Game difference", rating: "Rating", fewerTournaments: "Fewer tournaments played", moreTournaments: "More tournaments played" };
const FINISH_LABELS: Record<string, string> = { winPoints: "Win points", totalPoints: "Total match points", gameDiff: "Game difference", gamesWon: "Games won", wins: "Wins", rating: "Rating" };
const METHOD_TEXT: Record<string, string> = {
  elo: "Ratings use a team Elo model: before each match the system compares the average rating of both teams, and the result moves every player up or down. Beating a stronger team earns more than beating a weaker one.",
  weighted: "Ratings are a time-weighted average of recent match performances, so recent results count more than older ones.",
  manual: "Ratings are set by the organisers and do not change automatically after matches.",
};

export default async function RulesPage() {
  if (!isDatabaseConfigured()) return null; // the layout shows the setup message
  const { config, rulesetName, divisions, rules } = await getRulesData();
  const mults = Object.entries(config.points.courtMultipliers).filter(([k]) => k !== "default").sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <main className="container-page py-12">
      <p className="label">How it works</p>
      <h1 className="h-display mt-3 text-4xl sm:text-5xl">Rankings & Rules</h1>
      {rules.intro && <p className="mt-4 max-w-3xl text-muted">{rules.intro}</p>}
      {/not official/i.test(rulesetName) && (
        <p className="mt-4 inline-block rounded-xl border border-electric/30 bg-court/20 px-4 py-2 text-xs font-semibold text-ice">Current ruleset: {rulesetName}. Values may change before the official season.</p>
      )}

      <section className="mt-10">
        <h2 className="h-display mb-4 text-2xl">Divisions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {divisions.filter((d) => d.active).map((d) => (
            <div key={d.id} className="card p-5">
              <DivisionBadge code={d.code} name={d.name} sortOrder={d.sort_order} size="md" />
              {d.description && <p className="mt-3 text-sm text-muted">{d.description}</p>}
              {(d.min_rating != null || d.max_rating != null) && <p className="mt-2 text-xs text-ice">Rating band: {d.min_rating ?? "0"} to {d.max_rating ?? "max"}</p>}
              {(d.promote_top_n > 0 || d.relegate_bottom_n > 0) && <p className="mt-1 text-xs text-muted">Monthly review: top {d.promote_top_n} considered for promotion, bottom {d.relegate_bottom_n} for relegation.</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">Rating (RTG)</h2>
          <p className="text-sm text-muted">{METHOD_TEXT[config.rating.method]}</p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li>Scale: {config.rating.min} to {config.rating.max}, new players start at {config.rating.initial}.</li>
            <li>Shown publicly after {config.rating.visibleAfterMatches} matches and {config.rating.visibleAfterTournaments} tournament{config.rating.visibleAfterTournaments === 1 ? "" : "s"}.</li>
            {config.rating.method === "elo" && config.rating.provisional.matches > 0 && <li>Your first {config.rating.provisional.matches} matches move your rating faster while the system learns your level.</li>}
            {config.rating.method === "weighted" && <li>A match loses half its weight every {config.rating.weighted.halfLifeDays} days.</li>}
            <li>Ratings are recalculated after every published result.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">Points (PTS)</h2>
          <ul className="space-y-1.5 text-sm">
            <li>Match win: {config.points.win} · draw: {config.points.draw} · loss: {config.points.loss}</li>
            {config.points.perGameWon > 0 && <li>Each game won: {config.points.perGameWon}</li>}
            {mults.length > 0 && <li>Court multipliers: {mults.map(([c, m]) => `court ${c} ×${m}`).join(", ")}; other courts ×{config.points.courtMultipliers.default ?? 1}</li>}
            {config.points.placement.length > 0 && <li>Finishing position: {config.points.placement.map((p, i) => `${i + 1}${["st", "nd", "rd"][i] ?? "th"} ${p}`).join(", ")}</li>}
            {config.points.participation > 0 && <li>Participation: {config.points.participation} per tournament</li>}
            <li>Tournament finish order: {config.tournament.finishOrder.map((k) => FINISH_LABELS[k]).join(", then ")}.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">Monthly and all-time rankings</h2>
          <ul className="space-y-1.5 text-sm">
            <li>Monthly ranking: your best {config.standings.bestTournamentsMonthly || "all"} tournaments of the month count. Playing more can never lower your total.</li>
            <li>All-time ranking: your best {config.standings.bestTournamentsAllTime || "all"} tournaments count.</li>
            <li>Every month starts fresh. Past months stay in the archive, and the top player and pair of each division are crowned monthly champions.</li>
            <li>Ties are broken by: {config.standings.tieBreakers.map((k) => TIE_LABELS[k]).join(", then ")}.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 text-lg font-bold">Fixed and non-fixed pairs</h2>
          <p className="text-sm text-muted">Non-fixed events rank individuals. Fixed-pair events rank the pair on its own leaderboard{config.standings.individualIncludesFixedPairs ? " and also count towards individual points" : ", separately from individual points"}. Every match still counts towards each player&apos;s rating and match record.</p>
        </div>
      </section>

      {rules.sections.length > 0 && (
        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          {rules.sections.map((s, i) => (
            <div key={i} className="card p-6"><h2 className="mb-2 font-bold">{s.title}</h2><p className="whitespace-pre-line text-sm text-muted">{s.body}</p></div>
          ))}
        </section>
      )}
    </main>
  );
}
