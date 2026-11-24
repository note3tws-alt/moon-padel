(function () {
  "use strict";
  var C = window.MOON || {};
  var MARK = "/assets/img/moon-mark-"; // + size + .avif / .webp
  var LEVEL_PHASE = { "Crescent": "crescent", "Half moon": "half", "Gibbous": "gibbous", "Full moon": "full" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Escape, then show [PLACEHOLDERS] as highlighted tokens.
  function txt(s) {
    return esc(s).replace(/\[[^\]]+\]/g, function (m) { return '<span class="ph">' + m + "</span>"; });
  }
  function isPlaceholder(s) { return /\[[^\]]+\]/.test(String(s || "")); }

  function phase(kind, size) {
    var px = parseInt(size, 10) || 96;
    var file = MARK + (px > 96 ? "320" : "192");
    var img = function (cls) {
      return '<picture><source type="image/avif" srcset="' + file + '.avif">' +
        '<img class="' + cls + '" src="' + file + '.webp" alt="" width="' + px + '" height="' + px + '" loading="lazy" decoding="async"></picture>';
    };
    return '<span class="phase ' + kind + '"' + (size ? ' style="width:' + size + 'px"' : "") + ' aria-hidden="true">' + img("ghost") + img("lit") + "</span>";
  }

  function waLink(message) {
    var text = encodeURIComponent(message || C.whatsappKeyword || "MOON");
    var num = String(C.whatsappNumber || "").replace(/\D/g, "");
    return num ? "https://wa.me/" + num + "?text=" + text : "https://wa.me/?text=" + text;
  }

  /* WhatsApp buttons: any element with data-wa gets a link. data-wa can hold a custom message. */
  function wireWhatsApp(root) {
    (root || document).querySelectorAll("[data-wa]").forEach(function (a) {
      a.href = waLink(a.getAttribute("data-wa") || C.whatsappKeyword);
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  /* Links into the league app: <a data-league="/leaderboard"> */
  function wireLeague() {
    var base = String(C.leagueUrl || "").replace(/\/+$/, "");
    document.querySelectorAll("[data-league]").forEach(function (a) {
      if (!base) { a.hidden = true; return; }
      a.href = base + a.getAttribute("data-league");
    });
    document.querySelectorAll("[data-league-section]").forEach(function (el) { el.hidden = !base; });
  }

  /* Numbers strip: only real numbers from config */
  function renderStats() {
    var el = document.getElementById("stats");
    if (!el) return;
    var list = (C.stats || []).filter(function (x) { return x && x.value != null && x.value !== "" && !isPlaceholder(x.value); });
    if (!list.length) { el.hidden = true; return; }
    el.innerHTML = list.map(function (x) { return "<div><b>" + esc(x.value) + "</b><span>" + esc(x.label) + "</span></div>"; }).join("");
    el.hidden = false;
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  /* Config values shown inline */
  function fillConfig() {
    document.querySelectorAll("[data-cfg]").forEach(function (el) {
      var v = C[el.getAttribute("data-cfg")];
      if (v != null && v !== "") el.innerHTML = txt(v);
    });
    document.querySelectorAll("[data-ig]").forEach(function (el) {
      if (!C.instagram) { el.hidden = true; return; }
      el.href = "https://instagram.com/" + C.instagram.replace(/^@/, "");
      el.target = "_blank"; el.rel = "noopener";
      if (el.hasAttribute("data-ig-text")) el.textContent = "@" + C.instagram.replace(/^@/, "");
    });
    document.querySelectorAll("[data-email]").forEach(function (el) {
      if (!C.email) { el.hidden = true; return; }
      el.href = "mailto:" + C.email;
      if (el.hasAttribute("data-email-text")) el.textContent = C.email;
    });
    document.querySelectorAll("[data-ig-missing]").forEach(function (el) { el.hidden = !!C.instagram; });
    document.querySelectorAll("[data-email-missing]").forEach(function (el) { el.hidden = !!C.email; });
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    var banner = document.querySelector(".draft-banner");
    if (banner) banner.hidden = C.showDraftBanner === false;
  }

  /* Mobile menu */
  function menu() {
    var btn = document.querySelector(".menu-btn");
    var drawer = document.getElementById("drawer");
    if (!btn || !drawer) return;
    btn.addEventListener("click", function () {
      var open = drawer.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("menu-open", open);
    });
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) { drawer.classList.remove("open"); document.body.classList.remove("menu-open"); btn.setAttribute("aria-expanded", "false"); }
    });
  }

  /* Events */
  var STATUS = {
    soon: { label: "Registration opens soon", btn: "Get first access" },
    open: { label: "Registration open", btn: "Register" },
    full: { label: "Full, waitlist open", btn: "Join the waitlist" },
    done: { label: "Played", btn: "See results" },
    live: { label: "Live now", btn: "Follow live" }
  };

  var PAIRING = {
    solo: "Sign up on your own, partners rotate",
    pairs: "Sign up as a pair",
    either: "On your own or as a pair"
  };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // "2027-01-09T20:00" in Dubai time (UTC+4, no daylight saving) -> Date, or null.
  function parseStart(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(v || ""));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 4, +m[5]));
  }
  function dubaiParts(d) {
    var x = new Date(d.getTime() + 4 * 3600 * 1000);
    return { y: x.getUTCFullYear(), mo: x.getUTCMonth(), d: x.getUTCDate(), wd: x.getUTCDay(), h: x.getUTCHours(), mi: x.getUTCMinutes() };
  }
  function fmtTime(p) {
    var h = p.h % 12 || 12;
    return h + (p.mi ? ":" + String(p.mi).padStart(2, "0") : "") + (p.h < 12 ? " AM" : " PM");
  }
  function icsDate(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function icsEscape(s) { return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }

  function downloadIcs(ev) {
    var start = parseStart(ev.start);
    if (!start) return;
    var mins = parseInt(ev.durationMinutes, 10) || 120;
    var end = new Date(start.getTime() + mins * 60000);
    var url = location.origin + "/events#" + ev.id;
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Moon Padel//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + ev.id + "@moonpadel",
      "DTSTAMP:" + icsDate(new Date()),
      "DTSTART:" + icsDate(start),
      "DTEND:" + icsDate(end),
      "SUMMARY:" + icsEscape("Moon Padel: " + ev.title),
      "LOCATION:" + icsEscape([ev.venue, ev.area].filter(Boolean).join(", ")),
      "DESCRIPTION:" + icsEscape("Details and rules: " + url),
      "URL:" + url,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = ev.id + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function shareEvent(ev) {
    var url = location.origin + "/events#" + ev.id;
    var title = "Moon Padel: " + ev.title;
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { prompt("Copy this link", url); });
    else prompt("Copy this link", url);
  }

  function eventCard(ev) {
    var st = STATUS[ev.status] || STATUS.soon;
    var flagship = ev.type === "flagship";
    var start = parseStart(ev.start);
    var p = start ? dubaiParts(start) : null;
    var dateText = p ? DAYS[p.wd] + " " + p.d + " " + MONTHS[p.mo] + " " + p.y : ev.date;
    var timeText = p ? fmtTime(p) : ev.time;
    var tz = C.timezoneLabel && !isPlaceholder(timeText) ? ' <span class="tz">(' + esc(C.timezoneLabel) + ")</span>" : "";

    var spots = "", bar = "";
    var cap = parseInt(ev.capacity, 10), taken = parseInt(ev.taken, 10);
    if (!isNaN(cap) && !isNaN(taken) && !isPlaceholder(ev.capacity)) {
      spots = taken + " / " + cap + " spots taken";
      bar = '<div class="spots-bar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(taken / cap * 100)) + '%"></i></div>';
    } else spots = txt(ev.capacity) + " spots";

    var href, attrs = ' target="_blank" rel="noopener"';
    var name = ev.title + (isPlaceholder(dateText) ? "" : " " + dateText);
    if (ev.status === "live" && ev.liveUrl) href = esc(ev.liveUrl);
    else if (ev.status === "done") { href = "/results"; attrs = ""; }
    else if (ev.status === "open" && ev.payUrl) href = esc(ev.payUrl);
    else if (ev.status === "open") href = waLink((C.whatsappKeyword || "MOON") + " " + name);
    else if (ev.status === "full") href = waLink("WAITLIST " + name);
    else href = waLink(C.whatsappKeyword || "MOON");

    var pairing = ev.pairing ? (PAIRING[ev.pairing] ? esc(PAIRING[ev.pairing]) : txt(ev.pairing)) : "";
    var duration = parseInt(ev.durationMinutes, 10);

    var actions = [];
    if (start && ev.status !== "done") actions.push('<button type="button" class="linkbtn" data-act="ics" data-id="' + esc(ev.id) + '">Add to calendar</button>');
    if (ev.note) actions.unshift('<span class="muted small">' + txt(ev.note) + "</span>");
    if ((ev.pairing === "pairs" || ev.pairing === "either") && ev.status !== "done")
      actions.push('<a class="linkbtn" target="_blank" rel="noopener" href="' + waLink("PARTNER " + name) + '">Need a partner?</a>');
    actions.push('<button type="button" class="linkbtn" data-act="share" data-id="' + esc(ev.id) + '">Share</button>');

    return '<article class="event' + (flagship ? " flagship" : "") + '" id="' + esc(ev.id) + '" data-type="' + esc(ev.type) + '" data-levels="' + esc((ev.levels || []).join("|")) + '">' +
      '<div class="date"><span class="d">' + (p ? esc(DAYS[p.wd] + " " + p.d + " " + MONTHS[p.mo]) : txt(ev.date)) + "</span>" + phase(flagship ? "full" : "half") + "</div>" +
      "<div>" +
      '<span class="tag">' + (flagship ? "Full Moon Series" : ev.tag || "Moon Night") + "</span>" +
      "<h3>" + txt(ev.title) + "</h3>" +
      '<div class="meta">' +
      "<span><b>When</b> " + txt(dateText) + ", " + txt(timeText) + tz + (isNaN(duration) ? "" : " &middot; " + duration + " min") + "</span>" +
      "<span><b>Where</b> " + txt(ev.venue) + ", " + txt(ev.area) + "</span>" +
      "<span><b>Levels</b> " + (ev.levels || []).map(txt).join(", ") + "</span>" +
      "<span><b>Format</b> " + txt(ev.format) + "</span>" +
      (pairing ? "<span><b>Entry</b> " + pairing + "</span>" : "") +
      "<span><b>Fee</b> " + txt(ev.fee) + " per player &middot; " + spots + bar + "</span>" +
      "</div>" +
      '<div class="foot"><span class="status ' + esc(ev.status || "soon") + '">' + st.label + "</span>" +
      '<a class="btn btn-sm ' + (ev.status === "done" ? "btn-ghost" : "btn-primary") + '" href="' + href + '"' + attrs + ">" + st.btn + "</a></div>" +
      '<div class="actions">' + actions.join("") + "</div>" +
      "</div></article>";
  }

  function pickEvents(limit) {
    var evs = (C.events || []).slice();
    if (limit) evs = evs.filter(function (e) { return e.status !== "done"; }).slice(0, limit);
    return evs;
  }
  // Pure HTML for the event list. tools/build_site.py also calls this to pre-render the cards
  // into the page, so nothing moves when the script runs.
  function eventsHTML(limit) {
    var evs = pickEvents(limit);
    if (!evs.length) return '<div class="empty">No nights on the calendar yet. WhatsApp <strong>' + esc(C.whatsappKeyword || "MOON") + "</strong> and founding players hear first.</div>";
    return evs.map(eventCard).join("");
  }
  window.MoonRender = { eventsHTML: eventsHTML };

  function renderEvents() {
    var list = document.getElementById("event-list");
    if (!list) return;
    var limit = parseInt(list.getAttribute("data-limit") || "0", 10);
    var evs = pickEvents(limit);
    var html = eventsHTML(limit);
    if (list.innerHTML !== html) list.innerHTML = html;
    if (!evs.length) return;
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var ev = evs.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0];
      if (!ev) return;
      if (b.getAttribute("data-act") === "ics") downloadIcs(ev); else shareEvent(ev);
    });
    // Deep link: /events#full-moon-night-01 scrolls to the card once it exists.
    if (location.hash.length > 1) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }

    var filters = document.getElementById("event-filters");
    if (!filters) return;
    filters.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      filters.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
      var f = chip.getAttribute("data-filter");
      var shown = 0;
      list.querySelectorAll(".event").forEach(function (card) {
        var lv = card.getAttribute("data-levels");
        // Nights whose levels are still a [PLACEHOLDER] show under every level filter.
        var ok = f === "all" || card.getAttribute("data-type") === f ||
          lv.split("|").indexOf(f) > -1 || (LEVEL_PHASE[f] && lv.indexOf("[") > -1);
        card.hidden = !ok;
        if (ok) shown++;
      });
      var none = document.getElementById("event-none");
      if (none) none.hidden = shown > 0;
    });
  }

  /* Results */
  function table(rows, pairs) {
    if (!rows || !rows.length) {
      return '<div class="empty">The season table goes live after the first Moon Night. Results are posted the same night.</div>';
    }
    return '<div class="table-wrap"><table><thead><tr><th>#</th><th>' + (pairs ? "Pair" : "Player") + "</th><th>Level</th><th>Nights</th><th class=\"pts\">Pts</th></tr></thead><tbody>" +
      rows.map(function (r, i) {
        return '<tr class="' + (i < 3 ? "top" : "") + '"><td class="rank">' + (i + 1) + "</td><td>" + txt(r.name) + "</td><td>" + txt(r.level) + "</td><td>" + txt(r.nights) + '</td><td class="pts">' + txt(r.points) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function renderResults() {
    var holder = document.getElementById("standings");
    if (holder) {
      var tabs = document.getElementById("standings-tabs");
      var show = function (kind) { holder.innerHTML = table((C.standings || {})[kind], kind === "pairs"); };
      show("players");
      if (tabs) tabs.addEventListener("click", function (e) {
        var chip = e.target.closest(".chip"); if (!chip) return;
        tabs.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        show(chip.getAttribute("data-kind"));
      });
    }
    var ch = document.getElementById("champions");
    if (ch) {
      var list = C.champions || [];
      if (!list.length) {
        ch.innerHTML = ["Crescent", "Half moon", "Gibbous", "Full moon"].map(function (lvl) {
          return '<div class="card champ">' + phase(LEVEL_PHASE[lvl], 56) + '<div><h3>' + lvl + '</h3><p>First champions crowned at Full Moon Night 01.</p></div></div>';
        }).join("");
      } else {
        ch.innerHTML = list.map(function (c) {
          return '<div class="card champ"><span class="badge">1ST</span><div><h3>' + txt(c.names) + "</h3><p>" + txt(c.level) + " &middot; " + txt(c.event) + " &middot; " + txt(c.date) + "</p></div></div>";
        }).join("");
      }
    }
    var om = document.getElementById("of-the-month");
    if (om && C.ofTheMonth) {
      var o = C.ofTheMonth;
      om.innerHTML = '<div class="card"><span class="num">PLAYER OF THE MONTH &middot; ' + txt(o.month) + "</span><h3 class=\"medal\">" + txt(o.player) + "</h3><p class=\"muted\">" + txt(o.note || "") + '</p></div>' +
        '<div class="card"><span class="num">PAIR OF THE MONTH &middot; ' + txt(o.month) + "</span><h3 class=\"medal\">" + txt(o.pair) + "</h3></div>";
    }
  }

  function renderVenues() {
    var v = document.getElementById("venue-list");
    if (!v) return;
    var list = C.venues || [];
    if (!list.length) {
      v.innerHTML = '<div class="card venue"><div><h3><span class="ph">[VENUE]</span></h3><p>Host venue announced with the first night.</p></div></div>';
      return;
    }
    v.innerHTML = list.map(function (x) {
      var row = "<div><h3>" + txt(x.name) + "</h3><p>" + txt(x.area || "Dubai") + "</p></div>" +
        (x.mapUrl ? '<a class="btn btn-sm btn-ghost" href="' + esc(x.mapUrl) + '" target="_blank" rel="noopener">Directions</a>' : "");
      if (!x.photo) return '<div class="card venue">' + row + "</div>";
      return '<div class="card venue has-photo"><img class="venue-photo" src="' + esc(x.photo) + '" alt="' + esc(x.name) + '" loading="lazy" decoding="async" width="1280" height="720"><div class="row">' + row + "</div></div>";
    }).join("");
  }

  /* Static phase placeholders: <span data-phase="crescent" data-size="96"></span> */
  function renderPhases() {
    document.querySelectorAll("[data-phase]").forEach(function (el) {
      el.outerHTML = phase(el.getAttribute("data-phase"), el.getAttribute("data-size"));
    });
  }

  function reveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }


  /* ------------------------------------------------------------------
     Live data from the league app (one shared database with the admin,
     venue tablet and TV). The page is complete without it: cards from
     config.js are pre-rendered at build time, the last feed is kept in
     the browser for an instant repeat visit, and a slow or offline app
     never delays the page.
  ------------------------------------------------------------------ */
  var LIVE_STATES = { checkin_open: 1, ready: 1, round_live: 1, score_collection: 1, round_locked: 1 };
  var FEED_KEY = "mp-feed-v1";

  function feedEvents(feed, base) {
    return (feed.upcoming || []).map(function (e) {
      var start = e.start_time ? e.event_date + "T" + String(e.start_time).slice(0, 5) : "";
      var live = LIVE_STATES[e.state];
      return {
        id: e.slug, type: "night", tag: "Ladder Americano", title: e.title,
        date: e.event_date, time: e.start_time ? "" : "[TIME]", start: start, durationMinutes: e.duration_minutes,
        venue: e.venue || "[VENUE]", area: e.area || "Dubai",
        levels: e.levels && e.levels.length ? e.levels : ["[LEVELS]"],
        format: e.court_count + " courts, " + e.round_count + " rounds of " + e.round_minutes + " min, partners rotate",
        pairing: "solo", fee: C.defaultFee || "AED [FEE]",
        capacity: String(e.player_cap), taken: e.confirmed, note: e.public_note || "",
        status: live ? "live" : e.confirmed >= e.player_cap ? "full" : "open",
        liveUrl: base + "/live/" + encodeURIComponent(e.slug)
      };
    });
  }

  function fade(el) { if (el) { el.classList.remove("live-in"); void el.offsetWidth; el.classList.add("live-in"); } }

  function applyFeed(feed) {
    var base = String(C.leagueUrl || "").replace(/\/+$/, "");
    if (!feed || !base) return;
    var evs = feedEvents(feed, base);
    if (evs.length) {
      C.events = evs;
      var list = document.getElementById("event-list");
      if (list) {
        var html = eventsHTML(parseInt(list.getAttribute("data-limit") || "0", 10));
        if (list.innerHTML !== html) { list.innerHTML = html; fade(list); }
      }
    }
    var ms = (feed.milestones || []).map(function (m) { return m.threshold; });
    if (ms.length) {
      document.querySelectorAll("[data-milestones]").forEach(function (el) { el.textContent = ms.join(", ") + " points"; });
      document.querySelectorAll("[data-milestones-line]").forEach(function (el) { el.hidden = false; });
    }
    var life = feed.lifetime || [];
    var ll = document.getElementById("lifetime-list");
    if (ll && life.length) {
      ll.innerHTML = life.slice(0, 8).map(function (p, i) {
        return '<li><a href="' + base + "/players/" + encodeURIComponent(p.slug) + '"><span class="n">' + (i + 1) + "</span>" + esc(p.name) + "</a><span><b>" + esc(p.points) + "</b>" +
          (p.medals ? '<span class="medals">' + p.medals + " medal" + (p.medals > 1 ? "s" : "") + "</span>" : "") + "</span></li>";
      }).join("");
      fade(ll);
    }
    if (life.length) {
      C.standings = { players: life.map(function (p) { return { name: p.name, level: p.level || "", nights: p.events != null ? p.events : "", points: p.points }; }), pairs: [] };
      var holder = document.getElementById("standings");
      if (holder) { holder.innerHTML = table(C.standings.players, false); fade(holder); }
    }
    var ch = document.getElementById("champions");
    if (ch && (feed.recent || []).length) {
      ch.innerHTML = feed.recent.map(function (e) {
        var pod = (e.podium || []).map(function (p) { return '<span class="' + (p.medal === "gold" ? "medal" : "") + '">' + esc(p.medal) + ": " + esc(p.name) + " (" + esc(p.total) + ")</span>"; }).join("<br>");
        return '<a class="card champ" style="text-decoration:none;color:inherit" href="' + base + "/live/" + encodeURIComponent(e.slug) + '"><span class="badge">1ST</span><div><h3>' + esc(e.title) + "</h3><p>" + esc(e.event_date) + (e.venue ? " &middot; " + esc(e.venue) : "") + "</p><p>" + pod + "</p></div></a>";
      }).join("");
      fade(ch);
    }
  }

  function loadFeed() {
    var base = String(C.leagueUrl || "").replace(/\/+$/, "");
    if (!base || C.liveData === false || !window.fetch) return;
    try {
      var cached = JSON.parse(localStorage.getItem(FEED_KEY) || "null");
      if (cached && Date.now() - cached.t < 864e5) applyFeed(cached.feed);
    } catch (e) { /* storage blocked: fine */ }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    fetch(base + "/api/public/events", { signal: ctrl ? ctrl.signal : undefined, credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (feed) {
        clearTimeout(timer);
        if (!feed) return;
        applyFeed(feed);
        try { localStorage.setItem(FEED_KEY, JSON.stringify({ t: Date.now(), feed: feed })); } catch (e) { /* ignore */ }
      })
      .catch(function () { clearTimeout(timer); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderPhases();
    renderEvents();
    renderResults();
    renderVenues();
    renderStats();
    fillConfig();
    wireLeague();
    wireWhatsApp();
    menu();
    reveal();
    loadFeed();
  });
})();
