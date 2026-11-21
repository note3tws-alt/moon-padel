#!/usr/bin/env python3
"""
Package the Moon Padel static site for upload (Hostinger public_html, or Netlify Drop).

  python3 tools/build_site.py                                  # preview build, stays hidden from Google
  python3 tools/build_site.py --domain https://moonpadel.example   # adds canonical links and a sitemap
  python3 tools/build_site.py --domain https://moonpadel.example --launch   # also opens the site to search engines

Writes dist/site/ and dist/moon-padel-site.zip. Upload the CONTENTS of dist/site/ (or unzip the zip)
into public_html. The source folder site/ is never changed.

What it does:
  - copies site/ to dist/site/
  - pre-renders the event cards from config.js into the pages (no layout jump when the script runs)
  - inlines site.css into every page (no render-blocking request) and adds ?v=<hash> to site.js
    so browsers pick up new versions straight away
  - with --domain: canonical + og:url on every page, absolute og:image, sitemap.xml,
    Organization data on the home page, and SportsEvent data for nights whose start,
    venue and fee are confirmed (no [PLACEHOLDERS])
  - with --launch: removes the noindex header (.htaccess and netlify.toml), turns off the
    preview banner, and writes a robots.txt that allows crawling and points to the sitemap
  - lists every [PLACEHOLDER] still on the site so nothing unconfirmed goes live by accident
Needs Python 3.8+. Uses Node (if installed) to read config.js for event data; skips that step otherwise.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, zipfile
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "site")
DIST = os.path.join(ROOT, "dist")
OUT = os.path.join(DIST, "site")
PAGES = {"index.html": "/", "events.html": "/events", "levels.html": "/levels", "results.html": "/results",
         "rules.html": "/rules", "partners.html": "/partners", "faq.html": "/faq",
         "terms.html": "/terms", "privacy.html": "/privacy"}
PRIORITY = {"/": "1.0", "/events": "0.9", "/levels": "0.7", "/results": "0.7", "/rules": "0.6",
            "/partners": "0.6", "/faq": "0.6", "/terms": "0.2", "/privacy": "0.2"}
PH = re.compile(r"\[[A-Z][^\]]*\]")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def short_hash(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:10]


def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{}:;,>])\s*", r"\1", css)
    css = css.replace(";}", "}")
    # keep spaces that matter inside values like "0 0 90px 16px" (handled above only around punctuation)
    return css.strip()


def load_config():
    js = os.path.join(SRC, "assets", "js", "config.js")
    node = shutil.which("node")
    if not node:
        return None
    code = "global.window={};require(%s);process.stdout.write(JSON.stringify(window.MOON))" % json.dumps(js)
    try:
        return json.loads(subprocess.check_output([node, "-e", code], timeout=20))
    except Exception as e:  # noqa: BLE001
        print("  ! could not read config.js with node:", e)
        return None


def prerender_events():
    """Run config.js + site.js in Node with a stub DOM and return {limit: html} for the event list."""
    node = shutil.which("node")
    if not node:
        return None
    code = r"""
