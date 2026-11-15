"""Generate icon sizes from logo/moon-mark.png (transparent PNG, square).
Usage: python scripts/make_sizes.py     (needs: pip install pillow)
Writes to logo/icons/."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
src = root / "logo" / "moon-mark.png"
out = root / "logo" / "icons"
if not src.exists():
    raise SystemExit("Missing logo/moon-mark.png. Add the moon mark first (see README).")
out.mkdir(exist_ok=True)
mark = Image.open(src).convert("RGBA")
SPACE = (4, 7, 15, 255)

def on_ground(size, scale):
    """Mark centred on the Space ground. scale = mark width as a share of the canvas."""
    canvas = Image.new("RGBA", (size, size), SPACE)
    w = round(size * scale)
    m = mark.resize((w, w), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - w) // 2, (size - w) // 2))
    return canvas

for s in (16, 32, 48, 180, 192, 512):
    mark.resize((s, s), Image.LANCZOS).save(out / f"mark-{s}.png")
on_ground(1080, 0.78).save(out / "instagram-profile-1080.png")   # stays clear of the circular crop
on_ground(1024, 0.80).save(out / "app-icon-1024.png")
on_ground(180, 0.86).save(out / "apple-touch-icon.png")
mark.resize((48, 48), Image.LANCZOS).save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("Wrote", len(list(out.iterdir())), "files to", out)
