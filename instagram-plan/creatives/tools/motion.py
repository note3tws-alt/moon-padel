"""Animated Reel versions of the key creatives (1080 x 1920 MP4, 30 fps).

Run: python3 instagram-plan/creatives/tools/motion.py [name-filter]
Needs: playwright (see render.py) and ffmpeg on PATH.
Writes motion/src/*.html (editable, CSS keyframes) and motion/mp4/*.mp4.
Videos are silent: add a track in Instagram or CapCut. Orange [BRACKETS] are placeholders.
"""
import os
import sys
import subprocess
from playwright.sync_api import sync_playwright
from parts import ph, logo, wa_icon, journey_medal, podium_medal, lock_icon, JOURNEY

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "motion", "src")
OUT = os.path.join(ROOT, "motion", "mp4")
FPS = 30

BASE_CSS = """
@property --cx { syntax: '<length>'; inherits: false; initial-value: 0px; }
.amoon { position: absolute; }
.amoon img { position: absolute; inset: 0; width: 100%; height: 100%; }
.amoon .ghost { opacity: .10; filter: grayscale(1) brightness(.8); }
.amoon .lit { filter: drop-shadow(0 0 60px rgba(46,139,234,.55)) drop-shadow(0 0 14px rgba(63,184,255,.6));
  -webkit-mask-image: radial-gradient(circle at var(--cx) 50%, transparent calc(var(--r) - 10px), #000 calc(var(--r) + 6px));
          mask-image: radial-gradient(circle at var(--cx) 50%, transparent calc(var(--r) - 10px), #000 calc(var(--r) + 6px)); }
.amoon { -webkit-mask-image: radial-gradient(circle closest-side, #000 80%, transparent 100%); mask-image: radial-gradient(circle closest-side, #000 80%, transparent 100%); }
.a { animation-fill-mode: both; animation-timing-function: cubic-bezier(.2,.7,.2,1); }
@keyframes fadeUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: none; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes popIn { 0% { opacity: 0; transform: scale(.6); } 70% { opacity: 1; transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dropIn { 0% { opacity: 0; transform: translateY(-220px) scale(.8); } 70% { opacity: 1; transform: translateY(12px) scale(1.04); } 100% { opacity: 1; transform: none; } }
@keyframes riseUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes pulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 16px rgba(63,184,255,.8)); } 50% { transform: scale(1.08); filter: drop-shadow(0 0 40px rgba(63,184,255,1)); } }
@keyframes flash { 0% { opacity: 0; } 15% { opacity: .9; } 100% { opacity: 0; } }
"""


def page(title, body, css, dur):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="../../assets/theme.css">
<style>{BASE_CSS}{css}</style></head>
<body data-duration="{dur}"><div class="frame story bg-a">{body}</div></body></html>"""


def amoon(size, left, top, extra_class="", style="", cx0="0px"):
    return (f'<div class="amoon {extra_class}" style="width:{size}px;height:{size}px;left:{left}px;top:{top}px;--r:{size/2:.0f}px;{style}">'
            f'<img class="ghost" src="../../assets/moon-mark.png" alt=""><img class="lit" style="--cx:{cx0}" src="../../assets/moon-mark.png" alt=""></div>')


def cx(size, d):
    """Shadow-disc centre for a phase (d = how far the shadow has slid off; 1.0 = full)."""
    return f"{size*0.5 - d*size:.0f}px"


ANIMS = {}


def anim(name, dur):
    def wrap(fn):
        ANIMS[name] = (fn, dur)
        return fn
    return wrap


@anim("R01-something-rising", 9)
def _():
    S = 800
    css = f"""
.m1 {{ animation: rise 4.5s cubic-bezier(.2,.7,.2,1) both; }}
.m1 .lit {{ animation: phase 5s 1s ease-in-out both; }}
@keyframes rise {{ from {{ transform: translateY(420px); opacity: 0; }} 30% {{ opacity: 1; }} to {{ transform: none; opacity: 1; }} }}
@keyframes phase {{ from {{ --cx: {cx(S, .04)}; }} to {{ --cx: {cx(S, .26)}; }} }}
"""
    body = f"""
{amoon(S, 230, 250, "m1")}
<div class="pad" style="justify-content:flex-end;padding-bottom:40px">
  <div class="eyebrow a" style="animation:fadeIn .8s 4.6s both">Dubai · after dark</div>
  <div class="h1" style="margin-top:28px;font-size:150px"><div class="a" style="animation:fadeUp .9s 5.1s both">Something</div><div class="a" style="animation:fadeUp .9s 5.6s both">is <span class="blue">rising</span></div></div>
  <div class="lead a" style="margin-top:34px;animation:fadeIn .8s 6.6s both">Over Dubai. On the court. Under the lights.</div>
  <div class="line a" style="margin-top:50px;animation:fadeIn .8s 7.4s both">Coming soon</div>
