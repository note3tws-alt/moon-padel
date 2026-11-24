# MoonPadel league platform

The league app for MoonPadel: live leaderboards, player and pair profiles, tournaments, a configurable scoring engine, and a private admin panel with bulk Excel/CSV import.

It lives next to the marketing site. `site/` stays the static marketing site on its own Netlify site. `platform/` is a separate Next.js app and a separate Netlify site.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind, Framer Motion, Recharts, Supabase (Postgres, Auth, Storage), ExcelJS and PapaParse for imports, Vitest for tests.

## What is in here

| Path | What it is |
| --- | --- |
| `src/app/(site)` | Public pages: home, `/leaderboard`, `/players`, `/players/[slug]`, `/pairs/[slug]`, `/tournaments`, `/tournaments/[slug]`, `/rules` |
| `src/app/(site)/login`, `src/app/(site)/account`, `src/app/auth` | Player login (Google or email link), My profile, sign-in callback |
| `src/app/admin` | Admin login and panel: player accounts, dashboard, players, upload data, tournaments, matches and results, leaderboard, divisions, clubs and venues, fixed pairs, scoring settings, website settings, audit log |
| `src/app/api/admin` | Import parse/run, failed rows download, templates, players export. Admin only |
| `src/lib/scoring` | The scoring engine: rating models, points, rankings, tie-breakers. Pure TypeScript, unit tested |
| `src/lib/recalc.ts` | Rebuilds every ranking and stat from match data inside one database transaction |
| `src/lib/import` | Spreadsheet import: field definitions, parsing, validation and the per-row import logic |
| `src/lib/demo.ts` | Demo data generator and remover |
| `supabase/migrations` | Schema, row level security, default divisions and the demo ruleset |
| `scripts` | Migrate, seed or remove demo data, recalculate, create an admin |

## How the data flows

1. Admins enter or import players, tournaments and match results.
2. Every change that affects results runs a full recalculation in the same transaction: ratings are replayed match by match, tournament points are awarded, and monthly, all-time, division and pair rankings are rebuilt.
3. Public pages read the derived tables. If the recalculation fails, the change is rolled back, so the site never shows half-updated rankings.
4. Every admin change is written to the audit log.

The server talks to Postgres directly (`DATABASE_URL`) so imports and recalculations can run in real transactions. Row level security is enabled on every table, so the public Supabase API can only read public data. Emails, phone numbers and notes live in `player_private`, which is admin only and never rendered on public pages.

## Scoring engine

All rules are stored in the database and edited in Admin > Scoring settings. You can keep several rulesets and switch the active one; switching recalculates everything.

- Rating method: Elo-style, weighted performance, or manual. New methods implement the `RatingModel` interface in `src/lib/scoring/rating.ts` and register in `createRatingModel`.
- Points: per win, draw and loss, placement points, court multipliers, optional recency weighting.
- Rankings: best N tournaments per month and all-time, minimum tournaments, tie-breaker order.
- Divisions: D1 Elite to D4 Beginner by default, with promotion and relegation rules. Moves are suggested in Admin > Divisions and only applied when an admin confirms them.

The ruleset shipped with the app is called **"Demo ruleset (not official)"**. Replace its numbers with the official MoonPadel rules before launch.

## Ladder Americano nights (event operations)

Built from the Developer Workflow & Scope Brief (Nov 2026). One database drives four screens:

| Screen | URL | Who |
| --- | --- | --- |
| Admin control centre | `/admin/events` | Organiser: roster, check-in monitor, court draw and swaps, round clock, score queue and overrides, tie decisions, podium, finalise, exports |
| Venue tablet (kiosk) | `/kiosk/<token>` | Players: tap name to check in (optional 4-digit code), see court and partner, enter the score, other team confirms or disputes |
| TV display | `/tv/<token>` | Everyone: check-in, courts, live leaderboard, round results, podium. Auto-rotates by stage, or the admin picks a screen. Landscape or portrait |
| Public live page | `/live/<slug>` and `/nights` | Phones and the website |

Tablet and TV links are long random tokens per event (Admin > Events > Screens), so no login is needed on the devices; reset them there if a link leaks. Public screens never receive phone numbers, codes or notes.

