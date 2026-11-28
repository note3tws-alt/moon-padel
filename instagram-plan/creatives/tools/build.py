"""Write every Moon Padel Instagram creative to src/*.html.

Run:  python3 instagram-plan/creatives/tools/build.py
Then: python3 instagram-plan/creatives/tools/render.py

You can also edit a file in src/ by hand and only run render.py.
Running build.py again overwrites src/, so make lasting copy changes here.
Orange [BRACKETS] are placeholders the founders must confirm before posting.
"""
import os
from parts import (page, ph, logo, stacked_logo, moon, topbar, foot, journey_medal,
                   podium_medal, court, lock_icon, wa_icon, JOURNEY)

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src")
CREATIVES = {}


def creative(name):
    def wrap(fn):
        CREATIVES[name] = fn
        return fn
    return wrap


# =====================================================================
# PRE-LAUNCH: teasers (moon grows from crescent to full over the run-up)
# =====================================================================

@creative("P01-teaser-rising")
def _():
    body = f"""
{moon(980, "crescent", "position:absolute;left:300px;top:150px")}
<div class="pad" style="justify-content:flex-end">
  <div class="eyebrow">Dubai · after dark</div>
  <div class="h1" style="margin-top:28px">Something<br>is <span class="blue">rising</span></div>
  <div class="lead" style="margin-top:34px;max-width:760px">Over Dubai. On the court. Under the lights.</div>
  <div class="row" style="margin-top:60px"><div class="line">Coming soon</div><div class="spacer"></div><div class="line" style="letter-spacing:.2em">01 / 04</div></div>
</div>"""
    return page("Teaser 1: Something is rising", body, "feed", "a")


@creative("P02-teaser-points")
def _():
    digits = "".join(f'<div class="card" style="width:190px;height:270px;display:flex;align-items:center;justify-content:center"><span class="num" style="font-size:190px;color:#EAF6FF;text-shadow:0 0 40px rgba(63,184,255,.8)">0</span></div>' for _ in range(4))
    body = f"""
{topbar("02 / 04")}
<div class="pad" style="justify-content:center;align-items:center;text-align:center">
  <div class="eyebrow">Your padel points this year</div>
  <div class="row" style="gap:26px;margin:56px 0 30px">{digits}</div>
  <div class="line" style="letter-spacing:.5em">Saved: none</div>
  <div class="h2" style="margin-top:110px">Every rally.<br>Every point.<br><span class="blue">Gone.</span></div>
  <div class="lead" style="margin-top:44px">Not for much longer.</div>
</div>
{foot("Moon Padel · Dubai", "Coming soon")}"""
    return page("Teaser 2: Points gone", body, "feed", "b")


@creative("P03-teaser-numbers")
def _():
    cells = [("16", "players"), ("4", "courts"), ("6", "rounds"), ("1", "podium")]
    grid = "".join(f'''<div class="card{' hot' if n=='1' else ''}" style="height:400px;display:flex;flex-direction:column;justify-content:space-between;padding:40px 44px">
      <div class="num {'gold-t' if n=='1' else 'blue'}" style="font-size:230px;line-height:.9">{n}</div>
      <div class="eyebrow" style="font-size:28px;color:#C9D6EA;text-shadow:none">{l}</div></div>''' for n, l in cells)
    body = f"""
{topbar("03 / 04")}
<div class="pad" style="padding-top:110px">
  <div class="h3">One night.<br><span class="blue">Do the maths.</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:64px">{grid}</div>
  <div class="lead" style="margin-top:50px">Dubai. Coming soon.</div>
</div>"""
    return page("Teaser 3: The numbers", body, "feed", "a")


@creative("P04-teaser-secret-round")
def _():
    body = f"""
{moon(760, "gibbous", "position:absolute;left:160px;top:-140px;opacity:.9")}
<div class="pad" style="justify-content:flex-end">
  <div class="card hot" style="padding:56px 60px;text-align:center">
    <div style="display:flex;justify-content:center">{lock_icon(120)}</div>
    <div class="eyebrow" style="margin-top:26px">Round 6 of 6 · final round</div>
    <div class="h2" style="margin-top:22px">Scores<br>locked</div>
    <div class="lead" style="margin-top:26px">Nobody sees the final standings.<br>Not until the reveal.</div>
  </div>
  <div class="row" style="margin-top:50px"><div class="line">Coming soon</div><div class="spacer"></div><div class="line" style="letter-spacing:.2em">04 / 04</div></div>
</div>"""
    return page("Teaser 4: Round 6 is secret", body, "feed", "b")


@creative("P05-reveal")
def _():
    body = f"""
<div class="pad" style="align-items:center;text-align:center;justify-content:space-between">
  <div class="eyebrow" style="margin-top:20px">Now in Dubai</div>
  <div>{stacked_logo(700)}</div>
  <div>
    <div class="h2" style="font-size:84px">Padel nights where<br><span class="blue">every point counts</span></div>
    <div class="lead" style="margin-top:30px">Americano events. Live scores on the big screen.<br>A podium every night. Points saved forever.</div>
    <div style="margin-top:46px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
  </div>
</div>"""
    return page("Reveal: Moon Padel is here", body, "feed", "a")


# ---------- Carousel: How a Moon Padel night works (8 slides) ----------

def how_slide(n, eyebrow, title, content, bg="a"):
    body = f"""
{topbar(f"How it works · {n}/8")}
<div class="pad" style="padding-top:120px">
  <div class="eyebrow">{eyebrow}</div>
  <div class="h3" style="margin-top:20px;font-size:76px">{title}</div>
  <div style="margin-top:56px;flex:1;display:flex;flex-direction:column">{content}</div>
</div>
<div class="foot"><div>Swipe</div><div style="font-size:34px;color:var(--glow)">→</div></div>"""
    return page(f"How it works {n}", body, "feed", bg)


