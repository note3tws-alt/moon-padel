"""Shared building blocks for the Moon Padel Instagram creatives.

build.py uses these to write one HTML file per creative into src/.
The HTML in src/ is the editable source; render.py turns it into PNG.
"""

FEED = (1080, 1440)
STORY = (1080, 1920)


def page(title, body, kind="feed", bg="a", extra_css=""):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../assets/theme.css">
<style>{extra_css}</style>
</head><body>
<div class="frame {kind} bg-{bg}">
{body}
</div>
</body></html>
"""


def ph(text):
    """A bracketed placeholder the founders must fill. Shows in orange."""
    return f'<span class="ph">[{text}]</span>'


# ---------- Logo and moon ----------

def logo(h=64):
    return f'<img class="logo" src="../assets/logo-horizontal-transparent.png" style="height:{h}px" alt="MoonPadel">'


def stacked_logo(w=520):
    return f'<img src="../assets/logo-stacked-transparent.png" style="width:{w}px;display:block;filter:drop-shadow(0 0 50px rgba(46,139,234,.45))" alt="MoonPadel">'


PHASES = {"new": 0.06, "crescent": 0.24, "quarter": 0.46, "gibbous": 0.72, "full": None}


def moon(size, phase="full", style=""):
    """The founders' moon mark, masked into a phase. Never redrawn."""
    d = PHASES[phase]
    if d is None:
        mask = ""
    else:
        r = size * 0.5
        cx = size * 0.5 - d * size
        g = f"radial-gradient(circle at {cx:.0f}px {size/2:.0f}px, transparent {r-10:.0f}px, #000 {r+6:.0f}px)"
        mask = f"-webkit-mask-image:{g};mask-image:{g};"
    return (f'<div class="moonwrap" style="width:{size}px;height:{size}px;{style}">'
            f'<img class="ghost" src="../assets/moon-mark.png" alt="">'
            f'<img class="lit mark" src="../assets/moon-mark.png" style="{mask}" alt="MoonPadel moon mark"></div>')


def topbar(meta=""):
    return f'<div class="topbar">{logo(60)}<div class="meta">{meta}</div></div>'


def foot(left="moonpadel.ae", right='WhatsApp <span class="cta">MOON</span>'):
    return f'<div class="foot"><div>{left}</div><div>{right}</div></div>'


# ---------- Icons ----------

S = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"'
JOURNEY_ICONS = {
    "first light": f'<path {S} d="M18 66h64"/><path {S} d="M32 66a18 18 0 0 1 36 0"/><path {S} d="M50 30v-8M28 40l-6-6M72 40l6-6M20 54h-6M80 54h6"/>',
    "liftoff": f'<path {S} d="M30 52l20-20 20 20"/><path {S} d="M30 72l20-20 20 20"/><path {S} d="M50 22v-4"/>',
    "orbit": f'<circle {S} cx="50" cy="50" r="14"/><ellipse {S} cx="50" cy="50" rx="34" ry="11" transform="rotate(-22 50 50)"/>',
    "stardust": f'<path {S} d="M46 22c3 16 8 21 24 24-16 3-21 8-24 24-3-16-8-21-24-24 16-3 21-8 24-24z"/><path {S} d="M74 64c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z"/>',
    "comet": f'<circle {S} cx="64" cy="36" r="12"/><path {S} d="M55 45L22 78M48 36L28 56M64 52L44 72"/>',
    "nebula": f'<path {S} d="M50 50c0-4 6-4 6 0 0 8-12 8-12 0 0-12 18-12 18 0 0 16-24 16-24 0 0-20 30-20 30 0"/>',
    "eclipse": f'<circle {S} cx="50" cy="50" r="24"/><circle cx="50" cy="50" r="17" fill="currentColor" opacity=".25"/><path {S} d="M50 16v-4M50 88v-4M16 50h-4M88 50h-4"/>',
    "supernova": f'<circle {S} cx="50" cy="50" r="10"/><path {S} d="M50 18v14M50 68v14M18 50h14M68 50h14M28 28l9 9M63 63l9 9M72 28l-9 9M37 63l-9 9"/>',
    "polaris star": f'<circle {S} cx="50" cy="50" r="30" opacity=".6"/><path {S} d="M50 14l7 29 29 7-29 7-7 29-7-29-29-7 29-7z"/>',
    "moon legend": f'<path {S} d="M60 22a30 30 0 1 0 18 46 24 24 0 1 1-18-46z"/>',
}

JOURNEY = [
    ("First Light", 50, "Your first spark. The journey begins."),
    ("Liftoff", 100, "Engines on. You're off the ground."),
    ("Orbit", 175, "You're circling the court like a regular."),
    ("Stardust", 250, "You're made of padel now."),
    ("Comet", 350, "Fast, bright and hard to miss."),
    ("Nebula", 450, "Where new stars are born."),
    ("Eclipse", 575, "You've outshone the crowd."),
    ("Supernova", 700, "An explosion of effort."),
    ("Polaris Star", 850, "The guiding star that shows the way to the Moon."),
    ("Moon Legend", 1000, "You've touched the Moon."),
]


