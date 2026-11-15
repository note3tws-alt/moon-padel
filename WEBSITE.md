# Moon Padel website

Static site for Moon Padel UAE (Dubai), in `site/`. No build step, no framework. Mobile first.

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

Everything that changes lives in one file: WhatsApp number, Instagram, email, events, standings, champions, player of the month, venues, transfer and waitlist windows. Anything in `[BRACKETS]` shows as a highlighted placeholder on the site. Fixed copy is in the HTML files.

## Before launch

1. Set `whatsappNumber` in `config.js` (until then, buttons open WhatsApp with "MOON" typed and no number).
2. Replace every `[PLACEHOLDER]` once the founders confirm it: search the `site/` folder for `[`.
3. Set `showDraftBanner: false`.
4. Delete the `X-Robots-Tag = "noindex"` line in `site/netlify.toml` so search engines can index it.
5. Get the terms and privacy pages reviewed.

## Deploy to Netlify

- **Drag and drop:** unzip `moon-padel-website-netlify.zip` and drop the folder on app.netlify.com/drop (or Sites > Add new site > Deploy manually). `netlify.toml` inside it sets headers.
- **From Git:** connect this repo. The root `netlify.toml` publishes `site/`. No build command.

## Brand

Logo, mark and colours come from `brand/` (see `brand/README.md`). Moon phases are made by masking the real moon mark with CSS, never redrawn. Montserrat from Google Fonts. Medal gold is used only for winners. No court or player photos yet.