@creative("P06-how-01-cover")
def _():
    body = f"""
{moon(1100, "full", "position:absolute;left:-10px;top:-260px;opacity:.95")}
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,0) 30%,rgba(5,7,15,.92) 62%)"></div>
<div class="pad" style="justify-content:flex-end">
  <div class="eyebrow">90 minutes · 6 rounds · 1 podium</div>
  <div class="h1" style="margin-top:26px;font-size:120px">How a<br>Moon Padel<br><span class="blue">night works</span></div>
  <div class="row" style="margin-top:50px"><div class="lead">Swipe. It takes 30 seconds.</div><div class="spacer"></div><div style="font-size:60px;color:var(--glow)">→</div></div>
</div>"""
    return page("How it works cover", body, "feed", "b")


@creative("P06-how-02-message")
def _():
    chat = f"""<div class="card" style="padding:46px;flex:1;display:flex;flex-direction:column;gap:28px">
      <div class="row" style="gap:20px">{wa_icon(64)}<div><div class="mont" style="font-weight:800;font-size:34px">Moon Padel</div><div class="small">WhatsApp</div></div></div>
      <div style="align-self:flex-end;background:#1E6A4A;border-radius:28px 28px 6px 28px;padding:24px 36px;font-size:44px;font-weight:700">MOON</div>
      <div style="align-self:flex-start;max-width:720px;background:#16213F;border-radius:28px 28px 28px 6px;padding:26px 34px;font-size:32px;line-height:1.45;color:#DCE6F5">Welcome to Moon Padel. Here is your link to create your player profile. Pick your level and you're in.</div>
      <div style="align-self:flex-start;max-width:720px;background:#16213F;border-radius:28px 28px 28px 6px;padding:26px 34px;font-size:32px;line-height:1.45;color:#DCE6F5">Next event: {ph("DAY · TIME")} at {ph("VENUE")}. Confirm and pay by Ziina to lock your spot.</div>
    </div>"""
    return how_slide(2, "Step 1 · Join", 'Send <span class="blue">“MOON”</span><br>on WhatsApp', chat)


@creative("P06-how-03-league")
def _():
    rows = [("D-", "Complete beginner", False), ("D", "Keeps a rally going, knows the basics", False), ("D+", "Consistent rallies and serves", True),
            ("C-", "Lower intermediate", False), ("C", "Solid, uses the walls", False), ("C+", "Strong, plays tactically", False)]
    items = "".join(f'''<div class="card{' hot' if on else ''}" style="padding:22px 30px;display:flex;align-items:center;gap:30px;margin-bottom:18px">
        <span class="lvl{' c' if l.startswith('C') else ''}{' on' if on else ''}">{l}</span><span style="font-size:32px;color:#DCE6F5">{t}</span></div>''' for l, t, on in rows)
    content = items + '<div class="small" style="margin-top:14px">One event = one league. D and C players never play in the same event.</div>'
    return how_slide(3, "Step 2 · Pick your league", 'Beginner or<br><span class="blue">intermediate?</span>', content, "b")


@creative("P06-how-04-checkin")
def _():
    names = ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6", "Player 7", "Player 8",
             "Player 9", "Player 10", "Player 11", "Player 12", "Player 13", "Player 14", "Player 15", "You"]
    cards = "".join(f'''<div class="card{' hot' if (i % 3 != 2 or n=='You') else ''}" style="padding:16px 18px;border-radius:18px;{'background:rgba(30,155,255,.28);' if n=='You' else ''}">
      <div class="mont" style="font-weight:800;font-size:24px">{n}</div><div style="font-size:18px;color:{'#7CD3FF' if (i % 3 != 2 or n=='You') else '#8FA0BC'}">{'✓ checked in' if (i % 3 != 2 or n=='You') else 'tap to check in'}</div></div>''' for i, n in enumerate(names))
    content = f'''<div class="screen" style="padding:40px">
      <div class="row"><div class="mont" style="font-weight:800;font-size:30px;letter-spacing:.06em">TAP YOUR NAME TO CHECK IN</div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:28px">{cards}</div>
      <div class="row" style="margin-top:30px;gap:24px"><div style="flex:1;height:14px;border-radius:9px;background:#16213F"><div style="width:72%;height:100%;border-radius:9px;background:linear-gradient(90deg,#1E9BFF,#6CCBFF);box-shadow:0 0 14px #1E9BFF"></div></div><div class="mont" style="font-weight:800;font-size:26px">12 / 16 IN</div></div>
    </div>
    <div class="lead" style="margin-top:40px">Your name is already waiting on the tablet. One tap and you're in.</div>'''
    return how_slide(4, "Step 3 · Arrive", 'Find your name.<br><span class="blue">Tap. You\'re in.</span>', content)


@creative("P06-how-05-rounds")
def _():
    ladder = "".join(f'''<div class="card{' hot' if c==1 else ''}" style="padding:22px 30px;display:flex;align-items:center;margin-bottom:16px">
       <span class="mont" style="font-weight:800;font-size:34px;width:200px">COURT {c}</span><span style="font-size:28px;color:#C9D6EA">{t}</span></div>''' for c, t in
                     [(1, "Top court. Win and you stay."), (2, "Win, move up. Lose, move down."), (3, "Win, move up. Lose, move down."), (4, "Every pair gets a way back.")])
    content = f'''<div class="row" style="gap:46px;align-items:stretch">
      <div style="flex:1">{ladder}</div>
      <div class="card" style="width:300px;padding:30px;display:flex;flex-direction:column;justify-content:center;text-align:center">
        <div class="num blue" style="font-size:120px">6</div><div class="eyebrow" style="font-size:20px">rounds</div>
        <div class="rule" style="margin:26px 0"></div>
        <div class="num blue" style="font-size:120px">15</div><div class="eyebrow" style="font-size:20px">min each</div></div>
    </div>
    <div class="lead" style="margin-top:44px"><b>New partner every round.</b> Winners move up a court, losers move down. You'll play with most of the room by the end of the night.</div>'''
    return how_slide(5, "Step 4 · Play", 'Winners up.<br><span class="blue">Losers down.</span>', content, "b")