const vm=require('vm'),fs=require('fs');
const doc={addEventListener(){},querySelectorAll(){return[]},getElementById(){return null}};
const ctx={window:{},document:doc,location:{origin:'',hash:''},navigator:{},console};
ctx.window.document=doc; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8').replace('window.MOON','window.MOON'),ctx);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);
const R=ctx.window.MoonRender; process.stdout.write(JSON.stringify({'0':R.eventsHTML(0),'2':R.eventsHTML(2)}));
"""
    try:
        out = subprocess.check_output([node, "-e", code, os.path.join(SRC, "assets/js/config.js"),
                                       os.path.join(SRC, "assets/js/site.js")], timeout=20)
        return json.loads(out)
    except Exception as e:  # noqa: BLE001
        print("  ! could not pre-render events:", e)
        return None


def event_jsonld(cfg, domain):
    out = []
    for ev in (cfg or {}).get("events", []):
        start = ev.get("start") or ""
        fields = [start, ev.get("venue", ""), ev.get("fee", ""), ev.get("title", "")]
        if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", start) or any(PH.search(str(x)) for x in fields):
            continue
        if ev.get("status") == "done":
            continue
        item = {
            "@type": "SportsEvent",
            "name": "Moon Padel: " + ev["title"],
            "sport": "Padel",
            "startDate": start + ":00+04:00",
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {"@type": "Place", "name": ev["venue"],
                         "address": {"@type": "PostalAddress", "addressLocality": ev.get("area") or "Dubai", "addressCountry": "AE"}},
            "organizer": {"@type": "SportsOrganization", "name": "Moon Padel", "url": domain + "/"},
            "url": domain + "/events#" + ev["id"],
            "image": domain + "/assets/img/og.jpg",
        }
        fee = re.sub(r"[^\d.]", "", ev.get("fee", ""))
        if fee:
            item["offers"] = {"@type": "Offer", "price": fee, "priceCurrency": "AED", "url": domain + "/events#" + ev["id"],
                              "availability": "https://schema.org/SoldOut" if ev.get("status") == "full" else "https://schema.org/InStock"}
        out.append(item)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--domain", help="Live address, e.g. https://moonpadel.example (no trailing slash)")
    ap.add_argument("--launch", action="store_true", help="Open the site to search engines and hide the preview banner")
    ap.add_argument("--no-inline-css", action="store_true", help="Keep site.css as a separate file instead of inlining it")
    a = ap.parse_args()
    domain = (a.domain or "").rstrip("/")
    if a.launch and not domain:
        sys.exit("--launch needs --domain so the sitemap and canonical links are correct.")
    if domain and not re.match(r"^https://[a-z0-9.-]+\.[a-z]{2,}$", domain):
        sys.exit("--domain should look like https://moonpadel.example")

    shutil.rmtree(OUT, ignore_errors=True)
    shutil.copytree(SRC, OUT)
    css_v = short_hash(os.path.join(SRC, "assets/css/site.css"))
    js_v = short_hash(os.path.join(SRC, "assets/js/site.js"))
    cfg = load_config()
    css = minify_css(read(os.path.join(SRC, "assets/css/site.css")))
    pre = prerender_events()

    for f in list(PAGES) + ["404.html"]:
        p = os.path.join(OUT, f)
        s = read(p)
        if a.no_inline_css:
            s = s.replace('href="/assets/css/site.css"', 'href="/assets/css/site.css?v=%s"' % css_v)
        else:
            # Inline the stylesheet: removes the only render-blocking request (about 6 KB gzipped).
            s = s.replace('<link rel="stylesheet" href="/assets/css/site.css">', "<style>%s</style>" % css)
        s = s.replace('src="/assets/js/site.js"', 'src="/assets/js/site.js?v=%s"' % js_v)
        if pre:
            s = s.replace('<div class="events" id="event-list" data-limit="2"></div>',
                          '<div class="events" id="event-list" data-limit="2">%s</div>' % pre["2"])
            s = s.replace('<div class="events" id="event-list"></div>',
                          '<div class="events" id="event-list">%s</div>' % pre["0"])
        if domain and f in PAGES:
            url = domain + PAGES[f]
            head = '<link rel="canonical" href="%s">\n<meta property="og:url" content="%s">\n' % (url, url)
            s = s.replace('<meta property="og:image" content="/assets/img/og.jpg">',
                          '<meta property="og:image" content="%s/assets/img/og.jpg">' % domain)
            if f == "index.html":
                org = {"@context": "https://schema.org", "@graph": [
                    {"@type": "SportsOrganization", "name": "Moon Padel", "url": domain + "/", "sport": "Padel",
                     "logo": domain + "/assets/img/mark-192.png",
                     "areaServed": {"@type": "City", "name": "Dubai"},
                     "sameAs": (["https://instagram.com/" + cfg["instagram"].lstrip("@")] if cfg and cfg.get("instagram") else [])
                     + ([cfg["leagueUrl"]] if cfg and cfg.get("leagueUrl") else [])},
                    {"@type": "WebSite", "name": "Moon Padel", "url": domain + "/"}]}
                head += '<script type="application/ld+json">%s</script>\n' % json.dumps(org, separators=(",", ":"))
            if f == "events.html":
                evs = event_jsonld(cfg, domain)
                if evs:
                    head += '<script type="application/ld+json">%s</script>\n' % json.dumps(
                        {"@context": "https://schema.org", "@graph": evs}, separators=(",", ":"))
                print("  events with search data:", len(evs))
            s = s.replace("</head>", head + "</head>", 1)
        write(p, s)

    if domain:
        today = date.today().isoformat()
        urls = "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n"
                       % (domain, path, today, PRIORITY[path]) for path in PAGES.values())
        write(os.path.join(OUT, "sitemap.xml"),
              '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n")

    if a.launch:
        ht = os.path.join(OUT, ".htaccess")
        write(ht, re.sub(r"\n  # PRE-LAUNCH START.*?# PRE-LAUNCH END\n", "\n", read(ht), flags=re.S))
        nt = os.path.join(OUT, "netlify.toml")
        write(nt, re.sub(r"\n\s*# Keeps search engines away.*?X-Robots-Tag = \"noindex\"\n", "\n", read(nt), flags=re.S))
        cf = os.path.join(OUT, "assets/js/config.js")
        write(cf, read(cf).replace("showDraftBanner: true", "showDraftBanner: false"))
        write(os.path.join(OUT, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % domain)

    # Placeholder report
    left = {}
    for dp, _, files in os.walk(OUT):
        for fn in files:
            if fn.endswith((".html", ".js")):
                rel = os.path.relpath(os.path.join(dp, fn), OUT)
                text = read(os.path.join(dp, fn))
                if rel.endswith("site.js"):
                    continue  # code, not content
                if rel.endswith("config.js"):
                    text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.S)  # ignore comments
                else:
                    text = re.sub(r"<script.*?</script>", "", text, flags=re.S)
                hits = sorted(set(PH.findall(text)))
                if hits:
                    left[rel] = hits

    os.makedirs(DIST, exist_ok=True)
    zp = os.path.join(DIST, "moon-padel-site.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, _, files in os.walk(OUT):
            for fn in files:
                full = os.path.join(dp, fn)
                z.write(full, os.path.relpath(full, OUT))

    print("Built", OUT)
    print("Zip  ", zp)
    print("Mode ", "LAUNCH (indexable)" if a.launch else "preview (hidden from search engines)")
    if not domain:
        print("  ! No --domain: canonical links and sitemap.xml were skipped.")
    if left:
        print("\nStill to confirm (%d files):" % len(left))
        for k, v in sorted(left.items()):
            print("  %-26s %s" % (k, ", ".join(v)))
        if a.launch:
            print("\n  ! Launch build still has placeholders. Replace them before uploading.")
    else:
        print("\nNo [PLACEHOLDERS] left.")


if __name__ == "__main__":
    main()
