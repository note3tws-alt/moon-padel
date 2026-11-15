(function () {
  "use strict";
  var C = window.MOON || {};
  var MARK = "/assets/img/moon-mark.webp";
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
    return '<span class="phase ' + kind + '"' + (size ? ' style="width:' + size + 'px"' : "") + ' aria-hidden="true">' +
      '<img class="ghost" src="' + MARK + '" alt="" loading="lazy">' +
      '<img class="lit" src="' + MARK + '" alt="" loading="lazy"></span>';
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
    done: { label: "Played", btn: "See results" }
  };

  function eventCard(ev) {
    var st = STATUS[ev.status] || STATUS.soon;
    var flagship = ev.type === "flagship";
    var spots = "";
    if (ev.taken != null && !isPlaceholder(ev.capacity)) spots = esc(ev.taken) + " / " + esc(ev.capacity) + " spots taken";
    else spots = txt(ev.capacity) + " spots";
    var href, attrs = ' target="_blank" rel="noopener"';
    var name = ev.title + (isPlaceholder(ev.date) ? "" : " " + ev.date);
    if (ev.status === "done") { href = "/results"; attrs = ""; }
    else if (ev.status === "open" && ev.payUrl) href = esc(ev.payUrl);
    else if (ev.status === "open") href = waLink((C.whatsappKeyword || "MOON") + " " + name);
    else if (ev.status === "full") href = waLink("WAITLIST " + name);
    else href = waLink(C.whatsappKeyword || "MOON");

    return '<article class="event' + (flagship ? " flagship" : "") + '" data-type="' + esc(ev.type) + '" data-levels="' + esc((ev.levels || []).join("|")) + '">' +
      '<div class="date"><span class="d">' + txt(ev.date) + "</span>" + phase(flagship ? "full" : "half") + "</div>" +
      "<div>" +
      '<span class="tag">' + (flagship ? "Full Moon Series" : "Moon Night") + "</span>" +
      "<h3>" + txt(ev.title) + "</h3>" +
      '<div class="meta">' +
      "<span><b>When</b> " + txt(ev.date) + ", " + txt(ev.time) + "</span>" +
      "<span><b>Where</b> " + txt(ev.venue) + ", " + txt(ev.area) + "</span>" +
      "<span><b>Levels</b> " + (ev.levels || []).map(txt).join(", ") + "</span>" +
      "<span><b>Format</b> " + txt(ev.format) + "</span>" +
      "<span><b>Entry</b> " + txt(ev.fee) + " per player &middot; " + spots + "</span>" +
      "</div>" +
      '<div class="foot"><span class="status ' + esc(ev.status || "soon") + '">' + st.label + "</span>" +
      '<a class="btn btn-sm ' + (ev.status === "done" ? "btn-ghost" : "btn-primary") + '" href="' + href + '"' + attrs + ">" + st.btn + "</a></div>" +
      "</div></article>";
  }

  function renderEvents() {
    var list = document.getElementById("event-list");
    if (!list) return;
    var limit = parseInt(list.getAttribute("data-limit") || "0", 10);
    var evs = (C.events || []).slice();
    if (limit) evs = evs.filter(function (e) { return e.status !== "done"; }).slice(0, limit);
    if (!evs.length) {
      list.innerHTML = '<div class="empty">No nights on the calendar yet. WhatsApp <strong>' + esc(C.whatsappKeyword || "MOON") + "</strong> and founding players hear first.</div>";
      return;
    }
    list.innerHTML = evs.map(eventCard).join("");

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
      return '<div class="card venue"><div><h3>' + txt(x.name) + "</h3><p>" + txt(x.area || "Dubai") + "</p></div>" +
        (x.mapUrl ? '<a class="btn btn-sm btn-ghost" href="' + esc(x.mapUrl) + '" target="_blank" rel="noopener">Map</a>' : "") + "</div>";
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

  document.addEventListener("DOMContentLoaded", function () {
    renderPhases();
    renderEvents();
    renderResults();
    renderVenues();
    fillConfig();
    wireWhatsApp();
    menu();
    reveal();
  });
})();