@creative("P06-how-06-points")
def _():
    content = f'''<div class="card hot" style="padding:56px;text-align:center">
      <div class="row" style="justify-content:center;gap:60px">
        <div><div class="eyebrow" style="font-size:22px">Your pair</div><div class="num" style="font-size:230px;color:#fff;text-shadow:0 0 40px rgba(63,184,255,.8)">6</div></div>
        <div class="num" style="font-size:120px;color:var(--glow)">–</div>
        <div><div class="eyebrow" style="font-size:22px;color:var(--muted);text-shadow:none">Them</div><div class="num" style="font-size:230px;color:#9FB2D0">3</div></div>
      </div>
      <div class="row" style="justify-content:center;gap:30px;margin-top:20px"><span class="pill">You +6 pts</span><span class="pill" style="border-color:rgba(143,160,188,.6);box-shadow:none">Them +3 pts</span></div>
    </div>
    <div class="lead" style="margin-top:50px">No hidden formula. The points your pair wins go to <b>you</b>. Lose 6-3 and you still take 3 home. Every point counts.</div>'''
    return how_slide(6, "Step 5 · Score", 'Every point<br><span class="blue">is yours</span>', content)


@creative("P06-how-07-reveal")
def _():
    content = f'''<div class="row" style="justify-content:center;align-items:flex-end;gap:40px;margin-top:10px">
      <div style="text-align:center">{podium_medal(2, 200)}<div class="mont" style="font-weight:800;font-size:30px;margin-top:10px">2ND</div></div>
      <div style="text-align:center">{podium_medal(1, 260)}<div class="mont gold-t" style="font-weight:800;font-size:34px;margin-top:10px">1ST</div></div>
      <div style="text-align:center">{podium_medal(3, 200)}<div class="mont" style="font-weight:800;font-size:30px;margin-top:10px">3RD</div></div>
    </div>
    <div class="lead" style="margin-top:60px">Round 6 is played in secret. The big screen hides the totals. Then bronze, silver and gold are revealed one at a time, with real medals.</div>'''
    return how_slide(7, "Step 6 · The finale", 'Secret round.<br><span class="blue">Podium reveal.</span>', content, "b")


@creative("P06-how-08-forever")
def _():
    body = f"""
{topbar("How it works · 8/8")}
<div class="pad" style="padding-top:120px;align-items:center;text-align:center">
  <div class="eyebrow">Step 7 · Come back</div>
  <div class="h2" style="margin-top:24px;font-size:88px">Every point<br>is <span class="blue">saved forever</span></div>
  <div class="card hot" style="margin-top:56px;padding:44px 56px;width:100%">
    <div class="num" style="font-size:150px;color:#fff;text-shadow:0 0 40px rgba(63,184,255,.8)">233</div>
    <div class="eyebrow" style="font-size:22px">Lifetime points · sample</div>
    <div style="margin-top:30px;height:18px;border-radius:9px;background:#16213F"><div style="width:78%;height:100%;border-radius:9px;background:linear-gradient(90deg,#1E9BFF,#6CCBFF);box-shadow:0 0 14px #1E9BFF"></div></div>
    <div class="row" style="margin-top:16px;font-size:26px;color:#C9D6EA"><span>Next medal: <b style="color:#fff">STARDUST</b></span><span class="spacer"></span><span style="color:var(--glow);font-weight:700">17 pts to go</span></div>
  </div>
  <div class="lead" style="margin-top:40px">Your profile, your medals, your name on the leaderboard.</div>
  <div style="margin-top:40px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return page("How it works 8", body, "feed", "a")


# ---------- Carousel: the 10-medal journey (4 slides) ----------

@creative("P07-medals-01-cover")
def _():
    path = "".join(f'<div style="position:absolute;left:{70+i*92}px;top:{1150-i*72}px">{journey_medal(n, 120 if i<9 else 150)}</div>' for i, (n, p, s) in enumerate(JOURNEY))
    body = f"""
{moon(500, "full", "position:absolute;right:-170px;top:400px")}
{path}
<div class="pad" style="justify-content:flex-start">
  <div class="eyebrow">Lifetime rewards</div>
  <div class="h1" style="margin-top:22px;font-size:112px">From Earth<br>to <span class="blue">the Moon</span></div>
  <div class="lead" style="margin-top:28px;max-width:620px">10 real medals. One lifetime journey.</div>
</div>
<div class="foot"><div>Earth · 0 pts</div><div style="color:var(--glow)">Swipe →</div></div>"""
    return page("Medal journey cover", body, "feed", "b")


def medal_rows(items):
    out = ""
    for (n, p, s) in items:
        out += f'''<div class="card" style="padding:18px 30px;display:flex;align-items:center;gap:30px;margin-bottom:16px">
          {journey_medal(n, 92)}<div style="flex:1"><div class="mont" style="font-weight:800;font-size:36px;text-transform:uppercase">{n}</div><div style="font-size:26px;color:#AFC0DA;margin-top:4px">{s}</div></div>
          <div style="text-align:right"><div class="num blue" style="font-size:48px">{p}</div><div class="small" style="font-size:20px;letter-spacing:.2em">PTS</div></div></div>'''
    return out


@creative("P07-medals-02-first-five")
def _():
    body = f"""
{topbar("Medal journey · 2/4")}
<div class="pad" style="padding-top:110px">
  <div class="eyebrow">Medals 1 to 5</div>
  <div class="h3" style="margin-top:16px">The first ones<br><span class="blue">come fast</span></div>
  <div style="margin-top:40px">{medal_rows(JOURNEY[:5])}</div>
</div>"""
    return page("Medals 1-5", body, "feed", "a")


@creative("P07-medals-03-last-five")
def _():
    body = f"""
{topbar("Medal journey · 3/4")}
<div class="pad" style="padding-top:110px">
  <div class="eyebrow">Medals 6 to 10</div>
  <div class="h3" style="margin-top:16px">The last ones<br><span class="gold-t">take dedication</span></div>
  <div style="margin-top:40px">{medal_rows(JOURNEY[5:])}</div>
