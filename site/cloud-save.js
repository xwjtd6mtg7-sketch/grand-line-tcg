/**
 * Account cloud save — Grand Line TCG.
 * Mirrors every local progress key onto the signed-in account and restores
 * it on any device after login.
 */
(function () {
  var TCG = "gl-tcg-save";
  var MISSIONS = "gl-missions-v1";
  var MAIL = "gl-mail-claimed";
  var PROFILE = "gl-profile-v1";
  var PORTRAIT = "gl-portrait";
  var SOCIAL = "gl-social-v1";
  var BOUND = "gl-cloud-user";
  var WATCH = {};
  WATCH[TCG] = 1;
  WATCH[MISSIONS] = 1;
  WATCH[MAIL] = 1;
  WATCH[PROFILE] = 1;
  WATCH[PORTRAIT] = 1;
  WATCH[SOCIAL] = 1;

  var TCG_KEYS = [
    "berries", "collection", "decks", "activeDeckId", "packs", "wins", "losses",
    "opened", "lastFreePack", "granted", "seenRules", "ownedCosmetics", "equip",
    "pity", "bp", "bpStock", "bpAt", "bpDay", "bpMade", "ladderWins", "dailyMissions",
  ];

  var rev = 0;
  var userId = "";
  var signedIn = false;
  var applying = false;
  var dirty = false;
  var timer = 0;
  var storeApi = null;
  var ready = false;
  var pulling = false;

  var lastBlob = null;
  var lockTimer = 0;

  function packCount(p) {
    p = p || {};
    var n = 0;
    Object.keys(p).forEach(function (k) { n += Number(p[k]) || 0; });
    return n;
  }

  function looksStarter(p) {
    p = p || {};
    return (Number(p["OP-01"]) || 0) >= 5 && (Number(p["OP-02"]) || 0) >= 2;
  }

  function missionsOf(blob) {
    if (!blob) return null;
    if (blob.missions) return blob.missions;
    var st = tcgState(blob.tcg);
    return (st && st.dailyMissions) || null;
  }

  function parse(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, val) {
    if (val == null) return;
    try { localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); } catch (e) {}
  }

  function snapshot() {
    var tcg = parse(TCG, null);
    var missions = parse(MISSIONS, null);
    var st = tcgState(tcg);
    if (st && missions) {
      st.dailyMissions = missions;
      if (tcg && tcg.state) tcg.state.dailyMissions = missions;
      else if (tcg) tcg.dailyMissions = missions;
    }
    return {
      v: 1,
      savedAt: Date.now(),
      tcg: tcg,
      missions: missions,
      mailClaimed: parse(MAIL, null),
      profile: parse(PROFILE, null),
      portrait: parse(PORTRAIT, null),
      social: parse(SOCIAL, null),
    };
  }

  function mergeMissions(a, b) {
    if (!a) return b || a;
    if (!b) return a;
    var da = String(a.day || "");
    var db = String(b.day || "");
    if (da && db && da !== db) return da >= db ? a : b;
    var claimed = {};
    [a.claimed, b.claimed].forEach(function (src) {
      if (!src || typeof src !== "object") return;
      Object.keys(src).forEach(function (k) { if (src[k]) claimed[k] = true; });
    });
    return {
      day: da || db,
      login: Math.max(Number(a.login) || 0, Number(b.login) || 0),
      open: Math.max(Number(a.open) || 0, Number(b.open) || 0),
      win: Math.max(Number(a.win) || 0, Number(b.win) || 0),
      fight: Math.max(Number(a.fight) || 0, Number(b.fight) || 0),
      claimed: claimed,
      gaugeTaken: !!(a.gaugeTaken || b.gaugeTaken),
    };
  }

  function tcgState(wrap) {
    if (!wrap || typeof wrap !== "object") return null;
    return wrap.state && typeof wrap.state === "object" ? wrap.state : wrap;
  }

  function hookStore(api) {
    if (!api) return;
    if (api !== storeApi) {
      storeApi = api;
      if (api.subscribe) {
        api.subscribe(function (s) {
          if (applying) return;
          if (lastBlob) {
            var cloud = tcgState(lastBlob.tcg) || {};
            if ((Number(cloud.opened) || 0) >= (Number(s.opened) || 0)
              && packCount(s.packs) > packCount(cloud.packs)
              && looksStarter(s.packs)
              && !looksStarter(cloud.packs)) {
              applying = true;
              hydrateStore(lastBlob.tcg);
              setTimeout(function () { applying = false; }, 40);
              return;
            }
          }
          schedulePush();
        });
      }
    }
    if (api.persist && !api.__glPersistHooked) {
      api.__glPersistHooked = true;
      function replay() {
        if (lastBlob) hydrateStore(lastBlob.tcg);
      }
      try {
        api.persist.onFinishHydration(replay);
        if (api.persist.hasHydrated && api.persist.hasHydrated()) replay();
      } catch (e) {}
    }
  }

  function hydrateStore(wrap) {
    var st = tcgState(wrap);
    if (!st) return;
    var patch = {};
    for (var i = 0; i < TCG_KEYS.length; i++) {
      var k = TCG_KEYS[i];
      if (st[k] !== undefined) patch[k] = st[k];
    }
    function apply(api) {
      try { api.setState(patch); } catch (e) {}
    }
    if (storeApi && storeApi.setState) apply(storeApi);
    else {
      import("/assets/store-BlZSQe9J.js")
        .then(function (mod) {
          if (mod && mod.o && mod.o.setState) {
            hookStore(mod.o);
            apply(storeApi);
          }
        })
        .catch(function () {});
    }
  }

  function applyBlob(blob) {
    if (!blob || typeof blob !== "object") return;
    var st = tcgState(blob.tcg);
    if (st) {
      if (cardCount(blob.tcg) > 0) st.granted = true;
      var ms = mergeMissions(blob.missions, st.dailyMissions);
      if (ms) {
        blob.missions = ms;
        st.dailyMissions = ms;
      }
    }
    lastBlob = blob;
    applying = true;
    try {
      if (blob.tcg) write(TCG, blob.tcg);
      if (blob.missions) write(MISSIONS, blob.missions);
      if (blob.mailClaimed) write(MAIL, blob.mailClaimed);
      if (blob.profile) {
        var curP = parse(PROFILE, {}) || {};
        var nextP = Object.assign({}, curP, blob.profile);
        if (!nextP.name) nextP.name = curP.name || "";
        write(PROFILE, nextP);
      }
      if (blob.portrait && blob.portrait.cardId) write(PORTRAIT, blob.portrait);
      if (blob.social) write(SOCIAL, blob.social);
      hydrateStore(blob.tcg);
      try {
        window.dispatchEvent(new CustomEvent("gl-progress-applied", { detail: blob }));
      } catch (e2) {}
      if (signedIn) {
        publishStats(blob.tcg);
        syncIdentity(blob);
      }
      clearInterval(lockTimer);
      var until = Date.now() + 4500;
      lockTimer = setInterval(function () {
        if (Date.now() > until) {
          clearInterval(lockTimer);
          lockTimer = 0;
          return;
        }
        if (lastBlob === blob) {
          hydrateStore(blob.tcg);
          if (blob.missions) write(MISSIONS, blob.missions);
        }
      }, 280);
    } finally {
      setTimeout(function () {
        applying = false;
      }, 2000);
    }
  }

  function schedulePush() {
    dirty = true;
    if (!signedIn || applying || !ready) return;
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      push();
    }, 800);
  }

  function push() {
    if (!signedIn || applying || !ready) {
      dirty = true;
      return Promise.resolve();
    }
    dirty = false;
    var blob = snapshot();
    return fetch("/api/progress", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: blob, rev: rev }),
    })
      .then(function (r) {
        if (r.status === 401) {
          signedIn = false;
          userId = "";
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.ok) return;
        rev = Number(data.rev) || rev;
        if (data.blob && data.blob.tcg) {
          /* server may have merged; keep local in sync without a loop */
        }
      })
      .catch(function () {});
  }

  function cardCount(wrap) {
    var st = tcgState(wrap) || {};
    var coll = st.collection || {};
    var n = 0;
    Object.keys(coll).forEach(function (id) { n += Number(coll[id]) || 0; });
    return n;
  }

  function publishStats(wrap) {
    var st = tcgState(wrap) || {};
    var p = parse(PROFILE, {}) || {};
    var name = String(p.name || "").trim();
    fetch("/api/social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "publish",
        name: name,
        motto: p.motto || "",
        favs: p.favs || [],
        wins: st.wins || 0,
        losses: st.losses || 0,
        opened: st.opened || 0,
        owned: cardCount(wrap),
      }),
    }).catch(function () {});
  }

  function syncIdentity(blob) {
    var p = (blob && blob.profile) || parse(PROFILE, {}) || {};
    var port = (blob && blob.portrait) || parse(PORTRAIT, null);
    var name = String(p.name || "").trim();
    if (name) {
      fetch("/api/auth/update-user", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name }),
      }).catch(function () {});
    }
    if (port && port.cardId) {
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "avatar",
          cardId: port.cardId,
          x: port.x,
          y: port.y,
          s: port.s,
        }),
      }).catch(function () {});
      fetch("/api/auth/update-user", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: "glcard:" + port.cardId }),
      }).catch(function () {});
    }
  }

  function pull() {
    if (pulling) return pulling;
    pulling = fetch("/api/admin/status", { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (st) {
        signedIn = !!(st && st.signedIn && st.id);
        userId = signedIn ? String(st.id) : "";
        if (!signedIn) return null;
        return fetch("/api/progress", { credentials: "include" }).then(function (r) {
          if (!r.ok) return null;
          return r.json();
        });
      })
      .then(function (data) {
        if (!signedIn) return;
        var bound = "";
        try { bound = localStorage.getItem(BOUND) || ""; } catch (e) {}
        var local = snapshot();
        var cloud = data && data.blob ? data.blob : null;
        rev = (data && Number(data.rev)) || 0;
        var cloudEmpty = !cloud || !tcgState(cloud.tcg) || cardCount(cloud.tcg) === 0;
        var localCount = cardCount(local.tcg);
        var switched = !!(bound && bound !== userId);

        function bind() {
          try { localStorage.setItem(BOUND, userId); } catch (e3) {}
        }

        if (switched) {
          if (cloudEmpty) {
            applyBlob({
              tcg: { version: 4, state: { berries: 0, collection: {}, decks: [], packs: {}, wins: 0, losses: 0, opened: 0, granted: false, pity: {}, ladderWins: {}, ownedCosmetics: [], activeDeckId: "" } },
              missions: { day: "", login: 0, open: 0, win: 0, fight: 0, claimed: {}, gaugeTaken: false },
              mailClaimed: {},
            });
          } else {
            applyBlob(cloud);
          }
          bind();
          return;
        }

        if (cloudEmpty) {
          bind();
          return push();
        }

        applyBlob(cloud);
        bind();
      })
      .catch(function () {})
      .finally(function () {
        pulling = null;
        ready = true;
        try { window.dispatchEvent(new Event("gl-cloud-ready")); } catch (e4) {}
        setTimeout(function () {
          if (dirty && signedIn && !applying) push();
        }, 2800);
      });
    return pulling;
  }

  import("/assets/store-BlZSQe9J.js")
    .then(function (mod) {
      if (mod && mod.o && typeof mod.o.getState === "function") hookStore(mod.o);
    })
    .catch(function () {});

  try {
    var _setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      _setItem(k, v);
      if (WATCH[k] && !applying) schedulePush();
    };
  } catch (e) {}

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && dirty) push();
  });
  window.addEventListener("pagehide", function () {
    if (dirty) push();
  });

  setInterval(function () {
    if (dirty && signedIn && ready && !applying) push();
  }, 20000);

  window.GLCloudSave = {
    pull: pull,
    push: push,
    snapshot: snapshot,
    apply: applyBlob,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pull);
  } else {
    pull();
  }
})();
