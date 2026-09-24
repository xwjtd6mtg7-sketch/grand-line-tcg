(function () {
  var ART = {
    foosha: "/road/foosha.png",
    alvida: "/road/alvida.png",
    shells: "/road/shell.png",
    orange: "/road/orange.png",
    syrup: "/road/syrup.png",
    baratie: "/road/baratie.png",
    arlong: "/road/arlong.png",
    loguetown: "/road/loguetown.png",
    twins: "/road/twins.png",
  };
  var ICO = {
    decks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  };
  var cached = null;
  var openId = "";
  var sailedTo = "";
  var sailing = false;
  var introSent = false;
  var briefOn = false;
  var briefId = "";
  var SHIPS = [
    { id: "canot", name: "Canot", src: "/road/boat.png?v=5", need: "" },
    { id: "merry", name: "Vogue Merry", src: "/road/merry.png?v=2", need: "syrup", lock: "Termine le Village de Sirop" },
  ];

  function ensureCss() {
    var href = "/road.css?v=38";
    var link = document.querySelector("link[data-road-css]");
    if (link) {
      if (link.getAttribute("href") !== href) link.href = href;
      return;
    }
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-road-css", "1");
    document.head.appendChild(link);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;");
  }

  function moneyName(label) {
    return String(label || "").replace(/baies/ig, "Berries");
  }

  function view() {
    return cached && cached.view;
  }

  function applyDev(j) {
    var save = null;
    try { save = JSON.parse(localStorage.getItem("gl-tcg-save") || "null"); } catch (e) { return; }
    var on = save && (save.devInfinite || (save.state && save.state.devInfinite));
    if (!on || !j || !j.view) return;
    (j.view.regions || []).forEach(function (region) {
      (region.destinations || []).forEach(function (d) {
        if (d.status === "locked") d.status = "unlocked";
      });
    });
  }

  function take(j) {
    if (j && j.view) {
      cached = j;
      applyDev(j);
    }
    return j;
  }

  function refresh() {
    return fetch("/api/road", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(take);
  }

  function post(body) {
    return fetch("/api/road", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && (j.message || j.error)) || "La mer est agitée.");
        return take(j);
      });
    });
  }

  function artSrc(d) {
    return (ART[d.id] || d.image || "/road/foosha.png") + "?v=8";
  }

  function stopsOf(v) {
    var list = [];
    (v.regions || []).forEach(function (region) {
      (region.destinations || []).forEach(function (d) {
        d.regionName = region.name;
        d.regionId = region.id;
        list.push(d);
      });
    });
    list.push({
      id: "soon",
      name: "À venir",
      status: "soon",
      description: "La suite du voyage arrivera prochainement.",
      mystery: true,
    });
    return list;
  }

  function slotsFor(n) {
    var out = [];
    var top = 22;
    var bottom = 78;
    for (var i = 0; i < n; i++) {
      var t = n <= 1 ? 0 : i / (n - 1);
      out.push({ x: i % 2 === 0 ? 30 : 58, y: bottom - t * (bottom - top) });
    }
    return out;
  }

  function moorOf(isle, i, chart) {
    var c = chart.getBoundingClientRect();
    var r = isle.getBoundingClientRect();
    if (!c.width || !c.height || r.width < 40) return null;
    var onRight = i % 2 === 0 && i !== 0;
    var fx = i === 0 ? 0.16 : (onRight ? 0.84 : 0.16);
    var fy = i === 0 ? 0.22 : 0.4;
    var shipW = 92;
    var shipH = 70;
    var x = r.left + r.width * fx - (onRight ? shipW * 0.72 : shipW * 0.28);
    var y = r.top + r.height * fy - shipH * 0.42;
    return {
      x: ((x - c.left) / c.width) * 100,
      y: ((y - c.top) / c.height) * 100,
      faceRight: !onRight,
    };
  }

  function dockOf(slot, i) {
    return { x: slot.x + (i % 2 === 0 ? 15 : -15), y: slot.y + 1 };
  }

  function pathD(slots) {
    if (!slots.length) return "";
    var d = "M " + slots[0].x + " " + slots[0].y;
    for (var i = 1; i < slots.length; i++) {
      var a = slots[i - 1];
      var b = slots[i];
      var mx = (a.x + b.x) / 2 + (i % 2 ? -10 : 10);
      var my = (a.y + b.y) / 2;
      d += " Q " + mx + " " + my + " " + b.x + " " + b.y;
    }
    return d;
  }

  function bannersHtml(stops) {
    var html = "";
    var seen = {};
    stops.forEach(function (d, i) {
      if (!d.regionId || seen[d.regionId]) return;
      seen[d.regionId] = true;
      var src = d.regionId === "grand_line_entrance" ? "/road/banner-grand.png?v=1" : "/road/banner-east.png?v=1";
      var known = d.status === "current" || d.status === "unlocked" || d.status === "completed";
      html += '<div class="road-banner' + (known ? "" : " is-locked") + '" data-banner="' + i + '"><img src="' + src + '" alt="' + esc(d.regionName || "") + '" draggable="false"></div>';
    });
    return html;
  }

  function flag(status) {
    if (status === "current") return "Vous êtes ici";
    if (status === "completed") return "Explorée";
    if (status === "unlocked") return "Débloquée";
    if (status === "soon") return "À venir";
    return "Verrouillée";
  }

  function canSail(d) {
    return !!d && (d.status === "current" || d.status === "unlocked" || d.status === "completed");
  }

  function dossierHtml(d) {
    if (!d) return "";
    var meta = flag(d.status);
    if (d.status !== "current" && d.status !== "soon" && d.requiredPoints != null) meta += " · " + d.requiredPoints;
    return (
      '<div class="road-dock-id">' +
        "<h4>" + esc(d.name) + "</h4>" +
        '<p class="road-dock-line"><em>' + esc(meta) + "</em></p>" +
      "</div>" +
      (d.description ? '<p class="road-dock-desc">' + esc(d.description) + "</p>" : "")
    );
  }

  function legOf(d, stops, points) {
    var idx = -1;
    stops.forEach(function (s, i) { if (s.id === d.id) idx = i; });
    var next = null;
    for (var i = idx + 1; i < stops.length; i++) {
      if (!stops[i].mystery && stops[i].requiredPoints != null) { next = stops[i]; break; }
    }
    var from = Number(d.requiredPoints) || 0;
    var pts = Number(points) || 0;
    if (!next) return { next: null, ratio: 1, have: Math.max(0, pts - from), need: 0, left: 0 };
    var need = Math.max(1, next.requiredPoints - from);
    var have = Math.max(0, Math.min(need, pts - from));
    return { next: next, ratio: have / need, have: have, need: need, left: Math.max(0, next.requiredPoints - pts) };
  }

  function deckFrameHtml() {
    var snap = window.GLVsDeckSnap && window.GLVsDeckSnap();
    if (!snap) {
      return '<button type="button" class="road-brief-deck is-empty" data-act="decks"><span><b>Aucun deck</b><em>Toucher pour choisir</em></span></button>';
    }
    return (
      '<button type="button" class="road-brief-deck" data-act="decks">' +
        '<span class="road-brief-pack"><img src="' + esc(snap.pack) + '" alt="" draggable="false"></span>' +
        '<span class="road-brief-skins">' +
          (snap.back ? '<img src="' + esc(snap.back) + '" alt="" draggable="false">' : "") +
          (snap.don ? '<img src="' + esc(snap.don) + '" alt="" draggable="false">' : "") +
          (snap.mat ? '<img class="is-mat" src="' + esc(snap.mat) + '" alt="" draggable="false">' : "") +
        "</span>" +
        '<span class="road-brief-deck-meta"><small>Deck</small><b>' + esc(snap.name) + "</b><em>" + snap.count + "/50 · Changer</em></span>" +
      "</button>"
    );
  }

  function rewardRows(d) {
    var rows = d.rewards || [];
    if (!rows.length) return '<p class="road-brief-empty">Aucune récompense sur cette île.</p>';
    return '<ul class="road-brief-loot">' + rows.map(function (r) {
      var label = moneyName(r.label || "");
      var act = "";
      if (r.status === "available") {
        act = '<button type="button" class="road-claim" data-act="road-claim" data-id="' + esc(r.id) + '">Récupérer</button>';
      } else if (r.status === "claimed") {
        act = '<span class="road-flag is-done">Récupérée</span>';
      } else {
        act = '<span class="road-flag">Verrouillée</span>';
      }
      return "<li><b>" + esc(label) + "</b>" + act + "</li>";
    }).join("") + "</ul>";
  }

  function regionLogo(d) {
    if (d && d.regionId === "grand_line_entrance") return "/road/banner-grand.png?v=1";
    return "/road/banner-east.png?v=1";
  }

  function briefHtml(d, v) {
    if (!d || !v) return "";
    var stops = stopsOf(v);
    var points = (v.state && v.state.points) || 0;
    var leg = legOf(d, stops, points);
    var pct = Math.round(leg.ratio * 100);
    var progress = leg.next
      ? (leg.left ? leg.left + " points avant " + leg.next.name : "Étape franchie")
      : "Dernière escale";
    var h = Math.max(440, Math.round(window.innerHeight - 64));
    return (
      '<div class="filter-sheet gl-road-brief" data-act="road-brief-close">' +
        '<div class="dossier-sheet filter-panel" data-stop="1" style="height:' + h + 'px">' +
          '<div class="dossier-grab"><div class="dossier-handle"><span></span></div></div>' +
          '<div class="dossier-extra filter-sheet-body road-brief-body" data-scrolllock-allow="true">' +
            '<div class="road-brief-stage">' +
              '<img class="road-brief-logo" src="' + regionLogo(d) + '" alt="' + esc(d.regionName || "East Blue") + '" draggable="false">' +
              '<img class="road-brief-isle" src="' + artSrc(d) + '" alt="" draggable="false">' +
            "</div>" +
            (d.description ? '<p class="road-brief-desc">' + esc(d.description) + "</p>" : "") +
            '<div class="road-brief-progress">' +
              '<div class="road-brief-prow"><span>Log Pose</span><b>' + leg.have + " / " + (leg.next ? leg.need : "—") + "</b></div>" +
              '<div class="road-brief-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
              "<p>" + esc(progress) + "</p>" +
            "</div>" +
            deckFrameHtml() +
            '<p class="road-brief-label">Récompenses</p>' +
            rewardRows(d) +
            '<div class="list-end-pad" aria-hidden="true"></div>' +
          "</div>" +
          '<div class="filter-float"><button type="button" class="road-brief-go" data-act="road-launch">Prendre la mer</button></div>' +
        "</div>" +
      "</div>"
    );
  }

  function sheetHtml() {
    if (!briefOn) return "";
    var v = view();
    if (!v) return "";
    var found = null;
    stopsOf(v).forEach(function (d) { if (d.id === briefId) found = d; });
    return briefHtml(found, v);
  }

  function openBrief() {
    var v = view();
    if (!v) return;
    var picked = null;
    stopsOf(v).forEach(function (d) { if (d.id === openId) picked = d; });
    if (!picked && v.current) stopsOf(v).forEach(function (d) { if (d.id === v.current.id) picked = d; });
    if (!picked || !canSail(picked)) return;
    briefOn = true;
    briefId = picked.id;
  }

  function closeBrief() {
    briefOn = false;
  }

  function dockHtml(picked) {
    return (
      '<div class="road-dock">' +
        '<button type="button" class="road-dock-btn" data-act="hub" aria-label="Retour">' + ICO.back + "</button>" +
        '<div id="gl-road-dossier" class="road-dock-copy">' + dossierHtml(picked) + "</div>" +
        '<button type="button" class="road-dock-sail" data-act="road-sail"' + (canSail(picked) ? "" : " disabled") + ">Prendre la mer</button>" +
      "</div>"
    );
  }

  function syncRegion(root) {
    var scroller = root.querySelector(".road-scroll");
    var kicker = root.querySelector("#gl-road-region");
    if (!scroller || !kicker) return;
    var box = scroller.getBoundingClientRect();
    var mid = box.top + scroller.clientHeight * 0.38;
    var best = "";
    var bestD = 1e9;
    root.querySelectorAll(".road-isle[data-region]").forEach(function (el) {
      var name = el.getAttribute("data-region");
      if (!name) return;
      var r = el.getBoundingClientRect();
      if (r.bottom < box.top || r.top > box.bottom) return;
      var dist = Math.abs((r.top + r.bottom) / 2 - mid);
      if (dist < bestD) { bestD = dist; best = name; }
    });
    if (best) kicker.textContent = best;
  }

  function shipById(id) {
    for (var i = 0; i < SHIPS.length; i++) if (SHIPS[i].id === id) return SHIPS[i];
    return SHIPS[0];
  }

  function shipReady(ship) {
    if (!ship || !ship.need) return true;
    var v = view();
    if (!v) return false;
    var ok = false;
    (v.regions || []).forEach(function (region) {
      (region.destinations || []).forEach(function (d) {
        if (d.id === ship.need && d.status === "completed") ok = true;
      });
    });
    return ok;
  }

  function equippedShip() {
    var id = "";
    try { id = localStorage.getItem("gl-road-boat") || ""; } catch (e) {}
    var ship = shipById(id);
    return shipReady(ship) ? ship : SHIPS[0];
  }

  function shipyardHtml() {
    var current = equippedShip();
    var choices = SHIPS.map(function (ship) {
      var ready = shipReady(ship);
      var on = current.id === ship.id;
      return (
        '<button type="button" class="road-ship-choice' + (on ? " is-on" : "") + '" data-ship="' + ship.id + '"' + (ready ? "" : " disabled") + ">" +
          '<img src="' + ship.src + '" alt="">' +
          "<span><b>" + esc(ship.name) + "</b><em>" + (ready ? (on ? "Équipé" : "Choisir") : esc(ship.lock)) + "</em></span>" +
        "</button>"
      );
    }).join("");
    return (
      '<div class="road-shipyard" id="gl-road-shipyard" hidden>' +
        '<button type="button" class="road-shipyard-dim" data-ship-close aria-label="Fermer"></button>' +
        '<div class="road-shipyard-card">' +
          '<p class="road-kicker">Navire</p>' +
          choices +
        "</div>" +
      "</div>"
    );
  }

  function frameCurrent(root, animate) {
    var chart = root.querySelector(".road-chart");
    var scroller = root.querySelector(".road-scroll");
    var dock = root.querySelector(".road-dock");
    if (!chart || !scroller) return;
    var hereIsle = chart.querySelector(".road-isle.is-current") || chart.querySelector("[data-road-current]") || chart.querySelector(".road-isle");
    if (!hereIsle) return;
    var iRect = hereIsle.getBoundingClientRect();
    var sRect = scroller.getBoundingClientRect();
    var dockTop = dock ? dock.getBoundingClientRect().top - sRect.top : sRect.height - 96;
    var overlay = Math.max(64, sRect.height - dockTop);
    var banner = hereIsle.getAttribute("data-index") === "0" ? chart.querySelector('.road-banner[data-banner="0"]') : null;
    var mark = banner ? banner.getBoundingClientRect() : null;
    var bottom = iRect.bottom;
    var pad = 14;
    if (mark && mark.height > 24) {
      bottom = mark.bottom;
      pad = 12;
    } else {
      var ship = root.querySelector("#gl-road-ship");
      if (ship) {
        var shipRect = ship.getBoundingClientRect();
        var near = shipRect.height > 24 && shipRect.bottom > iRect.top && shipRect.top < iRect.bottom + 120 && Math.abs((shipRect.left + shipRect.right) / 2 - (iRect.left + iRect.right) / 2) < 180;
        if (near && shipRect.bottom > bottom) bottom = shipRect.bottom;
        else bottom += 48;
      } else bottom += 48;
    }
    var next = scroller.scrollTop + (bottom - sRect.bottom) + overlay + pad;
    var max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (next < 0) next = 0;
    if (next > max) next = max;
    scroller._roadUntil = Date.now() + (animate ? 1400 : 700);
    if (animate) scroller.scrollTo({ top: next, behavior: "smooth" });
    else scroller.scrollTop = next;
  }

  function page() {
    ensureCss();
    var v = view();
    if (!v) {
      return (
        '<img class="road-sea-art" src="/road/sea.svg?v=9" alt="" draggable="false">' +
        '<div class="road-hud"><div class="road-hud-row"><p class="road-kicker">East Blue</p><p class="road-hud-line">Log Pose <b>0</b></p></div></div>'
      );
    }
    if (v.state && !v.state.introSeen && !introSent) {
      introSent = true;
      post({ action: "intro" }).catch(function () { introSent = false; });
    }
    var stops = stopsOf(v);
    var slots = slotsFor(stops.length);
    var cur = v.current;
    var picked = null;
    stops.forEach(function (d) { if (d.id === openId) picked = d; });
    if (!picked && cur) stops.forEach(function (d) { if (d.id === cur.id) picked = d; });
    if (!picked) picked = stops[0];
    var isles = stops.map(function (d, i) {
      var s = slots[i];
      var current = d.status === "current";
      var body = d.mystery
        ? '<span class="road-mystery" aria-hidden="true"><span class="road-mystery-isle"></span><span class="road-mystery-mist"></span><span class="road-mystery-q">?</span></span>'
        : '<img class="road-art" src="' + artSrc(d) + '" alt="" draggable="false">';
      return (
        '<button type="button" class="road-isle is-' + esc(d.status) + (picked && picked.id === d.id ? " is-open" : "") + '" ' +
          'style="left:' + s.x + "%;top:" + s.y + '%" ' +
          'data-island="' + esc(d.id) + '" data-region="' + esc(d.regionName || "") + '" data-index="' + i + '"' +
          (current ? ' data-road-current="1"' : "") + ">" +
          '<span class="road-shadow" aria-hidden="true"></span>' +
          body +
          '<span class="road-plate"><b>' + esc(d.mystery ? "À venir" : flag(d.status)) + "</b>" +
          "<em>" + (d.requiredPoints != null ? d.requiredPoints + " Log" : "???") + "</em></span>" +
        "</button>"
      );
    }).join("");
    return (
      '<img class="road-sea-art" src="/road/sea.svg?v=9" alt="" draggable="false">' +
      skyAndHud(v) +
      '<div class="road-map">' +
        '<div class="road-scroll" data-scrolllock-allow="true">' +
          '<div class="road-chart" data-stops="' + stops.length + '">' +
            '<svg class="road-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
              '<path class="road-wake" d="' + pathD(slots) + '"></path>' +
              '<path class="road-lane" d="' + pathD(slots) + '"></path>' +
            "</svg>" +
            bannersHtml(stops) +
            isles +
            '<div class="road-ship" id="gl-road-ship"><img class="road-art" src="' + equippedShip().src + '" alt="Navire" draggable="false"></div>' +
          "</div>" +
        "</div>" +
        '<button type="button" class="road-compass" aria-label="Revenir à l’île actuelle"><span>N</span></button>' +
      "</div>" +
      dockHtml(picked) +
      shipyardHtml()
    );
  }

  function placeShip(ship, pos, faceRight) {
    if (!ship || !pos) return;
    ship.style.marginLeft = "0px";
    ship.style.marginTop = "0px";
    ship.style.left = pos.x + "%";
    ship.style.top = pos.y + "%";
    ship.classList.toggle("is-flip", faceRight != null ? !!faceRight : !!pos.faceRight);
  }

  function sailBetween(ship, points, done) {
    var i = 0;
    function hop() {
      if (i >= points.length - 1) { if (done) done(); return; }
      var a = points[i];
      var b = points[i + 1];
      var t0 = performance.now();
      var dur = 1100;
      function frame(now) {
        var t = Math.min(1, (now - t0) / dur);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        placeShip(ship, {
          x: a.x + (b.x - a.x) * e,
          y: a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 1.2,
          faceRight: e < 0.5 ? a.faceRight : b.faceRight,
        });
        if (t < 1) requestAnimationFrame(frame);
        else { i += 1; hop(); }
      }
      requestAnimationFrame(frame);
    }
    hop();
  }

  function fitStops(root) {
    var chart = root.querySelector(".road-chart");
    var header = root.querySelector(".road-hud");
    var dock = root.querySelector(".road-dock");
    var ship = root.querySelector("#gl-road-ship");
    if (!chart) return null;
    var isles = [].slice.call(chart.querySelectorAll(".road-isle"));
    var n = isles.length;
    if (!n) return null;
    var cRect = chart.getBoundingClientRect();
    var h = cRect.height;
    if (h < 80) {
      if (!root._roadFitRetry) {
        root._roadFitRetry = true;
        requestAnimationFrame(function () {
          root._roadFitRetry = false;
          if (!root.isConnected) return;
          var next = fitStops(root);
          if (next) applyBoat(root, next);
        });
      }
      return null;
    }
    var scroller = root.querySelector(".road-scroll");
    var viewH = scroller ? scroller.clientHeight : h;
    if (viewH < 80) viewH = h;
    var sTop = scroller ? scroller.getBoundingClientRect().top : cRect.top;
    var bar = header && header.querySelector(".road-bar");
    var headB = (bar || header) ? (bar || header).getBoundingClientRect().bottom - sTop : 52;
    var dockTop = dock ? dock.getBoundingClientRect().top - sTop : viewH - 96;
    var gap = 18;
    var last = isles[n - 1];
    var lastH = last.offsetHeight || 120;
    var peak = /\bis-soon\b/.test(last.className) ? 14 : 0;
    var shipH = ship && ship.offsetHeight ? ship.offsetHeight : 69;
    var overlay = Math.max(64, viewH - dockTop);
    var topPad = Math.max(36, headB) + gap + peak + lastH * 0.62;
    var firstH = isles[0].offsetHeight || 150;
    var bannerH = 88;
    var bottomPad = overlay + 14 + bannerH + Math.round(firstH * 0.42);
    var step = 248;
    var bannerGap = 120;
    var breaks = 0;
    for (var b = 1; b < n; b++) {
      var nextRegion = isles[b].getAttribute("data-region") || "";
      var prevRegion = isles[b - 1].getAttribute("data-region") || "";
      if (nextRegion && prevRegion && nextRegion !== prevRegion) breaks++;
    }
    var islandSpan = Math.max(0, n - 1) * step + breaks * bannerGap;
    var span = Math.max(islandSpan, Math.max(0, viewH - topPad - bottomPad));
    var chartH = Math.max(viewH, Math.ceil(topPad + span + bottomPad));
    chart.style.height = chartH + "px";
    var yPx = chartH - bottomPad;
    var slots = [];
    for (var i = 0; i < n; i++) {
      if (i > 0) {
        yPx -= step;
        var hereRegion = isles[i].getAttribute("data-region") || "";
        var wasRegion = isles[i - 1].getAttribute("data-region") || "";
        if (hereRegion && wasRegion && hereRegion !== wasRegion) yPx -= bannerGap;
      }
      var y = (yPx / chartH) * 100;
      slots.push({ x: i % 2 === 0 ? 30 : 58, y: y });
      isles[i].style.top = y + "%";
    }
    chart.querySelectorAll(".road-banner").forEach(function (banner) {
      var idx = Number(banner.getAttribute("data-banner"));
      var isle = isles[idx];
      if (!isle) return;
      var isleTop = parseFloat(isle.style.top);
      if (idx === 0) {
        var markH = banner.offsetHeight || 88;
        var center = chartH - overlay - 12 - markH / 2;
        banner.style.top = (center / chartH) * 100 + "%";
      } else {
        var prevTop = parseFloat(isles[idx - 1].style.top);
        banner.style.top = (isleTop + prevTop) / 2 + "%";
      }
    });
    var d = pathD(slots);
    chart.querySelectorAll(".road-route path").forEach(function (p) { p.setAttribute("d", d); });
    var map = root.querySelector(".road-map");
    if (map && dock) map.style.setProperty("--road-dock-h", dock.offsetHeight + "px");
    if (scroller && !scroller._roadHold) {
      frameCurrent(root);
      if (!scroller._roadWatch) {
        scroller._roadWatch = true;
        scroller.addEventListener("scroll", function () {
          syncRegion(root);
          if (Date.now() < (scroller._roadUntil || 0)) return;
          scroller._roadHold = true;
        }, { passive: true });
      }
    }
    syncRegion(root);
    return slots;
  }

  function moorings(root, slots) {
    var chart = root.querySelector(".road-chart");
    var isles = chart ? [].slice.call(chart.querySelectorAll(".road-isle")) : [];
    return (slots || []).map(function (slot, i) {
      return (chart && moorOf(isles[i], i, chart)) || dockOf(slot, i);
    });
  }

  function applyBoat(root, slots) {
    if (sailing || !slots) return;
    var ship = root.querySelector("#gl-road-ship");
    var v = view();
    if (!ship || !v) return;
    var stops = stopsOf(v);
    var docks = moorings(root, slots);
    var cur = v.current;
    var idx = 0;
    stops.forEach(function (d, i) { if (cur && d.id === cur.id) idx = i; });
    placeShip(ship, docks[idx] || docks[0]);
  }

  function afterPaint(root) {
    if (!root) return;
    var v = view();
    var chart = root.querySelector(".road-chart");
    var ship = root.querySelector("#gl-road-ship");
    if (chart && ship && v) {
      var fitted = fitStops(root);
      var stops = stopsOf(v);
      var slots = fitted || slotsFor(stops.length);
      var docks = moorings(root, slots);
      var cur = v.current;
      var idx = 0;
      stops.forEach(function (d, i) { if (cur && d.id === cur.id) idx = i; });
      var here = docks[idx];
      var prev = "";
      try { prev = sessionStorage.getItem("gl-road-boat-at") || ""; } catch (e) {}
      var prevIdx = -1;
      stops.forEach(function (d, i) { if (d.id === prev) prevIdx = i; });
      if (!sailing && prev && prevIdx >= 0 && prevIdx !== idx && sailedTo !== (cur && cur.id)) {
        sailedTo = cur ? cur.id : "";
        sailing = true;
        var path = [];
        var step = prevIdx < idx ? 1 : -1;
        for (var p = prevIdx; p !== idx + step; p += step) path.push(docks[p]);
        sailBetween(ship, path, function () {
          sailing = false;
          placeShip(ship, here);
          try { sessionStorage.setItem("gl-road-boat-at", cur ? cur.id : ""); } catch (e2) {}
        });
      } else if (!sailing) {
        placeShip(ship, here);
        var scroller = root.querySelector(".road-scroll");
        if (!scroller || !scroller._roadHold) frameCurrent(root);
        sailedTo = cur ? cur.id : sailedTo;
        try { sessionStorage.setItem("gl-road-boat-at", cur ? cur.id : ""); } catch (e3) {}
        var scroller = root.querySelector(".road-scroll");
        if (scroller && !scroller._roadHold) frameCurrent(root);
      }
      chart.querySelectorAll("img").forEach(function (img) {
        if (img._roadLoad || img.complete) return;
        img._roadLoad = true;
        img.addEventListener("load", function () {
          if (!root.isConnected) return;
          var next = fitStops(root);
          if (next) applyBoat(root, next);
        });
      });
    }
    if (!root._roadResize) {
      root._roadResize = true;
      window.addEventListener("resize", function () {
        if (!root.isConnected) return;
        var next = fitStops(root);
        if (next) applyBoat(root, next);
      });
    }
    var shipEl = root.querySelector("#gl-road-ship");
    if (shipEl && !shipEl._roadPick) {
      shipEl._roadPick = true;
      shipEl.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var box = root.querySelector("#gl-road-shipyard");
        if (box) box.hidden = false;
      });
    }
    root.querySelectorAll("[data-ship-close]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var box = root.querySelector("#gl-road-shipyard");
        if (box) box.hidden = true;
      });
    });
    root.querySelectorAll("[data-ship]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        var ship = shipById(btn.getAttribute("data-ship"));
        if (!shipReady(ship)) return;
        try { localStorage.setItem("gl-road-boat", ship.id); } catch (err) {}
        var img = root.querySelector("#gl-road-ship img");
        if (img) img.src = ship.src;
        var box = root.querySelector("#gl-road-shipyard");
        if (box) box.hidden = true;
      });
    });
    var compass = root.querySelector(".road-compass");
    if (compass && !compass._roadBound) {
      compass._roadBound = true;
      compass.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var scroller = root.querySelector(".road-scroll");
        if (scroller) scroller._roadHold = true;
        frameCurrent(root, true);
      });
    }
    var dossier = root.querySelector("#gl-road-dossier");
    root.querySelectorAll("[data-island]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-island");
        openId = id;
        var v2 = view();
        if (!v2 || !dossier) return;
        var found = null;
        stopsOf(v2).forEach(function (d) { if (d.id === id) found = d; });
        dossier.innerHTML = dossierHtml(found);
        var sail = root.querySelector(".road-dock-sail");
        if (sail) sail.disabled = !canSail(found);
        root.querySelectorAll(".road-isle").forEach(function (el) {
          el.classList.toggle("is-open", el.getAttribute("data-island") === id);
        });
      });
    });
  }

  function skyAndHud(v) {
    var cur = v && v.current;
    var next = v && v.next;
    var ratio = Math.round(((v && v.progress && v.progress.ratio) || 0) * 100);
    var region = (cur && cur.regionName) || ((v && v.regions && v.regions[0] && v.regions[0].name) || "East Blue");
    var nextLine = !v ? "" : v.atEnd
      ? "Dernière destination disponible."
      : ((v.progress && v.progress.label) || (next ? next.requiredPoints + " points avant la suite" : ""));
    return (
      '<svg class="road-sky-clouds" viewBox="0 0 390 80" width="390" height="80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<g fill="#f7fbfe" stroke="#16344c" stroke-width="2.4" stroke-linejoin="round">' +
          '<g><animateTransform attributeName="transform" type="translate" values="0 0; 8 0; 0 0" dur="16s" repeatCount="indefinite"/>' +
            '<ellipse cx="46" cy="28" rx="34" ry="13"/>' +
            '<ellipse cx="72" cy="20" rx="20" ry="11"/>' +
            '<ellipse cx="24" cy="24" rx="15" ry="10"/>' +
            '<ellipse cx="50" cy="34" rx="22" ry="7" fill="#d5e4f0" stroke="none"/>' +
          "</g>" +
          '<g><animateTransform attributeName="transform" type="translate" values="0 0; -8 0; 0 0" dur="19s" repeatCount="indefinite"/>' +
            '<ellipse cx="344" cy="36" rx="30" ry="12"/>' +
            '<ellipse cx="318" cy="28" rx="16" ry="10"/>' +
            '<ellipse cx="366" cy="30" rx="12" ry="8"/>' +
            '<ellipse cx="344" cy="42" rx="18" ry="6" fill="#d5e4f0" stroke="none"/>' +
          "</g>" +
        "</g>" +
      "</svg>" +
      '<div class="road-hud">' +
        '<div class="road-hud-row">' +
          '<p class="road-kicker" id="gl-road-region">' + esc(region) + "</p>" +
          '<p class="road-hud-line">Log Pose <b>' + ((v && v.state && v.state.points) || 0) + "</b></p>" +
        "</div>" +
        '<p class="road-hud-next">' + esc(nextLine) + "</p>" +
        '<div class="road-bar" aria-hidden="true"><span style="width:' + ratio + '%"></span></div>' +
      "</div>"
    );
  }

  function line() {
    var v = view();
    if (!v || !v.current) return "Prendre la mer";
    return v.current.name;
  }

  function waitExtra() {
    var v = view();
    var cur = v && v.current;
    if (!cur) return "";
    return (
      '<img class="road-seek-region" src="' + regionLogo(cur) + '" alt="' + esc(cur.regionName || "") + '" draggable="false">' +
      '<img class="road-seek-isle" src="' + artSrc(cur) + '" alt="" draggable="false">'
    );
  }

  function splash() {
    var v = view();
    var cur = v && v.current;
    var region = (cur && cur.regionName) || "East Blue";
    var ship = equippedShip();
    var isle = cur ? artSrc(cur) : "/road/foosha.png?v=8";
    return (
      '<div class="road-depart">' +
        '<img class="road-depart-sea" src="/road/sea.svg?v=9" alt="" draggable="false">' +
        '<div class="road-depart-shade" aria-hidden="true"></div>' +
        '<div class="road-depart-crest">' +
          '<img class="road-depart-logo" src="' + regionLogo(cur) + '" alt="' + esc(region) + '" draggable="false">' +
          '<img class="road-depart-isle" src="' + isle + '" alt="" draggable="false">' +
          '<div class="road-depart-rule" aria-hidden="true"></div>' +
          '<p class="road-depart-line">Le navire quitte le port…</p>' +
        "</div>" +
        '<div class="road-depart-sail" aria-hidden="true">' +
          '<span class="road-depart-ripple"></span>' +
          '<img class="road-depart-ship" src="' + ship.src + '" alt="" draggable="false">' +
        "</div>" +
      "</div>"
    );
  }

  function intro() {
    return post({ action: "intro" });
  }

  function creditBerries(total) {
    var n = Number(total);
    if (!Number.isFinite(n)) return;
    try {
      var raw = JSON.parse(localStorage.getItem("gl-tcg-save") || "null") || {};
      var st = raw.state && typeof raw.state === "object" ? raw.state : raw;
      st.berries = n;
      if (raw.state) raw.state = st;
      localStorage.setItem("gl-tcg-save", JSON.stringify(raw));
    } catch (e) {}
    import("/assets/store-BlZSQe9J.js").then(function (m) {
      if (m && m.o && typeof m.o.setState === "function") m.o.setState({ berries: n });
    }).catch(function () {});
  }

  function claim(id) {
    return post({ action: "claim", rewardId: id }).then(function (j) {
      if (j && j.berries != null) creditBerries(j.berries);
      return j;
    });
  }

  function settle(roomId) {
    return post({ action: "settle", roomId: roomId }).then(function (j) {
      var r = (j && j.result) || {};
      var total = r.total || 0;
      var win = r.outcome === "win";
      var loss = r.outcome === "loss";
      var word = win ? "Victoire" : loss ? "Défaite" : r.outcome === "draw" ? "Égalité" : "Terminé";
      var tone = win ? " is-win" : loss ? " is-loss" : "";
      var v = view();
      var cur = v && v.current;
      var leg = cur ? legOf(cur, stopsOf(v), r.after != null ? r.after : 0) : null;
      var pct = leg ? Math.round(Math.max(0, Math.min(1, leg.ratio)) * 100) : 0;
      var nextLine = leg && leg.next ? leg.left + " points avant " + leg.next.name : "";
      return (
        '<div class="road-end' + tone + '">' +
          '<p class="road-end-kicker">Road to One Piece</p>' +
          "<h3>" + word + "</h3>" +
          '<div class="road-end-rule"></div>' +
          '<p class="road-delta' + (total < 0 ? " is-down" : "") + '">' + (total > 0 ? "+" : "") + total + "</p>" +
          '<p class="road-end-pose">Log Pose</p>' +
          '<div class="road-end-meter" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
          '<p class="road-end-pts"><b>' + (r.before != null ? r.before : "—") + "</b><em>→</em><b>" + (r.after != null ? r.after : "—") + "</b></p>" +
          (nextLine ? '<p class="road-end-next">' + esc(nextLine) + "</p>" : "") +
          '<button type="button" class="road-end-go" data-over="road">Retour à la carte</button>' +
        "</div>"
      );
    });
  }

  window.GLRoad = {
    page: page,
    afterPaint: afterPaint,
    refresh: refresh,
    line: line,
    waitExtra: waitExtra,
    hud: function () {
      var v = view();
      return v ? skyAndHud(v) : "";
    },
    splash: splash,
    intro: intro,
    claim: claim,
    openBrief: openBrief,
    closeBrief: closeBrief,
    sheetHtml: sheetHtml,
    settle: settle,
  };
  ensureCss();
})();
