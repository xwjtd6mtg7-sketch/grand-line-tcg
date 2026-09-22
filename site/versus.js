/**
 * Versus overlay — Grand Line TCG.
 * Hub + Match privé (mot de passe / QR) + duel en ligne.
 */
(function () {
  var SAVE = "gl-tcg-save";
  var catalog = null;
  var view = "hub";
  var sheet = null;
  var openVs = false;
  var room = null;
  var password = "";
  var selectedDeckId = "";
  var pollT = 0;
  var clockT = 0;
  var selectedIid = "";
  var selectedAtk = "";
  var selectedDon = false;
  var lastVer = -1;
  var signedIn = false;
  var scanStream = null;
  var pendingPick = "";
  var shownPrep = false;
  var shownDecks = false;
  var sheetBusy = false;
  var vsScanLock = false;
  var soloLive = false;
  var resultLocked = false;
  var mullT0 = 0;
  var kickoffBusy = false;
  var sawMull = false;
  var sawCoin = false;
  var hereT = 0;
  var kickoffShown = false;
  var soloLaunching = false;

  if (!document.getElementById("gl-versus-css")) {
    var link = document.createElement("link");
    link.id = "gl-versus-css";
    link.rel = "stylesheet";
    link.href = "/versus.css?v=40";
    document.head.appendChild(link);
  } else {
    document.getElementById("gl-versus-css").href = "/versus.css?v=40";
  }

  var ICO = {
    versus: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="16" cy="16" r="7"/><circle cx="32" cy="20" r="6"/><path d="M6 38c1-8 6-12 10-12s9 4 10 12M26 38c.6-6 4-10 7-10s6 3 7 10"/></svg>',
    event: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="24" cy="22" r="10"/><path d="M24 12v-4M18 38h12M21 34h6"/><circle cx="24" cy="22" r="4"/></svg>',
    ranked: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 22l14-10 14 10v12a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z"/><circle cx="24" cy="24" r="6"/></svg>',
    priv: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="24" cy="16" r="7"/><path d="M10 40c1.2-8 7-12 14-12s12.8 4 14 12"/><rect x="28" y="22" width="12" height="10" rx="2"/><path d="M31 22v-3a3 3 0 0 1 6 0v3"/></svg>',
    globe: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="24" cy="24" r="14"/><path d="M10 24h28M24 10c6 4 8 10 8 14s-2 10-8 14c-6-4-8-10-8-14s2-10 8-14z"/></svg>',
    chat: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="8" y="10" width="32" height="22" rx="8"/><circle cx="18" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="30" cy="21" r="2" fill="currentColor"/><path d="M18 32l-4 8 10-8"/></svg>',
    qr: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 8h12v12H8zM28 8h12v12H28zM8 28h12v12H8z"/><path d="M28 28h6v6h-6zM38 28v12M28 38h4"/></svg>',
    decks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  };

  function saveState() {
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      return (raw && (raw.state || raw)) || {};
    } catch (e) {
      return {};
    }
  }
  function decks() {
    var st = saveState();
    return Array.isArray(st.decks) ? st.decks : [];
  }
  function activeDeck() {
    var st = saveState();
    var list = decks();
    var id = selectedDeckId || st.activeDeckId;
    return list.find(function (d) { return d.id === id; }) || list[0] || null;
  }
  function cardOf(id) {
    if (!catalog || !catalog.cards) return null;
    return catalog.cards.find(function (c) { return c.id === id; }) || null;
  }
  function srcOf(c) {
    if (!c) return "";
    var u = c.image || "";
    if (window.GL_cardSrc) u = window.GL_cardSrc(u);
    if (u && u.indexOf("/cards-fr/") === 0) {
      u = "https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main" + u;
    }
    return u;
  }
  function setOfDeck(d, leader) {
    if (d && d.starterId) return d.starterId;
    if (d && d.id) {
      var sm = String(d.id).match(/(?:starter_|deck_)(ST-\d+)/i);
      if (sm) return sm[1].toUpperCase();
    }
    var id = (leader && leader.id) || (d && d.leaderId) || "";
    var m = String(id).match(/^(ST|OP|EB|PRB)0*(\d+)/i);
    if (!m) return "";
    return m[1].toUpperCase() + "-" + String(m[2]).padStart(2, "0");
  }
  function packSrc(set) {
    if (!set) return "/boosters/generic.webp";
    if (set === "OP-15" || set === "EB-04") return "/boosters/OP15-EB04.webp?v=op15eb04";
    return "/boosters/" + set + ".webp?v=op15eb04";
  }
  var SKINS = {
    "back-official": "/card-back.png?v=official",
    "back-anniv3": "/cosmetics/backs/anniv3.jpg",
    "back-grandline": "/cosmetics/backs/grandline.jpg",
    "back-strawhat": "/cosmetics/backs/strawhat.jpg",
    "back-marine": "/cosmetics/backs/marine.jpg",
    "back-wano": "/cosmetics/backs/wano.jpg",
    "back-yonko": "/cosmetics/backs/yonko.jpg",
    "back-night": "/cosmetics/backs/night.jpg",
    "don-official": "/don/front.jpg",
    "don-anniv3": "/cosmetics/don/anniv3.jpg",
    "don-classic": "/don/standard.jpg",
    "don-gold": "/don/official.jpg",
    "don-wano": "/don/wano.jpg",
    "don-egghead": "/don/egghead.jpg",
    "don-foil": "/don/3d.jpg",
    "don-manga": "/don/manga.jpg",
    "mat-felt": "/cosmetics/mats/felt.jpg",
    "mat-anniv3": "/cosmetics/mats/anniv3.jpg?v=ai",
    "mat-sunny": "/cosmetics/mats/sunny.jpg",
    "mat-marine": "/cosmetics/mats/marine.jpg",
    "mat-ocean": "/cosmetics/mats/ocean.jpg",
    "mat-wano": "/cosmetics/mats/wano.jpg",
    "mat-night": "/cosmetics/mats/night.jpg",
  };
  function skinOf(d, kind) {
    var cos = (d && d.cosmetics) || {};
    var id = cos[kind] || (kind === "back" ? "back-official" : kind === "don" ? "don-official" : "mat-felt");
    return SKINS[id] || "";
  }
  function deckCount(d) {
    var n = 0;
    var map = (d && d.cards) || {};
    Object.keys(map).forEach(function (k) { n += Number(map[k]) || 0; });
    return n;
  }
  function applyDeck(id) {
    if (!id) return;
    selectedDeckId = id;
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null") || {};
      if (raw.state) raw.state.activeDeckId = id;
      else raw.activeDeckId = id;
      localStorage.setItem(SAVE, JSON.stringify(raw));
    } catch (e) {}
    import("/assets/store-BlZSQe9J.js").then(function (m) {
      if (m && m.o && typeof m.o.setState === "function") m.o.setState({ activeDeckId: id });
    }).catch(function () {});
  }
  function leaderColor(leader) {
    var c = (leader && leader.colors && leader.colors[0]) || "";
    return ({ Red: "#c4453c", Green: "#2f8f5b", Blue: "#3b6ea8", Purple: "#7a5ea8", Black: "#3a3d46", Yellow: "#c9a227" })[c] || "#c9a227";
  }
  function payloadDeck(d) {
    if (!d) return null;
    var leader = cardOf(d.leaderId) || { id: d.leaderId, name: d.name, life: 5, power: 5000, type: "Leader" };
    var cards = [];
    var map = d.cards || {};
    Object.keys(map).forEach(function (id) {
      var info = cardOf(id) || { id: id, name: id, type: "Character", cost: 3, power: 4000 };
      var n = Number(map[id]) || 0;
      for (var i = 0; i < n && cards.length < 50; i++) cards.push({
        id: info.id,
        name: info.name,
        type: info.type,
        cost: info.cost,
        power: info.power,
        counter: info.counter || 0,
        text: info.text || info.textEn || "",
        textEn: info.textEn || "",
        image: info.image || "",
        colors: info.colors || [],
      });
    });
    return {
      name: d.name || "Deck",
      leader: {
        id: leader.id,
        name: leader.name,
        life: leader.life || 5,
        power: leader.power || 5000,
        image: leader.image || "",
        colors: leader.colors || [],
      },
      cards: cards,
    };
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function rootEl() {
    var el = document.getElementById("gl-vs-root");
    if (el) return el;
    el = document.createElement("div");
    el.id = "gl-vs-root";
    el.className = "gl-vs-root";
    el.hidden = true;
    var host = document.querySelector(".tab-host");
    (host || document.body).appendChild(el);
    el.addEventListener("click", onClick);
    return el;
  }
  function portalEl() {
    var p = document.getElementById("gl-vs-portal");
    if (!p) {
      p = document.createElement("div");
      p.id = "gl-vs-portal";
      p.className = "gl-vs-portal";
      document.body.appendChild(p);
      p.addEventListener("click", onClick);
    }
    return p;
  }

  function sheetHeight() {
    var head = document.querySelector("#gl-vs-root .gl-head");
    var top = Math.round((typeof window !== "undefined" ? window.innerHeight : 700) * 0.12);
    if (head) {
      var r = head.getBoundingClientRect();
      if (r.bottom > 24) top = Math.round(r.bottom + 8);
    }
    return Math.max(360, window.innerHeight - top);
  }

  function pickerHeight() {
    return Math.max(280, Math.round(window.innerHeight - 52));
  }

  function setReveal(el, maxH, revealed, animate) {
    if (!el) return;
    var r = Math.max(0, Math.min(maxH + 28, revealed));
    el._vsMaxH = maxH;
    el._vsReveal = r;
    el.style.height = maxH + "px";
    el.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
    el.style.transform = "translate3d(0," + Math.max(0, maxH - r) + "px,0)";
  }

  function slideIn(el, maxH) {
    if (!el) return;
    var h = maxH || parseInt(el.style.height, 10) || sheetHeight();
    el.classList.remove("is-live");
    setReveal(el, h, 0, false);
    requestAnimationFrame(function () {
      el.classList.add("is-live");
      requestAnimationFrame(function () { setReveal(el, h, h, true); });
    });
  }

  function slideOut(el, done) {
    if (!el) { if (done) done(); return; }
    var h = el._vsMaxH || parseInt(el.style.height, 10) || el.offsetHeight;
    sheetBusy = true;
    el.classList.add("is-live");
    setReveal(el, h, 0, true);
    setTimeout(function () {
      sheetBusy = false;
      if (done) done();
    }, 390);
  }

  function restSheet(el) {
    if (!el) return;
    var h = parseInt(el.style.height, 10) || el.offsetHeight;
    el.classList.add("is-live");
    setReveal(el, h, h, false);
  }

  function bindGrab(sheet, onClose) {
    var grab = sheet && sheet.querySelector(".dossier-grab");
    if (!grab) return;
    grab.style.touchAction = "none";
    grab.addEventListener("pointerdown", function (e) {
      if (sheetBusy) return;
      e.stopPropagation();
      try { grab.setPointerCapture(e.pointerId); } catch (err) {}
      var maxH = sheet._vsMaxH || sheet.offsetHeight;
      sheet._drag = { y: e.clientY, base: sheet._vsReveal || maxH, maxH: maxH };
      sheet.classList.add("is-drag");
    });
    grab.addEventListener("pointermove", function (e) {
      var d = sheet._drag;
      if (!d || sheetBusy) return;
      var n = Math.max(80, Math.min(d.maxH + 28, d.base - (e.clientY - d.y)));
      setReveal(sheet, d.maxH, n, false);
      if (n < d.maxH * 0.42) {
        sheet._drag = null;
        sheet.classList.remove("is-drag");
        onClose();
      }
    });
    function end() {
      var d = sheet._drag;
      if (!d || sheetBusy) return;
      sheet._drag = null;
      sheet.classList.remove("is-drag");
      var r = sheet._vsReveal || d.maxH;
      if (r < d.maxH * 0.78) onClose();
      else setReveal(sheet, d.maxH, d.maxH, true);
    }
    grab.addEventListener("pointerup", end);
    grab.addEventListener("pointercancel", end);
  }

  function closePrepAnim() {
    var prep = document.querySelector("#gl-vs-portal .gl-vs-prep .dossier-sheet");
    slideOut(prep, function () {
      view = "hub";
      sheet = null;
      shownPrep = false;
      shownDecks = false;
      paint();
    });
  }

  function closeDecksAnim() {
    var dEl = document.querySelector("#gl-vs-portal .gl-vs-decks .dossier-sheet");
    slideOut(dEl, function () {
      sheet = null;
      shownDecks = false;
      paint();
    });
  }

  function mountRoot() {
    var el = rootEl();
    var host = document.querySelector(".tab-host");
    if (host && el.parentNode !== host) host.appendChild(el);
    return el;
  }
  function toast(msg) {
    var t = rootEl().querySelector(".gl-vs-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "gl-vs-toast";
      rootEl().appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove("is-on"); }, 1800);
  }
  function header(sub) {
    return (
      '<div class="gl-head"><div class="gl-head-row">' +
        '<h2 class="gl-head-title">Combat' +
          (sub ? '<span class="cmb-head-sub">' + sub + "</span>" : "") +
        '</h2></div><div class="gl-rule"></div></div>'
    );
  }
  function backBar(opts) {
    opts = opts || {};
    var leftAct = opts.leftAct || "decks";
    var leftLabel = opts.leftLabel || "Decks";
    var leftIco = opts.leftIco || ICO.decks;
    var backAct = opts.backAct || "back";
    return (
      '<div class="cmb-float">' +
        '<button type="button" class="cmb-deck-btn" data-act="' + leftAct + '">' +
          leftIco + "<span>" + leftLabel + "</span></button>" +
        '<button type="button" class="cmb-back" data-act="' + backAct + '" aria-label="Retour">' +
          ICO.back + "</button>" +
        '<span class="cmb-deck-btn is-ghost" aria-hidden="true"></span>' +
      "</div>"
    );
  }

  function api(body) {
    return fetch("/api/versus", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (r.status === 401) { signedIn = false; throw new Error("Connecte-toi pour un match privé."); }
        if (!r.ok) throw new Error(j.message || "Erreur");
        signedIn = true;
        return j;
      });
    });
  }
  function getRoom(id) {
    return fetch("/api/versus?id=" + encodeURIComponent(id), { credentials: "include" })
      .then(function (r) { return r.json(); });
  }

  function startPoll() {
    stopPoll();
    lastVer = -1;
    pollT = setInterval(tick, 900);
    if (!clockT) {
      clockT = setInterval(function () {
        tickMulligan();
        maybeKickoff();
        var v = room && room.view;
        if (!v || !v.clocks) return;
        if (view !== "play" && !soloLive) return;
        if (pregameLock() || (window.__glVsNet && !window.__glVsNet.kickoffDone)) {
          hideClockOverlay();
          return;
        }
        if (v.clockSide && v.clocks[v.clockSide] != null && !oppAwayOf(v)) {
          v.clocks[v.clockSide] = Math.max(0, (v.clocks[v.clockSide] || 0) - 250);
        }
        if (v.shot != null && !oppAwayOf(v)) {
          v.shot = Math.max(0, (v.shot || 0) - 250);
        }
        if (v.shot != null && v.shot <= 0 && window.__glVsNet && typeof window.__glVsNet.forceTimeout === "function") {
          window.__glVsNet.forceTimeout();
        }
        if (v.awayFor) {
          var awaySide = (v.pid | 0) === 0 ? "guest" : "host";
          if (v.away && v.away[awaySide] && v.awayFor[awaySide] > 0) {
            v.awayFor[awaySide] = Math.max(0, v.awayFor[awaySide] - 250);
            var cd = document.querySelector('[data-clock="opp"] [data-away-cd]');
            if (cd) cd.textContent = fmtClock(v.awayFor[awaySide]);
          }
        }
        if (v.react && v.react.remaining > 0) {
          v.react.remaining = Math.max(0, v.react.remaining - 250);
        }
        updateClocks();
      }, 250);
    }
    tick();
    startHereBeat();
  }
  function stopPoll() {
    if (pollT) { clearInterval(pollT); pollT = 0; }
    if (clockT) { clearInterval(clockT); clockT = 0; }
    if (window._glVsClock) { clearInterval(window._glVsClock); window._glVsClock = 0; }
    stopHereBeat();
  }

  function isSoloView(v) {
    return !!(v && v.engine === "solo" && v.hostDeck && v.guestDeck);
  }

  function persistResume() {
    try {
      if (room && room.id) {
        sessionStorage.setItem("gl-vs-resume", String(room.id));
        localStorage.setItem("gl-vs-resume", String(room.id));
      }
    } catch (e) {}
  }

  function clearResume() {
    try { sessionStorage.removeItem("gl-vs-resume"); } catch (e) {}
    try { localStorage.removeItem("gl-vs-resume"); } catch (e) {}
  }

  function resumeId() {
    try { return sessionStorage.getItem("gl-vs-resume") || localStorage.getItem("gl-vs-resume") || ""; }
    catch (e) { return ""; }
  }

  function bustEngineCache() {
    try {
      var prev = Number(sessionStorage.getItem("gl-vs-bust") || 0);
      if (prev && Date.now() - prev < 60000) return false;
      sessionStorage.setItem("gl-vs-bust", String(Date.now()));
    } catch (e) {}
    persistResume();
    try { sessionStorage.setItem("gl-vs-silent", "1"); } catch (e) {}
    var go = function () { location.reload(); };
    var chain = Promise.resolve();
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        chain = navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        });
      }
    } catch (e) {}
    chain.then(function () {
      if (!window.caches || !caches.keys) return;
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    }).then(go).catch(go);
    return true;
  }

  function goPlayRoute() {
    try { window.dispatchEvent(new Event("gl-vs-kick")); } catch (e) {}
  }

  function playerDisplayName() {
    try {
      var p = JSON.parse(localStorage.getItem("gl-profile-v1") || "{}");
      if (p && p.name) return String(p.name).slice(0, 14);
    } catch (e) {}
    return "Pirate";
  }

  function isSoloMode() {
    var html = document.documentElement;
    if (html.classList.contains("gl-versus-fight") && !html.classList.contains("gl-versus-solo")) return false;
    if (html.classList.contains("gl-versus-solo") || html.classList.contains("gl-bgm-solo")) return true;
    return false;
  }

  function clocksShouldShow() {
    if (pregameLock()) return false;
    if (document.querySelector(".over-root, #gl-vs-resume, .vs-root")) return false;
    if (!document.querySelector(".fight-fs")) return false;
    return true;
  }

  function clockFloatHtml(v) {
    v = v || {};
    var pid = v.pid | 0;
    var mySide = pid === 0 ? "host" : "guest";
    var oppSide = mySide === "host" ? "guest" : "host";
    var myName = pid === 0 ? (v.hostName || playerDisplayName()) : (v.guestName || playerDisplayName());
    var oppName = isSoloMode()
      ? "Adversaire"
      : (pid === 0 ? (v.guestName || "Adversaire") : (v.hostName || "Adversaire"));
    var namesOnly = isSoloMode();
    var mine = (v.clocks && v.clocks[mySide]) || 0;
    var opp = (v.clocks && v.clocks[oppSide]) || 0;
    return (
      '<div class="gl-vs-clocks is-float' + (namesOnly ? " is-names" : "") + '">' +
        '<div class="gl-vs-clock is-opp' + (namesOnly ? "" : ((v.clockSide === oppSide ? " is-run" : "") + (opp < 60000 ? " is-low" : ""))) + '" data-clock="opp">' +
          '<div class="gl-vs-clock-face"><small>' + esc(oppName) + "</small>" + (namesOnly ? "" : "<b>" + fmtClock(opp) + "</b>") + "</div></div>" +
        '<div class="gl-vs-clock is-me' + (namesOnly ? "" : ((v.clockSide === mySide ? " is-run" : "") + (mine < 60000 ? " is-low" : ""))) + '" data-clock="me">' +
          '<div class="gl-vs-clock-face"><small>' + esc(myName) + "</small>" + (namesOnly ? "" : "<b>" + fmtClock(mine) + "</b>") + "</div></div>" +
      "</div>"
    );
  }

  function pinClockToLife(el, side) {
    if (!el) return;
    var life = document.querySelector('.fight-fs [data-life="' + side + '"]');
    if (!life || !life.getClientRects().length) {
      el.style.opacity = "0";
      return;
    }
    el.style.opacity = "";
    var r = life.getBoundingClientRect();
    var gap = 6;
    el.style.position = "fixed";
    el.style.left = Math.round(r.left + r.width / 2) + "px";
    el.style.zIndex = "126";
    var towardField = side === "opp" ? (r.top < window.innerHeight * 0.45) : (r.top > window.innerHeight * 0.45);
    if (towardField && side === "opp") {
      el.style.top = Math.round(r.bottom + gap) + "px";
      el.style.transform = "translate(-50%, 0)";
    } else {
      el.style.top = Math.round(r.top - gap) + "px";
      el.style.transform = "translate(-50%, -100%)";
    }
  }

  function pinClocksToLife() {
    var root = document.getElementById("gl-vs-clocks-float");
    if (!root || root.hidden) return;
    pinClockToLife(root.querySelector('[data-clock="me"]'), "me");
    pinClockToLife(root.querySelector('[data-clock="opp"]'), "opp");
  }

  function mountClockOverlay(v) {
    if (!clocksShouldShow()) {
      hideClockOverlay();
      return;
    }
    var el = document.getElementById("gl-vs-clocks-float");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-vs-clocks-float";
      el.className = "gl-vs-clocks-float";
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.innerHTML = clockFloatHtml(v || (room && room.view) || {});
    pinClocksToLife();
    updateShotOverlay(v || (room && room.view));
    updateAwayOverlay(v || (room && room.view));
  }

  function hideClockOverlay() {
    var el = document.getElementById("gl-vs-clocks-float");
    if (el) {
      el.hidden = true;
      el.innerHTML = "";
    }
    var shot = document.getElementById("gl-vs-shot");
    if (shot) shot.hidden = true;
  }

  function pregameLock() {
    return !!(document.querySelector(".mul-root, .coin-root, #gl-vs-kickoff"));
  }

  function vsFirstPid() {
    var seed = String((window.__glVsNet && window.__glVsNet.gameId) || "");
    if (!seed) return 0;
    var h = 2166136261;
    for (var k = 0; k < seed.length; k++) {
      h ^= seed.charCodeAt(k);
      h = Math.imul(h, 16777619);
    }
    return h >>> 31;
  }

  function tickMulligan() {
    var mul = document.querySelector(".mul-root");
    var el = document.getElementById("gl-vs-mull-cd");
    if (!mul) {
      mullT0 = 0;
      if (el) el.hidden = true;
      return;
    }
    sawMull = true;
    hideClockOverlay();
    var keepBtn = mul.querySelector(".studio-float-save");
    var idle = !!(keepBtn && !keepBtn.disabled);
    if (!idle) {
      if (el) el.hidden = true;
      return;
    }
    if (!mullT0) mullT0 = Date.now();
    var left = Math.max(0, 30 - Math.floor((Date.now() - mullT0) / 1000));
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-vs-mull-cd";
      el.className = "gl-vs-mull-cd";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.textContent = left + "s";
    el.classList.toggle("is-low", left <= 5);
    if (left <= 0) {
      mullT0 = 0;
      var btn = mul.querySelector(".studio-float-save");
      if (btn && !btn.disabled) {
        try { btn.click(); } catch (e) {}
      }
    }
  }

  function markFightBgm() {
    var html = document.documentElement;
    var pvp = html.classList.contains("gl-versus-fight") && !html.classList.contains("gl-versus-solo");
    html.classList.toggle("gl-bgm-pvp", !!pvp);
    html.classList.toggle("gl-bgm-solo", !pvp);
    try { if (window.GLBgm && window.GLBgm.sync) window.GLBgm.sync(); } catch (eB) {}
  }

  function clearFightBgm() {
    document.documentElement.classList.remove("gl-bgm-solo", "gl-bgm-pvp");
    try { if (window.GLBgm && window.GLBgm.sync) window.GLBgm.sync(); } catch (eB) {}
  }

  function finishKickoff() {
    var el = document.getElementById("gl-vs-kickoff");
    if (el) el.remove();
    kickoffBusy = false;
    kickoffShown = true;
    var net = window.__glVsNet;
    if (net) {
      net.kickoffDone = true;
      var first = vsFirstPid();
      var side = first === 1 ? "guest" : "host";
      try { net.send({ type: "kickoff", first: first }, side); } catch (e) {}
    }
    mountClockOverlay(room && room.view);
  }

  function showKickoff() {
    if (kickoffShown || kickoffBusy || document.getElementById("gl-vs-kickoff")) return;
    var net = window.__glVsNet;
    if (net && net.kickoffDone) return;
    kickoffBusy = true;
    hideClockOverlay();
    var el = document.createElement("div");
    el.id = "gl-vs-kickoff";
    el.className = "gl-vs-kickoff";
    el.innerHTML =
      '<div class="gl-vs-kickoff-burst" aria-hidden="true"></div>' +
      '<p class="gl-vs-kickoff-kicker">Grand Line</p>' +
      "<h2>C’est parti !</h2>" +
      '<p class="gl-vs-kickoff-sub">Le duel commence</p>';
    document.body.appendChild(el);
    markFightBgm();
    window.setTimeout(function () {
      el.classList.add("is-out");
      window.setTimeout(finishKickoff, 420);
    }, 2200);
  }

  function beginSoloLaunch() {
    soloLaunching = true;
    document.documentElement.classList.add("gl-versus-solo");
    try { if (window.GLBgm && window.GLBgm.sync) window.GLBgm.sync(); } catch (eB) {}
    window.setTimeout(function () {
      if (!soloLaunching) return;
      if (document.querySelector(".fight-fs, .vs-root, .coin-root, .mul-root, #gl-vs-kickoff")) return;
      soloLaunching = false;
      resetKickoffIfIdle();
      try { if (window.GLBgm && window.GLBgm.sync) window.GLBgm.sync(); } catch (e2) {}
    }, 8000);
  }

  function clearKickoff() {
    kickoffBusy = false;
    var el = document.getElementById("gl-vs-kickoff");
    if (el) el.remove();
  }

  function resetKickoffIfIdle() {
    if (document.querySelector(".fight-fs, .vs-root, .coin-root, .mul-root, .over-root, #gl-vs-kickoff, #gl-vs-resume")) {
      soloLaunching = false;
      return;
    }
    if (soloLaunching) return;
    hideClockOverlay();
    kickoffShown = false;
    kickoffBusy = false;
    sawCoin = false;
    sawMull = false;
    clearFightBgm();
    if (!window.__glVsNet || !window.__glVsNet.started) {
      document.documentElement.classList.remove("gl-versus-solo");
    }
  }

  function maybeKickoff() {
    if (document.querySelector(".coin-root")) sawCoin = true;
    if (document.querySelector(".mul-root")) sawMull = true;
    if (document.querySelector(".mul-root, .coin-root, .vs-root")) {
      hideClockOverlay();
      return;
    }
    if (document.getElementById("gl-vs-kickoff")) return;
    var live = document.querySelector(".fight-fs");
    if (!live) return;
    var net = window.__glVsNet;
    if (!kickoffShown && !kickoffBusy && !(net && net.kickoffDone) && sawCoin) {
      showKickoff();
      return;
    }
    if (
      !document.documentElement.classList.contains("gl-bgm-solo") &&
      !document.documentElement.classList.contains("gl-bgm-pvp") &&
      (kickoffShown || (net && net.kickoffDone) || !sawCoin)
    ) {
      if (document.documentElement.classList.contains("gl-versus-fight") || document.documentElement.classList.contains("gl-versus-solo")) {
        markFightBgm();
      }
    }
  }

  function shotWindow(sec) {
    return (sec >= 40 && sec <= 45) || (sec >= 0 && sec <= 20);
  }

  function updateShotOverlay(v) {
    v = v || (room && room.view);
    var el = document.getElementById("gl-vs-shot");
    var ms = v && v.shot;
    if (ms == null || !soloLive) {
      if (el) el.hidden = true;
      return;
    }
    var sec = Math.max(0, Math.ceil(ms / 1000));
    if (!shotWindow(sec)) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-vs-shot";
      el.className = "gl-vs-shot";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    el.textContent = String(sec);
    el.classList.toggle("is-low", sec <= 20);
    el.hidden = false;
  }

  function hideAwayOverlay() {
    var el = document.getElementById("gl-vs-away");
    if (el) el.remove();
    var opp = document.querySelector('#gl-vs-clocks-float [data-clock="opp"]');
    if (opp) restoreOppClock(opp);
  }

  function oppAwayOf(v) {
    if (!v || !v.away) return false;
    return (v.pid | 0) === 0 ? !!v.away.guest : !!v.away.host;
  }

  function oppAwayMs(v) {
    if (!v || !v.awayFor) return 0;
    return (v.pid | 0) === 0 ? (v.awayFor.guest || 0) : (v.awayFor.host || 0);
  }

  function oppClockName(v) {
    v = v || {};
    return (v.pid | 0) === 0 ? (v.guestName || "Adversaire") : (v.hostName || "Adversaire");
  }

  function restoreOppClock(opp, v) {
    if (!opp || !opp.classList.contains("is-away")) return;
    v = v || (room && room.view) || {};
    var pid = v.pid | 0;
    var oppSide = pid === 0 ? "guest" : "host";
    var ms = (v.clocks && v.clocks[oppSide]) || 0;
    opp.classList.remove("is-away");
    opp.classList.add("is-back");
    var face = opp.querySelector(".gl-vs-clock-face") || opp;
    face.innerHTML = "<small>" + esc(oppClockName(v)) + "</small>" + (isSoloMode() ? "" : "<b>" + fmtClock(ms) + "</b>");
    window.setTimeout(function () { opp.classList.remove("is-back"); }, 520);
  }

  function updateAwayOverlay(v) {
    v = v || (room && room.view);
    var show = !!(soloLive && v && oppAwayOf(v) && v.winner !== 0 && v.winner !== 1);
    var old = document.getElementById("gl-vs-away");
    if (old) old.remove();
    var opp = document.querySelector('#gl-vs-clocks-float [data-clock="opp"]');
    if (!opp) return;
    if (!show) {
      restoreOppClock(opp, v);
      return;
    }
    var ms = oppAwayMs(v);
    var name = oppClockName(v);
    var face = opp.querySelector(".gl-vs-clock-face");
    if (!face) {
      face = document.createElement("div");
      face.className = "gl-vs-clock-face";
      while (opp.firstChild) face.appendChild(opp.firstChild);
      opp.appendChild(face);
    }
    if (!opp.classList.contains("is-away")) {
      opp.classList.add("is-away");
      opp.classList.remove("is-run", "is-low", "is-back");
      face.innerHTML =
        "<small>" + esc(name) + "</small>" +
        "<b>Hors ligne</b>" +
        '<em data-away-cd>' + fmtClock(ms) + "</em>";
    } else {
      var cd = face.querySelector("[data-away-cd]");
      if (cd) cd.textContent = fmtClock(ms);
      var sm = face.querySelector("small");
      if (sm && sm.textContent !== name) sm.textContent = name;
    }
  }

  function sendHere(here) {
    if (!room || !room.id) return;
    if (!soloLive && room.status !== "play") return;
    var body = JSON.stringify({ action: "here", id: room.id, here: !!here });
    try {
      fetch("/api/versus", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function startHereBeat() {
    if (hereT) return;
    sendHere(document.visibilityState !== "hidden");
    hereT = setInterval(function () {
      if (!soloLive || !room) return;
      if (document.visibilityState === "hidden") return;
      sendHere(true);
    }, 3000);
  }

  function stopHereBeat() {
    if (hereT) { clearInterval(hereT); hereT = 0; }
  }

  function ingestSeq(v) {
    var net = window.__glVsNet;
    if (!net || !v) return;
    var me = net.pid | 0;
    var seq = v.seq || [];
    for (var i = 0; i < seq.length; i++) {
      var it = seq[i];
      if (!it || typeof it.n !== "number" || it.n <= net.lastN) continue;
      net.lastN = it.n;
      if ((it.pid | 0) === me && !(it.act && it.act.timeout)) continue;
      if (it.act && it.act.type === "coinResult") continue;
      if (it.act) net.recv(it.act);
    }
    if (v.winner === 0 || v.winner === 1) net.recv({ type: "vsOver", winner: v.winner });
  }

  function endSoloFight() {
    if (!soloLive && !window.__glVsNet) return;
    soloLive = false;
    hideClockOverlay();
    hideAwayOverlay();
    stopHereBeat();
    sendHere(false);
    clearKickoff();
    kickoffShown = false;
    if (room && (room.status === "done" || (room.view && (room.view.winner === 0 || room.view.winner === 1)))) {
      clearResume();
    }
    document.documentElement.classList.remove("gl-versus-fight", "gl-versus-solo", "gl-bgm-solo", "gl-bgm-pvp");
    var net = window.__glVsNet;
    if (net && net._bootT) { clearInterval(net._bootT); net._bootT = 0; }
    window.__glVsNet = null;
    stopPoll();
    room = null;
    view = "hub";
    openVs = true;
    if (document.getElementById("gl-vs-resume")) {
      document.documentElement.classList.remove("gl-versus-on", "gl-versus-priv");
      return;
    }
    var el = document.getElementById("gl-vs-root");
    if (el) el.hidden = false;
    document.documentElement.classList.add("gl-versus-on");
    paint();
  }

  function renderLaunching(err) {
    return (
      '<div class="gl-vs-page gl-vs-launch">' + header("Duel") +
        '<div class="gl-vs-wait">' +
          (err ? "" : '<div class="gl-vs-spin"></div>') +
          '<p class="gl-vs-copy">' + esc(err || "Lancement du duel…") + "</p>" +
          (err
            ? '<button type="button" class="gl-vs-go" data-act="vs-retry">Réessayer</button>'
            : "") +
        "</div>" +
        backBar({ backAct: "cancel" }) +
      "</div>"
    );
  }

  function hideVsChrome() {
    var el = document.getElementById("gl-vs-root");
    if (el) el.hidden = true;
    var portal = document.getElementById("gl-vs-portal");
    if (portal) { portal.innerHTML = ""; portal.hidden = true; }
    shownPrep = false;
    shownDecks = false;
    document.documentElement.classList.remove("gl-versus-on", "gl-versus-priv");
    document.documentElement.classList.add("gl-versus-fight");
  }

  function kickSoloEngine() {
    if (document.querySelector(".fight-fs, .vs-root, .coin-root, .playmat-grid")) return true;
    try { window.dispatchEvent(new Event("gl-vs-kick")); } catch (e) {}
    if (typeof window.__glKickFight === "function") {
      try { window.__glKickFight(); } catch (e) { console.error("[vs kick]", e); }
    }
    if (window.__glVsNet && window.__glVsNet.started) return true;
    return !!document.querySelector(".fight-fs, .vs-root, .coin-root, .playmat-grid");
  }

  function fightDomReady() {
    return !!(window.__glVsNet && window.__glVsNet.started) ||
      !!document.querySelector(".fight-fs, .vs-root, .coin-root, .playmat-grid");
  }

  function watchFightBoot() {
    var net = window.__glVsNet;
    if (!net) return;
    if (net._bootT) clearInterval(net._bootT);
    var tries = 0;
    net._bootT = setInterval(function () {
      tries++;
      if (!window.__glVsNet) {
        clearInterval(net._bootT);
        net._bootT = 0;
        return;
      }
      if (fightDomReady()) {
        clearInterval(net._bootT);
        net._bootT = 0;
        soloLive = true;
        hideVsChrome();
        ingestSeq(room && room.view);
        mountClockOverlay(room && room.view);
        return;
      }
      if (net.error) {
        clearInterval(net._bootT);
        net._bootT = 0;
        soloLive = false;
        view = "play";
        document.documentElement.classList.add("gl-versus-on");
        document.documentElement.classList.remove("gl-versus-solo");
        var el = document.getElementById("gl-vs-root");
        if (el) el.hidden = false;
        paint();
        return;
      }
      kickSoloEngine();
      if (tries === 6 && !(window.__glKickFight && window.__glKickFight.live)) {
        if (bustEngineCache()) {
          clearInterval(net._bootT);
          net._bootT = 0;
          return;
        }
      }
      if (tries > 100 && !net.error && !net.started) {
        net.error = typeof window.__glKickFight === "function"
          ? (net.error || "Le duel n’a pas pu s’ouvrir. Réessaie.")
          : "Le combat Solo n’est pas prêt. Réessaie dans un instant.";
        net.booting = false;
      }
    }, 200);
  }

  function launchSoloFight(j) {
    var v = j && j.view;
    if (!isSoloView(v)) return false;
    if (window.__glVsNet && window.__glVsNet._roomId === j.id && (soloLive || document.querySelector(".fight-fs, .vs-root"))) {
      ingestSeq(v);
      mountClockOverlay(v);
      return true;
    }
    var pending = [];
    var applyFn = null;
    var net = {
      pid: (v.pid === 1 || j.you === "guest") ? 1 : 0,
      gameId: String(v.seed || j.id),
      hostDeck: v.hostDeck,
      guestDeck: v.guestDeck,
      oppRedraw: null,
      started: false,
      booting: false,
      error: null,
      lastN: 0,
      _seq: (v && v.seq) || [],
      shotLeft: v && v.shot != null ? v.shot : 90000,
      kickoffDone: false,
      winner: (v && (v.winner === 0 || v.winner === 1)) ? (v.winner | 0) : null,
      _roomId: j.id,
      send: function (act, clockSide) {
        if (!room || !act) return;
        var side;
        if (arguments.length > 1) {
          side = clockSide;
        } else {
          if (act.type === "endTurn" || act.type === "attack") side = net.pid === 0 ? "guest" : "host";
          else if (act.type === "concede" || act.type === "vsOver" || act.type === "coinResult" || act.type === "mulligan" || act.type === "vsMull") side = null;
          else side = net.pid === 0 ? "host" : "guest";
        }
        api({ action: "move", id: room.id, move: { type: "act", act: act, clockSide: side } })
          .then(function (res) {
            if (!res || res.error) return;
            room = res;
            lastVer = typeof res.version === "number" ? res.version : lastVer;
            if (res.view) {
              ingestSeq(res.view);
              mountClockOverlay(res.view);
            }
          })
          .catch(function () {});
      },
      recv: function (act) {
        if (!act) return;
        if (typeof applyFn === "function") applyFn(act);
        else pending.push(act);
      },
      onOver: function () {},
      onError: function (msg) {
        net.error = msg || "Le combat n’a pas pu démarrer.";
        soloLive = false;
        view = "play";
        document.documentElement.classList.add("gl-versus-on");
        document.documentElement.classList.remove("gl-versus-solo");
        var el = document.getElementById("gl-vs-root");
        if (el) el.hidden = false;
        if (openVs) paint();
      },
      exit: function () { endSoloFight(); }
    };
    Object.defineProperty(net, "apply", {
      configurable: true,
      enumerable: true,
      get: function () { return applyFn; },
      set: function (fn) {
        applyFn = fn;
        if (typeof fn === "function") {
          var q = pending.splice(0);
          for (var i = 0; i < q.length; i++) fn(q[i]);
        }
      }
    });
    window.__glVsNet = net;
    soloLive = false;
    sawMull = false;
    sawCoin = false;
    kickoffBusy = false;
    kickoffShown = false;
    room = j;
    persistResume();
    view = "play";
    openVs = true;
    document.documentElement.classList.add("gl-versus-on");
    document.documentElement.classList.remove("gl-versus-priv", "gl-versus-solo", "gl-versus-fight", "gl-bgm-solo", "gl-bgm-pvp");
    var el = document.getElementById("gl-vs-root");
    if (el) el.hidden = false;
    var portal = document.getElementById("gl-vs-portal");
    if (portal) { portal.innerHTML = ""; portal.hidden = true; }
    shownPrep = false;
    shownDecks = false;
    paint();
    mountClockOverlay(v);
    kickSoloEngine();
    watchFightBoot();
    return true;
  }

  function tick() {
    if (!room || !room.id) return;
    getRoom(room.id).then(function (j) {
      if (!j || j.error) return;
      var prevStatus = room && room.status;
      var ver = typeof j.version === "number" ? j.version : lastVer;
      var same = ver === lastVer && prevStatus === j.status;
      if (same && (view === "play" || soloLive) && j.view) {
        room.view = room.view || {};
        room.view.clocks = j.view.clocks;
        room.view.clockSide = j.view.clockSide;
        room.view.shot = j.view.shot;
        room.view.shotSide = j.view.shotSide;
        room.view.react = j.view.react;
        room.view.log = j.view.log;
        room.view.winner = j.view.winner;
        room.view.seq = j.view.seq;
        room.view.away = j.view.away;
        room.view.awayFor = j.view.awayFor;
        updateAwayOverlay(room.view);
        if (isSoloView(j.view) || soloLive) {
          ingestSeq(j.view);
          updateClocks();
          if (j.status === "done" || j.view.winner === 0 || j.view.winner === 1) {
            ingestSeq(j.view);
          }
          return;
        }
        updateClocks();
        return;
      }
      if (same) return;
      var enteringPlay = j.status === "play" && view !== "play" && !soloLive;
      var enteringDone = j.status === "done" || (j.view && (j.view.winner === 0 || j.view.winner === 1 || j.view.endedBy === "expired" || j.view.winner));
      room = j;
      lastVer = ver;
      if ((enteringPlay || j.status === "play") && isSoloView(j.view)) {
        launchSoloFight(j);
        if (openVs && !soloLive) paint();
        return;
      }
      if (enteringPlay) {
        view = "play";
        selectedIid = "";
        selectedAtk = "";
        selectedDon = false;
        document.documentElement.classList.add("gl-versus-fight");
      }
      if (enteringDone && soloLive) {
        ingestSeq(j.view);
        updateClocks();
        updateAwayOverlay(j.view);
        return;
      }
      if (enteringDone && !soloLive) {
        if (resultLocked || document.getElementById("gl-vs-resume")) return;
        view = "result";
        document.documentElement.classList.remove("gl-versus-fight");
        stopPoll();
        bumpLocal(j);
      }
      if (openVs && !soloLive) paint();
    }).catch(function () {});
  }

  function bumpLocal(j) {
    if (j && j.view && j.view.endedBy === "expired") {
      clearResume();
      return;
    }
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null") || {};
      var st = raw.state || raw;
      var win = iWonRoom(j);
      st.wins = (st.wins || 0) + (win ? 1 : 0);
      st.losses = (st.losses || 0) + (win ? 0 : 1);
      if (raw.state) raw.state = st;
      else raw = st;
      localStorage.setItem(SAVE, JSON.stringify(raw));
    } catch (e) {}
    clearResume();
  }

  function qrUrl(code) {
    var data = location.origin + "/?vs=" + encodeURIComponent(code);
    return "https://api.qrserver.com/v1/create-qr-code/?size=280x280&ecc=M&color=c9a227&bgcolor=070b14&data=" +
      encodeURIComponent(data);
  }

  function genPass() {
    var abc = "abcdefghjkmnpqrstuvwxyz23456789";
    var s = "";
    for (var i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  function renderHub() {
    return (
      '<main class="cmb-page">' +
        header("Versus") +
        '<div class="cmb-hero is-solo"><picture>' +
          '<source media="(min-width: 1120px) and (hover: hover) and (pointer: fine)" srcset="/combat/fight-wide.jpg?v=op1">' +
          '<img src="/combat/fight.jpg?v=op1" alt="" class="cmb-hero-img" draggable="false">' +
        "</picture></div>" +
        '<div class="cmb-bottom">' +
          '<div class="cmb-pair">' +
            '<button type="button" class="cmb-tile" disabled data-act="soon">' +
              '<span class="cmb-tile-label">Match évènement</span><em class="nav-soon">Soon</em></button>' +
            '<button type="button" class="cmb-tile" disabled data-act="soon">' +
              '<span class="cmb-tile-label">Match classé</span><em class="nav-soon">Soon</em></button>' +
            '<button type="button" class="cmb-tile" data-act="private">' +
              '<span class="cmb-tile-label">Match privé</span></button>' +
            '<button type="button" class="cmb-tile" disabled data-act="soon">' +
              '<span class="cmb-tile-label">Match aléatoire</span><em class="nav-soon">Soon</em></button>' +
          "</div>" +
          backBar() +
        "</div>" +
      "</main>"
    );
  }

  function deckCardHtml() {
    var d = activeDeck();
    if (!d) return '<p class="gl-vs-copy">Aucun deck. Construis-en un d’abord.</p>';
    var list = decks();
    var idx = Math.max(1, list.findIndex(function (x) { return x.id === d.id; }) + 1);
    var leader = cardOf(d.leaderId);
    var set = setOfDeck(d, leader);
    var pack = packSrc(set);
    var v = leaderColor(leader);
    var back = skinOf(d, "back");
    var don = skinOf(d, "don");
    var mat = skinOf(d, "mat");
    return (
      '<button type="button" class="cmb-mydeck deck-tile is-active" data-act="decks">' +
        '<span class="deck-tile-hit">' +
          '<span class="deck-tile-banner" style="background:linear-gradient(180deg, ' + v + ", " + v + '66 70%, transparent)">' +
            String(idx).padStart(2, "0") +
          "</span>" +
          '<div class="deck-tile-stage">' +
            '<div class="deck-tile-hero"><div class="deck-tile-pack"><img src="' + esc(pack) + '" alt="" draggable="false"></div></div>' +
            '<div class="deck-tile-skins">' +
              '<span class="deck-tile-skin">' + (back ? '<img src="' + esc(back) + '" alt="" draggable="false">' : "") + "</span>" +
              '<span class="deck-tile-skin">' + (don ? '<img src="' + esc(don) + '" alt="" draggable="false">' : "") + "</span>" +
              '<span class="deck-tile-skin is-mat">' + (mat ? '<img src="' + esc(mat) + '" alt="" draggable="false">' : "") + "</span>" +
            "</div>" +
          "</div>" +
          '<p class="deck-tile-name">' + esc(d.name || "Ton deck") + "</p>" +
        "</span>" +
      "</button>"
    );
  }

  function renderPrivate() {
    var h = sheetHeight();
    return (
      '<div class="filter-sheet gl-vs-prep" data-act="back">' +
        '<div class="dossier-sheet filter-panel" data-stop="1" style="height:' + h + 'px">' +
          '<div class="dossier-grab">' +
            '<div class="dossier-handle"><span></span></div>' +
            '<p class="filter-title">Match privé</p>' +
            '<div class="gl-rule"></div>' +
          "</div>" +
          '<div class="dossier-extra filter-sheet-body cmb-prep-body" data-scrolllock-allow="true">' +
            '<div class="cmb-prep-card gl-vs-prep-card">' +
              '<div class="gl-vs-prep-lead">' + ICO.priv + "</div>" +
              '<div class="gl-vs-prep-meta">' +
                "<p>Affronte un nakama avec un mot de passe — ou un code QR.</p>" +
                '<button type="button" class="gl-vs-pw-btn" data-act="pw-menu">' +
                  (password ? esc(password) : "Créer un mot de passe") + ICO.pen +
                "</button>" +
                '<button type="button" class="gl-vs-qr-btn" data-act="go-qr">' + ICO.qr + "<span>Code-barres 2D</span></button>" +
                '<button type="button" class="gl-vs-qr-btn" data-act="scan">' + ICO.qr + "<span>Scanner un code</span></button>" +
              "</div>" +
            "</div>" +
            '<div class="gl-vs-deck-slot">' + deckCardHtml() + "</div>" +
          "</div>" +
          '<div class="cmb-prep-actions">' +
            '<button type="button" class="cmb-go" data-act="go-pass">C’est parti !</button>' +
            '<button type="button" class="cmb-close" data-act="back" aria-label="Fermer">×</button>' +
          "</div>" +
        "</div>" +
        (sheet === "private-menu" ? privateMenu() : "") +
        (sheet === "pw-create" ? pwCreate() : "") +
        (sheet === "pw-enter" ? pwEnter() : "") +
      "</div>"
    );
  }

  function privateMenu() {
    return (
      '<div class="gl-vs-sheet" data-act="sheet-off"><div class="gl-vs-sheet-card" data-stop="1">' +
        "<h3>Menu match privé</h3>" +
        '<div class="gl-vs-sheet-row">' +
          '<button type="button" class="gl-vs-choice" data-act="pw-create">' + ICO.chat + "<span>Avec mot de passe</span></button>" +
          '<button type="button" class="gl-vs-choice" data-act="go-qr">' + ICO.qr + "<span>Montrer mon QR</span></button>" +
          '<button type="button" class="gl-vs-choice" data-act="scan">' + ICO.qr + "<span>Scanner un code</span></button>" +
        "</div>" +
        '<button type="button" class="gl-vs-x" data-act="sheet-off">×</button>' +
      "</div></div>"
    );
  }
  function pwCreate() {
    return (
      '<div class="gl-vs-sheet" data-act="sheet-off"><div class="gl-vs-sheet-card" data-stop="1">' +
        "<h3>Créer un mot de passe</h3>" +
        '<div class="gl-vs-sheet-list">' +
          '<button type="button" data-act="pw-enter">Saisir un mot de passe</button>' +
          '<button type="button" data-act="pw-auto">Générer automatiquement</button>' +
        "</div>" +
        '<button type="button" class="gl-vs-x" data-act="sheet-off">×</button>' +
      "</div></div>"
    );
  }
  function pwEnter() {
    return (
      '<div class="gl-vs-sheet" data-act="sheet-off"><div class="gl-vs-sheet-card" data-stop="1">' +
        "<h3>Saisir un mot de passe</h3>" +
        '<input class="gl-vs-field" id="gl-vs-pass" maxlength="10" placeholder="Saisis ton mot de passe ici." value="' + esc(password) + '">' +
        '<p class="gl-vs-hint">10 caractères maximum</p>' +
        '<p class="gl-vs-warn">N\'utilise pas ton vrai nom ni tes informations personnelles.</p>' +
        '<div class="gl-vs-dual">' +
          '<button type="button" class="gl-vs-ghost" data-act="sheet-off">Annuler</button>' +
          '<button type="button" class="gl-vs-go" style="width:auto;margin:0" data-act="pw-ok">OK</button>' +
        "</div>" +
      "</div></div>"
    );
  }
  function deckSheet() {
    var list = decks().slice().sort(function (a, b) { return Number(!!b.favorite) - Number(!!a.favorite); });
    var cur = pendingPick || (activeDeck() && activeDeck().id) || "";
    var h = pickerHeight();
    return (
      '<div class="filter-sheet gl-vs-decks" data-act="sheet-off"><div class="dossier-sheet filter-panel" data-stop="1" style="height:' + h + 'px">' +
        '<div class="dossier-grab"><div class="dossier-handle"><span></span></div>' +
          '<p class="filter-title">Sélection du deck</p><div class="gl-rule"></div></div>' +
        '<div class="dossier-extra filter-sheet-body" data-scrolllock-allow="true"><ul class="deck-pick-list">' +
          (list.length ? list.map(function (d) {
            var leader = cardOf(d.leaderId);
            var set = setOfDeck(d, leader);
            var pack = packSrc(set);
            var n = deckCount(d);
            var on = d.id === cur;
            var back = skinOf(d, "back");
            var don = skinOf(d, "don");
            var mat = skinOf(d, "mat");
            var ready = n === 50 ? "Prêt" : "Incomplet";
            return (
              '<li><button type="button" class="deck-pick-row' + (on ? " is-on" : "") + '" data-act="pick-deck" data-id="' + esc(d.id) + '">' +
                '<span class="deck-pick-art"><img class="deck-pick-pack" src="' + esc(pack) + '" alt="" draggable="false"></span>' +
                '<span class="deck-pick-meta"><span class="deck-pick-name">' + esc(d.name || "Deck") + "</span>" +
                  '<span class="deck-pick-stat' + (n === 50 ? "" : " is-bad") + '">' + n + "/50 · " + ready + "</span></span>" +
                '<span class="deck-pick-skins" aria-hidden="true">' +
                  '<span class="deck-pick-skin">' + (back ? '<img src="' + esc(back) + '" alt="" draggable="false">' : "") + "</span>" +
                  '<span class="deck-pick-skin">' + (don ? '<img src="' + esc(don) + '" alt="" draggable="false">' : "") + "</span>" +
                  '<span class="deck-pick-skin is-mat">' + (mat ? '<img src="' + esc(mat) + '" alt="" draggable="false">' : "") + "</span>" +
                "</span>" +
                (on
                  ? '<span class="deck-pick-check">' + ICO.check + "</span>"
                  : '<span class="deck-pick-check is-off"></span>') +
              "</button></li>"
            );
          }).join("") : '<li class="gl-vs-copy">Aucun deck.</li>') +
        '</ul><div class="list-end-pad" aria-hidden="true"></div></div>' +
        '<div class="filter-float">' +
          '<button type="button" class="studio-float-save" data-act="deck-ok">OK</button>' +
        "</div></div></div>"
    );
  }

  function renderWait() {
    var isQr = room && room.mode === "qr";
    var code = (room && room.id) || "";
    return (
      '<div class="gl-vs-page' + (isQr ? " is-qr" : "") + '">' +
        header(isQr ? "Code-barres 2D" : "Match privé") +
        '<div class="gl-vs-wait">' +
          (isQr ? '<div class="gl-vs-icon-hero">' + ICO.globe + "</div>" : '<div class="gl-vs-spin"></div>') +
          (isQr
            ? '<p class="gl-vs-copy">Recherche d\'adversaire par code-barres 2D</p>' +
              '<div class="gl-vs-qr" data-act="zoom-qr"><img alt="QR" src="' + qrUrl(code) + '"></div>' +
              '<p class="gl-vs-copy">Demande à l\'adversaire de toucher « Scanner un code » et de viser ce QR.</p>'
            : '<p class="gl-vs-copy">En attente d\'un nakama avec le même mot de passe…</p>' +
              (room && room.password ? '<div class="gl-vs-code">' + esc(room.password) + "</div>" : "")) +
          (isQr ? '<div class="gl-vs-code">' + esc(code) + "</div>" : "") +
        "</div>" +
        (isQr
          ? backBar({ leftAct: "scan", leftLabel: "Scanner", leftIco: ICO.qr, backAct: "cancel" })
          : backBar({ backAct: "cancel" })) +
      "</div>"
    );
  }

  function renderScan() {
    return (
      '<div class="gl-vs-page is-qr">' +
        header("Scanner") +
        '<div class="gl-vs-wait gl-vs-scan"><video id="gl-vs-cam" playsinline autoplay muted></video>' +
          '<p class="gl-vs-copy">Vise le code QR de ton adversaire.</p>' +
          '<div class="gl-vs-manual">' +
            '<input id="gl-vs-join-in" type="text" maxlength="12" placeholder="Ou saisis le code" autocomplete="off" autocapitalize="characters">' +
            '<button type="button" class="gl-vs-go" data-act="join-code">Rejoindre</button>' +
          "</div>" +
          '<input type="file" accept="image/*" capture="environment" id="gl-vs-file" hidden>' +
          '<button type="button" class="gl-vs-ghost" data-act="scan-file">Choisir une photo</button>' +
        "</div>" +
        backBar({ leftAct: "scan-file", leftLabel: "Photo", leftIco: ICO.qr, backAct: "back" }) +
      "</div>"
    );
  }

  function renderLogin() {
    return (
      '<div class="gl-vs-page">' +
        header("Versus") +
        '<div class="gl-vs-login">' +
          '<div class="gl-vs-icon-hero">' + ICO.versus + "</div>" +
          '<p class="gl-vs-copy">Connecte-toi pour affronter un nakama en ligne.</p>' +
          '<button type="button" class="gl-vs-go" data-act="login">Se connecter</button>' +
        "</div>" +
        backBar() +
      "</div>"
    );
  }

  function meOf(v) {
    return v && v.host && v.host.me ? v.host : (v && v.guest);
  }
  function oppOf(v) {
    return v && v.host && v.host.me ? v.guest : (v && v.host);
  }
  function mySideOf(v) {
    return v && v.host && v.host.me ? "host" : "guest";
  }

  function cardHtml(c, extra, opts) {
    if (!c) return '<div class="gl-vs-slot"></div>';
    extra = extra || "";
    opts = opts || {};
    if (c.back) {
      return '<div class="gl-vs-card is-back" ' + extra + '><img src="/card-back.png" alt=""></div>';
    }
    var pwr = (Number(c.power) || 0) + (Number(c.don) || 0) * 1000;
    var cls = "gl-vs-card" +
      (c.rested ? " is-rest" : "") +
      (c.sick ? " is-sick" : "") +
      (c.blocker ? " is-blocker" : "") +
      (c.rush ? " is-rush" : "") +
      (selectedIid === c.iid || selectedAtk === c.iid ? " is-sel" : "") +
      (opts.tgt ? " is-tgt" : "") +
      (opts.blockable ? " is-blockable" : "") +
      (opts.counter ? " is-counter" : "");
    return (
      '<button type="button" class="' + cls + '" data-act="card" data-iid="' + esc(c.iid) + '"' + extra + ">" +
        (c.image ? '<img src="' + esc(srcOf(c) || c.image) + '" alt="">' : '<img src="/card-back.png" alt="">') +
        (pwr ? "<em>" + pwr + "</em>" : "") +
        (c.cost != null && opts.cost !== false ? "<b>" + c.cost + "</b>" : "") +
        (c.don ? "<i class=\"gl-vs-donchip\">" + c.don + "</i>" : "") +
        (opts.showCounter && c.counter ? "<s>+" + c.counter + "</s>" : "") +
      "</button>"
    );
  }

  function lifeRow(n, max, mine) {
    var html = '<div class="gl-vs-life' + (mine ? " is-me" : " is-opp") + '">';
    for (var i = 0; i < max; i++) {
      html += '<span class="life-card' + (i < n ? "" : " is-empty") + (mine ? " is-me" : " is-opp") + '">' +
        (i < n ? '<img src="/card-back.png" alt="">' : "") + "</span>";
    }
    html += '<span class="life-n">' + n + "</span></div>";
    return html;
  }

  function donPile(p, mine) {
    var n = (p.donActive || 0) + (p.donRested || 0);
    return (
      '<button type="button" class="gl-vs-donpile' + (mine && selectedDon ? " is-sel" : "") + '"' +
        (mine ? ' data-act="pick-don"' : " disabled") + ">" +
        '<img src="/don/front.jpg" alt="DON">' +
        "<span>" + (p.donActive || 0) + " actifs</span>" +
        "<small>" + (p.donRested || 0) + " reposés · deck " + (p.donDeck || 0) + "</small>" +
      "</button>"
    );
  }

  function pile(label, n) {
    return (
      '<div class="gl-vs-pile">' +
        (n ? '<img src="/card-back.png" alt="">' : '<div class="gl-vs-pile-empty"></div>') +
        "<span>" + esc(label) + " " + n + "</span>" +
      "</div>"
    );
  }

  function fmtClock(ms) {
    var s = Math.max(0, Math.ceil((ms || 0) / 1000));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function clockHtml(v) {
    var mySide = mySideOf(v);
    var oppSide = mySide === "host" ? "guest" : "host";
    var myP = meOf(v);
    var oppP = oppOf(v);
    var namesOnly = isSoloMode();
    var mine = (v.clocks && v.clocks[mySide]) || 0;
    var opp = (v.clocks && v.clocks[oppSide]) || 0;
    return (
      '<div class="gl-vs-clocks' + (namesOnly ? " is-names" : "") + '">' +
        '<div class="gl-vs-clock is-opp' + (namesOnly ? "" : ((v.clockSide === oppSide ? " is-run" : "") + (opp < 60000 ? " is-low" : ""))) + '" data-clock="opp">' +
          "<small>" + esc((oppP && oppP.name) || "Adversaire") + "</small>" +
          (namesOnly ? "" : "<b>" + fmtClock(opp) + "</b>") +
        "</div>" +
        '<div class="gl-vs-clock is-me' + (namesOnly ? "" : ((v.clockSide === mySide ? " is-run" : "") + (mine < 60000 ? " is-low" : ""))) + '" data-clock="me">' +
          "<small>" + esc((myP && myP.name) || playerDisplayName()) + "</small>" +
          (namesOnly ? "" : "<b>" + fmtClock(mine) + "</b>") +
        "</div>" +
      "</div>"
    );
  }

  function updateClocks() {
    var v = room && room.view;
    if (!v || !v.clocks) return;
    var mySide;
    var oppSide;
    if (typeof v.pid === "number") {
      mySide = v.pid === 0 ? "host" : "guest";
      oppSide = mySide === "host" ? "guest" : "host";
    } else {
      mySide = mySideOf(v);
      oppSide = mySide === "host" ? "guest" : "host";
    }
    var mine = v.clocks[mySide] || 0;
    var opp = v.clocks[oppSide] || 0;
    var root = document.getElementById("gl-vs-clocks-float") || document.getElementById("gl-vs-root");
    if (!root) return;
    var meEl = root.querySelector('[data-clock="me"]');
    var oppEl = root.querySelector('[data-clock="opp"]');
    if (meEl) {
      var b = meEl.querySelector("b");
      if (b && !isSoloMode()) b.textContent = fmtClock(mine);
      meEl.classList.toggle("is-run", !isSoloMode() && v.clockSide === mySide);
      meEl.classList.toggle("is-low", !isSoloMode() && mine < 60000);
    }
    if (oppEl) {
      if (oppEl.classList.contains("is-away")) {
        pinClocksToLife();
      } else {
        var b2 = oppEl.querySelector("b");
        if (b2 && !isSoloMode()) b2.textContent = fmtClock(opp);
        oppEl.classList.toggle("is-run", !isSoloMode() && v.clockSide === oppSide);
        oppEl.classList.toggle("is-low", !isSoloMode() && opp < 60000);
      }
    }
    var react = root.querySelector("[data-react-cd]");
    if (react && v.react) {
      react.textContent = Math.max(0, Math.ceil((v.react.remaining || 0) / 1000)) + "s";
    }
    var logEl = root.querySelector(".gl-vs-log");
    if (logEl && v.log && v.log.length) logEl.textContent = v.log[v.log.length - 1];
    updateShotOverlay(v);
    pinClocksToLife();
  }

  function fieldLane(cards, opts) {
    opts = opts || {};
    var html = "";
    var list = cards || [];
    for (var i = 0; i < 5; i++) {
      if (list[i]) {
        html += cardHtml(list[i], "", {
          tgt: !!opts.tgt && !list[i].rested,
          blockable: !!opts.blockable && list[i].blocker && !list[i].rested,
        });
      } else {
        html += '<div class="gl-vs-slot' + (opts.empty ? " is-drop" : "") + '"></div>';
      }
    }
    return html;
  }

  function leaderBtn(p, mine, opts) {
    opts = opts || {};
    var L = p && p.leader;
    if (!L) return '<div class="gl-vs-leader is-empty"></div>';
    var pwr = L.powerNow || ((Number(L.power) || 0) + (Number(L.don) || 0) * 1000);
    var cls = "gl-vs-leader" +
      (mine ? " is-me" : "") +
      (L.rested ? " is-rest" : "") +
      (selectedAtk === "leader" && mine ? " is-sel" : "") +
      (opts.tgt ? " is-tgt" : "");
    var act = mine ? "my-leader" : "atk-leader";
    return (
      '<button type="button" class="' + cls + '" data-act="' + act + '">' +
        (srcOf(L) || L.image ? '<img src="' + esc(srcOf(L) || L.image) + '" alt="">' : "") +
        "<em>" + pwr + "</em>" +
        (L.don ? "<i class=\"gl-vs-donchip\">" + L.don + "</i>" : "") +
      "</button>"
    );
  }

  function renderPlay() {
    if (soloLive || (room && room.view && room.view.engine === "solo")) return "";
    var v = room && room.view;
    if (!v) return '<div class="gl-vs-page">' + header("Duel") + '<p class="gl-vs-copy">Chargement…</p></div>';
    var me = meOf(v);
    var opp = oppOf(v);
    if (!me || !opp) return '<div class="gl-vs-page">' + header("Duel") + '<p class="gl-vs-copy">Chargement…</p></div>';
    var myTurn = v.turn === mySideOf(v);
    var lastLog = (v.log || []).slice(-1)[0] || "";
    var reacting = v.phase === "react" && v.react;
    var iDefend = reacting && v.react.youDefend;
    var hint;
    if (reacting && iDefend) {
      hint = "Réaction " + Math.ceil((v.react.remaining || 0) / 1000) + "s — bloqueur ou contre, puis Valider";
    } else if (reacting) {
      hint = "L'adversaire réagit… " + Math.ceil((v.react.remaining || 0) / 1000) + "s";
    } else if (!myTurn) {
      hint = "Tour adverse…";
    } else if (selectedDon) {
      hint = "Touche un perso, le Leader ou la scène pour attacher un DON!!";
    } else if (selectedIid) {
      hint = "Retouche pour invoquer · " + (me.donActive || 0) + " DON!! actifs";
    } else if (selectedAtk) {
      hint = "Choisis une cible (perso ou Leader adverse)";
    } else if (!v.canAttack) {
      hint = "Premier tour : invoque et attache — pas d'attaque";
    } else {
      hint = "Invoque · attache DON!! · attaque";
    }
    var oppHand = "";
    for (var h = 0; h < (opp.handCount || 0) && h < 8; h++) {
      oppHand += '<span class="gl-vs-oback"><img src="/card-back.png" alt=""></span>';
    }
    return (
      '<div class="gl-vs-duel">' +
        clockHtml(v) +
        '<div class="gl-vs-opp">' +
          '<div class="gl-vs-opp-top">' +
            pile("DECK", opp.deckCount || 0) +
            donPile(opp, false) +
            '<div class="gl-vs-opp-mid">' +
              leaderBtn(opp, false, { tgt: !!selectedAtk && !reacting }) +
              "<b>" + esc(opp.name) + "</b>" +
              '<span class="gl-vs-handn">Main ' + (opp.handCount || 0) + "</span>" +
              '<div class="gl-vs-obacks">' + oppHand + "</div>" +
            "</div>" +
            pile("TRASH", opp.trashCount || 0) +
          "</div>" +
          lifeRow(opp.life || 0, opp.lifeMax || 5, false) +
          (opp.stage ? '<div class="gl-vs-stage is-opp">' + cardHtml(opp.stage) + "</div>" : "") +
          '<div class="gl-vs-lane is-opp">' + fieldLane(opp.board, { tgt: !!selectedAtk && !reacting }) + "</div>" +
        "</div>" +
        '<div class="gl-vs-mid' + (myTurn && !reacting ? " is-mine" : "") + (reacting ? " is-react" : "") + '">' +
          '<p class="gl-vs-turn">' + esc(hint) + "</p>" +
          '<p class="gl-vs-log">' + esc(lastLog) + "</p>" +
          (reacting ? '<span class="gl-vs-react-cd" data-react-cd>' + Math.ceil((v.react.remaining || 0) / 1000) + "s</span>" : "") +
        "</div>" +
        '<div class="gl-vs-me">' +
          (me.stage ? '<div class="gl-vs-stage is-me">' + cardHtml(me.stage) + "</div>" : "") +
          '<div class="gl-vs-lane is-me">' + fieldLane(me.board, { empty: true, blockable: iDefend }) + "</div>" +
          '<div class="gl-vs-me-bar">' +
            donPile(me, true) +
            leaderBtn(me, true) +
            lifeRow(me.life || 0, me.lifeMax || 5, true) +
            pile("DECK", me.deckCount || 0) +
            pile("TRASH", me.trashCount || 0) +
          "</div>" +
          '<div class="gl-vs-hand">' + (me.hand || []).map(function (c) {
            return cardHtml(c, "", { showCounter: iDefend && c.counter > 0, counter: iDefend && c.counter > 0 });
          }).join("") + "</div>" +
        "</div>" +
        '<div class="gl-vs-actions">' +
          '<button type="button" data-act="concede">Abandonner</button>' +
          (iDefend
            ? '<button type="button" class="is-gold" data-act="react-pass">Valider la réaction</button>'
            : '<button type="button" class="is-gold" data-act="end"' + (myTurn && !reacting ? "" : " disabled") + ">Fin de tour</button>") +
        "</div>" +
      "</div>"
    );
  }

  function renderResult() {
    var expired = room && room.view && room.view.endedBy === "expired";
    var win = !expired && iWonRoom(room);
    var why = room && room.view && room.view.endedBy;
    var title = expired ? "Duel terminé" : win ? "Victoire" : "Défaite";
    var copy;
    if (expired) {
      copy = "Le combat a expiré. Aucun vainqueur.";
    } else if (win) {
      copy = why === "forfeit" || why === "concede"
        ? "L’adversaire a abandonné le duel."
        : "Tu as fait plier l'adversaire.";
    } else {
      copy = why === "forfeit"
        ? "Tu as quitté le duel trop longtemps. C’est un abandon."
        : why === "concede"
          ? "Tu as abandonné le duel."
          : "La mer t'a rappelé à l'ordre.";
    }
    return (
      '<div class="gl-vs-page"><div class="gl-vs-result">' +
        "<h2>" + title + "</h2>" +
        '<p class="gl-vs-copy">' + copy + "</p>" +
        '<button type="button" class="gl-vs-go" data-act="hub">Retour au Versus</button>' +
      "</div></div>"
    );
  }

  function paint() {
    if (soloLive) return;
    var el = mountRoot();
    var html = "";
    if (view === "hub") html = renderHub();
    else if (view === "login") html = renderLogin();
    else if (view === "private") html = renderHub();
    else if (view === "wait") html = renderWait();
    else if (view === "scan") html = renderScan();
    else if (view === "play") {
      if (room && room.view && room.view.engine === "solo") {
        html = renderLaunching(
          (window.__glVsNet && window.__glVsNet.error) ||
          (!isSoloView(room.view) ? "Impossible de lire les decks du duel." : null)
        );
      } else html = renderPlay();
    }
    else if (view === "result") html = renderResult();
    else html = renderHub();
    el.innerHTML = html + '<div class="gl-vs-toast"></div>';
    var overlays = "";
    if (view === "private") overlays += renderPrivate();
    if (sheet === "decks") overlays += deckSheet();
    var portal = portalEl();
    portal.innerHTML = overlays;
    portal.hidden = !overlays;
    var prep = portal.querySelector(".gl-vs-prep .dossier-sheet");
    var decksEl = portal.querySelector(".gl-vs-decks .dossier-sheet");
    if (prep) {
      if (!shownPrep) slideIn(prep, sheetHeight());
      else restSheet(prep);
      bindGrab(prep, closePrepAnim);
    }
    if (decksEl) {
      if (!shownDecks) slideIn(decksEl, pickerHeight());
      else restSheet(decksEl);
      bindGrab(decksEl, closeDecksAnim);
    }
    shownPrep = !!prep;
    shownDecks = !!decksEl;
    var priv = view === "private" || view === "wait" || view === "scan" || view === "login" || sheet === "decks";
    document.documentElement.classList.toggle("gl-versus-priv", !!priv);
    if (view === "scan") {
      startCamera();
      var jin = el.querySelector("#gl-vs-join-in");
      if (jin) {
        jin.onkeydown = function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var code = (jin.value || "").trim();
            if (code) joinBy(code);
          }
        };
      }
    } else stopCamera();
    if (sheet === "pw-enter") {
      var inp = portal.querySelector("#gl-vs-pass");
      if (inp) inp.focus();
    }
  }

  function needDeck() {
    var d = payloadDeck(activeDeck());
    if (!d || !d.leader || !d.cards.length) {
      toast("Choisis un deck valide.");
      return null;
    }
    return d;
  }

  function goPassword() {
    var d = needDeck();
    if (!d) return;
    if (!password) { sheet = "pw-create"; paint(); return; }
    api({ action: "open", mode: "password", password: password, deck: d })
      .then(function (j) {
        room = j;
        if (isSoloView(j.view) || j.status === "play") {
          if (launchSoloFight(j)) {
            startPoll();
            return;
          }
        }
        if (j.status === "play") {
          view = "play";
          document.documentElement.classList.add("gl-versus-fight");
        } else view = "wait";
        startPoll();
        paint();
      })
      .catch(function (e) { toast(e.message); });
  }

  function goQr() {
    var d = needDeck();
    if (!d) return;
    sheet = null;
    api({ action: "open", mode: "qr", deck: d })
      .then(function (j) {
        room = j;
        view = "wait";
        startPoll();
        paint();
      })
      .catch(function (e) { toast(e.message); });
  }

  function joinBy(code) {
    var d = needDeck();
    if (!d) { vsScanLock = false; return; }
    var body = { action: "join", deck: d };
    var raw = String(code || "").trim();
    if (/^[A-Z0-9]{6,12}$/i.test(raw)) body.id = raw.toUpperCase();
    else body.password = raw.toLowerCase();
    api(body)
      .then(function (j) {
        vsScanLock = false;
        room = j;
        if (isSoloView(j.view) || j.status === "play") {
          if (launchSoloFight(j)) {
            startPoll();
            return;
          }
        }
        view = j.status === "play" ? "play" : "wait";
        if (view === "play") document.documentElement.classList.add("gl-versus-fight");
        startPoll();
        paint();
      })
      .catch(function (e) {
        vsScanLock = false;
        toast(e.message);
        if (view === "wait" && !room) { view = "scan"; paint(); }
      });
  }

  function move(type, extra) {
    if (!room) return;
    extra = extra || {};
    extra.type = type;
    var keepDon = type === "attach" && selectedDon;
    api({ action: "move", id: room.id, move: extra })
      .then(function (j) {
        room = j;
        lastVer = typeof j.version === "number" ? j.version : lastVer;
        selectedIid = "";
        selectedAtk = "";
        selectedDon = false;
        if (keepDon && j.view) {
          var me = meOf(j.view);
          if (me && me.donActive > 0) selectedDon = true;
        }
        if (j.status === "done" || (j.view && j.view.winner)) {
          view = "result";
          document.documentElement.classList.remove("gl-versus-fight");
          stopPoll();
          bumpLocal(j);
        }
        paint();
      })
      .catch(function (e) { toast(e.message); });
  }

  function onCard(iid) {
    var v = room && room.view;
    if (!v) return;
    var me = meOf(v);
    var opp = oppOf(v);
    var myTurn = v.turn === mySideOf(v);
    var reacting = v.phase === "react" && v.react;
    var iDefend = reacting && v.react.youDefend;
    var inHand = (me.hand || []).some(function (c) { return c.iid === iid; });
    var onMine = (me.board || []).some(function (c) { return c.iid === iid; }) ||
      (me.stage && me.stage.iid === iid);
    var onOpp = (opp.board || []).some(function (c) { return c.iid === iid; }) ||
      (opp.stage && opp.stage.iid === iid);
    if (iDefend) {
      if (inHand) {
        var hc = (me.hand || []).find(function (c) { return c.iid === iid; });
        if (hc && hc.counter > 0) move("counter", { iid: iid });
        else toast("Cette carte n'a pas de Contre.");
        return;
      }
      if (onMine) {
        var blk = (me.board || []).find(function (c) { return c.iid === iid; });
        if (blk && blk.blocker && !blk.rested) move("block", { iid: iid });
        else toast("Choisis un [Bloqueur] actif.");
        return;
      }
      toast("Bloque, contre, ou Valide.");
      return;
    }
    if (!myTurn) { toast("Tour adverse."); return; }
    if (reacting) { toast("En attente de la réaction."); return; }
    if (inHand) {
      selectedDon = false;
      if (selectedIid === iid) {
        move("play", { iid: iid });
      } else {
        selectedIid = iid;
        selectedAtk = "";
        paint();
        var cost = ((me.hand || []).find(function (c) { return c.iid === iid; }) || {}).cost;
        toast("Retouche pour jouer" + (cost != null ? " · coût " + cost + " DON!!" : ""));
      }
      return;
    }
    if (onMine) {
      if (selectedDon) {
        move("attach", { iid: iid });
        return;
      }
      var mine = (me.board || []).find(function (c) { return c.iid === iid; });
      if (me.stage && me.stage.iid === iid) {
        toast("Scène en jeu.");
        return;
      }
      if (!v.canAttack) { toast("Pas d'attaque ce tour."); return; }
      if (mine && mine.rested) { toast("Ce personnage est reposé."); return; }
      if (mine && mine.sick) { toast("Invocable ce tour (sauf [Rush])."); return; }
      selectedAtk = iid;
      selectedIid = "";
      paint();
      toast("Choisis une cible (perso ou Leader).");
      return;
    }
    if (onOpp) {
      if (!selectedAtk) { toast("Choisis d'abord ton attaquant."); return; }
      move("attack", { iid: selectedAtk, target: iid });
    }
  }

  function stopCamera() {
    if (scanStream) {
      scanStream.getTracks().forEach(function (t) { t.stop(); });
      scanStream = null;
    }
  }

  function startCamera() {
    var video = document.getElementById("gl-vs-cam");
    if (!video || !navigator.mediaDevices) {
      toast("Caméra indisponible — saisis le code.");
      return;
    }
    if (window.GLQr) window.GLQr.load(function () {});
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (s) {
      scanStream = s;
      video.srcObject = s;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      if (window.GLQr) {
        window.GLQr.loop(video, function () { return view === "scan" && !!scanStream; }, handleScan);
      }
    }).catch(function () { toast("Caméra indisponible — saisis le code."); });
  }

  function handleScan(raw) {
    if (vsScanLock || view !== "scan") return;
    var text = String(raw || "");
    var m = text.match(/[?&]vs=([A-Z0-9]{6,12})/i) || text.match(/\b([A-Z0-9]{8})\b/i);
    if (!m) return;
    vsScanLock = true;
    stopCamera();
    joinBy(m[1]);
  }

  function onClick(e) {
    if (sheetBusy) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var stop = e.target.closest("[data-stop]");
    if (stop && !stop.contains(btn)) return;
    var act = btn.getAttribute("data-act");
    if (act === "back") {
      if (view === "scan") { view = room ? "wait" : "private"; paint(); return; }
      if (view === "private" || view === "login") {
        if (view === "private") { closePrepAnim(); return; }
        view = "hub";
        sheet = null;
        paint();
        return;
      }
      closeVersus();
      return;
    }
    if (act === "hub") { room = null; view = "hub"; sheet = null; stopPoll(); paint(); return; }
    if (act === "soon") { toast("Bientôt disponible."); return; }
    if (act === "zoom-qr") {
      var img = btn.querySelector("img") || (e.target.tagName === "IMG" ? e.target : null);
      var src = img && img.src;
      if (src) {
        if (window.GLSocial && window.GLSocial.zoomQr) window.GLSocial.zoomQr(src);
        else {
          var z = document.getElementById("gl-qr-zoom");
          if (!z) {
            z = document.createElement("div");
            z.id = "gl-qr-zoom";
            z.className = "gl-qr-zoom";
            document.body.appendChild(z);
            z.addEventListener("click", function () { z.classList.remove("is-on"); z.innerHTML = ""; });
          }
          z.innerHTML = '<img alt="QR" src="' + src + '">';
          z.classList.add("is-on");
        }
      }
      return;
    }
    if (act === "login") { location.href = "/login.html"; return; }
    if (act === "private") {
      checkAuth().then(function (ok) {
        view = ok ? "private" : "login";
        paint();
      });
      return;
    }
    if (act === "sheet-off") {
      if (sheet === "decks") { closeDecksAnim(); return; }
      sheet = null;
      paint();
      return;
    }
    if (act === "pw-menu") { sheet = "private-menu"; paint(); return; }
    if (act === "pw-create") { sheet = "pw-create"; paint(); return; }
    if (act === "pw-enter") { sheet = "pw-enter"; paint(); return; }
    if (act === "pw-auto") { password = genPass(); sheet = null; paint(); return; }
    if (act === "pw-ok") {
      var inp = (document.getElementById("gl-vs-portal") || rootEl()).querySelector("#gl-vs-pass");
      password = (inp && inp.value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      if (password.length < 2) { toast("2 caractères minimum."); return; }
      sheet = null;
      paint();
      return;
    }
    if (act === "decks") {
      pendingPick = (activeDeck() && activeDeck().id) || "";
      sheet = "decks";
      paint();
      return;
    }
    if (act === "pick-deck") { pendingPick = btn.getAttribute("data-id") || ""; paint(); return; }
    if (act === "deck-ok") {
      applyDeck(pendingPick);
      closeDecksAnim();
      return;
    }
    if (act === "go-pass") { goPassword(); return; }
    if (act === "go-qr") { goQr(); return; }
    if (act === "scan") { sheet = null; view = "scan"; paint(); return; }
    if (act === "join-code") {
      var jin = rootEl().querySelector("#gl-vs-join-in");
      var code = (jin && jin.value || "").trim();
      if (!code) { toast("Saisis le code de la salle."); return; }
      joinBy(code);
      return;
    }
    if (act === "scan-file") {
      var f = document.getElementById("gl-vs-file");
      if (f) {
        f.onchange = function () {
          var file = f.files && f.files[0];
          if (!file) return;
          if (window.GLQr) {
            window.GLQr.fromFile(file, function (raw) {
              if (raw) handleScan(raw);
              else toast("QR illisible.");
            });
          } else toast("Scan indisponible, saisis le code.");
        };
        f.click();
      }
      return;
    }
    if (act === "vs-retry") {
      if (!(window.__glKickFight && window.__glKickFight.live)) {
        if (bustEngineCache()) return;
      }
      if (typeof window.__glVsReset === "function") {
        try { window.__glVsReset(); } catch (e) {}
      }
      if (window.__glVsNet) {
        window.__glVsNet.error = null;
        window.__glVsNet.started = false;
        window.__glVsNet.booting = false;
        kickSoloEngine();
        watchFightBoot();
        paint();
      } else if (room) launchSoloFight(room);
      return;
    }
    if (act === "cancel") {
      stopPoll();
      if (room) api({ action: "cancel", id: room.id }).catch(function () {});
      room = null;
      view = "private";
      document.documentElement.classList.remove("gl-versus-fight");
      paint();
      return;
    }
    if (act === "card") { onCard(btn.getAttribute("data-iid")); return; }
    if (act === "pick-don") {
      var vdon = room && room.view;
      if (!vdon) return;
      if (vdon.phase === "react") { toast("Pas pendant la réaction."); return; }
      if (vdon.turn !== mySideOf(vdon)) { toast("Tour adverse."); return; }
      var meDon = meOf(vdon);
      if (!meDon || !meDon.donActive) { toast("Aucun DON!! actif."); return; }
      selectedDon = !selectedDon;
      selectedIid = "";
      selectedAtk = "";
      paint();
      toast(selectedDon ? "Touche un perso ou le Leader pour attacher." : "Attache annulée.");
      return;
    }
    if (act === "my-leader") {
      var vl = room && room.view;
      if (!vl) return;
      if (vl.phase === "react") { toast("En attente de la réaction."); return; }
      if (vl.turn !== mySideOf(vl)) { toast("Tour adverse."); return; }
      if (selectedDon) { move("attach", { iid: "leader" }); return; }
      var meL = meOf(vl);
      if (!vl.canAttack) { toast("Pas d'attaque ce tour."); return; }
      if (meL && meL.leader && meL.leader.rested) { toast("Leader reposé."); return; }
      selectedAtk = "leader";
      selectedIid = "";
      selectedDon = false;
      paint();
      toast("Choisis une cible.");
      return;
    }
    if (act === "atk-leader") {
      if (!selectedAtk) { toast("Choisis d'abord un attaquant."); return; }
      move("attack", { iid: selectedAtk, target: "leader" });
      return;
    }
    if (act === "react-pass") { move("react-pass"); return; }
    if (act === "end") { move("end"); return; }
    if (act === "concede") {
      if (!confirm("Abandonner le duel ?")) return;
      move("concede");
      return;
    }
  }

  function checkAuth() {
    return fetch("/api/admin/status", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        signedIn = !!(s && s.signedIn);
        return signedIn;
      })
      .catch(function () { return false; });
  }

  function openVersus(page) {
    if (window.GLSocial && window.GLSocial.close) window.GLSocial.close();
    openVs = true;
    view = page || "hub";
    sheet = null;
    var el = mountRoot();
    el.hidden = false;
    document.documentElement.classList.add("gl-versus-on");
    paint();
    var q = new URLSearchParams(location.search).get("vs");
    if (q) {
      checkAuth().then(function (ok) {
        if (!ok) { view = "login"; paint(); return; }
        joinBy(q);
      });
    }
  }
  function closeVersus() {
    openVs = false;
    stopPoll();
    stopCamera();
    soloLive = false;
    hideClockOverlay();
    hideAwayOverlay();
    window.__glVsNet = null;
    clearKickoff();
    kickoffShown = false;
    document.documentElement.classList.remove("gl-versus-on", "gl-versus-fight", "gl-versus-priv", "gl-versus-solo", "gl-bgm-solo", "gl-bgm-pvp");
    var el = document.getElementById("gl-vs-root");
    if (el) el.hidden = true;
    var p = document.getElementById("gl-vs-portal");
    if (p) { p.innerHTML = ""; p.hidden = true; }
    shownPrep = false;
    shownDecks = false;
    sheetBusy = false;
    selectedIid = "";
    selectedAtk = "";
    selectedDon = false;
    lastVer = -1;
    sendHere(false);
  }

  function closeVersusIfMenu() {
    if (soloLive || (window.__glVsNet && window.__glVsNet.started) || document.documentElement.classList.contains("gl-versus-fight")) return;
    closeVersus();
  }

  document.addEventListener("click", function (e) {
    var li = e.target.closest(".app-dock li");
    if (li) {
      var label = li.textContent || "";
      var isMenu = !!(li.querySelector('[aria-label="Paramètres"]') || /Menu/.test(label));
      if (!isMenu) closeVersusIfMenu();
      return;
    }
    var btn = e.target.closest(".cmb-tile");
    if (!btn) return;
    var tile = (btn.textContent || "").replace(/\s+/g, " ");
    if (tile.indexOf("Versus") < 0) {
      if (openVs && !e.target.closest("#gl-vs-root") && !e.target.closest("#gl-vs-portal")) closeVersusIfMenu();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    openVersus("hub");
  }, true);

  window.addEventListener("gl-tab", function () { closeVersusIfMenu(); });

  (window.GLLoadCatalog
    ? window.GLLoadCatalog()
    : fetch("/data/catalog.json").then(function (r) { return r.json(); })
  ).then(function (d) { catalog = d; }).catch(function () {});

  function hideResumePrompt() {
    var el = document.getElementById("gl-vs-resume");
    if (el) el.remove();
  }

  function seenOver(id) {
    if (!id) return false;
    try { return sessionStorage.getItem("gl-vs-over-" + id) === "1"; } catch (e) { return false; }
  }

  function markOver(id) {
    if (!id) return;
    try { sessionStorage.setItem("gl-vs-over-" + id, "1"); } catch (e) {}
  }

  /** Never fake-dismiss the React intro splash — that leaves a black unclickable screen. */
  function enterAppIfNeeded() {
    try {
      var intro = document.querySelector(".intro-root");
      if (!intro || intro.classList.contains("is-out")) return;
      if (intro.classList.contains("is-ready")) {
        intro.click();
        return;
      }
      var n = 0;
      var t = setInterval(function () {
        n++;
        var el = document.querySelector(".intro-root");
        if (!el || el.classList.contains("is-out")) { clearInterval(t); return; }
        if (el.classList.contains("is-ready") || n > 40) {
          clearInterval(t);
          try { el.click(); } catch (e2) {}
        }
      }, 200);
    } catch (e) {}
  }

  function pidOf(j) {
    if (!j) return 0;
    if (j.view && (j.view.pid === 0 || j.view.pid === 1)) return j.view.pid | 0;
    return j.you === "guest" ? 1 : 0;
  }

  function duelWinnerPid(j) {
    if (!j || !j.view) return null;
    if (j.view.endedBy === "expired") return null;
    var w = j.view.winner;
    if (w === 0 || w === 1) return w;
    return null;
  }

  function isExpiredRoom(j) {
    return !!(j && j.view && j.view.endedBy === "expired");
  }

  function isLiveDuel(j) {
    if (!j || j.error) return false;
    if (j.status && j.status !== "play") return false;
    if (!isSoloView(j.view)) return false;
    if (isExpiredRoom(j)) return false;
    if (j.view.endedBy === "forfeit" || j.view.endedBy === "concede") return false;
    if (duelWinnerPid(j) !== null) return false;
    return true;
  }

  function iWonRoom(j) {
    j = j || room;
    if (!j) return false;
    if (isExpiredRoom(j)) return false;
    var v = j.view;
    if (v && v.engine === "solo") {
      var pid = pidOf(j);
      if (v.winner === 0 || v.winner === 1) return pid === (v.winner | 0);
    }
    if (j.winner && j.host && j.winner === j.host.id && j.you === "host") return true;
    if (j.winner && j.guest && j.winner === j.guest.id && j.you === "guest") return true;
    if (v && v.winner === "host" && v.host && v.host.me) return true;
    if (v && v.winner === "guest" && v.guest && v.guest.me) return true;
    return false;
  }

  function scoreOnce(j) {
    if (!j || !j.id) return;
    if (isExpiredRoom(j)) return;
    var key = "gl-vs-scored-" + j.id;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch (e) {}
    bumpLocal(j);
  }

  function stripVersusChrome() {
    hideClockOverlay();
    hideAwayOverlay();
    clearKickoff();
    kickoffShown = false;
    document.documentElement.classList.remove("gl-versus-fight", "gl-versus-solo", "gl-versus-on", "gl-versus-priv", "gl-bgm-solo", "gl-bgm-pvp");
    var root = document.getElementById("gl-vs-root");
    if (root) root.hidden = true;
    var portal = document.getElementById("gl-vs-portal");
    if (portal) { portal.innerHTML = ""; portal.hidden = true; }
  }

  function resumeCard(html, onClick) {
    var el = document.getElementById("gl-vs-resume");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-vs-resume";
      el.className = "gl-vs-resume";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.onclick = onClick;
    return el;
  }

  function showMatchOver(j, opts) {
    opts = opts || {};
    if (resultLocked && !opts.force && !opts.asLoss) return;
    if (opts.asLoss) resultLocked = true;
    stopPoll();
    soloLive = false;
    if (window.__glVsNet && window.__glVsNet._bootT) {
      clearInterval(window.__glVsNet._bootT);
      window.__glVsNet._bootT = 0;
    }
    window.__glVsNet = null;
    stripVersusChrome();
    if (!j) {
      hideResumePrompt();
      return;
    }
    room = j;
    var expired = isExpiredRoom(j) || !!opts.expired;
    var win = !opts.asLoss && !expired && iWonRoom(j);
    if (!expired) scoreOnce(j);
    var why = (j.view && j.view.endedBy) || (opts.asLoss ? "concede" : "");
    var title;
    var copy;
    if (expired) {
      title = "Duel terminé";
      copy = "Le combat a expiré. Aucun vainqueur.";
    } else if (win) {
      title = "Victoire";
      copy = why === "forfeit" || why === "concede"
        ? "L’adversaire a abandonné le duel."
        : "Tu as fait plier l’adversaire.";
    } else {
      title = "Défaite";
      copy = why === "forfeit"
        ? "Tu as quitté le duel trop longtemps. C’est un abandon."
        : "Tu as abandonné le duel.";
    }
    resumeCard(
      '<div class="gl-vs-resume-card">' +
        '<p class="gl-vs-resume-kicker">Duel terminé</p>' +
        "<h3>" + title + "</h3>" +
        "<p>" + copy + "</p>" +
        '<button type="button" class="gl-vs-go" data-over="ok">OK</button>' +
      "</div>",
      function (e) {
        if (e.target.closest("[data-over='ok']") || e.target === e.currentTarget) {
          hideResumePrompt();
          resultLocked = false;
          if (j.view && isSoloView(j.view) && (j.view.winner === 0 || j.view.winner === 1)) {
            persistResume();
            enterAppIfNeeded();
            launchSoloFight(j);
            return;
          }
          markOver(j.id);
          clearResume();
          room = null;
          enterAppIfNeeded();
        }
      }
    );
  }

  function resumeFightFrom(j) {
    if (!j || j.error) return false;
    if (!isLiveDuel(j)) {
      showMatchOver(j);
      return false;
    }
    hideResumePrompt();
    enterAppIfNeeded();
    room = j;
    lastVer = typeof j.version === "number" ? j.version : -1;
    persistResume();
    openVersus("hub");
    startPoll();
    sendHere(true);
    if ((j.status === "play" || j.status === "done") && isSoloView(j.view)) {
      launchSoloFight(j);
    } else paint();
    return true;
  }

  function abandonResume(id) {
    resultLocked = true;
    var pid = pidOf(room);
    showMatchOver({
      id: id,
      status: "done",
      you: room && room.you,
      view: {
        engine: "solo",
        pid: pid,
        winner: pid ^ 1,
        endedBy: "concede",
      },
    }, { asLoss: true, force: true });
    clearResume();
    api({ action: "cancel", id: id }).catch(function () {});
  }

  function showResumePrompt(j) {
    if (!j || !j.id) return;
    if (!isLiveDuel(j)) {
      showMatchOver(j);
      return;
    }
    room = j;
    var opp = j.you === "host"
      ? ((j.guest && j.guest.name) || "l’adversaire")
      : ((j.host && j.host.name) || "l’adversaire");
    resumeCard(
      '<div class="gl-vs-resume-card">' +
        '<p class="gl-vs-resume-kicker">Duel en pause</p>' +
        '<h3>Un combat est déjà en cours</h3>' +
        '<p>Voulez-vous reprendre face à ' + esc(opp) + ' ? Si vous refusez, ce sera une défaite.</p>' +
        '<button type="button" class="gl-vs-go" data-resume="yes">Reprendre</button>' +
        '<button type="button" class="gl-vs-ghost" data-resume="no">Non, abandonner</button>' +
      "</div>",
      function (e) {
        var yes = e.target.closest("[data-resume='yes']");
        var no = e.target.closest("[data-resume='no']");
        if (yes) {
          hideResumePrompt();
          resumeFightFrom(j);
        } else if (no) {
          abandonResume(j.id);
        }
      }
    );
  }

  function bindPresence() {
    if (bindPresence._on) return;
    bindPresence._on = true;
    function onHide() {
      if (!room || !room.id) return;
      sendHere(false);
    }
    function onShow() {
      if (!room || !room.id || (!soloLive && room.status !== "play")) return;
      sendHere(true);
      startHereBeat();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") onHide();
      else onShow();
    });
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("freeze", onHide, { capture: true });
    window.addEventListener("resume", onShow);
    window.addEventListener("blur", function () {
      if (document.visibilityState === "hidden") onHide();
    });
    window.addEventListener("focus", onShow);
  }

  function bootDeep() {
    bindPresence();
    var q = new URLSearchParams(location.search).get("vs");
    if (q) setTimeout(function () { openVersus("hub"); }, 600);
    var silent = false;
    try { silent = sessionStorage.getItem("gl-vs-silent") === "1"; sessionStorage.removeItem("gl-vs-silent"); } catch (e) {}
    var rid = resumeId();
    setTimeout(function () {
      var n = 0;
      var wait = setInterval(function () {
        n++;
        var ready = window.__glKickFight && window.__glKickFight.live;
        if (ready || n > 40) {
          clearInterval(wait);
          checkAuth().then(function (ok) {
            if (!ok) return;
            var load = function (id) {
              if (!id) {
                return api({ action: "active" }).then(function (j) { return j && j.room; }).catch(function () { return null; });
              }
              return getRoom(id).then(function (j) {
                if (j && !j.error) return j;
                return api({ action: "active" }).then(function (a) { return a && a.room; }).catch(function () { return null; });
              }).catch(function () { return null; });
            };
            load(rid).then(function (j) {
              if (!j) {
                if (rid) clearResume();
                return;
              }
              if (!isLiveDuel(j)) {
                if (seenOver(j.id)) {
                  clearResume();
                  return;
                }
                showMatchOver(j);
                return;
              }
              persistResume();
              if (silent) resumeFightFrom(j);
              else showResumePrompt(j);
            }).catch(function () {});
          });
        }
      }, 200);
    }, 400);
  }
  function afterHydrate(fn) {
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (!window.$_TSR || n > 60) {
        clearInterval(t);
        fn();
      }
    }, 50);
  }
  if (document.body) afterHydrate(bootDeep);
  else document.addEventListener("DOMContentLoaded", function () { afterHydrate(bootDeep); });

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button.cmb-go");
    if (!btn) return;
    if ((btn.getAttribute("data-act") || "") === "go-pass") return;
    if (btn.closest("#gl-vs-root") || btn.closest("#gl-vs-portal")) return;
    var label = btn.textContent || "";
    if (label.indexOf("parti") < 0) return;
    beginSoloLaunch();
  }, true);

  setInterval(function () {
    if (document.hidden) return;
    var html = document.documentElement;
    var busy = soloLive || openVs || kickoffBusy || soloLaunching
      || html.classList.contains("gl-versus-fight")
      || html.classList.contains("gl-versus-solo")
      || html.classList.contains("gl-bgm-solo")
      || html.classList.contains("gl-bgm-pvp");
    if (!busy && !document.querySelector(".fight-fs, #gl-vs-kickoff")) return;
    maybeKickoff();
    resetKickoffIfIdle();
    if (!clocksShouldShow()) hideClockOverlay();
    else pinClocksToLife();
  }, 250);

  window.GLVersus = {
    open: openVersus,
    close: closeVersus,
    closeMenu: closeVersusIfMenu,
    away: function (on, ms) {
      var v = {
        pid: 0,
        away: { host: false, guest: !!on },
        awayFor: { host: 0, guest: ms || 30 * 1000 },
        guestName: "Adversaire",
        winner: null,
      };
      var prev = soloLive;
      soloLive = true;
      updateAwayOverlay(on ? v : null);
      soloLive = prev;
    },
    promptResume: showResumePrompt,
  };
})();