- **Engine** (`src/lib/ladder/engine.ts`, pure and unit tested): level-aware round 1 draw, adjacent-court ladder (court 1 = W1+W2, court k = L(k-1)+W(k+1), last court = L(N-1)+LN), partner remix that never keeps an arriving pair together and prefers fewest repeat partners then opponents, games-won scoring, standings (total, wins, game difference, organiser order) and podium.
- **Service** (`src/lib/ladder/service.ts`): every write locks the event row in one transaction and checks a per-match revision, so a score commits once even with double taps, retries or two devices. A round locks by itself when all courts are confirmed and decided, and the next round is drawn at once.
- **Ties**: per event, either the organiser picks the pair that moves up, or golden point is entered on the tablet. Final ties: total games, wins, game difference, then organiser order.
- **Lifetime points and medals**: finalising writes each player's total to `player_points_ledger` and unlocks every newly reached milestone in `medal_tiers` once. Reopening or correcting recomputes it; medals already handed over are kept and logged. Thresholds are editable in Admin > Medals.
- **League sync**: a finalised night with "count in league" on is written as a tournament with matches, so the leaderboard and player profiles include it.
- **Live updates**: screens poll `/api/live/...` with the version they hold (a 204 when nothing changed). With `SUPABASE_SERVICE_ROLE_KEY` and the public Supabase keys set, the server also sends a Supabase Realtime broadcast on every change, so screens update instantly and poll only every 15 seconds. If the Wi-Fi drops, screens show "Reconnecting" and catch up by themselves.
- **Roles**: `admin` (owner) can change levels, medal settings, correct locked rounds and reopen finalised nights. `editor` (event staff) can run nights: roster, check-in, rounds and scores.
- **Exports**: event report page with XLSX (totals, rounds, audit log) and CSVs; medals CSV in Admin > Medals.
- **Installable**: `manifest.webmanifest` lets the tablet, TV and phones add MoonPadel to the home screen.

Run the end-to-end acceptance tests (T01 to T12) against a disposable database:

```bash
TEST_DATABASE_URL=postgres://moon:moon@localhost:5432/moonpadel_test npx vitest run src/lib/ladder
```

Migration to apply on Supabase: `supabase/migrations/20261124000001_event_ops.sql`. Demo data (Admin > Website settings) now includes three demo Ladder nights.

## Bulk import

Admin > Upload data accepts .xlsx and .csv for players, tournaments, match results and historical monthly stats. Download a template from the same page.

The wizard runs in four steps: upload, map columns, preview, import. The preview runs the real import inside a transaction and rolls it back, so what you see is exactly what will happen. It shows new rows, updates (with a before and after for each changed field), possible duplicates, missing information and errors. Nothing is overwritten unless you choose "Update existing". Rows with errors are skipped and can be downloaded as a CSV after the import.

## Demo data

The app can generate 40 fictional players, 4 fictional venues marked "(demo)", fixed pairs, past tournaments with results and a few upcoming tournaments. Every demo record has `is_demo = true` and a banner on the public site says so.

- Load or remove it in Admin > Website settings.
- Or run `npm run db:seed-demo` / `npm run db:remove-demo`.

Remove demo data before going live. Nothing else is touched when you remove it.

## Player accounts

Players sign in from the **Login** button in the header (Google, or a sign-in link by email). Signing in does not give anyone access to data. An account only shows a player's stats once it is connected to their player profile, in one of two ways:

- **Invite by email:** an admin saves the player's email on their player record. When the player signs in with that same, verified email, the profile connects by itself.
- **Request and approve:** the player searches for their name on My profile and taps "This is me" (or asks to be added if they are new). The request waits in Admin > Player accounts until an admin approves or declines it.

Each profile can have one account and each account one profile. Admins can disconnect an account at any time; results are never touched.

On **My profile** a connected player sees their rating, ranking, stats, upcoming tournaments, recent matches and finishes, and can change their flag, nationality, playing side, photo and a private phone number. Name, division, rating and results stay admin only. Every self-edit is written to the audit log.

Privacy and caching: `player_accounts` and `player_claims` have row level security with no public policy, so emails and requests are never readable through the public API. A signed-in player is not an admin (admins must be in `public.users`). `/account`, `/login`, `/auth/callback` and `/api/me` are sent with `Cache-Control: private, no-store`. Public pages stay cached; the header asks `/api/me` in the browser only when a sign-in cookie exists.