</div>"""
    return page("Medals 6-10", body, "feed", "b")


@creative("P07-medals-04-start")
def _():
    body = f"""
{topbar("Medal journey · 4/4")}
<div class="pad" style="padding-top:140px;align-items:center;text-align:center">
  {journey_medal("First Light", 300)}
  <div class="eyebrow" style="margin-top:30px">Medal 1 of 10</div>
  <div class="h2" style="margin-top:20px;font-size:90px">First Light<br><span class="blue">50 points</span></div>
  <div class="lead" style="margin-top:34px">Every point you win, in every event, counts towards it. Even the ones from a loss.</div>
  <div style="margin-top:50px"><span class="btn">{wa_icon(46)} Start: WhatsApp “MOON”</span></div>
</div>"""
    return page("Medals start", body, "feed", "a")


@creative("P08-find-your-league")
def _():
    def col(league, cls, rows, note):
        items = "".join(f'''<div class="card" style="padding:22px 26px;margin-bottom:16px;display:flex;gap:22px;align-items:center"><span class="lvl {cls}" style="min-width:90px">{l}</span><span style="font-size:27px;color:#DCE6F5;line-height:1.3">{t}</span></div>''' for l, t in rows)
        return f'''<div style="flex:1"><div class="eyebrow" style="{'color:#B9ACFF;text-shadow:0 0 18px rgba(154,136,255,.6)' if cls=='c' else ''}">{league}</div><div class="small" style="margin:8px 0 24px">{note}</div>{items}</div>'''
    d = col("D League", "", [("D+", "Consistent rallies and serves"), ("D", "Keeps a rally going"), ("D-", "Complete beginner")], "Beginners. Start here.")
    c = col("C League", "c", [("C+", "Plays tactically"), ("C", "Uses the walls"), ("C-", "Lower intermediate")], "Intermediate players.")
    body = f"""
{topbar("Levels")}
<div class="pad" style="padding-top:120px">
  <div class="h2">Find your<br><span class="blue">league</span></div>
  <div class="lead" style="margin-top:26px">Pick your best guess. We'll confirm it with you after your first night.</div>
  <div class="row" style="gap:34px;margin-top:56px;align-items:flex-start">{d}{c}</div>
</div>
{foot("Not sure? Ask us", 'WhatsApp <span class="cta">MOON</span>')}"""
    return page("Find your league", body, "feed", "b")


# ---------- Countdown stories: the moon fills as launch gets closer ----------

def countdown(name, big, unit, phase, line, bg):
    body = f"""
{topbar("Moonrise")}
<div class="pad" style="align-items:center;text-align:center">
  {moon(720, phase, "margin-top:10px")}
  <div class="num" style="font-size:300px;line-height:.85;margin-top:30px;color:#fff;text-shadow:0 0 60px rgba(63,184,255,.8)">{big}</div>
  <div class="eyebrow" style="font-size:40px;margin-top:20px">{unit}</div>
  <div class="lead" style="margin-top:40px">{line}</div>
</div>
{foot("Moon Padel · Dubai", "Turn on notifications")}"""
    return page(name, body, "story", bg)


@creative("P09-story-countdown-7")
def _():
    return countdown("Countdown 7", "7", "days to moonrise", "crescent", "Something is coming to Dubai's courts.", "a")


@creative("P09-story-countdown-3")
def _():
    return countdown("Countdown 3", "3", "days to moonrise", "quarter", "16 spots on the first night. Founding players hear first.", "b")


@creative("P09-story-countdown-1")
def _():
    return countdown("Countdown 1", "1", "day to moonrise", "gibbous", "Tomorrow the full plan goes live.", "a")


@creative("P09-story-countdown-tonight")
def _():
    body = f"""
{topbar("Moonrise")}
<div class="pad" style="align-items:center;text-align:center">
  {moon(780, "full")}
  <div class="h1" style="font-size:180px;margin-top:40px">Tonight</div>
  <div class="eyebrow" style="font-size:32px;margin-top:20px">{ph("TIME")} · Moon Padel goes live</div>
  <div class="lead" style="margin-top:40px">Watch this space.</div>
</div>
{foot("Moon Padel · Dubai", "Set a reminder")}"""
    return page("Countdown tonight", body, "story", "b")


@creative("P10-story-join-mission")
def _():
    body = f"""
{topbar("Join")}
<div class="pad" style="align-items:center;text-align:center">
  {moon(460, "full")}
  <div class="h1" style="font-size:128px;margin-top:40px">Join the<br><span class="blue">mission</span></div>
  <div class="lead" style="margin-top:30px">Create your player profile in one minute.<br>Your journey to the Moon starts on night one.</div>
  <div class="card hot" style="margin-top:56px;padding:40px 50px;width:100%">
    <div class="row" style="gap:26px;justify-content:center">{wa_icon(80)}<div style="text-align:left"><div class="small">Send this on WhatsApp</div><div class="num" style="font-size:96px;color:#fff;letter-spacing:.06em">MOON</div></div></div>
    <div class="mont" style="margin-top:20px;font-weight:700;font-size:30px;color:var(--ice)">{ph("WHATSAPP NUMBER")}</div>
  </div>
  <div class="small" style="margin-top:34px">Or tap the link sticker</div>