</div>"""
    return css, body


@anim("R02-moonrise-countdown", 13)
def _():
    S = 760
    stops = [(0, .06), (2.4, .24), (3.2, .24), (5.6, .46), (6.4, .46), (8.6, .72), (9.4, .72), (11, 1.05), (13, 1.05)]
    kf = " ".join(f"{t/13*100:.2f}% {{ --cx: {cx(S, d)}; }}" for t, d in stops)
    css = f"""
.m2 .lit {{ animation: ph 13s linear both; }}
@keyframes ph {{ {kf} }}
.step {{ position: absolute; left: 0; right: 0; top: 1240px; text-align: center; opacity: 0; }}
@keyframes show {{ 0% {{ opacity: 0; transform: scale(.7); }} 12% {{ opacity: 1; transform: scale(1.04); }} 18% {{ transform: scale(1); }} 85% {{ opacity: 1; }} 100% {{ opacity: 0; transform: scale(1.1); }} }}
"""
    steps = [("7", "days to moonrise", 0.3), ("3", "days to moonrise", 3.3), ("1", "day to moonrise", 6.3)]
    html = "".join(f'''<div class="step a" style="animation:show 3s {t}s both"><div class="num" style="font-size:300px;line-height:.85;color:#fff;text-shadow:0 0 60px rgba(63,184,255,.8)">{n}</div><div class="eyebrow" style="font-size:40px;margin-top:20px">{u}</div></div>''' for n, u, t in steps)
    body = f"""
<div class="topbar">{logo(60)}<div class="meta">Moonrise</div></div>
{amoon(S, 160, 360, "m2")}
{html}
<div style="position:absolute;left:0;right:0;top:1240px;text-align:center">
  <div class="h1 a" style="font-size:180px;animation:popIn .9s 9.4s both">Tonight</div>
  <div class="eyebrow a" style="font-size:30px;margin-top:20px;animation:fadeIn .8s 10.4s both">{ph("DATE")} · {ph("TIME")}</div>
  <div class="a" style="margin-top:44px;animation:fadeUp .8s 11s both"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return css, body


@anim("R03-points-gone", 9)
def _():
    target = "0347"
    cols = ""
    for i, ch in enumerate(target):
        n = int(ch)
        strip = "".join(f'<div style="height:270px;display:flex;align-items:center;justify-content:center">{k}</div>' for k in range(10))
        cols += f'''<div class="card" style="width:190px;height:270px;overflow:hidden"><div class="num odo" style="font-size:190px;color:#EAF6FF;text-shadow:0 0 40px rgba(63,184,255,.8);animation:odo{i} 9s both">{strip}</div></div>'''
    kfs = ""
    for i, ch in enumerate(target):
        y = -270 * int(ch)
        kfs += f"@keyframes odo{i} {{ 0%, 6% {{ transform: translateY(0); }} {28 + i*2}% {{ transform: translateY({y}px); }} 40% {{ transform: translateY({y}px); }} 44% {{ transform: translateY(0); }} 100% {{ transform: translateY(0); }} }}\n"
    css = kfs + """
.odo { animation-timing-function: cubic-bezier(.3,.8,.3,1); }
.glitch { animation: gl 9s both; }
@keyframes gl { 0%,40% { filter: none; } 41% { filter: hue-rotate(160deg) brightness(1.6); transform: translateX(-12px); } 42% { filter: none; transform: translateX(10px); } 43% { transform: none; } 100% { filter: none; } }
"""
    body = f"""
<div class="topbar">{logo(60)}<div class="meta">Coming soon</div></div>
<div class="pad" style="align-items:center;text-align:center">
  <div class="eyebrow a" style="animation:fadeIn .6s .2s both">Your padel points this year</div>
  <div class="row glitch" style="gap:26px;margin:56px 0 30px">{cols}</div>
  <div class="line a" style="letter-spacing:.5em;animation:fadeIn .5s 4.1s both">Saved: none</div>
  <div class="h2" style="margin-top:100px"><div class="a" style="animation:fadeUp .7s 4.6s both">Every rally.</div><div class="a" style="animation:fadeUp .7s 5.0s both">Every point.</div><div class="a blue" style="animation:popIn .7s 5.5s both">Gone.</div></div>
  <div class="lead a" style="margin-top:44px;animation:fadeIn .8s 7s both">Not for much longer.</div>
</div>"""
    return css, body


