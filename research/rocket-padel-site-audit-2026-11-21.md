# Rocket Padel website audit and Moon Padel site gaps

21 Nov 2026. Builds on the [competitor study of 15 Nov](rocket-padel-competitor-study.md), which covers the business model, formats and positioning. This audit is about the website itself: pages, navigation, flows, SEO, speed and mobile, and what the Moon Padel site was missing next to it.

**How it was checked:** every public page of rocketpadel.ae was read on 21 Nov 2026 (home, schedule, leaderboard, a player profile, rules, clubs, terms, privacy, account). rocketpadel.ae refuses automated speed tools from our environment, so speed findings come from the page markup and tech stack, not a Lighthouse score. `/robots.txt`, `/sitemap.xml` and `/login` could not be read.

## Summary

Rocket's site is a league tool, and a good one. Its whole job is "where do I stand and when can I play next", and it answers that in two taps. It is weak on search (one meta description reused on most pages, no social sharing tags seen, key pages client rendered) and it still sells nothing: no photos of people, no video, no social links, no partners.

The Moon Padel static site already had the brand, story and offers Rocket lacks. What it was missing was Rocket's "league" layer (a way into the leaderboard, player profiles and login), event details players expect, search basics, and a setup that works on Hostinger. Those are fixed in this PR. The deeper league features (climbers, division moves, partners and rivals) belong in the league app and are listed at the end.

## Site map and navigation

| Page | URL | What it does |
| --- | --- | --- |
| Home | `/` | Top players by division (rating, last 30 days), division moves this month, climbers this month, latest champions per division, how the league works, WhatsApp join button, numbers strip |
| Schedule ("Book a game") | `/schedule` | Upcoming games as cards; filter All / Non-fixed pairs / Fixed pairs |
| Event | `/events/<id>` | One game: register and pay (from the terms) |
| Leaderboard | `/boards` | Rating list by division, tabs Active / Everyone, 30-day change, distance to next division |
| Player profile | `/players/<name>` | Full player history (see below) |
| Tournament | `/tournaments/<id>` | Result of one tournament |
| Profile | `/account` | Signed-in player's own profile and settings |
| Rules | `/rules` | Divisions, format, points, rating, sign-ups and payments, fair play |
| Clubs | `/clubs` | 5 club cards, each a Google Maps link |
| Terms, Privacy | `/terms`, `/privacy` | Updated 10 Sep and 23 Oct 2026 |

