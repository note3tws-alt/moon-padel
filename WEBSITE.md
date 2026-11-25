# Moon Padel website

Static site for Moon Padel UAE (Dubai), in `site/`. No framework, no build step needed to preview it. Mobile first. Runs on Hostinger (Apache, `.htaccess`) or Netlify (`netlify.toml`, `_headers`).

The league app (leaderboard, player profiles, log in) is a separate Next.js site in `platform/`. This site links to it through one setting, `leagueUrl` in `config.js`.

Structure follows how a Dubai padel league site works (schedule, levels, standings, rules, venues, WhatsApp entry), with Moon Padel's own copy, brand and positioning: fewer, bigger competitive nights, the Full Moon Series, moon-phase levels and players featured, not just listed.

## Pages

| URL | File | What it does |
| --- | --- | --- |
| `/` | `index.html` | Hero, next nights, how it works, why Moon Padel, levels, Full Moon Series, partners, WhatsApp CTA |
| `/events` | `events.html` | Night listings with filters (series, level), status and register / waitlist buttons, entry terms |
| `/levels` | `levels.html` | Crescent, Half moon, Gibbous, Full moon; placement rules; "Which phase are you?" self-check |
| `/results` | `results.html` | Season standings (players, pairs), champions by level, player and pair of the month, points |
| `/rules` | `rules.html` | Levels, format, points, registration, refunds and transfers, waitlist, on the night, fair play, filming |
| `/partners` | `partners.html` | Venue, sponsor and corporate offers; venue list |
| `/faq` | `faq.html` | FAQ and contact |
| `/terms`, `/privacy` | | Drafts, need a legal review before launch |

## Day-to-day edits: `site/assets/js/config.js`

Everything that changes lives in one file: WhatsApp number, Instagram, email, league app address (`leagueUrl`), events, home page numbers (`stats`, hidden while empty), standings, champions, player of the month, venues (with optional photo), transfer and waitlist windows.

Each event can also take `start` (Dubai time, `"2027-01-09T20:00"`), `durationMinutes` and `pairing` (`solo`, `pairs` or `either`). With `start` set, the card gets Add to calendar and search engines get event data. Each night has its own link, `/events#<id>`, and a Share button. Anything in `[BRACKETS]` shows as a highlighted placeholder on the site. Fixed copy is in the HTML files.

## Before launch

1. Set `whatsappNumber` in `config.js` (until then, buttons open WhatsApp with "MOON" typed and no number).
2. Replace every `[PLACEHOLDER]` once the founders confirm it. `python3 tools/build_site.py` lists what is left, file by file.
3. Get the terms and privacy pages reviewed.
4. Build the launch package: `python3 tools/build_site.py --domain https://YOUR-DOMAIN --launch`. This turns off the preview banner, removes the noindex header (`.htaccess` and `_headers`), and adds canonical links, sitemap.xml and robots.txt.

## Deploy to Hostinger

1. In hPanel, add the domain and switch on the free SSL certificate.
2. Run `python3 tools/build_site.py --domain https://YOUR-DOMAIN` (add `--launch` when ready). It writes `dist/moon-padel-site.zip`.
3. hPanel > Files > File Manager > `public_html`: delete the Hostinger default page, upload the zip and Extract it there. `index.html` and `.htaccess` must sit directly in `public_html`, not in a subfolder. (File Manager hides dotfiles by default; `.htaccess` is there.)
4. Check: `/events` loads (clean URLs), `/nothing` shows the Moon Padel 404 page, `http://` and `www.` both redirect to `https://YOUR-DOMAIN`.
5. If you prefer `www.` as the main address, replace step 2 in `.htaccess` with:
   ```
   RewriteCond %{HTTP_HOST} !^www\. [NC]
   RewriteRule ^ https://www.%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```
   and do not also turn on a www redirect in hPanel, or the two will loop.
6. After launch: add the site in Google Search Console and submit `https://YOUR-DOMAIN/sitemap.xml`.

`.htaccess` does what `_headers` and `_redirects` do on Netlify: HTTPS, one address, clean URLs, the 404 page, security headers, caching (fonts a year, images 30 days, CSS and JS a week with a version tag, pages and `config.js` always fresh) and compression.

## Deploy to Netlify

- **From Git (used for the live preview):** the root `netlify.toml` runs `python3 tools/build_site.py` and publishes `dist/site`. Every push to `main` redeploys. When the domain is ready, change the command to `python3 tools/build_site.py --domain https://YOUR-DOMAIN --launch`.
- **Drag and drop:** build as above and drop the `dist/site` folder on app.netlify.com/drop.
- Headers live in `site/_headers` and redirects in `site/_redirects` (Netlify reads both in either mode).

## Speed

- Montserrat is self-hosted (`assets/fonts/`, one variable file for weights 400 to 800, Latin Extended only loads if a page needs it). No Google Fonts request.
- The moon mark comes in AVIF (with WebP fallback) at 192, 320, 420 and 560 px. The home hero picks the right size per screen and is preloaded; small moon phases use 192 px (320 px above 96 px). To regenerate, resize `brand/logo/moon-mark.png` and save AVIF quality 50 and WebP quality 65.
- `build_site.py` inlines `site.css` into every page, so nothing blocks the first paint. Edit `site/assets/css/site.css` as usual; the build does the rest.
- Venue photos: 1280 x 720 WebP under 150 KB; they lazy load.
- Measured with Lighthouse (mobile, simulated slow 4G) on the built site: see the PR for scores. Re-check any time at pagespeed.web.dev once the site is live.
- Below-the-fold images use `loading="lazy"`.

## Brand

Logo, mark and colours come from `brand/` (see `brand/README.md`). Moon phases are made by masking the real moon mark with CSS, never redrawn. Montserrat, self-hosted. Medal gold is used only for winners. No court or player photos yet.

## Live data from the app (Nov 2026)

With `liveData: true` in `site/assets/js/config.js`, the site loads `<leagueUrl>/api/public/events` after the page has painted and swaps in, with a short fade:

- upcoming Ladder nights marked "Publish" in Admin > Events (they replace the `events` list; live nights get a "Follow live" button),
- latest podiums on the results page,
- lifetime points on the home and results pages, and the milestone thresholds in the rules.

The page never waits for it: cards from `config.js` are pre-rendered at build time, the last response is kept in the browser for repeat visits, and a slow or offline app is ignored after 5 seconds. Lighthouse mobile on the built site after this change: home 100, events 100, results 100 (CLS 0).
