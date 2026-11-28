# Moon Padel Instagram creatives

46 designed creatives for the pre-launch (P) and post-launch (L) plan in `../content-plan.md`.

| Folder | What |
| --- | --- |
| `png/` | Ready-size exports. Feed 1080 x 1440, Story and Reel cover 1080 x 1920. `_grid-preview.png` and `_contact-sheet.png` are overviews. |
| `src/` | Editable source, one HTML file per creative. Open in a browser to preview. |
| `assets/` | `theme.css` (all colours, type and components), galaxy backgrounds, logo files, Montserrat. |
| `motion/` | Animated Reel versions: `mp4/` videos and `src/` HTML (CSS keyframes). Built by `tools/motion.py`, except `R00`, which is Higgsfield footage with a text overlay (see `../higgsfield-prompt-pack.md`). |
| `tools/` | `build.py` writes `src/` from one Python file, `render.py` exports PNGs, `make_backgrounds.py` regenerates the galaxy backgrounds. |

Orange `[BRACKETS]` are placeholders. Replace them only with confirmed facts.

## Change a creative

Quick text change: edit the HTML in `src/`, then render. Lasting change: edit `tools/build.py` (running it overwrites `src/`).

```
pip install playwright pillow numpy
playwright install chromium
python3 tools/build.py          # only if you edited build.py
python3 tools/render.py         # all creatives + overview sheets
python3 tools/render.py L07     # just the files whose name contains L07
```

To use an existing Chromium instead of downloading one, set `CHROMIUM_PATH`.

Logo files are the founders' originals from `brand/`. The moon phases are masks over the real mark; never redraw it.