@anim("R04-podium-reveal", 15)
def _():
    def plinth(place, h, col, t):
        return f'''<div style="display:flex;flex-direction:column;align-items:center;width:300px">
          <div class="a" style="animation:dropIn 1s {t+.5}s both">{podium_medal(place, 190 if place > 1 else 240)}</div>
          <div class="a" style="animation:fadeIn .6s {t+1.2}s both;text-align:center"><div class="mont" style="font-weight:800;font-size:36px;margin-top:14px">{ph("@PLAYER")}</div>
          <div class="num" style="font-size:42px;color:{col};margin:6px 0 20px">{ph("PTS")} pts</div></div>
          <div class="a" style="width:100%;height:{h}px;transform-origin:bottom;animation:riseUp .8s {t}s both;border-radius:24px 24px 0 0;background:linear-gradient(180deg,{col}66,{col}10);border:2px solid {col}aa;border-bottom:none;display:flex;justify-content:center;padding-top:20px"><span class="num" style="font-size:100px;color:{col}">{place}</span></div></div>'''
    css = """
.locked { animation: fadeOut .6s 3s both; }
.lockicon { animation: pulse 1s 0s 3 both; }
.flash { position:absolute; inset:0; background: radial-gradient(circle at 50% 45%, rgba(242,193,78,.55), transparent 60%); opacity:0; animation: flash 1.6s 8.6s both; }
"""
    body = f"""
<div class="topbar">{logo(60)}<div class="meta">{ph("DATE")}</div></div>
<div class="locked" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <div class="lockicon">{lock_icon(220)}</div>
  <div class="eyebrow" style="margin-top:50px">Round 6 of 6 · final round</div>
  <div class="h1" style="font-size:170px;margin-top:24px">Scores<br><span class="blue">locked</span></div>
</div>
<div class="flash"></div>
<div style="position:absolute;left:0;right:0;top:400px;text-align:center">
  <div class="eyebrow a" style="animation:fadeIn .6s 3.6s both">Tonight's podium</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:430px;display:flex;justify-content:center;align-items:flex-end;gap:20px">
  {plinth(2, 300, "#C9D3E0", 6.2)}{plinth(1, 420, "#F2C14E", 8.4)}{plinth(3, 220, "#D08A55", 4.0)}
</div>
<div style="position:absolute;left:0;right:0;bottom:280px;text-align:center" class="a" >
  <div class="a" style="animation:fadeUp .8s 11.6s both"><span class="btn">{wa_icon(46)} Next night: {ph("DATE")}</span></div>
</div>"""
    return css, body


@anim("R05-medal-journey", 12)
def _():
    n = len(JOURNEY)
    medals = ""
    for i, (name, pts, story) in enumerate(JOURNEY):
        x = 60 + i * 86
        y = 1330 - i * 66
        t = 1.6 + i * 0.6
        size = 120 if i < 9 else 160
        medals += (f'<div style="position:absolute;left:{x}px;top:{y}px;text-align:center">'
                   f'<div style="opacity:.22;position:absolute">{journey_medal(name, size)}</div>'
                   f'<div class="a" style="animation:popIn .6s {t}s both">{journey_medal(name, size)}</div></div>')
    css = """
.endmoon { animation: fadeIn 1.2s 7s both; }
"""
    body = f"""
<div class="pad" style="justify-content:flex-start;padding-top:0">
  <div class="eyebrow a" style="animation:fadeIn .6s .2s both">Lifetime rewards</div>
  <div class="h1" style="margin-top:22px;font-size:120px"><div class="a" style="animation:fadeUp .8s .5s both">From Earth</div><div class="a" style="animation:fadeUp .8s .9s both">to <span class="blue">the Moon</span></div></div>
  <div class="lead a" style="margin-top:28px;max-width:540px;animation:fadeIn .8s 1.3s both">10 real medals. One lifetime journey.</div>
</div>
<div class="endmoon">{amoon(520, 654, 570, cx0="-600px")}</div>
{medals}
<div style="position:absolute;left:0;right:0;bottom:290px;text-align:center">
  <div class="lead a" style="animation:fadeIn .8s 8.4s both">First Light unlocks at 50 points.</div>
  <div class="a" style="margin-top:30px;animation:fadeUp .8s 9s both"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return css, body


def build_and_render(filt=""):
    os.makedirs(SRC, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    exe = os.environ.get("CHROMIUM_PATH")
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        for name, (fn, dur) in ANIMS.items():
            if filt not in name:
                continue
            css, body = fn()
            path = os.path.join(SRC, name + ".html")
            with open(path, "w", encoding="utf-8") as f:
                f.write(page(name, body, css, dur))
            pg.goto("file://" + path)
            pg.wait_for_load_state("networkidle")
            pg.evaluate("document.fonts.ready")
            pg.evaluate("document.getAnimations().forEach(a => a.pause())")
            mp4 = os.path.join(OUT, name + ".mp4")
            ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", mp4],
                                  stdin=subprocess.PIPE)
            frame = pg.locator(".frame")
            for i in range(int(dur * FPS)):
                t = i * 1000 / FPS
                pg.evaluate(f"document.getAnimations().forEach(a => {{ a.currentTime = {t}; }})")
                ff.stdin.write(frame.screenshot(type="jpeg", quality=92))
            ff.stdin.close()
            ff.wait()
            print("rendered", name)
        b.close()


if __name__ == "__main__":
    build_and_render(sys.argv[1] if len(sys.argv) > 1 else "")