### Switching player login on

1. Run `supabase/migrations/20261115000004_player_accounts.sql` in the Supabase SQL editor (or `npm run db:migrate`).
2. Supabase > Authentication > Sign In / Providers: turn on **Allow new users to sign up** and keep **Confirm email** on. This does not create admins.
3. Supabase > Authentication > URL Configuration: set Site URL to the live site and add `https://<your-site>/auth/callback` to Redirect URLs.
4. Google: in Google Cloud Console create an OAuth client (Web application) with the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then paste its Client ID and Secret into Supabase > Providers > Google. In Netlify set `PLAYER_LOGIN_GOOGLE=true`.
5. Email links: Supabase's built-in mailer only sends to your own team members and a few emails an hour, so add custom SMTP first (Supabase > Authentication > Emails > SMTP, for example with Resend). Optionally edit the Magic Link template so links work on any device and include a code:
   `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Sign in to MoonPadel</a> or enter this code: {{ .Token }}`
   Then set `PLAYER_LOGIN_EMAIL=true` in Netlify.
6. Redeploy. Until one of the two flags is on, the Login page says player accounts open soon.

## Running it locally

You need Node 20 or newer and a Postgres 15+ database.

```bash
cd platform
npm install
cp .env.example .env.local
# Set DATABASE_URL, e.g. postgres://moon:moon@localhost:5432/moonpadel
# Set AUTH_SECRET to a random string of 32+ characters
npm run db:local-auth-shim   # plain Postgres only: adds a stub auth schema, then runs migrations
npm run db:seed-demo         # optional
npm run admin:create -- you@example.com "a long password" "Your Name"
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.

Without Supabase Auth settings the admin login uses a local password stored as a hash in the `users` table. That mode is refused in production unless `ALLOW_LOCAL_AUTH=true` is set, which you should only do for a private preview.

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Setting up Supabase

1. Create a project at supabase.com. Pick a region close to Dubai (for example Frankfurt or Mumbai).
2. Run the migrations. Either paste the three files in `supabase/migrations` into the SQL editor in order, or set `DATABASE_URL` to the project and run `npm run db:migrate`. Do **not** run `db:local-auth-shim` against Supabase.
3. In Authentication > Providers, keep Email enabled. Admins are created by script, not by signing up. Keep public sign-ups off until you switch on player accounts (see Player accounts).
4. Create the first admin from your computer with all env vars set: `npm run admin:create -- you@example.com "a long password" "Your Name"`. This creates the Supabase Auth user and marks it as admin. More admins can be added later in Admin > Website settings.
5. The `player-photos` storage bucket is created by the migration. Photo URLs in imports can also point anywhere public.

## Environment variables

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Supabase > Project Settings > Database > Connection string > Transaction pooler (port 6543) | Required. Server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API | Required in production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API | Required in production. Safe to expose, protected by row level security |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API | Server only. Used for photo uploads and `admin:create`. Never expose |
| `NEXT_PUBLIC_SITE_URL` | Your domain | For page metadata |
| `AUTH_SECRET` | Generate one | Only for local login |
| `ALLOW_LOCAL_AUTH` | | Leave empty in production |
| `PLAYER_LOGIN_GOOGLE` | `true` to show Continue with Google | Needs the Google provider in Supabase |
| `PLAYER_LOGIN_EMAIL` | `true` to show email sign-in links | Needs custom SMTP in Supabase |

If `DATABASE_URL` is missing, the public pages show a "setup required" message instead of fake data.

## Deploying on Netlify

1. Add a new site from the same GitHub repository.
2. Set **Base directory** to `platform`. Netlify reads `platform/netlify.toml`, which turns on the Next.js runtime plugin.
3. Add the environment variables above in Site configuration > Environment variables.
4. Deploy, then log in at `/admin`.

The marketing site keeps its own Netlify site with the root `netlify.toml`, which publishes `site/`.

## Still placeholder

- The scoring ruleset is a demo, not official rules.
- The WhatsApp number in Website settings is empty.
- Entry fees, venues and dates come only from what admins enter. Demo tournaments have no fee.
- Proposed brand items (colours, Montserrat, moon phases) follow the brand board and are still waiting for founder approval.