def journey_medal(name, size=170, locked=False):
    gold = name.lower() == "moon legend"
    rim1, rim2 = ("#FFE7A3", "#C9962E") if gold else ("#F2F7FF", "#7C8CA8")
    icon_col = "#F2C14E" if gold else "#DDEBFF"
    op = ".35" if locked else "1"
    icon = JOURNEY_ICONS[name.lower()]
    return f'''<svg class="medal" width="{size}" height="{size*1.25:.0f}" viewBox="0 0 100 125" style="opacity:{op}">
<defs><linearGradient id="r{name[:3]}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{rim1}"/><stop offset="1" stop-color="{rim2}"/></linearGradient>
<radialGradient id="f{name[:3]}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#1B2C55"/><stop offset="1" stop-color="#070C1C"/></radialGradient></defs>
<path d="M30 0h16l10 30H40z" fill="#1E6FD9"/><path d="M70 0H54L44 30h16z" fill="#2E9BFF"/>
<circle cx="50" cy="75" r="44" fill="url(#r{name[:3]})" style="filter:drop-shadow(0 0 8px rgba(63,184,255,.6))"/>
<circle cx="50" cy="75" r="37" fill="url(#f{name[:3]})"/>
<g transform="translate(22 47) scale(.56)" style="color:{icon_col}">{icon}</g>
</svg>'''


def podium_medal(place, size=200):
    cols = {1: ("#FFE9A8", "#F2C14E", "#A8781E"), 2: ("#FFFFFF", "#C9D3E0", "#7D8899"), 3: ("#F7C9A2", "#D08A55", "#8A5128")}
    a, b, c = cols[place]
    return f'''<svg class="medal" width="{size}" height="{size*1.3:.0f}" viewBox="0 0 100 130">
<defs><radialGradient id="p{place}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="{a}"/><stop offset=".55" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></radialGradient></defs>
<path d="M28 0h18l10 34H38z" fill="#1E6FD9"/><path d="M72 0H54L44 34h18z" fill="#2E9BFF"/>
<circle cx="50" cy="80" r="44" fill="url(#p{place})" style="filter:drop-shadow(0 0 14px {b}88)"/>
<circle cx="50" cy="80" r="34" fill="none" stroke="{c}" stroke-width="2" opacity=".7"/>
<text x="50" y="94" text-anchor="middle" font-family="Montserrat" font-weight="800" font-size="38" fill="{c}">{place}</text>
</svg>'''


def court(w=300, glow=True, extra=""):
    h = w * 2
    sw = 3
    return f'''<svg width="{w}" height="{h}" viewBox="0 0 100 200" style="{'filter:drop-shadow(0 0 10px rgba(63,184,255,.8))' if glow else ''}">
<rect x="2" y="2" width="96" height="196" rx="2" fill="rgba(29,63,166,.28)" stroke="#6CCBFF" stroke-width="{sw*0.4}"/>
<line x1="2" y1="100" x2="98" y2="100" stroke="#E9F4FF" stroke-width="{sw*0.6}"/>
<line x1="2" y1="31" x2="98" y2="31" stroke="#6CCBFF" stroke-width="{sw*0.3}"/>
<line x1="2" y1="169" x2="98" y2="169" stroke="#6CCBFF" stroke-width="{sw*0.3}"/>
<line x1="50" y1="31" x2="50" y2="169" stroke="#6CCBFF" stroke-width="{sw*0.3}"/>
{extra}
</svg>'''


def lock_icon(size=120, color="#6CCBFF"):
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 100 100" style="filter:drop-shadow(0 0 16px rgba(63,184,255,.8))">
<rect x="20" y="44" width="60" height="46" rx="10" fill="none" stroke="{color}" stroke-width="6"/>
<path d="M32 44V32a18 18 0 0 1 36 0v12" fill="none" stroke="{color}" stroke-width="6"/>
<circle cx="50" cy="64" r="6" fill="{color}"/><path d="M50 68v10" stroke="{color}" stroke-width="6" stroke-linecap="round"/></svg>'''


def wa_icon(size=44):
    return f'''<svg width="{size}" height="{size}" viewBox="0 0 32 32"><path fill="#25D366" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3z"/><path fill="#fff" d="M23.2 19.4c-.4-.2-2.3-1.1-2.6-1.2-.4-.1-.6-.2-.9.2-.3.4-1 1.2-1.2 1.4-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.1-.3 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.8-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.7 1.6 4c.2.3 2.7 4.2 6.6 5.9 2.5 1 3.4 1.1 4.6.9.7-.1 2.3-.9 2.6-1.9.3-.9.3-1.7.2-1.9-.1-.2-.3-.3-.7-.5z"/></svg>'''
