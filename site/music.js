/**
 * Screen BGM for Grand Line TCG.
 *  - Écran de chargement    → /audio/departure.mp3
 *  - Accueil (/)            → /audio/grand-line.mp3
 *  - Collection (cartes, decks) → /audio/we-are.mp3
 *  - Social                 → /audio/party.mp3
 *  - Combat (lobby)         → /audio/duel.mp3
 *  - Combat solo (from « C’est parti ») → /audio/cant-lose.mp3
 *  - Match privé en ligne   → /audio/strongest.mp3
 *  - Écran victoire         → /audio/huge-win.mp3
 *  - Écran défaite          → /audio/mother-sea.mp3
 *  - Boutique               → /audio/oden.mp3
 *  - Pregame / elsewhere    → silence
 *
 * The compiled React bundle used to loop We Are! globally after the intro
 * click. We hijack that Audio.play and own routing ourselves, still honoring
 * the existing gltcg-audio musicOn / musicVol settings.
 */
(function () {
  if (window.GLBgm && window.GLBgm.__ready) return;

  var INTRO_SRC = "/audio/departure.mp3?v=2";
  var HOME_SRC = "/audio/grand-line.mp3?v=1";
  var COLL_SRC = "/audio/we-are.mp3?v=bgm";
  var SOCIAL_SRC = "/audio/party.mp3?v=1";
  var COMBAT_SRC = "/audio/duel.mp3?v=1";
  var SOLO_SRC = "/audio/cant-lose.mp3?v=1";
  var PVP_SRC = "/audio/strongest.mp3?v=1";
  var WIN_SRC = "/audio/huge-win.mp3?v=1";
  var LOSE_SRC = "/audio/mother-sea.mp3?v=1";
  var SHOP_SRC = "/audio/oden.mp3?v=1";
  var BASE_VOL = 0.42;
  var FADE_MS = 700;
  var NativeAudio = window.Audio;
  var IDS = ["intro", "home", "coll", "social", "combat", "solo", "pvp", "win", "lose", "shop"];
  var SRCS = {
    intro: INTRO_SRC, home: HOME_SRC, coll: COLL_SRC, social: SOCIAL_SRC,
    combat: COMBAT_SRC, solo: SOLO_SRC, pvp: PVP_SRC, win: WIN_SRC, lose: LOSE_SRC, shop: SHOP_SRC
  };

  var tracks = { intro: null, home: null, coll: null, social: null, combat: null, solo: null, pvp: null, win: null, lose: null, shop: null };
  var current = null;
  var unlocked = false;
  var warmed = false;
  var playMute = false;
  var fadeTok = {};
  var routeHint = "";
  var socialWant = false;
  var prefs = { on: true, vol: 0.8 };

  function readPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem("gltcg-audio") || "{}");
      var n = raw.state && typeof raw.state === "object" ? raw.state : raw;
      prefs.on = n.musicOn !== false;
      prefs.vol = typeof n.musicVol === "number" ? n.musicVol : 0.8;
    } catch (e) {
      prefs.on = true;
      prefs.vol = 0.8;
    }
    if (prefs.vol < 0) prefs.vol = 0;
    if (prefs.vol > 1) prefs.vol = 1;
  }
  readPrefs();

  function goalVol() {
    return BASE_VOL * prefs.vol;
  }

  function make(src) {
    var a = new NativeAudio(src);
    a.loop = true;
    a.preload = "none";
    a.volume = 0;
    a.muted = false;
    a.playsInline = true;
    a.controls = false;
    a.setAttribute("data-gl-bgm", "1");
    a.setAttribute("playsinline", "true");
    try { a.setAttribute("webkit-playsinline", "true"); } catch (e0) {}
    try { a.setAttribute("x-webkit-airplay", "deny"); } catch (e1) {}
    mountEl(a);
    return a;
  }

  function mountEl(el) {
    if (!el || el.isConnected) return el;
    var host = document.body || document.documentElement;
    if (!host) return el;
    el.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none;";
    try { host.appendChild(el); } catch (e) {}
    return el;
  }

  function makeIntroAudible(el) {
    if (!el) el = tracks.intro;
    if (!el) return;
    try { el.defaultMuted = false; } catch (e0) {}
    try { el.removeAttribute("muted"); } catch (e1) {}
    try { el.muted = false; } catch (e2) {}
    try { el.volume = goalVol(); } catch (e3) {}
  }

  function introIsAudible() {
    var el = tracks.intro;
    if (!el) return false;
    return !el.paused && !el.muted && (el.volume || 0) >= goalVol() * 0.5;
  }

  function armAudioSession() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!window.__glAc) window.__glAc = new AC();
        if (window.__glAc.state === "suspended") window.__glAc.resume();
      }
    } catch (e2) {}
  }

  function killIntro() {
    var el = tracks.intro || document.getElementById("gl-bgm-intro");
    if (!el) return;
    cancelFade("intro");
    try { el.autoplay = false; } catch (e0) {}
    try { el.pause(); } catch (e1) {}
    try { el.volume = 0; } catch (e2) {}
    rewind(el);
    if (current === "intro") current = null;
  }

  function grabIntroEl() {
    var html = document.getElementById("gl-bgm-intro") || window.__glIntroEl;
    if (html) {
      html.loop = true;
      html.autoplay = !entered();
      html.preload = "auto";
      html.playsInline = true;
      html.setAttribute("data-gl-bgm", "1");
      html.setAttribute("playsinline", "true");
      var prev = tracks.intro;
      tracks.intro = html;
      if (!entered()) {
        try { html.autoplay = true; } catch (eA) {}
        makeIntroAudible(html);
        try { html.play(); } catch (eP) {}
      }
      if (prev && prev !== html) {
        try { prev.pause(); } catch (e0) {}
        try {
          if (prev.parentNode && prev.parentNode !== html.parentNode) prev.parentNode.removeChild(prev);
        } catch (e1) {}
      }
      return html;
    }
    if (tracks.intro) return mountEl(tracks.intro);
    tracks.intro = make(INTRO_SRC);
    try { tracks.intro.id = "gl-bgm-intro"; } catch (e2) {}
    tracks.intro.autoplay = true;
    return tracks.intro;
  }

  function ensure(id) {
    grabIntroEl();
    if (id && id !== "intro") {
      if (!tracks[id]) tracks[id] = make(SRCS[id]);
      else mountEl(tracks[id]);
      return;
    }
    var want = null;
    try { want = wanted(); } catch (e) {}
    if (want && want !== "intro") {
      if (!tracks[want]) tracks[want] = make(SRCS[want]);
      else mountEl(tracks[want]);
    }
  }

  function pathOf() {
    try {
      if (routeHint) return routeHint;
      return String(location.pathname || "/").split("?")[0];
    } catch (e) {
      return routeHint || "/";
    }
  }

  function entered() {
    if (document.documentElement.classList.contains("gl-entered")) return true;
    var intro = document.querySelector(".intro-root");
    if (intro && intro.classList.contains("is-out")) return true;
    return false;
  }

  function isIntro() {
    if (document.documentElement.classList.contains("gl-entered")) return false;
    var intro = document.querySelector(".intro-root");
    if (intro && intro.classList.contains("is-out")) return false;
    return true;
  }

  function pregame() {
    return !!(
      document.querySelector(".coin-root") ||
      document.querySelector(".mul-root") ||
      document.querySelector(".vs-root")
    );
  }

  function headingOf(el) {
    if (!el) return "";
    var h = el.querySelector("h3, h2, .over-pill");
    return ((h && h.textContent) || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isVictoryScreen() {
    if (document.querySelector(".over-root.over-win")) return true;
    var resume = document.getElementById("gl-vs-resume");
    if (resume && /^Victoire$/i.test(headingOf(resume))) return true;
    return false;
  }

  function isDefeatScreen() {
    if (document.querySelector(".over-root.over-lose")) return true;
    var resume = document.getElementById("gl-vs-resume");
    if (resume && /^Défaite$/i.test(headingOf(resume))) return true;
    return false;
  }

  function isPvpFight() {
    var html = document.documentElement;
    if (html.classList.contains("gl-bgm-pvp")) return true;
    if (html.classList.contains("gl-bgm-solo") || html.classList.contains("gl-versus-solo")) return false;
    if (document.getElementById("gl-vs-kickoff") && html.classList.contains("gl-versus-fight")) return true;
    return false;
  }

  function isSoloFight() {
    var html = document.documentElement;
    if (html.classList.contains("gl-bgm-pvp")) return false;
    if (html.classList.contains("gl-versus-priv")) return false;
    if (html.classList.contains("gl-bgm-solo")) return true;
    if (document.getElementById("gl-vs-kickoff") && !html.classList.contains("gl-versus-fight")) return true;
    if (document.getElementById("gl-vs-kickoff") && html.classList.contains("gl-versus-solo")) return true;
    return false;
  }

  function overlayMute() {
    if (isSoloFight() || isPvpFight()) return false;
    var html = document.documentElement;
    if (html.classList.contains("gl-versus-fight") || html.classList.contains("gl-versus-solo")) return true;
    if (pregame()) return true;
    if (document.querySelector(".fight-fs")) return true;
    return false;
  }

  function isSocialOn() {
    if (!socialWant) return false;
    try {
      if (window.GLSocial && typeof window.GLSocial.isOpen === "function") {
        return !!window.GLSocial.isOpen();
      }
    } catch (e) {}
    return false;
  }

  function wanted() {
    if (isIntro()) return (!prefs.on || prefs.vol <= 0.02) ? null : "intro";
    if (document.visibilityState === "hidden") return null;
    if (!prefs.on || prefs.vol <= 0.02) return null;
    if (isIntro()) return "intro";
    if (!unlocked) return null;
    if (!entered()) return "intro";
    if (isVictoryScreen()) return "win";
    if (isDefeatScreen()) return "lose";
    if (isSoloFight()) return "solo";
    if (isPvpFight()) return "pvp";
    if (overlayMute()) return null;
    if (isSocialOn()) return "social";
    var p = pathOf();
    if (p === "/" || p === "") return "home";
    if (p === "/collection" || p.indexOf("/collection/") === 0) return "coll";
    if (p === "/decks" || p.indexOf("/decks/") === 0) return "coll";
    if (p === "/play" || p.indexOf("/play/") === 0) return "combat";
    if (p === "/shop" || p.indexOf("/shop/") === 0) return "shop";
    return null;
  }

  function rewind(el) {
    if (!el) return;
    try { el.currentTime = 0; } catch (e) {}
  }

  function ease(k) {
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    return k * k * (3 - 2 * k);
  }

  function cancelFade(id) {
    fadeTok[id] = (fadeTok[id] || 0) + 1;
    var el = tracks[id];
    if (el) el._glFadeTo = null;
  }

  function fadeEl(id, to, ms, onDone) {
    var el = tracks[id];
    if (!el) return;
    var cur = 0;
    try { cur = el.volume || 0; } catch (eC) { cur = 0; }
    el._glFadeTo = to;
    var token = (fadeTok[id] = (fadeTok[id] || 0) + 1);
    var from = cur;
    if (ms <= 0 || Math.abs(from - to) < 0.012) {
      try { el.volume = to; } catch (e1) {}
      if (to <= 0.01 && current !== id) {
        try { el.pause(); } catch (e2) {}
        try { el.volume = 0; } catch (e3) {}
        rewind(el);
      }
      if (el._glFadeTo === to) el._glFadeTo = null;
      if (onDone) onDone();
      return;
    }
    var t0 = performance.now();
    function step(now) {
      if (fadeTok[id] !== token) return;
      var k = ease(Math.min(1, (now - t0) / ms));
      var v = from + (to - from) * k;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      try { el.volume = v; } catch (e4) {}
      if (k < 1) {
        requestAnimationFrame(step);
        return;
      }
      try { el.volume = to; } catch (e5) {}
      if (to <= 0.01 && current !== id) {
        try { el.pause(); } catch (e6) {}
        try { el.volume = 0; } catch (e7) {}
        rewind(el);
      }
      if (el._glFadeTo === to) el._glFadeTo = null;
      if (onDone) onDone();
    }
    requestAnimationFrame(step);
  }

  function fadeOutOthers(keep) {
    IDS.forEach(function (id) {
      if (id === keep) return;
      var el = tracks[id];
      if (!el) return;
      if (el.paused && (el.volume || 0) <= 0.01) {
        rewind(el);
        return;
      }
      if (el._glFadeTo === 0) return;
      if (id === "intro") {
        killIntro();
        return;
      }
      fadeEl(id, 0, FADE_MS);
    });
  }

  function playIncoming(id, fromStart) {
    var el = tracks[id];
    if (!el || current !== id) return;
    mountEl(el);
    try { el.muted = false; } catch (eM) {}
    function fadeIn() {
      if (current !== id) return;
      unlocked = true;
      if (fromStart && id !== "intro") {
        try { el.currentTime = 0; } catch (eR) {}
      }
      if (id === "intro") makeIntroAudible(el);
      else fadeEl(id, goalVol(), FADE_MS);
    }
    var p = el.play();
    if (p && p.then) {
      p.then(fadeIn).catch(function () {
        setTimeout(function () {
          if (current !== id) return;
          if (fromStart && id !== "intro") rewind(el);
          var p2 = el.play();
          if (p2 && p2.then) p2.then(fadeIn).catch(function () {});
          else fadeIn();
        }, 120);
      });
    } else fadeIn();
  }

  function startTrack(id) {
    var el = id === "intro" ? grabIntroEl() : tracks[id];
    if (!el) {
      el = make(SRCS[id]);
      tracks[id] = el;
    }
    cancelFade(id);
    mountEl(el);
    try { el.preload = "auto"; } catch (ePre) {}
    try { el.muted = false; } catch (eM) {}
    if (id === "intro") {
      makeIntroAudible(el);
    } else {
      try { el.autoplay = false; } catch (eA) {}
      try { el.volume = 0; } catch (e0) {}
      rewind(el);
    }
    playIncoming(id, id !== "intro");
  }

  function playId(id, forceRestart) {
    ensure(id);
    var el = tracks[id];
    if (!el) {
      current = null;
      fadeOutOthers(null);
      return;
    }
    var gv = goalVol();
    if (current === id && !forceRestart) {
      if (el.paused) playIncoming(id, false);
      else if ((el._glFadeTo == null || el._glFadeTo === 0) && (el.volume || 0) < gv * 0.6) {
        if (id === "intro") makeIntroAudible(el);
        else fadeEl(id, gv, 280);
      }
      return;
    }
    current = id;
    startTrack(id);
    fadeOutOthers(id);
  }

  function warmAll() {
    if (warmed) return;
    warmed = true;
    armAudioSession();
    var next = "home";
    try {
      if (!isIntro()) next = wanted() || "home";
    } catch (e) {}
    if (next && next !== "intro") ensure(next);
    var warmIds = ["intro"];
    if (next && next !== "intro") warmIds.push(next);
    warmIds.forEach(function (id) {
      var el = tracks[id];
      if (!el) return;
      mountEl(el);
      try { el.preload = "auto"; } catch (eP) {}
      var keep = current === id || (isIntro() && id === "intro");
      try { el.muted = !keep; } catch (e0) {}
      if (!keep) {
        try { el.volume = 0; } catch (e1) {}
      }
      var p = el.play();
      if (p && p.then) {
        p.then(function () {
          if (current !== id) {
            try { el.pause(); } catch (e2) {}
            rewind(el);
            try { el.muted = false; el.volume = 0; } catch (e3) {}
          } else {
            try { el.muted = false; } catch (e4) {}
            if (id === "intro") makeIntroAudible(el);
          }
        }).catch(function () {});
      }
    });
  }

  function silence(opts) {
    opts = opts || {};
    current = null;
    IDS.forEach(function (id) {
      var el = tracks[id];
      if (!el) return;
      if (el.paused && (el.volume || 0) <= 0.01) return;
      fadeEl(id, 0, opts.fast ? 180 : FADE_MS);
    });
  }

  var ducking = false;

  function sync() {
    readPrefs();
    if (ducking && !isIntro()) return;
    var want = wanted();
    if (!want) silence();
    else playId(want);
  }

  function unlock() {
    unlocked = true;
    armAudioSession();
    ensure();
    warmAll();
    if (isIntro() && tracks.intro) {
      current = "intro";
      var el = tracks.intro;
      try { el.autoplay = true; } catch (eA) {}
      makeIntroAudible(el);
      var p = el.play();
      if (p && p.then) {
        p.then(function () {
          if (current === "intro") makeIntroAudible(el);
        }).catch(function () {
          sync();
        });
      }
      return;
    }
    killIntro();
    sync();
    setTimeout(sync, 80);
    setTimeout(sync, 400);
  }

  function preload() {
    grabIntroEl();
  }

  function setPrefs(on, vol) {
    prefs.on = !!on;
    prefs.vol = typeof vol === "number" ? vol : prefs.vol;
    if (prefs.vol < 0) prefs.vol = 0;
    if (prefs.vol > 1) prefs.vol = 1;
    var el = current ? tracks[current] : null;
    if (el && prefs.on) el.volume = goalVol();
    sync();
  }

  function setPlayMute(on) {
    playMute = !!on;
    sync();
  }

  function setRoute(path) {
    routeHint = String(path || "/").split("?")[0] || "/";
    socialWant = false;
    sync();
  }

  function setSocial(on) {
    socialWant = !!on;
    if (socialWant) routeHint = "";
    sync();
  }

  window.GLBgm = {
    __ready: true,
    unlock: unlock,
    sync: sync,
    preload: preload,
    setPrefs: setPrefs,
    setPlayMute: setPlayMute,
    setRoute: setRoute,
    setSocial: setSocial,
    hide: function () { ducking = true; silence({ fast: true }); },
    show: function () { ducking = false; sync(); },
    stopIntro: killIntro,
    track: function () { return current; },
    wanted: wanted,
    isUnlocked: function () { return unlocked; },
    elements: function () { return tracks; },
  };

  /* Block the React bundle's global We Are! player. */
  try {
    var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto && proto.play && !proto.play.__glBgm) {
      var origPlay = proto.play;
      proto.play = function () {
        var src = "";
        try { src = String(this.currentSrc || this.src || this.getAttribute("src") || ""); } catch (e) {}
        var ours = false;
        try { ours = this.getAttribute && this.getAttribute("data-gl-bgm") === "1"; } catch (e2) {}
        if (!ours) {
          var self = this;
          try {
            IDS.forEach(function (id) { if (tracks[id] === self) ours = true; });
          } catch (eOwn) {}
        }
        if (!ours && /we-are\.mp3/i.test(src)) {
          try { this.pause(); } catch (e3) {}
          return Promise.resolve();
        }
        return origPlay.apply(this, arguments);
      };
      proto.play.__glBgm = true;
    }
  } catch (wrapErr) {}

  function onGesture(e) {
    unlocked = true;
    armAudioSession();
    var introEl = document.querySelector(".intro-root");
    var ready = !!(introEl && introEl.classList.contains("is-ready") && !introEl.classList.contains("is-out"));
    if (isIntro() && !entered() && !ready) {
      current = "intro";
      ensure();
      if (tracks.intro) {
        try { tracks.intro.autoplay = true; } catch (eA) {}
        makeIntroAudible(tracks.intro);
        var p = tracks.intro.play();
        if (p && p.then) {
          p.then(function () {
            if (current === "intro") makeIntroAudible(tracks.intro);
          }).catch(function () {});
        }
      }
      return;
    }
    if (ready) return;
    ensure();
    warmAll();
    sync();
  }
  window.addEventListener("pointerdown", onGesture, { capture: true });
  window.addEventListener("pointerup", onGesture, { capture: true });
  window.addEventListener("touchstart", onGesture, { capture: true, passive: true });
  window.addEventListener("touchend", onGesture, { capture: true, passive: true });
  window.addEventListener("keydown", onGesture, { capture: true });

  document.addEventListener("click", function (e) {
    var intro = document.querySelector(".intro-root");
    if (!intro || intro.classList.contains("is-out") || document.documentElement.classList.contains("gl-entered")) return;
    if (intro.classList.contains("is-ready")) return;
    try { e.stopPropagation(); } catch (e1) {}
    try { e.stopImmediatePropagation(); } catch (e2) {}
    try { e.preventDefault(); } catch (e3) {}
    unlock();
  }, true);

  document.addEventListener("visibilitychange", function () {
    if (isIntro()) {
      ducking = false;
      bootIntro();
      return;
    }
    if (document.visibilityState === "hidden") {
      ducking = true;
      IDS.forEach(function (id) {
        if (id === "intro") return;
        var el = tracks[id];
        if (!el || el.paused) return;
        fadeEl(id, 0, 220, function () {
          try { el.pause(); } catch (e) {}
        });
      });
      return;
    }
    ducking = false;
    var keep = current;
    if (keep && tracks[keep]) {
      var el = tracks[keep];
      var p = el.play();
      if (p && p.then) p.then(function () { fadeEl(keep, goalVol(), FADE_MS); }).catch(function () { sync(); });
      else fadeEl(keep, goalVol(), FADE_MS);
      return;
    }
    sync();
  });

  window.addEventListener("gl-tab", function (e) {
    var p = e && e.detail ? String(e.detail).split("?")[0] : "";
    if (p && p !== routeHint) setRoute(p);
    else sync();
  });
  window.addEventListener("popstate", function () {
    try { routeHint = String(location.pathname || "/").split("?")[0]; } catch (e) {}
    socialWant = false;
    sync();
  });

  var lastKey = "";
  var applyT = 0;
  function applySoon() {
    if (applyT) return;
    applyT = setTimeout(function () {
      applyT = 0;
      var key = pathOf() + "|" + (wanted() || "") + "|" + (isIntro() ? "i" : "") + (isVictoryScreen() ? "w" : "") + (isDefeatScreen() ? "l" : "") + (isSocialOn() ? "s" : "") + (isSoloFight() ? "o" : "") + (isPvpFight() ? "p" : "") + (overlayMute() ? "f" : "");
      if (key === lastKey) return;
      lastKey = key;
      sync();
    }, 50);
  }
  if (window.MutationObserver) {
    try {
      new MutationObserver(function () { applySoon(); }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch (mo) {}
    try {
      if (document.body) {
        new MutationObserver(function () { applySoon(); }).observe(document.body, { childList: true });
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          try {
            new MutationObserver(function () { applySoon(); }).observe(document.body, { childList: true });
          } catch (mo2) {}
        });
      }
    } catch (mo3) {}
  }

  setInterval(function () {
    var want = wanted();
    var key = pathOf() + "|" + (want || "") + "|" + (isIntro() ? "i" : "") + (isVictoryScreen() ? "w" : "") + (isDefeatScreen() ? "l" : "") + (isSocialOn() ? "s" : "") + (isSoloFight() ? "o" : "") + (isPvpFight() ? "p" : "") + (overlayMute() ? "f" : "");
    if (key !== lastKey) {
      lastKey = key;
      sync();
      return;
    }
    if (ducking && !isIntro()) return;
    if (want && tracks[want]) {
      if (want === "intro") {
        makeIntroAudible(tracks.intro);
        if (!introIsAudible()) playIncoming("intro", false);
        return;
      }
      if (current !== want) {
        playId(want);
        return;
      }
      var el = tracks[want];
      var vol = el.volume || 0;
      var fadingIn = el._glFadeTo != null && el._glFadeTo > 0.05;
      if (el.paused || (!fadingIn && vol < 0.05)) playIncoming(want, false);
    }
  }, 800);

  function bootIntro() {
    readPrefs();
    if (!prefs.on || prefs.vol <= 0.02) return;
    if (entered()) {
      sync();
      return;
    }
    ensure();
    var el = grabIntroEl();
    armAudioSession();
    if (!el) return;
    current = "intro";
    try { el.autoplay = true; } catch (eA) {}
    makeIntroAudible(el);
    function onPlay() {
      if (current !== "intro") return;
      unlocked = true;
      makeIntroAudible(el);
    }
    if (!el.paused && !el.muted && (el.volume || 0) > 0.05) {
      onPlay();
      return;
    }
    var p = el.play();
    if (p && p.then) p.then(onPlay).catch(function () {
      makeIntroAudible(el);
    });
    else onPlay();
  }
  bootIntro();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootIntro);
  }
  window.addEventListener("pageshow", function () {
    if (!entered()) bootIntro();
  });
  var introTries = 0;
  var introTimer = setInterval(function () {
    introTries += 1;
    if (entered() || introTries > 80) {
      clearInterval(introTimer);
      return;
    }
    if (introIsAudible()) return;
    bootIntro();
  }, 200);
})();
