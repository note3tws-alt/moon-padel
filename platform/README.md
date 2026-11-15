# MoonPadel league platform

The league app for MoonPadel: live leaderboards, player and pair profiles, tournaments, a configurable scoring engine, and a private admin panel with bulk Excel/CSV import.

It lives next to the marketing site. `site/` stays the static marketing site on its own Netlify site. `platform/` is a separate Next.js app and a separate Netlify site.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind, Framer Motion, Recharts, Supabase (Postgres, Auth, Storage), ExcelJS and PapaParse for imports, Vitest for tests.

## What is in here

| Path | What it is |
| --- | --- |
| `src/app/(site)` | Public pages: home, `/leaderboard`, `/players`, `/players/[slug]`, `/pairs/[slug]`, `/tournaments`, `/tournaments/[slug]`, `/rules` |
| `src/app/admin` | Admin login and panel: dashboard, players, upload data, tournaments, matches and results, leaderboard, divisions, clubs and venues, fixed pairs, scoring settings, website settings, audit log |
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

## Bulk import

Admin > Upload data accepts .xlsx and .csv for players, tournaments, match results and historical monthly stats. Download a template from the same page.

The wizard runs in four steps: upload, map columns, preview, import. The preview runs the real import inside a transaction and rolls it back, so what you see is exactly what will happen. It shows new rows, updates (with a before and after for each changed field), possible duplicates, missing information and errors. Nothing is overwritten unless you choose "Update existing". Rows with errors are skipped and can be downloaded as a CSV after the import.

## Demo data

The app can generate 40 fictional players, 4 fictional venues marked "(demo)", fixed pairs, past tournaments with results and a few upcoming tournaments. Every demo record has `is_demo = true` and a banner on the public site says so.

- Load or remove it in Admin > Website settings.
- Or run `npm run db:seed-demo` / `npm run db:remove-demo`.

Remove demo data before going live. Nothing else is touched when you remove it.

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
3. In Authentication > Providers, keep Email enabled. Turn off public sign-ups: admins are created by script, not by signing up.
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

If `DATABASE_URL` is missing, the public pages show a "setup required" message instead of fake data.

## Deploying on Netlify

1. Add a new site from the same GitHub repository.
2. Set **Base directory** to `platform`. Netlify reads `platform/netlify.toml` and detects Next.js on its own.
3. Add the environment variables above in Site configuration > Environment variables.
4. Deploy, then log in at `/admin`.

The marketing site keeps its own Netlify site with the root `netlify.toml`, which publishes `site/`.

## Still placeholder

- The scoring ruleset is a demo, not official rules.
- The WhatsApp number in Website settings is empty.
- Entry fees, venues and dates come only from what admins enter. Demo tournaments have no fee.
- Proposed brand items (colours, Montserrat, moon phases) follow the brand board and are still waiting for founder approval.