</div>"""
    return page("Join the mission", body, "story", "a")


@creative("P11-story-league-quiz")
def _():
    body = f"""
{topbar("Quick quiz")}
<div class="pad" style="align-items:center;text-align:center">
  <div class="eyebrow">Be honest</div>
  <div class="h1" style="font-size:120px;margin-top:22px">Which league<br>are <span class="blue">you?</span></div>
  <div class="lead" style="margin-top:30px">Last rally you played, you...</div>
  <div style="margin-top:50px;width:100%;display:flex;flex-direction:column;gap:22px">
    <div class="card" style="padding:30px;font-size:34px;text-align:left"><span class="lvl" style="margin-right:24px">D-</span>...asked which side to stand</div>
    <div class="card" style="padding:30px;font-size:34px;text-align:left"><span class="lvl" style="margin-right:24px">D</span>...kept it going for 6 shots</div>
    <div class="card" style="padding:30px;font-size:34px;text-align:left"><span class="lvl c" style="margin-right:24px">C</span>...won it off the back glass</div>
  </div>
  <div class="small" style="margin-top:40px;border:2px dashed rgba(169,219,255,.4);border-radius:20px;padding:26px 30px;width:100%">Place the Instagram quiz sticker here, with the same three answers</div>
</div>"""
    return page("League quiz", body, "story", "b")


@creative("P12-first-night-poster")
def _():
    rows = [("Date", ph("DATE")), ("Time", ph("START") + " to " + ph("END")), ("Venue", ph("VENUE")), ("League", "D League (beginners)"), ("Entry", "AED " + ph("FEE"))]
    info = "".join(f'<div class="row" style="padding:20px 0;border-bottom:1px solid rgba(63,184,255,.2)"><span class="eyebrow" style="font-size:22px;width:220px">{k}</span><span class="mont" style="font-weight:700;font-size:38px">{v}</span></div>' for k, v in rows)
    body = f"""
{moon(860, "full", "position:absolute;left:110px;top:-300px")}
<div class="pad" style="padding-top:470px">
  <div class="eyebrow">Moon Padel · Night 01</div>
  <div class="h1" style="margin-top:16px;font-size:150px">First<br><span class="blue">night</span></div>
  <div class="card" style="margin-top:40px;padding:14px 44px 20px">{info}</div>
  <div class="row" style="margin-top:44px;gap:30px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span><span class="lead" style="font-size:30px">16 players.<br>4 courts.</span></div>
</div>"""
    return page("First night poster", body, "feed", "a")


@creative("P13-story-founding-16")
def _():
    slots = "".join(f'<div class="card{" hot" if i < 0 else ""}" style="height:150px;display:flex;align-items:center;justify-content:center;border-radius:22px"><span class="num" style="font-size:44px;color:rgba(169,219,255,.5)">{i+1:02d}</span></div>' for i in range(16))
    body = f"""
{topbar("Founding players")}
<div class="pad" style="align-items:center;text-align:center">
  <div class="eyebrow">Night 01</div>
  <div class="h1" style="font-size:120px;margin-top:20px">The founding<br><span class="blue">16</span></div>
  <div class="lead" style="margin-top:28px">The first names on the Moon Padel leaderboard. Forever.</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:50px;width:100%">{slots}</div>
  <div class="mont" style="margin-top:40px;font-weight:800;font-size:44px">{ph("X")} / 16 confirmed</div>
</div>"""
    return page("Founding 16", body, "story", "b")


# =====================================================================
# POST-LAUNCH
# =====================================================================

def event_poster(name, league, cls, bg):
    accent = "#B9ACFF" if cls == "c" else "var(--glow)"
    rows = [("When", ph("DAY, DATE")), ("Time", ph("START") + " to " + ph("END")), ("Where", ph("VENUE")), ("Entry", "AED " + ph("FEE"))]
    info = "".join(f'<div style="padding:18px 0;border-bottom:1px solid rgba(63,184,255,.2)"><div class="eyebrow" style="font-size:20px;color:{accent};text-shadow:none">{k}</div><div class="mont" style="font-weight:700;font-size:40px;margin-top:6px">{v}</div></div>' for k, v in rows)
    body = f"""
{topbar("Americano night")}
<div style="position:absolute;right:70px;top:200px;transform:rotate(8deg)">{court(330)}</div>
<div class="pad" style="padding-top:140px">
  <span class="lvl {cls} on" style="align-self:flex-start;font-size:30px;height:64px;padding:0 30px">{league}</span>
  <div class="h1" style="margin-top:34px;font-size:136px">This<br>{ph("DAY")}</div>
  <div class="lead" style="margin-top:24px;max-width:560px">16 players. 4 courts. 6 rounds. Live scores and a podium reveal.</div>
  <div class="card" style="margin-top:44px;padding:14px 44px 22px;max-width:640px">{info}</div>
  <div style="margin-top:44px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return page(name, body, "feed", bg)


@creative("L01-event-poster-d")
def _():
    return event_poster("Event poster D League", "D League", "", "a")


@creative("L02-event-poster-c")
def _():
    return event_poster("Event poster C League", "C League", "c", "b")


@creative("L03-story-spots")
def _():
    dots = "".join(f'<div style="width:150px;height:150px;border-radius:50%;border:3px solid {"#6CCBFF" if i < 12 else "rgba(169,219,255,.3)"};{"background:radial-gradient(circle at 40% 35%,#6CCBFF,#1E6FD9);box-shadow:0 0 24px #1E9BFF;" if i < 12 else ""}"></div>' for i in range(16))
    body = f"""
{topbar("This " + ph("DAY"))}
<div class="pad" style="align-items:center;text-align:center">
  <span class="lvl on">D League</span>
  <div class="h1" style="font-size:140px;margin-top:30px">{ph("X")} spots<br><span class="blue">left</span></div>
  <div class="lead" style="margin-top:24px">{ph("DAY")} · {ph("TIME")} · {ph("VENUE")}</div>
  <div style="display:grid;grid-template-columns:repeat(4,150px);gap:36px;margin-top:60px">{dots}</div>
</div>
{foot("Reply to this story", 'or WhatsApp <span class="cta">MOON</span>')}"""
    return page("Spots left", body, "story", "a")


