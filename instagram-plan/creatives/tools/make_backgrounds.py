"""Generate the deep-space backgrounds used by every creative.

Run: python3 instagram-plan/creatives/tools/make_backgrounds.py
Writes assets/space-feed-*.jpg (1080x1440) and assets/space-story-*.jpg (1080x1920).
Seeded, so the output is the same every run.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")

SPACE = np.array([5, 7, 15], float)


def noise(w, h, rng, scale):
    small = rng.random((max(2, h // scale), max(2, w // scale)))
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, float) / 255.0


def fbm(w, h, rng):
    acc = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for scale in (240, 120, 60, 30, 14):
        acc += amp * noise(w, h, rng, scale)
        tot += amp
        amp *= 0.55
    return acc / tot


def make(w, h, seed, band_angle, band_offset, glow_xy):
    rng = np.random.default_rng(seed)
    img = np.tile(SPACE, (h, w, 1))
    yy, xx = np.mgrid[0:h, 0:w].astype(float)

    # Milky Way band: a soft diagonal strip broken up by fbm noise
    a = np.deg2rad(band_angle)
    d = (xx - w / 2) * np.sin(a) - (yy - h / 2) * np.cos(a) - band_offset
    band = np.exp(-(d / (w * 0.22)) ** 2)
    n = fbm(w, h, rng)
    dust = fbm(w, h, rng)
    band_val = band * (0.35 + 0.9 * n) * (1 - 0.55 * np.clip((dust - 0.45) * 3, 0, 1))
    img += band_val[..., None] * np.array([22, 42, 92])
    img += (band * n ** 3)[..., None] * np.array([40, 70, 130])

    # Blue nebula glow (like the brief's lower-left haze)
    gx, gy = glow_xy
    r = np.sqrt((xx - gx * w) ** 2 + (yy - gy * h) ** 2)
    glow = np.exp(-(r / (w * 0.55)) ** 2) * (0.6 + 0.4 * fbm(w, h, rng))
    img += glow[..., None] * np.array([14, 36, 96])

    # Vignette
    vr = np.sqrt(((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2)
    img *= (1 - 0.55 * np.clip(vr - 0.25, 0, 1))[..., None]

    # Stars: many faint, some medium, a few bright with halo
    stars = np.zeros((h, w))
    density = band * 2.5 + 0.6
    count = int(w * h / 260)
    sx = rng.integers(0, w, count)
    sy = rng.integers(0, h, count)
    keep = rng.random(count) < density[sy, sx] / density.max()
    sx, sy = sx[keep], sy[keep]
    stars[sy, sx] = rng.random(len(sx)) ** 3 * 0.9
    star_im = Image.fromarray((np.clip(stars, 0, 1) * 255).astype(np.uint8))
    soft = np.asarray(star_im.filter(ImageFilter.GaussianBlur(0.7)), float) / 255
    sharp = np.asarray(star_im, float) / 255

    bright = np.zeros((h, w))
    nb = int(w * h / 26000)
    bx = rng.integers(0, w, nb)
    by = rng.integers(0, h, nb)
    bright[by, bx] = 0.6 + 0.4 * rng.random(nb)
    b_im = Image.fromarray((bright * 255).astype(np.uint8))
    halo = np.asarray(b_im.filter(ImageFilter.GaussianBlur(4)), float) / 255 * 9
    core = np.asarray(b_im.filter(ImageFilter.GaussianBlur(1.1)), float) / 255 * 3.5

    tint = np.array([200, 225, 255])
    img += (sharp * 0.8 + soft * 1.6)[..., None] * tint
    img += np.clip(halo, 0, 1)[..., None] * np.array([90, 150, 255]) * 0.5
    img += np.clip(core, 0, 1)[..., None] * np.array([235, 245, 255])

    img = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(img)


SPECS = {
    "space-feed-a.jpg": (1080, 1440, 11, 62, -120, (0.05, 0.95)),
    "space-feed-b.jpg": (1080, 1440, 23, -55, 80, (0.95, 0.9)),
    "space-story-a.jpg": (1080, 1920, 31, 70, -160, (0.0, 0.92)),
    "space-story-b.jpg": (1080, 1920, 47, -64, 120, (1.0, 0.85)),
}

if __name__ == "__main__":
    for name, (w, h, seed, ang, off, glow) in SPECS.items():
        make(w, h, seed, ang, off, glow).save(os.path.join(OUT, name), quality=92)
        print("wrote", name)
