# Moon Padel

Padel tournament and events brand. Work here covers brand identity, the Instagram launch, tournament marketing and business planning. Moon Padel is an independent tournament brand, not a club or court operator.

## What is in this folder

| Path | What it is |
| --- | --- |
| `launch-plan.md` | 7-day Instagram launch plan: competitor read (Rocket Padel), positioning, day-by-day posts, Reel shot lists, captions, shoot plan, KPIs, open decisions |
| `design/canvas.json` | Layout of the design canvas: board positions, titles, sticky notes |
| `design/Main.dc.html` | Brand identity board (proposed): logo, colour, type, moon-phase system |
| `design/Teaser1-3-*.dc.html` | Days 1 to 3 teaser covers (1080 x 1440) |
| `design/Day4-Reveal.dc.html` | Day 4 reveal poster |
| `design/Day5-Carousel-*.dc.html` | Day 5 carousel cover and inner-slide template |
| `design/Day6-LevelStory.dc.html` | Day 6 "Which phase are you?" Story (1080 x 1920) |
| `design/Day7-FirstMoonNight.dc.html` | Day 7 first event poster |
| `design/Story-*.dc.html` | Story templates: reveal countdown, founding players list |
| `design/Profile-Preview.dc.html` | Mock of the Instagram profile on Day 7 |
| `brand/` | Logo kit: moon mark, lockups, icons, social profile and highlight images, usage rules (`brand/README.md`) |
| `exports/posters/` | PNG exports of every design board, using the real moon mark (Dubai copy, court photos still to come) |

The `.dc.html` files are the source files of the Claude Design canvas "Moon Padel Brand Board & Launch Posts" (https://claude.ai/artifact/8yeSLsydutgqcExXMFR8Cc). Each one is a single fixed-size board with inline styles. They load `./support.js` from the canvas runtime, which is not included, so they are sources to edit, not standalone pages.

## Images are not included

The boards reference eight uploaded images by `/_blob/<id>` paths. Those files could not be exported. To render the boards outside the canvas, add the originals and repoint the `src` values.

| Blob id | Image |
| --- | --- |
| `1ff4ab357917b71e13ee5c503e3832bf` | MoonPadel moon mark (PNG, transparent), used on every board |
| `5a4a09f8d30cf34e9ca90e02623ed6a5` | Night padel courts from above with the logo (Day 4) |
| `fbdb7e97a7accdc5200b1a24078a88d1` | Padel court at dusk with the logo on the wall (brand board, Day 7) |
| `58181546cc9c13bdda0c31064817f1d8` | Players in MoonPadel kit on court (founding list Story) |
| `af5770e08dd6bbbac3f2746b1c4e71b0` | App icon |
| `943a32136790b2075197a4508784d8b5` | Gold, silver and bronze medals |
| `810c3642e7c09bdfd0d0cf50992d31af` | Playing shirt, front and back |
| `1094a98af3f5a17790175d3766914491` | Racket and bag |

## Brand system in use

Built on the founders' own logo and deck. Everything below is proposed until the founders approve it.

- Mark: the founders' moon mark, shown in phases. Crescent to tease, half to announce, gibbous for hype, full moon on match night.
- Colour: Space `#04070F`, Night `#0A1428`, Court `#1D3FA6`, Electric `#2E8BEA`, Ice `#A9DBFF`, Silver `#E9EEF5`. Medal gold `#C9A24A` for winners only. Muted text `#8FA0BC`.
- Type: Montserrat. Extra bold caps with -0.02em tracking for headlines, medium caps with 0.42em tracking for lines like PLAY BEYOND.
- Brand line from the founders' deck: "Play beyond."
- Feed posts are 1080 x 1440 (3:4). Stories are 1080 x 1920.
- Main call to action: WhatsApp "MOON" to join the founding players list.

## Working rules

- No em dashes in any copy.
- Never invent dates, venues, fees, prizes, rules or registration numbers. Use bracketed placeholders such as `[DATE]` until the founders confirm.
- Treat taglines, level names (Crescent, Half moon, Gibbous, Full moon), the Full Moon Series and the visual direction as concepts, not approved decisions.
- Launch market: Dubai (confirmed by Hola, 15 Nov 2026). Fees in AED as `[FEE]` placeholders.
- Use urgency or limited-place messaging only when it reflects real event conditions.
- Captions: natural and confident, few emojis, few hashtags.
- Every asset should look like it belongs to the same brand. Keep to the colours, type and moon-phase system above.