@creative("L04-story-match-day")
def _():
    body = f"""
{moon(1000, "full", "position:absolute;left:40px;top:-120px;opacity:.9")}
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,0) 30%,rgba(5,7,15,.9) 55%)"></div>
<div class="pad" style="justify-content:flex-end">
  <div class="eyebrow">Match day</div>
  <div class="h1" style="font-size:170px;margin-top:20px">Tonight<br>we <span class="blue">play</span></div>
  <div class="card" style="margin-top:40px;padding:36px 44px">
    <div class="row" style="gap:20px"><span class="tag venue">Venue</span><span class="mont" style="font-weight:700;font-size:38px">{ph("VENUE")}</span></div>
    <div class="row" style="gap:20px;margin-top:20px"><span class="tag web">First serve</span><span class="mont" style="font-weight:700;font-size:38px">{ph("TIME")}</span></div>
    <div class="row" style="gap:20px;margin-top:20px"><span class="tag" style="color:var(--gold);border:2px solid rgba(242,193,78,.6)">Reveal</span><span class="mont" style="font-weight:700;font-size:38px">around {ph("TIME")}</span></div>
  </div>
  <div class="lead" style="margin-top:30px">Not playing? Come and watch the podium reveal.</div>
</div>"""
    return page("Match day", body, "story", "b")


@creative("L05-story-live-round")
def _():
    st = [("Player A", 12), ("Player B", 11), ("Player C", 10), ("Player D", 9), ("Player E", 9)]
    rows = "".join(f'<div class="row" style="padding:22px 30px;{"background:rgba(30,155,255,.14);" if i<3 else ""}border-radius:16px;margin-bottom:8px"><span class="num blue" style="font-size:40px;width:80px">{i+1}</span><span class="mont" style="font-weight:700;font-size:38px;flex:1">{n}</span><span class="num" style="font-size:46px">{p}</span></div>' for i, (n, p) in enumerate(st))
    body = f"""
{topbar("Live")}
<div class="pad" style="align-items:stretch">
  <div class="row"><span class="tag" style="color:#FF8A8A;border:2px solid rgba(255,90,90,.7);background:rgba(255,60,60,.12)">● Live</span><span class="spacer"></span><span class="eyebrow" style="font-size:24px">{ph("VENUE")}</span></div>
  <div class="h1" style="font-size:140px;margin-top:40px">Round 3<br><span class="blue">of 6</span></div>
  <div class="screen" style="margin-top:50px;padding:34px 30px">
    <div class="eyebrow" style="font-size:22px;margin:0 0 20px 30px">Standings · after round 2</div>
    {rows}
  </div>
  <div class="lead" style="margin-top:40px;text-align:center">Three rounds left. Anything can happen.</div>
</div>"""
    return page("Live round", body, "story", "a")


@creative("L06-story-scores-locked")
def _():
    body = f"""
<div class="pad" style="align-items:center;justify-content:center;text-align:center">
  {lock_icon(220)}
  <div class="eyebrow" style="margin-top:50px">Round 6 of 6 · final round</div>
  <div class="h1" style="font-size:170px;margin-top:24px">Scores<br><span class="blue">locked</span></div>
  <div class="lead" style="margin-top:40px">16 / 16 final scores in.<br>Bronze first. Then silver. Then gold.</div>
  <div class="card hot" style="margin-top:70px;padding:30px 50px"><span class="mont" style="font-weight:800;font-size:36px;letter-spacing:.2em">GUESS THE WINNER ↓</span></div>
</div>"""
    return page("Scores locked", body, "story", "b")


@creative("L07-podium")
def _():
    def plinth(place, h, col):
        return f'''<div style="display:flex;flex-direction:column;align-items:center;width:280px">
          {podium_medal(place, 170 if place>1 else 210)}
          <div class="mont" style="font-weight:800;font-size:36px;margin-top:16px">{ph("@PLAYER")}</div>
          <div class="num" style="font-size:44px;color:{col};margin:6px 0 20px">{ph("PTS")} pts</div>
          <div style="width:100%;height:{h}px;border-radius:24px 24px 0 0;background:linear-gradient(180deg,{col}55,{col}10);border:2px solid {col}aa;border-bottom:none;display:flex;align-items:flex-start;justify-content:center;padding-top:20px"><span class="num" style="font-size:90px;color:{col}">{place}</span></div></div>'''
    body = f"""
{topbar(ph("DATE") + " · " + ph("LEAGUE"))}
<div class="pad" style="padding-top:110px;align-items:center;text-align:center">
  <div class="eyebrow">Tonight's podium</div>
  <div class="h2" style="margin-top:18px">Under the <span class="blue">lights</span></div>
  <div class="row" style="align-items:flex-end;gap:20px;margin-top:70px">{plinth(2, 260, "#C9D3E0")}{plinth(1, 360, "#F2C14E")}{plinth(3, 190, "#D08A55")}</div>
</div>
{foot("Full results: moonpadel.ae", "Leaderboard updated")}"""
    return page("Podium", body, "feed", "b")


@creative("L08-story-medal-unlocked")
def _():
    body = f"""
<div class="pad" style="align-items:center;text-align:center;justify-content:center">
  <div class="eyebrow">Medal 4 of 10 unlocked</div>
  <div style="margin-top:50px">{journey_medal("Stardust", 420)}</div>
  <div class="mont" style="font-weight:800;font-size:56px;margin-top:40px">{ph("@USERNAME")}</div>
  <div class="h1" style="font-size:150px;margin-top:10px"><span class="blue">Stardust</span></div>
  <div class="lead" style="margin-top:24px">“You're made of padel now.”</div>
  <div class="card" style="margin-top:50px;padding:30px 44px;width:100%">
    <div class="row" style="font-size:30px"><span>{ph("PTS")} lifetime points</span><span class="spacer"></span><span style="color:var(--glow);font-weight:700">Next: Comet at 350</span></div>
  </div>
  <div style="margin-top:50px">{logo(70)}</div>
</div>"""
    return page("Medal unlocked share card", body, "story", "a")