- **Header (every page):** logo + "Dubai's competitive padel league", then Home, Leaderboard, Schedule ("Book a game"), Profile. Four items only.
- **Footer:** Rules, Clubs, Terms, Privacy. No social links, no contact block, no copyright line.
- **Also:** iOS Smart App Banner (App Store app 6825674989), installable as a web app (theme colour #0F1E1A).

## Key flows

**Join:** the only call to action on the home page is "WhatsApp us" (a `wa.me/message/...` link, no number shown). "We place you in the right division after your first tournament."

**Book a game:** Schedule card shows day and date (no year), time (no timezone), club with photo, division, fixed or non-fixed pairs, 90 or 120 minutes, 170 AED, spots taken out of capacity (16 to 28) and the roster with each player's rating. Labels seen: "confirmed", "waitlist N", "Looking for a partner N". Paying through Ziina is registering; the spot is held 15 minutes; 5% processing fee plus VAT on top.

**Can't make it / full:** no refunds; free transfer to another game in the same division until 24 hours before; free waitlist with a 15-minute window to pay. League cancellations become a transfer or credit.

**Account:** Google and email sign-in, one account per player, edit flag, side and photo, delete account in Settings (results stay under the nickname). Push and email notifications.

## Leaderboard and player profiles (their strongest feature)

- **Home page data blocks:** top 5 per division, division moves this month (up and down counts and names), climbers this month (rating growth, minimum two tournaments), latest champions per division.
- **Leaderboard:** rank, player with flag, 30-day change, rating, and "0.08 to D2" style distance to the next division. Active vs Everyone tabs.
- **Player profile:** tournaments and medal counts, rating with a D4 to D1 scale bar, rating progression chart (last 5 / 10 / all), best partners with win rates, rivals head to head, titles and achievements with tiers and progress, "Legendary moments", monthly activity chart, a Share profile button, and a full tournament table filterable by division, format and month.

This is what keeps Rocket players coming back. Moon Padel's league app already has a leaderboard, player and pair pages, tournaments and login (PR #16), but the static site never linked to it.

## SEO

| Check | Rocket | Notes |
| --- | --- | --- |
| Titles | Unique on most pages, but profile and account pages say "Leaderboards" | Weak for player-name searches |
| Meta description | "Tournament standings for the Rocket Padel community in Dubai." reused on home, schedule, leaderboard, profiles, terms, privacy | Only rules and clubs have their own |
| Open Graph / Twitter tags | None seen | Links shared on WhatsApp show no image or proper title |
| Canonical, structured data | None seen | No SportsEvent data, so games never show as events in Google |
| Indexing | Terms, privacy and account are noindex; Google Search Console verified | Sensible |
| Rendering | Next.js; `/account` returns only "Loading..." to a crawler | Fine for a private page |
| Content | Thin: no text about Dubai padel, venues or levels beyond rules | Little to rank for besides the brand name |
| Name clash | Rocket Padel UK (rocketpadel.com) owns most "Rocket Padel" results | Brand searches are muddied |

## Speed and tech

- **Stack:** Next.js, images through the Next.js optimiser, deployment ids that suggest Vercel (their privacy page names Vercel and Supabase), club photos from Supabase Storage.
- **Good:** server-rendered public pages, optimised and resized images, almost no images per page.
- **Weak:** the account area is fully client rendered ("Loading..." first), and the leaderboard ships every row in one page.
- **No score:** we could not run Lighthouse against rocketpadel.ae. If you want numbers, open pagespeed.web.dev on a phone or laptop and paste the address.

## Mobile UX

- Built for phones: four-item navigation, viewport-fit cover, web app capable, App Store banner.
- Data is dense. Tables and rosters read as run-on text in places ("Alekseii & DenisPKarim D"), and schedule dates show as "Sat21Nov" with no year or timezone.
- No sticky booking or join button; the WhatsApp link sits low on the home page.

## Inconsistencies spotted (trust costs)

- Rating scale is 0 to 4.5 on the home page and leaderboard, 0 to 7 on the rules page.
- Home says 6 clubs; the clubs page lists 5 (one under an unexplained "Padel Pro" heading).
- Division moves list fewer names than the counts shown; one period label reads "Nov 2026 * Nov 2026".
- Latest champions dates have no year and are not in date order.
- Counters moved from 1,524+ players and 267 tournaments (15 Nov) to 1,557+ and 274 (21 Nov). That is 33 players and 7 tournaments in 6 days.

## Gaps on the Moon Padel site, and what this PR does

| Gap | Rocket has | Moon Padel before | Fixed in this PR |
| --- | --- | --- | --- |
| Way into the league | Leaderboard and Profile in the main nav | No link to the league app at all | Leaderboard in the nav, Log in / My profile in the header and menu, league links in the footer, a "The league" section on home and results. One setting (`leagueUrl`) moves them all |
| Hostinger hosting | n/a | Netlify only: clean URLs like `/events` would 404 on Hostinger, no 404 page, no headers | `.htaccess` with HTTPS, www to bare domain, clean URLs, 404 page, security headers, caching, compression, noindex until launch |
| Search basics | Partial | No canonical, relative og:image (breaks WhatsApp previews), no robots.txt or sitemap, no structured data | `tools/build_site.py --domain ... --launch` adds canonical links, absolute share images, sitemap.xml, robots.txt, Organization data, and SportsEvent data for confirmed nights only |
| Event details | Duration, pair type, spots bar, roster, club photo | Date, time, venue, levels, format, fee | Optional start time (with "Dubai time"), duration, pairing (solo, pairs, either), spots bar when both numbers are real, Add to calendar (.ics), Share link to each night, "Need a partner?" on pair nights |
| Venue cards | Photo and directions | Name and map only | Optional photo (lazy loaded), "Directions" button |
| Numbers strip | Players, tournaments, divisions, clubs | None | Strip on home that stays hidden until real numbers are added to config |
| Speed | Optimised images | Google Fonts (5 weights, 2 extra connections), 85 KB logo PNG, 158 KB mark used for every small moon phase | Montserrat self-hosted (one 38 KB file), logo 12 KB WebP, 37 KB mark for phases, smaller icons, cache-busted CSS and JS |
| Medium screens | n/a | Header wrapped between 980 and 1100 px | Full nav from 1100 px, menu and sticky WhatsApp bar below |
| Launch safety | n/a | Placeholders had to be found by hand | The build script lists every [PLACEHOLDER] left, per file |

Not copied on purpose: Rocket's dense data on the marketing site. The static site stays the brand front door and the league app carries the numbers.

## Still open

**Needs the founders (placeholders stay until then):** domain, WhatsApp number, Instagram handle, email, company legal name and trade licence, fee, refund and transfer windows, payment provider, format and pairing, level bands, points system, venues and photos, real stats.

**League app ideas from Rocket (separate piece of work):** climbers this month, division moves, distance to the next level on the leaderboard, best partners and rivals on profiles, achievements, a Share profile button, and online registration with payment and waitlist from the player account.

**Hosting note:** Hostinger shared hosting serves static files only. The league app (Next.js) stays on Netlify, or moves to a `league.` subdomain later. Change `leagueUrl` in `site/assets/js/config.js` when it does.
