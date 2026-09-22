/**
 * Daily missions overlay — Grand Line TCG.
 * Independent of the compiled React bundle; talks to the zustand save via
 * dynamic import of /assets/store-*.js (addPacks / gain / subscribe).
 */
(function () {
  var KEY = "gl-missions-v1";
  var SAVE = "gl-tcg-save";
  var PACK = "OP-17";
  var DEFS = [
    { id: "login", title: "Prendre la mer", hint: "Se connecter au jeu", goal: 1, stat: "login" },
    { id: "open1", title: "Coffre du jour", hint: "Ouvrir un booster", goal: 1, stat: "open" },
    { id: "win1", title: "Premier abordage", hint: "Gagner un combat", goal: 1, stat: "win" },
    { id: "fight1", title: "Hisser les voiles", hint: "Disputer un combat", goal: 1, stat: "fight" },
    { id: "open2", title: "Soute pleine", hint: "Ouvrir 2 boosters", goal: 2, stat: "open" },
    { id: "win2", title: "Capitaine du jour", hint: "Gagner 2 combats", goal: 2, stat: "win" },
  ];

  if (!document.getElementById("gl-missions-css")) {
    var link = document.createElement("link");
    link.id = "gl-missions-css";
    link.rel = "stylesheet";
    link.href = "/missions.css?v=7";
    document.head.appendChild(link);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function msToMidnight() {
    var n = new Date();
    var end = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    return end - n;
  }
  function fmtEta(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h + " h " + String(m).padStart(2, "0") + " min";
  }

  function blank() {
    return {
      day: today(),
      login: 0,
      open: 0,
      win: 0,
      fight: 0,
      claimed: {},
      gaugeTaken: false,
    };
  }
  function fromTcg() {
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      var st = raw && (raw.state || raw);
      var dm = st && st.dailyMissions;
      if (dm && dm.day === today()) return Object.assign(blank(), dm);
    } catch (e) {}
    return null;
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.day === today()) return Object.assign(blank(), raw);
    } catch (e) {}
    return fromTcg() || blank();
  }
  function save(st) {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      if (raw) {
        if (raw.state) raw.state.dailyMissions = st;
        else raw.dailyMissions = st;
        localStorage.setItem(SAVE, JSON.stringify(raw));
      }
    } catch (e3) {}
    try {
      if (window.GLCloudSave && typeof window.GLCloudSave.push === "function") {
        window.GLCloudSave.push();
      }
    } catch (e2) {}
  }

  var state = blank();
  var booted = false;

  function bootState() {
    if (booted) return;
    booted = true;
    state = load();
    state.login = Math.max(1, state.login || 0);
    save(state);
    try { renderFab(); } catch (e) {}
    if (document.getElementById("gl-ms-root")) {
      try { paintSheet(); } catch (e2) {}
    }
  }

  window.addEventListener("gl-progress-applied", function (ev) {
    try {
      if (ev && ev.detail && ev.detail.missions) {
        var incoming = ev.detail.missions;
        var cur = null;
        try { cur = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e0) {}
        if (cur && incoming && String(cur.day || "") === String(incoming.day || "")) {
          incoming = {
            day: incoming.day,
            login: Math.max(Number(cur.login) || 0, Number(incoming.login) || 0),
            open: Math.max(Number(cur.open) || 0, Number(incoming.open) || 0),
            win: Math.max(Number(cur.win) || 0, Number(incoming.win) || 0),
            fight: Math.max(Number(cur.fight) || 0, Number(incoming.fight) || 0),
            claimed: Object.assign({}, cur.claimed || {}, incoming.claimed || {}),
            gaugeTaken: !!(cur.gaugeTaken || incoming.gaugeTaken),
          };
        }
        try { localStorage.setItem(KEY, JSON.stringify(incoming)); } catch (eSet) {}
        booted = true;
        state = Object.assign(blank(), incoming);
        if (incoming.day === today()) {
          state.login = Math.max(1, state.login || 0);
        }
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (eSet2) {}
        try { renderFab(); } catch (e) {}
        if (document.getElementById("gl-ms-root")) {
          try { paintSheet(); } catch (e2) {}
        }
        return;
      }
    } catch (e1) {}
    booted = true;
    state = load();
    state.login = Math.max(1, state.login || 0);
    save(state);
    try { renderFab(); } catch (e) {}
    if (document.getElementById("gl-ms-root")) {
      try { paintSheet(); } catch (e2) {}
    }
  });
  window.addEventListener("gl-cloud-ready", bootState);
  setTimeout(bootState, 2200);

  function progressOf(def) {
    return Math.min(def.goal, Number(state[def.stat]) || 0);
  }
  function ready(def) {
    return progressOf(def) >= def.goal && !state.claimed[def.id];
  }
  function doneCount() {
    return DEFS.filter(function (d) { return state.claimed[d.id]; }).length;
  }
  function readyCount() {
    return DEFS.filter(ready).length;
  }
  function gaugeFull() {
    return doneCount() >= DEFS.length;
  }
  function shouldGlow() {
    return readyCount() > 0 || (gaugeFull() && !state.gaugeTaken);
  }

  var storeApi = null;
  function bindStore(api) {
    storeApi = api;
    var prev = api.getState();
    api.subscribe(function (s) {
      var changed = false;
      if (s.opened > (prev.opened || 0)) {
        state.open += s.opened - (prev.opened || 0);
        changed = true;
      }
      if (s.wins > (prev.wins || 0)) {
        state.win += s.wins - (prev.wins || 0);
        changed = true;
      }
      var fights = (s.wins || 0) + (s.losses || 0);
      var prevF = (prev.wins || 0) + (prev.losses || 0);
      if (fights > prevF) {
        state.fight += fights - prevF;
        changed = true;
      }
      prev = s;
      if (changed) {
        save(state);
        renderFab();
        if (document.getElementById("gl-ms-root")) paintSheet();
      }
    });
  }
  import("/assets/store-BlZSQe9J.js")
    .then(function (mod) {
      if (mod && typeof mod.o === "function" && mod.o.getState) bindStore(mod.o);
      else pollSave();
    })
    .catch(function () { pollSave(); });

  function readSave() {
    try {
      var raw = JSON.parse(localStorage.getItem("gl-tcg-save") || "null");
      var st = raw && (raw.state || raw);
      return st || {};
    } catch (e) {
      return {};
    }
  }
  function pollSave() {
    var prev = readSave();
    setInterval(function () {
      var s = readSave();
      var changed = false;
      if ((s.opened || 0) > (prev.opened || 0)) {
        state.open += (s.opened || 0) - (prev.opened || 0);
        changed = true;
      }
      if ((s.wins || 0) > (prev.wins || 0)) {
        state.win += (s.wins || 0) - (prev.wins || 0);
        changed = true;
      }
      var fights = (s.wins || 0) + (s.losses || 0);
      var prevF = (prev.wins || 0) + (prev.losses || 0);
      if (fights > prevF) {
        state.fight += fights - prevF;
        changed = true;
      }
      prev = s;
      if (changed) {
        save(state);
        renderFab();
        if (document.getElementById("gl-ms-root")) paintSheet();
      }
    }, 1200);
  }

  function grantBooster() {
    if (storeApi && storeApi.getState().addPacks) {
      storeApi.getState().addPacks(PACK, 1);
      return true;
    }
    try {
      var raw = localStorage.getItem("gl-tcg-save");
      var data = raw ? JSON.parse(raw) : { state: {} };
      var st = data.state || data;
      st.packs = st.packs || {};
      st.packs[PACK] = (st.packs[PACK] || 0) + 1;
      if (data.state) data.state = st;
      else data = st;
      localStorage.setItem("gl-tcg-save", JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function toast(msg) {
    var el = document.getElementById("gl-ms-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-ms-toast";
      el.className = "gl-ms-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-on"); }, 2200);
  }

  function claim(id) {
    var def = DEFS.find(function (d) { return d.id === id; });
    if (!def || !ready(def)) return;
    state.claimed[id] = true;
    save(state);
    paintSheet();
    renderFab();
  }
  function claimAll() {
    DEFS.forEach(function (d) {
      if (ready(d)) state.claimed[d.id] = true;
    });
    save(state);
    paintSheet();
    renderFab();
  }
  function claimGauge() {
    if (!gaugeFull() || state.gaugeTaken) return;
    state.gaugeTaken = true;
    save(state);
    grantBooster();
    toast("Booster offert — à ouvrir dans la boutique");
    paintSheet();
    renderFab();
  }

  function inCombat() {
    if (document.querySelector(".fight-fs, .mul-root, .vs-root, .coin-root, .over-root")) return true;
    var intro = document.querySelector(".intro-root");
    if (intro && !intro.classList.contains("is-out")) return true;
    return false;
  }

  function paneOn(el) {
    if (!el) return false;
    var pane = el.closest(".tab-pane");
    if (pane && !pane.classList.contains("is-on")) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return true;
  }

  function isHome() {
    if (inCombat()) return false;
    return paneOn(document.querySelector(".home-page"));
  }

  function isCombatMenu() {
    if (inCombat()) return false;
    if (paneOn(document.querySelector(".cmb-page"))) return true;
    if (paneOn(document.querySelector(".cmb-hero"))) return true;
    var path = (location.pathname || "").replace(/\/+$/, "") || "/";
    return path === "/play" || path.indexOf("/play/") === 0;
  }

  function shouldShowFab() {
    if (document.querySelector(".side-root")) return false;
    if (document.getElementById("gl-pf-root")) return false;
    var so = document.getElementById("gl-so-root");
    if (so && !so.hidden) return false;
    if (document.documentElement.classList.contains("gl-versus-priv")) return false;
    return isHome() || isCombatMenu();
  }

  var ICO = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="7" y="5" width="18" height="23" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M11 11h10M11 16h10M11 21h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="23.5" cy="23.5" r="5.2" fill="#0c1118" stroke="#e8c96a" stroke-width="1.5"/><path d="M21.4 23.5l1.4 1.4 2.8-3" stroke="#e8c96a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PACK_ICO = '<svg viewBox="0 0 32 44" width="18" height="24"><rect x="4" y="3" width="24" height="38" rx="4" fill="#121820" stroke="#e8c96a" stroke-width="1.6"/><rect x="7" y="7" width="18" height="13" rx="2" fill="#0b1018" stroke="#c9a22788" stroke-width=".8"/><rect x="6" y="23" width="20" height="6" rx="1.2" fill="#e8c96a"/></svg>';

  function renderFab() {
    var fab = document.getElementById("gl-ms-fab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "gl-ms-fab";
      fab.className = "gl-ms-fab";
      fab.type = "button";
      fab.setAttribute("aria-label", "Missions");
      fab.innerHTML = ICO + '<span class="gl-ms-pip"></span><span class="gl-ms-cap">Missions</span>';
      fab.addEventListener("click", openSheet);
      document.body.appendChild(fab);
    }
    fab.classList.toggle("is-lit", shouldGlow());
    fab.classList.toggle("is-hidden", !shouldShowFab());
  }

  function paintSheet() {
    var root = document.getElementById("gl-ms-root");
    if (!root) return;
    var fill = root.querySelector(".gl-ms-fill");
    var count = doneCount();
    if (fill) fill.style.width = (count / DEFS.length) * 100 + "%";
    var meta = root.querySelector(".gl-ms-gauge-top span");
    if (meta) meta.textContent = "Missions accomplies : " + count;
    var eta = root.querySelector(".gl-ms-eta");
    if (eta) eta.textContent = fmtEta(msToMidnight());
    var reward = root.querySelector(".gl-ms-reward");
    if (reward) {
      reward.classList.toggle("is-ready", gaugeFull() && !state.gaugeTaken);
      reward.classList.toggle("is-got", state.gaugeTaken);
      reward.title = state.gaugeTaken ? "Booster récupéré" : "Booster offert";
    }
    var list = root.querySelector(".gl-ms-list");
    if (list) {
      list.innerHTML = DEFS.map(function (d) {
        var p = progressOf(d);
        var isReady = ready(d);
        var claimed = !!state.claimed[d.id];
        var cls = "gl-ms-card" + (claimed ? " is-claimed" : isReady ? " is-done" : "");
        var btn = isReady
          ? '<button type="button" class="gl-ms-go" data-claim="' + d.id + '">Terminer</button>'
          : "";
        var meter = claimed || isReady
          ? ""
          : '<div class="gl-ms-meter"><div class="gl-ms-bar"><span style="width:' + (p / d.goal) * 100 + '%"></span></div><span class="gl-ms-prog">' + p + "/" + d.goal + "</span></div>";
        return (
          '<article class="' + cls + '">' +
            '<div class="gl-ms-copy"><h3>' + d.title + "</h3><p>" + d.hint + "</p>" + meter + "</div>" +
            btn +
          "</article>"
        );
      }).join("");
    }
    var all = root.querySelector(".gl-ms-claim-all");
    if (all) all.classList.toggle("is-on", readyCount() >= 2);
    lockListScroll(root);
  }

  function lockListScroll(root) {
    var list = root.querySelector(".gl-ms-list");
    var sheet = root.querySelector(".gl-ms-sheet");
    if (!list || !sheet) return;
    list.classList.remove("is-scroll");
    requestAnimationFrame(function () {
      var room = sheet.clientHeight;
      var used = sheet.scrollHeight;
      list.classList.toggle("is-scroll", used > room + 2);
    });
  }

  function bindGrab(root, sheet) {
    var grab = sheet.querySelector(".gl-ms-grab");
    if (!grab) return;
    var startY = 0, pull = 0, dragging = false;
    function down(e) {
      dragging = true;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      pull = 0;
      sheet.classList.add("is-drag");
    }
    function move(e) {
      if (!dragging) return;
      var y = e.touches ? e.touches[0].clientY : e.clientY;
      pull = Math.max(0, y - startY);
      sheet.style.setProperty("--pull", pull + "px");
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove("is-drag");
      if (pull > 90) closeSheet();
      else sheet.style.setProperty("--pull", "0px");
    }
    grab.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    root._ungrab = function () {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }

  function openSheet() {
    if (document.getElementById("gl-ms-root")) return;
    var root = document.createElement("div");
    root.id = "gl-ms-root";
    root.className = "gl-ms-root";
    root.innerHTML =
      '<div class="gl-ms-sheet">' +
        '<div class="gl-ms-grab" aria-hidden="true"><span></span></div>' +
        '<header class="gl-ms-head"><h2 class="gl-ms-kicker">Missions quotidiennes</h2></header>' +
        '<div class="gl-ms-rule" aria-hidden="true"></div>' +
        '<p class="gl-ms-eta"></p>' +
        '<section class="gl-ms-gauge">' +
          '<div class="gl-ms-gauge-top"><span>Missions accomplies : 0</span></div>' +
          '<div class="gl-ms-track"><div class="gl-ms-fill"></div></div>' +
          '<div class="gl-ms-pips"><button type="button" class="gl-ms-reward" aria-label="Récompense booster"><img src="/boosters/OP-17.webp" alt=""/><span class="gl-ms-reward-n">1</span></button></div>' +
        "</section>" +
        '<div class="gl-ms-list"></div>' +
        '<button type="button" class="gl-ms-claim-all">Tout terminer</button>' +
      "</div>";
    document.body.appendChild(root);
    var sheet = root.querySelector(".gl-ms-sheet");
    bindGrab(root, sheet);
    root.addEventListener("click", function (e) {
      if (e.target === root) closeSheet();
    });
    root.addEventListener("click", function (e) {
      var go = e.target.closest("[data-claim]");
      if (go) claim(go.getAttribute("data-claim"));
      if (e.target.closest(".gl-ms-claim-all")) claimAll();
      if (e.target.closest(".gl-ms-reward")) claimGauge();
    });
    paintSheet();
    requestAnimationFrame(function () {
      root.classList.add("is-in");
      lockListScroll(root);
    });
  }

  function closeSheet() {
    var root = document.getElementById("gl-ms-root");
    if (!root) return;
    root.classList.remove("is-in");
    if (root._ungrab) root._ungrab();
    setTimeout(function () { root.remove(); }, 400);
  }

  var obs = new MutationObserver(function () { renderFab(); });
  obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("gl-tab", renderFab);
  window.addEventListener("popstate", renderFab);
  document.addEventListener("click", function () {
    window.setTimeout(renderFab, 50);
  }, true);
  try {
    var _push = history.pushState;
    history.pushState = function () {
      var r = _push.apply(this, arguments);
      window.setTimeout(renderFab, 30);
      return r;
    };
  } catch (e) {}

  setInterval(function () {
    if (state.day !== today()) {
      state = blank();
      state.login = 1;
      save(state);
    }
    renderFab();
    if (document.getElementById("gl-ms-root")) paintSheet();
  }, 30000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderFab);
  } else {
    renderFab();
  }
})();
