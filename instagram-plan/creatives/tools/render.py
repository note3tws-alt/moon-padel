"""Render every src/*.html creative to png/ at full Instagram size.

Run: python3 instagram-plan/creatives/tools/render.py [name-filter]
Needs: pip install playwright && playwright install chromium
Also writes png/_grid-preview.png (first 9 feed posts as a profile grid)
and png/_contact-sheet.png (everything at a glance).
"""
import os
import sys
import glob
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC, OUT = os.path.join(ROOT, "src"), os.path.join(ROOT, "png")

GRID = ["P04-teaser-secret-round", "P03-teaser-numbers", "P02-teaser-points",
        "P06-how-01-cover", "P05-reveal", "P01-teaser-rising",
        "L01-event-poster-d", "P12-first-night-poster", "P07-medals-01-cover"]


def render(filt=""):
    os.makedirs(OUT, exist_ok=True)
    files = sorted(f for f in glob.glob(os.path.join(SRC, "*.html")) if filt in os.path.basename(f))
    with sync_playwright() as p:
        exe = os.environ.get("CHROMIUM_PATH")  # optional: use an existing Chromium
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        for f in files:
            pg.goto("file://" + f)
            pg.wait_for_load_state("networkidle")
            pg.evaluate("document.fonts.ready")
            el = pg.locator(".frame")
            el.screenshot(path=os.path.join(OUT, os.path.basename(f)[:-5] + ".png"))
            print("rendered", os.path.basename(f))
        b.close()


def sheets():
    from PIL import Image, ImageDraw
    # Profile grid preview (Instagram shows 3:4 tiles)
    tw, th = 360, 480
    grid = Image.new("RGB", (tw * 3 + 8, th * 3 + 8), (0, 0, 0))
    for i, n in enumerate(GRID):
        im = Image.open(os.path.join(OUT, n + ".png")).convert("RGB").resize((tw, th))
        grid.paste(im, ((i % 3) * (tw + 4), (i // 3) * (th + 4)))
    grid.save(os.path.join(OUT, "_grid-preview.png"))
    # Contact sheet
    pngs = sorted(f for f in glob.glob(os.path.join(OUT, "*.png")) if not os.path.basename(f).startswith("_"))
    cw, ch, cols = 270, 480, 8
    rows = (len(pngs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cw + 20) + 20, rows * (ch + 60) + 20), (5, 7, 15))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(pngs):
        im = Image.open(f).convert("RGB")
        im.thumbnail((cw, ch))
        x, y = 20 + (i % cols) * (cw + 20), 20 + (i // cols) * (ch + 60)
        sheet.paste(im, (x, y))
        d.text((x, y + im.height + 8), os.path.basename(f)[:-4][:38], fill=(169, 219, 255))
    sheet.save(os.path.join(OUT, "_contact-sheet.png"))


if __name__ == "__main__":
    render(sys.argv[1] if len(sys.argv) > 1 else "")
    if len(sys.argv) == 1:
        sheets()