@creative("L09-leaderboard-month")
def _():
    rows = "".join(f'''<div class="row" style="padding:16px 26px;border-radius:16px;margin-bottom:6px;{"background:rgba(30,155,255,.12);" if i<3 else ""}">
      <span class="num" style="font-size:38px;width:80px;color:{["#F2C14E","#C9D3E0","#D08A55"][i] if i<3 else "#6CCBFF"}">{i+1}</span>
      <span class="mont" style="font-weight:700;font-size:34px;flex:1">{ph("@PLAYER")}</span>
      <span class="lvl" style="height:46px;min-width:80px;font-size:22px;margin-right:30px">{ph("LVL")}</span>
      <span class="num" style="font-size:40px;width:150px;text-align:right">{ph("PTS")}</span></div>''' for i in range(10))
    body = f"""
{topbar(ph("MONTH"))}
<div class="pad" style="padding-top:110px">
  <div class="eyebrow">This month · D League</div>
  <div class="h2" style="margin-top:16px">Top <span class="blue">10</span></div>
  <div class="screen" style="margin-top:40px;padding:26px 20px">{rows}</div>
  <div class="lead" style="margin-top:30px;font-size:32px">The board resets on the 1st. Anyone can top it.</div>
</div>"""
    return page("Leaderboard month", body, "feed", "a")


@creative("L10-player-feature")
def _():
    body = f"""
<div style="position:absolute;left:84px;right:84px;top:84px;height:820px;border-radius:30px;border:2px dashed rgba(169,219,255,.45);background:linear-gradient(160deg,rgba(29,63,166,.35),rgba(5,7,15,.2));display:flex;align-items:center;justify-content:center;text-align:center">
  <div><div class="eyebrow" style="font-size:24px">Player photo</div><div class="small" style="margin-top:10px">Action shot from tonight, 912 x 820,<br>cut to fill this frame</div></div>
</div>
<div style="position:absolute;left:84px;right:84px;top:84px;height:820px;border-radius:30px;background:linear-gradient(180deg,rgba(5,7,15,0) 60%,rgba(5,7,15,.85))"></div>
<div class="pad" style="justify-content:flex-end">
  <div class="row" style="gap:20px"><span class="eyebrow">Climber of the night</span><span class="lvl on" style="height:48px;font-size:24px">{ph("LVL")}</span></div>
  <div class="h1" style="font-size:120px;margin-top:20px">{ph("NAME")}</div>
  <div class="row" style="gap:24px;margin-top:40px">
    <div class="card" style="flex:1;padding:26px 30px"><div class="num blue" style="font-size:64px">{ph("N")}</div><div class="small">courts climbed</div></div>
    <div class="card" style="flex:1;padding:26px 30px"><div class="num blue" style="font-size:64px">{ph("N")}</div><div class="small">points tonight</div></div>
    <div class="card" style="flex:1;padding:26px 30px"><div class="num blue" style="font-size:64px">{ph("N")}</div><div class="small">nights played</div></div>
  </div>
  <div class="lead" style="margin-top:30px;font-size:32px">“{ph("ONE LINE FROM THE PLAYER")}”</div>
</div>"""
    return page("Player feature", body, "feed", "b")


@creative("L11-first-time")
def _():
    items = [("No partner needed", "You get a new one every round."), ("No ranking needed", "Pick D-, D or D+. We'll help you choose."),
             ("No pressure", "Every point you win counts, even in a loss."), ("Just turn up", "Your name is already on the tablet.")]
    cards = "".join(f'<div class="card" style="padding:28px 34px;margin-bottom:18px;display:flex;gap:26px;align-items:center"><div class="num blue" style="font-size:54px;width:70px">0{i+1}</div><div><div class="mont" style="font-weight:800;font-size:36px;text-transform:uppercase">{t}</div><div style="font-size:28px;color:#B9C8E0;margin-top:6px">{d}</div></div></div>' for i, (t, d) in enumerate(items))
    body = f"""
{topbar("New here?")}
<div class="pad" style="padding-top:120px">
  <div class="h1" style="font-size:118px">First<br><span class="blue">tournament?</span></div>
  <div class="lead" style="margin-top:24px">Start in the D League. It was built for you.</div>
  <div style="margin-top:46px">{cards}</div>
  <div style="margin-top:20px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return page("First time", body, "feed", "a")


@creative("L12-bring-your-crew")
def _():
    body = f"""
{topbar("Bring your people")}
<div style="position:absolute;left:50%;top:250px;transform:translateX(-50%)">{court(220, extra='<circle cx="25" cy="55" r="9" fill="#6CCBFF"/><circle cx="75" cy="55" r="9" fill="#6CCBFF"/><circle cx="25" cy="145" r="9" fill="#F2C14E"/><circle cx="75" cy="145" r="9" fill="#F2C14E"/>')}</div>
<div class="pad" style="padding-top:640px;align-items:center;text-align:center">
  <div class="h1" style="font-size:118px">4 friends.<br><span class="blue">16 rivals.</span></div>
  <div class="lead" style="margin-top:30px">Sign up together, then get split up. New partner every round, so by the end of the night your crew is 16.</div>
</div>
{foot("Tag your four", 'WhatsApp <span class="cta">MOON</span>')}"""
    return page("Bring your crew", body, "feed", "b")


@creative("L13-team-nights")
def _():
    perks = ["Your own private Americano night", "Live scores on the big screen", "Podium reveal and medals", "Every player saved on the leaderboard"]
    li = "".join(f'<div class="row" style="gap:22px;margin-bottom:22px"><span style="width:16px;height:16px;border-radius:50%;background:#3FB8FF;box-shadow:0 0 12px #3FB8FF"></span><span style="font-size:34px">{p}</span></div>' for p in perks)
    body = f"""
{moon(640, "quarter", "position:absolute;right:-180px;top:160px")}
{topbar("Teams and companies")}
<div class="pad" style="padding-top:150px">
  <div class="eyebrow">Team nights</div>
  <div class="h1" style="font-size:120px;margin-top:20px">Your team.<br>Our <span class="blue">night.</span></div>
  <div class="lead" style="margin-top:30px;max-width:720px">Swap the team dinner for 90 minutes your office will talk about all week.</div>
  <div class="card" style="margin-top:50px;padding:44px">{li}<div class="small" style="margin-top:10px">Groups of {ph("SIZE")}. Venue, date and price on request.</div></div>
</div>
{foot("Enquiries", 'WhatsApp <span class="cta">TEAM</span>')}"""
    return page("Team nights", body, "feed", "a")


@creative("L14-story-new-month")
def _():
    body = f"""
{topbar(ph("MONTH"))}
<div class="pad" style="align-items:center;text-align:center;justify-content:center">
  {moon(520, "new")}
  <div class="eyebrow" style="margin-top:40px">New moon, new month</div>
  <div class="h1" style="font-size:150px;margin-top:20px">Clean<br><span class="blue">board</span></div>
  <div class="lead" style="margin-top:34px">The monthly leaderboard is back to zero.<br>Lifetime points stay. The race starts now.</div>
  <div class="card" style="margin-top:50px;padding:30px 44px"><span class="mont" style="font-weight:700;font-size:30px">Last month's #1: {ph("@PLAYER")}</span></div>
</div>
{foot("This month's nights", 'WhatsApp <span class="cta">MOON</span>')}"""
    return page("New month", body, "story", "b")


# ---------- Paid ads (Story / Reels placement, 9:16) ----------

@creative("L15-ad-saved-forever")
def _():
    body = f"""
<div class="pad" style="align-items:center;text-align:center">
  {logo(80)}
  <div class="h1" style="font-size:140px;margin-top:80px">Your points.<br><span class="blue">Saved forever.</span></div>
  <div class="card hot" style="margin-top:60px;padding:44px;width:100%">
    <div class="num" style="font-size:170px;color:#fff;text-shadow:0 0 40px rgba(63,184,255,.8)">0</div>
    <div class="eyebrow" style="font-size:24px">Your lifetime points. For now.</div>
  </div>
  <div class="lead" style="margin-top:44px">Americano padel nights in Dubai. Live scores, podium, real medals.</div>
  <div style="margin-top:50px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return page("Ad: saved forever", body, "story", "a")


@creative("L16-ad-start-at-d")
def _():
    body = f"""
<div class="pad" style="align-items:center;text-align:center">
  {logo(80)}
  <div class="row" style="gap:20px;margin-top:80px"><span class="lvl on" style="font-size:44px;height:90px;min-width:150px">D-</span><span class="lvl" style="font-size:44px;height:90px;min-width:150px">D</span><span class="lvl" style="font-size:44px;height:90px;min-width:150px">D+</span></div>
  <div class="h1" style="font-size:136px;margin-top:60px">Never played<br>a <span class="blue">tournament?</span></div>
  <div class="lead" style="margin-top:36px">Good. Our D League is for beginners. No partner needed, new one every round.</div>
  <div style="margin-top:60px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
  <div class="small" style="margin-top:30px">Dubai · {ph("NEXT DATE")}</div>
</div>"""
    return page("Ad: start at D", body, "story", "b")


@creative("L17-ad-big-screen")
def _():
    rows = "".join(f'<div class="row" style="padding:16px 24px;border-radius:12px;{"background:rgba(30,155,255,.3);box-shadow:0 0 20px rgba(30,155,255,.5);" if n=="YOU" else ""}"><span class="num blue" style="width:60px;font-size:32px">{i}</span><span class="mont" style="font-weight:700;font-size:32px;flex:1;text-align:left">{n}</span><span class="num" style="font-size:34px">{p}</span></div>' for i, n, p in [(1, "Player A", 31), (2, "YOU", 29), (3, "Player C", 28), (4, "Player D", 27)])
    body = f"""
<div class="pad" style="align-items:center;text-align:center">
  {logo(80)}
  <div class="h1" style="font-size:132px;margin-top:70px">Your name.<br><span class="blue">Big screen.</span></div>
  <div class="screen" style="margin-top:56px;padding:34px;width:100%">
    <div class="row" style="margin-bottom:16px"><span class="eyebrow" style="font-size:20px">Final standings</span><span class="spacer"></span><span class="mont" style="font-weight:800;font-size:22px;color:var(--muted)">ROUND 6 OF 6</span></div>
    {rows}
  </div>
  <div class="lead" style="margin-top:44px">Padel nights in Dubai with live scores, a podium reveal and real medals.</div>
  <div style="margin-top:44px"><span class="btn">{wa_icon(46)} WhatsApp “MOON”</span></div>
</div>"""
    return page("Ad: big screen", body, "story", "a")


# ---------- Reel covers (9:16, keep text in the centre 1080x1440 for the grid crop) ----------

def reel_cover(name, eyebrow, title, phase, bg):
    body = f"""
{moon(820, phase, "position:absolute;left:130px;top:300px")}
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,15,0) 35%,rgba(5,7,15,.85) 60%)"></div>
<div style="position:absolute;left:84px;right:84px;top:1060px;text-align:center">
  <div class="eyebrow">{eyebrow}</div>
  <div class="h1" style="font-size:130px;margin-top:20px">{title}</div>
</div>"""
    return page(name, body, "story", bg)


@creative("L18-reel-cover-reveal")
def _():
    return reel_cover("Reel cover: the reveal", "Moon Padel · Night " + ph("N"), 'The <span class="blue">reveal</span>', "full", "a")


@creative("L19-reel-cover-americano")
def _():
    return reel_cover("Reel cover: Americano", "30-second explainer", 'What is<br><span class="blue">Americano?</span>', "quarter", "b")


@creative("L20-reel-cover-first-night")
def _():
    return reel_cover("Reel cover: first night", "Night 01", 'First <span class="blue">night</span>', "gibbous", "a")


if __name__ == "__main__":
    os.makedirs(SRC, exist_ok=True)
    for name, fn in CREATIVES.items():
        with open(os.path.join(SRC, name + ".html"), "w", encoding="utf-8") as f:
            f.write(fn())
    print(f"wrote {len(CREATIVES)} creatives to src/")
