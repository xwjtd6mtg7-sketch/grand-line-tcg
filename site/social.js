/**
 * Social hub — Grand Line TCG.
 * Partage / Échange / Amis.
 */
(function () {
  var KEY = "gl-social-v1";
  var SAVE = "gl-tcg-save";
  var catalog = null;
  var view = "hub";
  var pickMode = null;
  var selectedCard = null;
  var selectedFriend = null;
  var scanStream = null;
  var viewedProfile = null;
  var socialOpen = false;
  var tradeReplyId = "";
  var pendingOffer = null;
  var confirmOpen = false;
  var pickQuery = "";
  var pickSet = "";
  var pickSort = "set";
  var shownFriends = false;
  var sheetBusy = false;
  var qrBusy = false;

  if (!window.GLQr) {
    window.GLQr = {
      load: function (done) {
        if (window.jsQR) { done(window.jsQR); return; }
        if (window._jsqrWait) { window._jsqrWait.push(done); return; }
        window._jsqrWait = [done];
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
        s.onload = function () {
          var q = window._jsqrWait || [];
          window._jsqrWait = null;
          q.forEach(function (fn) { fn(window.jsQR); });
        };
        s.onerror = function () {
          var q = window._jsqrWait || [];
          window._jsqrWait = null;
          q.forEach(function (fn) { fn(null); });
        };
        document.head.appendChild(s);
      },
      fromCanvas: function (canvas) {
        if (!window.jsQR) return null;
        try {
          var ctx = canvas.getContext("2d", { willReadFrequently: true });
          var w = canvas.width, h = canvas.height;
          if (!w || !h) return null;
          var data = ctx.getImageData(0, 0, w, h);
          var code = window.jsQR(data.data, w, h);
          return code && code.data ? code.data : null;
        } catch (e) { return null; }
      },
      loop: function (video, still, onHit) {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        var det = null;
        if (window.BarcodeDetector) {
          try { det = new BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { det = null; }
        }
        window.GLQr.load(function () {});
        function tick() {
          if (!still()) return;
          var w = video.videoWidth, h = video.videoHeight;
          if (w && h) {
            if (det) {
              det.detect(video).then(function (codes) {
                if (!still()) return;
                if (codes && codes[0] && codes[0].rawValue) { onHit(codes[0].rawValue); return; }
                requestAnimationFrame(tick);
              }).catch(function () { requestAnimationFrame(tick); });
              return;
            }
            if (window.jsQR) {
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              var hit = window.GLQr.fromCanvas(canvas);
              if (hit) { onHit(hit); return; }
            }
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      fromFile: function (file, cb) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          function viaJs() {
            window.GLQr.load(function (lib) {
              if (!lib) { cb(null); return; }
              var canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext("2d").drawImage(img, 0, 0);
              cb(window.GLQr.fromCanvas(canvas));
            });
          }
          if (window.BarcodeDetector) {
            try {
              new BarcodeDetector({ formats: ["qr_code"] }).detect(img).then(function (codes) {
                if (codes && codes[0] && codes[0].rawValue) cb(codes[0].rawValue);
                else viaJs();
              }).catch(viaJs);
              return;
            } catch (e) {}
          }
          viaJs();
        };
        img.onerror = function () { cb(null); };
        img.src = url;
      },
    };
  }

  if (!document.getElementById("gl-social-css")) {
    var link = document.createElement("link");
    link.id = "gl-social-css";
    link.rel = "stylesheet";
    link.href = "/social.css?v=32";
    document.head.appendChild(link);
  } else {
    document.getElementById("gl-social-css").href = "/social.css?v=32";
  }
  try {
    if (!document.querySelector('link[rel="preload"][href*="/social/hero.jpg"]')) {
      var pre = document.createElement("link");
      pre.rel = "preload";
      pre.as = "image";
      pre.href = "/social/hero.jpg?v=op1";
      document.head.appendChild(pre);
    }
    var preload = new Image();
    preload.src = "/social/hero.jpg?v=op1";
    if (preload.decode) preload.decode().catch(function () {});
  } catch (ePre) {}

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
      return {
        myId: p.myId || makeId(),
        friends: Array.isArray(p.friends) ? p.friends : [],
        history: Array.isArray(p.history) ? p.history : [],
        lastShare: p.lastShare || {},
      };
    } catch (e) {
      return { myId: makeId(), friends: [], history: [], lastShare: {} };
    }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  var storeApi = null;
  import("/assets/store-BlZSQe9J.js")
    .then(function (mod) {
      if (mod && mod.o && typeof mod.o.getState === "function") storeApi = mod.o;
    })
    .catch(function () {});

  var claimedMail = {};
  try { claimedMail = JSON.parse(localStorage.getItem("gl-mail-claimed") || "{}") || {}; } catch (e) { claimedMail = {}; }

  function persistClaimed() {
    try { localStorage.setItem("gl-mail-claimed", JSON.stringify(claimedMail)); } catch (e) {}
  }

  window.addEventListener("gl-progress-applied", function (ev) {
    try {
      if (ev && ev.detail && ev.detail.mailClaimed) claimedMail = ev.detail.mailClaimed;
      else claimedMail = JSON.parse(localStorage.getItem("gl-mail-claimed") || "{}") || {};
    } catch (e) {}
    try {
      if (ev && ev.detail && ev.detail.social) {
        data = Object.assign(load(), ev.detail.social);
        save(data);
      } else {
        data = load();
      }
    } catch (e2) {}
  });

  var data = load();
  save(data);
  var session = { signedIn: false, me: null, friends: [], incoming: [], outgoing: [], mail: [], trades: [] };

  function refreshSocial() {
    return fetch("/api/social", { credentials: "include" })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          session = { signedIn: false, me: null, friends: [], incoming: [], outgoing: [], banned: r.status === 403 };
          paintDockBadge();
          return session;
        }
        return r.json().then(function (j) {
          session = {
            signedIn: true,
            me: j.me || null,
            friends: j.friends || [],
            incoming: j.incoming || [],
            outgoing: j.outgoing || [],
            mail: j.mail || [],
            trades: j.trades || [],
          };
          data.friends = session.friends.map(function (f) {
            return { id: f.id, name: f.name, code: f.code, avatar: f.avatar };
          });
          if (session.me && session.me.code) data.myId = prettyId(session.me.code);
          save(data);
          applyMail(session.mail || []);
          paintDockBadge();
          hydrateIdentityFromMe(session.me);
          return session;
        });
      })
      .catch(function () {
        session = { signedIn: false, me: null, friends: [], incoming: [], outgoing: [] };
        return session;
      });
  }

  function makeId() {
    var s = "";
    for (var i = 0; i < 16; i++) s += Math.floor(Math.random() * 10);
    return s.replace(/(.{4})(?=.)/g, "$1-");
  }
  function normId(v) {
    return String(v || "").replace(/\D/g, "").slice(0, 16);
  }
  function prettyId(v) {
    var n = normId(v);
    return n.replace(/(.{4})(?=.)/g, "$1-");
  }

  function displayName() {
    if (session.me && session.me.name) return session.me.name;
    try {
      var p = JSON.parse(localStorage.getItem("gl-profile-v1") || "{}");
      if (p && p.name) return p.name;
    } catch (e) {}
    return "Pirate";
  }

  var lastIdent = "";
  function hydrateIdentityFromMe(me) {
    if (!me) return;
    var ident = String(me.name || "") + "|" + JSON.stringify(me.avatar || null) + "|" + String(me.motto || "");
    if (ident === lastIdent) return;
    lastIdent = ident;
    try {
      var p = {};
      try { p = JSON.parse(localStorage.getItem("gl-profile-v1") || "{}") || {}; } catch (e0) { p = {}; }
      var serverName = String(me.name || "").trim();
      if (serverName && !/^pirate$/i.test(serverName)) p.name = serverName.slice(0, 14);
      if (me.motto) p.motto = me.motto;
      if (Array.isArray(me.favs) && me.favs.length) p.favs = me.favs.slice(0, 3);
      localStorage.setItem("gl-profile-v1", JSON.stringify(p));
    } catch (e1) {}
    var av = me.avatar;
    var local = null;
    try { local = JSON.parse(localStorage.getItem("gl-portrait") || "null"); } catch (e2) {}
    if (av && av.cardId) {
      var payload = {
        cardId: av.cardId,
        name: (local && local.name) || "",
        x: av.x != null ? av.x : 50,
        y: av.y != null ? av.y : 16,
        s: av.s != null ? av.s : 1.8,
        at: Date.now(),
      };
      try { localStorage.setItem("gl-portrait", JSON.stringify(payload)); } catch (e3) {}
      if (window.GLPortrait && typeof window.GLPortrait.hydrate === "function") {
        window.GLPortrait.hydrate(payload);
      }
    } else if (local && local.cardId) {
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "avatar", cardId: local.cardId, x: local.x, y: local.y, s: local.s }),
      }).catch(function () {});
    }
    try { window.dispatchEvent(new CustomEvent("gl-identity-applied")); } catch (e4) {}
  }

  function mutateCollection(cardId, delta) {
    if (!cardId || !delta) return 0;
    var n = 0;
    function nextCol(col) {
      var out = Object.assign({}, col || {});
      n = (Number(out[cardId]) || 0) + delta;
      if (n <= 0) {
        delete out[cardId];
        n = 0;
      } else out[cardId] = n;
      return out;
    }
    try {
      if (storeApi && storeApi.setState) {
        storeApi.setState(function (s) {
          return { collection: nextCol(s.collection) };
        });
        return n;
      }
    } catch (e) {}
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null") || {};
      var st = raw.state || raw;
      st.collection = nextCol(st.collection);
      if (raw.state) raw.state = st;
      else raw = st;
      localStorage.setItem(SAVE, JSON.stringify(raw));
      return n;
    } catch (err) {
      return 0;
    }
  }

  function cardById(id) {
    if (!id) return null;
    var list = (catalog && catalog.cards) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, name: id };
  }

  function applyMail(list) {
    if (!list || !list.length) return;
    var ids = [];
    var received = [];
    list.forEach(function (m) {
      if (!m || !m.id || !m.cardId) return;
      if (claimedMail[m.id]) { ids.push(m.id); return; }
      claimedMail[m.id] = 1;
      mutateCollection(m.cardId, 1);
      var card = cardById(m.cardId);
      var label = (card && card.name) || m.cardId;
      var who = m.fromName || "un nakama";
      var kind = m.kind === "trade" ? "trade" : m.kind === "refund" ? "trade" : "share";
      data.history.push({ kind: kind, label: label + (m.kind === "refund" ? " — retour" : " reçu de " + who), at: Date.now() });
      received.push({ card: card, who: who, kind: m.kind });
      ids.push(m.id);
    });
    persistClaimed();
    save(data);
    if (ids.length) {
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "claim", ids: ids }),
      }).catch(function () {});
    }
    if (received.length) {
      var first = received[0];
      playFx({
        kind: first.kind === "trade" ? "trade" : "receive",
        title: first.kind === "refund" ? "Carte rendue" : "Carte reçue",
        sub: (first.card && first.card.name ? first.card.name : "Carte") + " · " + first.who,
        img: srcOf(first.card),
      });
    }
  }

  function collection() {
    try {
      if (storeApi && storeApi.getState) {
        var col = storeApi.getState().collection;
        if (col && typeof col === "object") return col;
      }
    } catch (e) {}
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      var st = raw && (raw.state || raw);
      return (st && st.collection) || {};
    } catch (e) {}
    return {};
  }

  function fxRoot() {
    var el = document.getElementById("gl-so-fx");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-so-fx";
      el.className = "gl-so-fx";
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  }

  function playFx(opt) {
    opt = opt || {};
    var el = fxRoot();
    el.hidden = false;
    el.className = "gl-so-fx is-on is-" + (opt.kind || "share");
    el.innerHTML =
      '<div class="gl-so-fx-burst"></div>' +
      '<div class="gl-so-fx-rays"></div>' +
      (opt.img ? '<div class="gl-so-fx-card"><img alt="" src="' + opt.img + '"></div>' : "") +
      '<p class="gl-so-fx-title">' + escapeHtml(opt.title || "Terminé") + "</p>" +
      '<p class="gl-so-fx-sub">' + escapeHtml(opt.sub || "") + "</p>";
    setTimeout(function () {
      el.classList.remove("is-on");
      setTimeout(function () { el.hidden = true; el.innerHTML = ""; }, 420);
    }, 2200);
  }

  function confirmHtml() {
    if (!confirmOpen || !selectedCard) return "";
    var friend = selectedFriend;
    var offer = pendingOffer;
    var img = srcOf(selectedCard);
    var title, copy;
    if (tradeReplyId) {
      title = "Confirmer l’échange";
      copy = "Tu envoies <b>" + escapeHtml(selectedCard.name || selectedCard.id) + "</b>" +
        (offer ? " contre <b>" + escapeHtml(offer.name || offer.id) + "</b>" : "") + ".";
    } else if (pickMode === "trade") {
      title = "Proposer l’échange";
      copy = "Tu proposes <b>" + escapeHtml(selectedCard.name || selectedCard.id) + "</b> à <b>" +
        escapeHtml(friend && friend.name ? friend.name : "ton nakama") + "</b>.";
    } else {
      title = "Confirmer le partage";
      copy = "Tu offres <b>" + escapeHtml(selectedCard.name || selectedCard.id) + "</b> à <b>" +
        escapeHtml(friend && friend.name ? friend.name : "ton nakama") + "</b>. Tu perdras 1 exemplaire.";
    }
    return (
      '<div class="gl-so-confirm" data-act="confirm-no">' +
        '<div class="gl-so-confirm-box" data-stop="1">' +
          '<div class="gl-so-confirm-art">' +
            (offer && tradeReplyId
              ? '<img class="is-offer" alt="" src="' + srcOf(offer) + '"><span>⇄</span>'
              : "") +
            '<img alt="" src="' + img + '">' +
          "</div>" +
          "<h3>" + title + "</h3>" +
          "<p>" + copy + "</p>" +
          '<div class="gl-so-dlg-btns">' +
            '<button type="button" class="gl-so-ghost" data-act="confirm-no">Annuler</button>' +
            '<button type="button" class="gl-so-ok" data-act="confirm-yes">Valider</button>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function showQrZoom(src) {
    var el = document.getElementById("gl-qr-zoom");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-qr-zoom";
      el.className = "gl-qr-zoom";
      document.body.appendChild(el);
      el.addEventListener("click", function () {
        el.classList.remove("is-on");
        el.innerHTML = "";
      });
    }
    el.innerHTML = '<img alt="QR" src="' + src + '">';
    el.classList.add("is-on");
  }

  function srcOf(card) {
    if (!card) return "/card-back.png";
    if (card.image) return card.image;
    return "https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main/site/cards-fr/" + card.id + ".webp";
  }

  function canShare(card) {
    if (!card || isStarterCard(card)) return false;
    var r = String(card.rarity || "").toUpperCase();
    return r === "C" || r === "UC" || r === "R";
  }

  function isStarterCard(card) {
    if (!card) return true;
    var set = String(card.set || "");
    var id = String(card.id || "");
    if (/^ST[-_]/i.test(set) || /^ST\d/i.test(set)) return true;
    if (/^ST\d{0,2}[-_]/i.test(id)) return true;
    return false;
  }

  function ownedShareable() {
    var col = collection();
    var list = (catalog && catalog.cards) || [];
    var byId = {};
    for (var i = 0; i < list.length; i++) byId[list[i].id] = list[i];
    var out = [];
    Object.keys(col).forEach(function (id) {
      if ((Number(col[id]) || 0) < 1) return;
      var c = byId[id];
      if (c && canShare(c)) out.push(c);
    });
    return out;
  }

  function rarityRank(r) {
    var x = String(r || "").toUpperCase();
    if (x === "C") return 1;
    if (x === "UC") return 2;
    if (x === "R") return 3;
    if (x === "SR") return 4;
    return 5;
  }

  function filteredShareable() {
    var col = collection();
    var q = pickQuery.trim().toLowerCase();
    var list = ownedShareable();
    if (pickSet) {
      list = list.filter(function (c) { return String(c.set || "") === pickSet; });
    }
    if (q) {
      list = list.filter(function (c) {
        return String(c.name || "").toLowerCase().indexOf(q) >= 0 ||
          String(c.id || "").toLowerCase().indexOf(q) >= 0 ||
          String(c.set || "").toLowerCase().indexOf(q) >= 0;
      });
    }
    list.sort(function (a, b) {
      if (pickSort === "name") return String(a.name || "").localeCompare(String(b.name || ""), "fr");
      if (pickSort === "rarity") {
        var d = rarityRank(a.rarity) - rarityRank(b.rarity);
        return d || String(a.id).localeCompare(String(b.id));
      }
      if (pickSort === "qty") {
        return (Number(col[b.id]) || 0) - (Number(col[a.id]) || 0);
      }
      var ds = String(a.set || "").localeCompare(String(b.set || ""));
      return ds || String(a.id).localeCompare(String(b.id));
    });
    return list;
  }

  function ownedSets() {
    var seen = {};
    var out = [];
    ownedShareable().forEach(function (c) {
      var s = String(c.set || "");
      if (!s || seen[s]) return;
      seen[s] = 1;
      out.push(s);
    });
    out.sort();
    return out;
  }

  var ICO = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.8.4-1.2.8-1.2 1.6V14"/><circle cx="12" cy="17" r=".8" fill="currentColor"/></svg>',
    share: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M10 30V16h16l8 8v14H18z"/><path d="M26 16v8h8"/><rect x="20" y="8" width="14" height="18" rx="2"/></svg>',
    trade: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="10" width="16" height="22" rx="2"/><rect x="26" y="16" width="16" height="22" rx="2"/><path d="M22 20h4M24 18v4M22 32h4M24 30v4" stroke-linecap="round"/></svg>',
    friends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M3 19c.6-3 3-5 6-5s5.4 2 6 5"/><path d="M14 19c.3-2 1.8-3.5 4-3.8 1.8.3 3 1.6 3.4 3.8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h3v3h-3zM19 14v6M14 19h2"/></svg>',
    hist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v6l4 2"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  var HERO_SRC = "/social/hero.jpg?v=op1";
  var HERO_WIDE = "/social/hero-wide.jpg?v=op1";
  var HERO_MQ = "(min-width: 1120px) and (hover: hover) and (pointer: fine)";
  var SHELL_HTML =
    '<div class="gl-so-hub-layer"></div>' +
    '<div class="gl-so-main" data-view=""></div>';

  function heroImgHtml() {
    return (
      '<picture>' +
        '<source media="' + HERO_MQ + '" srcset="' + HERO_WIDE + '">' +
        '<img class="gl-so-art-img cmb-hero-img" src="' + HERO_SRC + '" alt="" draggable="false" decoding="async" fetchpriority="high">' +
      "</picture>"
    );
  }

  function ensureShell(el) {
    if (!el) return el;
    if (!el.querySelector(":scope > .gl-so-hub-layer")) {
      var hub = document.createElement("div");
      hub.className = "gl-so-hub-layer";
      el.insertBefore(hub, el.firstChild);
    }
    if (!el.querySelector(":scope > .gl-so-main")) {
      var main = document.createElement("div");
      main.className = "gl-so-main";
      main.setAttribute("data-view", "");
      el.appendChild(main);
    }
    return el;
  }

  function ensureHub(el) {
    var hub = el && el.querySelector(":scope > .gl-so-hub-layer");
    if (!hub) return;
    if (!hub.querySelector(".gl-so-page")) hub.innerHTML = renderHub();
    var hero = hub.querySelector(".gl-so-hero");
    if (!hero) return;
    if (!hero.querySelector("picture")) hero.innerHTML = heroImgHtml();
    var img = hero.querySelector("img");
    if (img && img.getAttribute("src") !== HERO_SRC) img.setAttribute("src", HERO_SRC);
    var art = el.querySelector(":scope > .gl-so-art");
    if (art) art.remove();
  }

  function rootEl() {
    var el = document.getElementById("gl-so-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "gl-so-root";
      el.className = "gl-so-root is-showing-hub";
      el.hidden = true;
      el.innerHTML = SHELL_HTML;
      var host = document.querySelector(".tab-host");
      (host || document.body).appendChild(el);
    } else {
      ensureShell(el);
    }
    if (!el._soClick) {
      el._soClick = true;
      el.addEventListener("click", onClick, true);
    }
    return el;
  }

  function mountRoot() {
    var el = rootEl();
    var host = document.querySelector(".tab-host");
    if (host && el.parentNode !== host) host.appendChild(el);
    return el;
  }

  function portalEl() {
    var p = document.getElementById("gl-so-portal");
    if (!p) {
      p = document.createElement("div");
      p.id = "gl-so-portal";
      p.className = "gl-so-portal";
      document.body.appendChild(p);
      p.addEventListener("click", onClick);
    }
    return p;
  }

  function friendsHeight() {
    var head = document.querySelector("#gl-so-root .gl-head");
    var top = Math.round(window.innerHeight * 0.12);
    if (head) {
      var r = head.getBoundingClientRect();
      if (r.bottom > 24) top = Math.round(r.bottom + 8);
    }
    return Math.max(360, window.innerHeight - top);
  }

  function setReveal(el, maxH, revealed, animate) {
    if (!el) return;
    var r = Math.max(0, Math.min(maxH + 28, revealed));
    el._soMaxH = maxH;
    el._soReveal = r;
    el.style.height = maxH + "px";
    el.style.transition = animate ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none";
    el.style.transform = "translate3d(0," + Math.max(0, maxH - r) + "px,0)";
  }

  function slideIn(el, maxH) {
    if (!el) return;
    var h = maxH || parseInt(el.style.height, 10) || friendsHeight();
    el.classList.remove("is-live");
    setReveal(el, h, 0, false);
    requestAnimationFrame(function () {
      el.classList.add("is-live");
      requestAnimationFrame(function () { setReveal(el, h, h, true); });
    });
  }

  function slideOut(el, done) {
    if (!el) { if (done) done(); return; }
    var h = el._soMaxH || parseInt(el.style.height, 10) || el.offsetHeight;
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
      var maxH = sheet._soMaxH || sheet.offsetHeight;
      sheet._drag = { y: e.clientY, base: sheet._soReveal || maxH, maxH: maxH };
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
      var r = sheet._soReveal || d.maxH;
      if (r < d.maxH * 0.78) onClose();
      else setReveal(sheet, d.maxH, d.maxH, true);
    }
    grab.addEventListener("pointerup", end);
    grab.addEventListener("pointercancel", end);
  }

  function closeFriendsAnim() {
    var sheet = document.querySelector("#gl-so-portal .dossier-sheet");
    if (!sheet) {
      view = "hub";
      shownFriends = false;
      paint();
      return;
    }
    slideOut(sheet, function () {
      view = "hub";
      shownFriends = false;
      paint();
    });
  }

  function toast(msg) {
    var root = rootEl();
    var t = root.querySelector(":scope > .gl-so-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "gl-so-toast";
      root.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove("is-on"); }, 1800);
  }

  function header(title, sub) {
    return (
      '<div class="gl-head">' +
        '<div class="gl-head-row">' +
          '<h2 class="gl-head-title">' + title +
            (sub ? '<span class="cmb-head-sub">' + sub + "</span>" : "") +
          "</h2>" +
        "</div>" +
        '<div class="gl-rule"></div>' +
      "</div>"
    );
  }

  function backBar(extra) {
    return (
      '<div class="gl-so-float">' +
        (extra || "") +
        '<button type="button" class="gl-so-retour" data-act="back">Retour</button>' +
      "</div>"
    );
  }

  function srcOfAvatar(av) {
    if (!av || !av.cardId) return "";
    if (catalog && catalog.cards) {
      var card = catalog.cards.find(function (c) { return c.id === av.cardId; });
      if (card) return srcOf(card);
    }
    return "https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main/site/cards-fr/" + av.cardId + ".webp";
  }

  function avatarHtmlFor(av, name, cls) {
    var klass = cls || "gl-so-av-sm";
    var style = "";
    if (av) {
      style =
        ' style="--gl-av-x:' + (av.x != null ? av.x : 50) + "%;--gl-av-y:" +
        (av.y != null ? av.y : 16) + "%;--gl-av-s:" + (av.s != null ? av.s : 1.8) + '"';
    }
    var src = srcOfAvatar(av);
    var inner = src
      ? '<img class="gl-av-img" alt="" src="' + src + '">'
      : escapeHtml((name || "?").slice(0, 2).toUpperCase());
    return '<div class="' + klass + (src ? "" : " is-ph") + '"' + style + ">" + inner + "</div>";
  }

  function renderHub() {
    var tradeN = ((session.trades || []).filter(function (t) {
      return t.toId === (session.me && session.me.id);
    }).length);
    return (
      '<div class="gl-so-page is-hub">' +
        header("Social") +
        '<div class="gl-so-hero cmb-hero is-solo" aria-hidden="true"></div>' +
        '<div class="gl-so-hub">' +
          '<div class="gl-so-row">' +
            '<button type="button" class="gl-so-tile" data-act="share">' + ICO.share + "<span>Partage</span></button>" +
            '<button type="button" class="gl-so-tile" data-act="trade">' + ICO.trade + "<span>Échange</span>" +
              (tradeN ? '<em class="gl-so-badge">' + tradeN + "</em>" : "") +
            "</button>" +
          "</div>" +
          '<button type="button" class="gl-so-tile gl-so-friends-btn" data-act="friends">' +
            ICO.friends + "<span>Amis</span>" +
            (session.incoming && session.incoming.length
              ? '<em class="gl-so-badge">' + session.incoming.length + "</em>"
              : "") +
          "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function transferRows(list, incoming) {
    if (!list || !list.length) return "";
    return list.map(function (t) {
      var who = incoming ? (t.fromName || "Pirate") : (t.toName || "Pirate");
      var card = cardById(t.offerCard);
      var name = (card && card.name) || t.offerCard || "Carte";
      var thumb = srcOf(card);
      var extra = incoming
        ? '<button type="button" class="gl-so-ok" data-act="trade-answer" data-tid="' + t.id + '">Répondre</button>' +
          '<button type="button" class="gl-so-ghost" data-act="trade-cancel" data-tid="' + t.id + '">Refuser</button>'
        : '<button type="button" class="gl-so-ghost" data-act="trade-cancel" data-tid="' + t.id + '">Annuler</button>';
      return (
        '<div class="gl-so-xfer">' +
          '<img class="gl-so-xfer-art" alt="" src="' + thumb + '">' +
          '<div><b>' + escapeHtml(who) + "</b><span>" + escapeHtml(name) + "</span></div>" +
          extra +
        "</div>"
      );
    }).join("");
  }

  function renderShare() {
    return (
      '<div class="gl-so-page has-float is-center">' +
        header("Social", "Partage") +
        '<div class="gl-so-stage">' +
          '<div class="gl-so-icon-lg">' + ICO.share + "</div>" +
          '<div class="gl-so-info">' +
            "Tu peux donner des cartes de rareté C, UC ou R à tes nakama." +
            '<div class="gl-so-note">' + ICO.friends + "<span>Une fois par jour, avec la même personne.</span></div>" +
          "</div>" +
          '<button type="button" class="gl-so-cta" data-act="share-go">Partager</button>' +
        "</div>" +
        backBar('<button type="button" class="gl-so-retour is-ghost" data-act="history">Historique</button>') +
      "</div>"
    );
  }

  function renderTrade() {
    var meId = session.me && session.me.id;
    var mine = (session.trades || []).filter(function (t) { return t.fromId === meId; });
    var theirs = (session.trades || []).filter(function (t) { return t.toId === meId; });
    return (
      '<div class="gl-so-page has-float">' +
        header("Social", "Échange") +
        '<div class="gl-so-scroll" style="padding:12px 14px 90px">' +
          '<div class="gl-so-stage" style="padding-top:8px">' +
            '<div class="gl-so-icon-lg">' + ICO.trade + "</div>" +
            '<div class="gl-so-info">' +
              "Propose une de tes cartes contre une carte d’un ami. L’échange se conclut quand les deux pirates acceptent." +
            "</div>" +
            '<button type="button" class="gl-so-cta" data-act="trade-go">Échanger</button>' +
          "</div>" +
          (theirs.length ? '<div class="gl-so-add-title">Demandes reçues</div>' + transferRows(theirs, true) : '<p class="gl-so-empty" style="margin-top:18px">Aucune demande reçue pour le moment.</p>') +
          (mine.length ? '<div class="gl-so-add-title">En attente</div>' + transferRows(mine, false) : "") +
        "</div>" +
        backBar('<button type="button" class="gl-so-retour is-ghost" data-act="history">Historique</button>') +
      "</div>"
    );
  }

  function avatarHtml() {
    var av = session.me && session.me.avatar;
    if (!av && window.GLPortrait && window.GLPortrait.get) av = window.GLPortrait.get();
    if (av && av.cardId) return avatarHtmlFor(av, displayName(), "gl-so-av");
    return avatarHtmlFor(null, displayName(), "gl-so-av");
  }

  function friendRow(f, extra) {
    return (
      '<div class="gl-so-friend">' +
        '<button type="button" class="gl-so-friend-main" data-act="view-friend" data-fid="' + f.id + '">' +
          avatarHtmlFor(f.avatar, f.name) +
          '<div class="gl-so-friend-meta"><b>' + escapeHtml(f.name || "Pirate") + "</b><span>" + prettyId(f.code || f.id) + "</span></div>" +
          '<span class="gl-so-chev" aria-hidden="true">' + ICO.chev + "</span>" +
        "</button>" +
        (extra ? '<div class="gl-so-friend-actions">' + extra + "</div>" : "") +
      "</div>"
    );
  }

  function renderFriends() {
    var h = friendsHeight();
    var inner;
    if (!session.signedIn) {
      inner =
        '<div class="dossier-extra filter-sheet-body gl-so-friends-body" data-scrolllock-allow="true">' +
          '<p class="gl-so-empty" style="padding:24px 12px">Connecte-toi pour obtenir ton ID ami et ajouter des nakama.</p>' +
          '<button type="button" class="gl-so-cta" data-act="go-login">Se connecter / Créer un compte</button>' +
        "</div>";
    } else {
      var incoming = (session.incoming || []).map(function (f) {
        return friendRow(
          f,
          '<div class="gl-so-req-btns">' +
            '<button type="button" class="gl-so-ok" data-act="accept" data-fid="' + f.id + '">Accepter</button>' +
            '<button type="button" class="gl-so-ghost" data-act="decline" data-fid="' + f.id + '">Refuser</button>' +
          "</div>",
        );
      }).join("");
      var outgoing = (session.outgoing || []).map(function (f) {
        return friendRow(f, '<span class="gl-so-wait">En attente</span>');
      }).join("");
      var rows = data.friends.length
        ? data.friends.map(function (f) {
            return friendRow(f, '<button type="button" data-act="unfriend" data-fid="' + f.id + '">Retirer</button>');
          }).join("")
        : '<p class="gl-so-empty">Aucun nakama pour le moment. Ajoute un ami par ID ou QR.</p>';
      var code = session.me && session.me.code ? session.me.code : data.myId;
      var qr = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&color=c9a227&bgcolor=0e141c&data=" +
        encodeURIComponent("GLTCG:" + normId(code));
      inner =
        '<div class="dossier-extra filter-sheet-body gl-so-friends-body" data-scrolllock-allow="true">' +
          '<div class="cmb-prep-card gl-so-friends-id">' +
            '<div class="gl-so-qr" data-act="zoom-qr"><img alt="QR ami" src="' + qr + '"></div>' +
            '<div class="gl-so-friends-meta">' +
              '<div class="gl-so-friends-who">' + avatarHtml() +
                '<p class="gl-so-name">' + escapeHtml(displayName()) + "</p></div>" +
              '<div class="gl-so-idline">ID ami <b>' + prettyId(code) + '</b>' +
                '<button type="button" class="gl-so-copy" data-act="copy-id">' + ICO.copy + "</button></div>" +
              '<p class="gl-so-hint">Ton nakama scanne ce QR via « Scanner un code ».</p>' +
            "</div>" +
          "</div>" +
          '<div class="gl-so-add-title">Ajouter un ami</div>' +
          '<div class="gl-so-add-row">' +
            '<button type="button" class="gl-so-chip" data-act="search-id">' + ICO.search + " Rechercher un ID ami</button>" +
            '<button type="button" class="gl-so-chip" data-act="scan">' + ICO.qr + " Scanner un code</button>" +
          "</div>" +
          '<div class="gl-so-sheet-body">' +
            (incoming ? '<div class="gl-so-add-title">Demandes reçues</div><div class="gl-so-list">' + incoming + "</div>" : "") +
            (outgoing ? '<div class="gl-so-add-title">Demandes envoyées</div><div class="gl-so-list">' + outgoing + "</div>" : "") +
            '<div class="gl-so-add-title">Équipage</div>' +
            '<div class="gl-so-list">' + rows + "</div>" +
          "</div>" +
        "</div>";
    }
    return (
      '<div class="filter-sheet gl-so-friends-sheet" data-act="close-sheet">' +
        '<div class="dossier-sheet filter-panel" data-stop="1" style="height:' + h + 'px">' +
          '<div class="dossier-grab">' +
            '<div class="dossier-handle"><span></span></div>' +
            '<p class="filter-title">Amis</p>' +
            '<div class="gl-rule"></div>' +
          "</div>" +
          inner +
          '<div class="cmb-prep-actions">' +
            '<button type="button" class="cmb-close" data-act="close-sheet" aria-label="Fermer">×</button>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderHistory() {
    var rows = data.history.length
      ? data.history.slice().reverse().map(function (h) {
          return '<div class="gl-so-friend"><b>' + escapeHtml(h.kind === "trade" ? "Échange" : "Partage") + "</b><span>" + escapeHtml(h.label || "") + "</span></div>";
        }).join("")
      : '<p class="gl-so-empty">Aucun mouvement pour le moment.</p>';
    return (
      '<div class="gl-so-page has-float">' +
        header("Social", "Historique") +
        '<div class="gl-so-scroll"><div class="gl-so-list" style="padding:12px 14px">' + rows + "</div></div>" +
        backBar() +
      "</div>"
    );
  }

  function renderPickFriend(kind) {
    var rows = data.friends.length
      ? data.friends.map(function (f) {
          return '<button type="button" class="gl-so-friend" data-act="pick-friend" data-fid="' + f.id + '">' +
            avatarHtmlFor(f.avatar, f.name) +
            '<div class="gl-so-friend-meta"><b>' + escapeHtml(f.name || "Pirate") + "</b><span>" + prettyId(f.code || f.id) + "</span></div></button>";
        }).join("")
      : '<p class="gl-so-empty">Ajoute d’abord un ami.</p>';
    return (
      '<div class="gl-so-page has-float">' +
        header("Social", kind === "trade" ? "Choisir un nakama" : "À qui donner ?") +
        '<div class="gl-so-scroll"><div class="gl-so-list" style="padding:12px 14px">' + rows +
          '<button type="button" class="gl-so-chip" style="margin:12px auto;width:min(280px,100%)" data-act="friends">Gérer les amis</button>' +
        "</div></div>" +
        backBar() +
      "</div>"
    );
  }

  function pickGridHtml() {
    var col = collection();
    var cards = filteredShareable();
    if (!cards.length) {
      return '<p class="gl-so-empty">Aucune carte C / UC / R (hors starters) ne correspond.</p>';
    }
    return cards.slice(0, 240).map(function (c) {
      var on = selectedCard && selectedCard.id === c.id ? " is-on" : "";
      var n = Number(col[c.id]) || 0;
      return '<button type="button" class="gl-so-card' + on + '" data-act="pick-card" data-cid="' + escapeHtml(c.id) + '">' +
        '<img alt="" src="' + srcOf(c) + '" draggable="false">' +
        (n ? '<em class="card-qty">×' + n + "</em>" : "") +
        "</button>";
    }).join("");
  }

  function renderPickCard() {
    var sets = ownedSets();
    var chips = '<button type="button" class="filter-chip' + (!pickSet ? " is-on" : "") + '" data-act="pick-set" data-set="">Tous</button>';
    sets.forEach(function (s) {
      chips += '<button type="button" class="filter-chip' + (pickSet === s ? " is-on" : "") + '" data-act="pick-set" data-set="' + escapeHtml(s) + '">' + escapeHtml(s) + "</button>";
    });
    var sorts = [
      ["set", "Booster"],
      ["name", "Nom"],
      ["rarity", "Rareté"],
      ["qty", "Exemplaires"],
    ];
    var sortBtns = sorts.map(function (p) {
      return '<button type="button" class="filter-chip' + (pickSort === p[0] ? " is-on" : "") + '" data-act="pick-sort" data-sort="' + p[0] + '">' + p[1] + "</button>";
    }).join("");
    var label = selectedCard ? (selectedCard.name || selectedCard.id) : "";
    var cta = pickMode === "trade" || tradeReplyId ? "Proposer" : "Envoyer";
    return (
      '<div class="gl-so-page has-float">' +
        header("Social", "Choisir une carte") +
        '<div class="gl-so-pick-tools">' +
          '<div class="filter-search">' + ICO.search +
            '<input id="gl-so-pick-q" type="search" placeholder="Rechercher une carte…" autocomplete="off" value="' + escapeHtml(pickQuery) + '">' +
          "</div>" +
          '<div class="gl-so-sets">' + chips + "</div>" +
          '<div class="gl-so-sorts">' + sortBtns + "</div>" +
        "</div>" +
        (selectedCard ? '<p class="gl-so-pick-name">' + escapeHtml(label) + " · ×" + (Number(collection()[selectedCard.id]) || 1) + "</p>" : '<p class="gl-so-pick-name is-muted">Hors starters · C / UC / R</p>') +
        '<div class="gl-so-scroll"><div class="gl-so-grid">' + pickGridHtml() + "</div></div>" +
        '<div class="gl-so-float">' +
          '<button type="button" class="gl-so-retour is-ghost" data-act="back">Retour</button>' +
          (selectedCard
            ? '<button type="button" class="gl-so-retour" data-act="confirm-send">' + cta + "</button>"
            : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderDlg() {
    if (view !== "search") return "";
    return (
      '<div class="gl-so-dlg" data-act="close-dlg">' +
        '<div class="gl-so-box" data-stop="1">' +
          "<h3>Rechercher un ID ami</h3>" +
          '<input id="gl-so-id-in" type="text" inputmode="numeric" maxlength="19" placeholder="Saisir un ID ami" autocomplete="off" autocapitalize="off">' +
          "<p>Saisis le numéro (avec ou sans tirets).</p>" +
          '<div class="gl-so-dlg-btns">' +
            '<button type="button" class="gl-so-ghost" data-act="close-dlg">Annuler</button>' +
            '<button type="button" class="gl-so-ok" data-act="ok-id">OK</button>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function renderScan() {
    if (view !== "scan") return "";
    return (
      '<div class="gl-so-scan">' +
        "<h3>Scanner un code-barres 2D</h3>" +
        '<div class="gl-so-view"><video id="gl-so-cam" playsinline autoplay muted></video></div>' +
        '<div class="gl-so-scan-manual">' +
          '<input id="gl-so-scan-id" type="text" inputmode="numeric" maxlength="19" placeholder="Ou saisis l’ID ami" autocomplete="off">' +
          '<button type="button" class="gl-so-ok" data-act="ok-scan-id">Valider l’ID</button>' +
        "</div>" +
        '<div class="gl-so-float">' +
          '<button type="button" class="gl-so-retour is-ghost" data-act="scan-file">Image sauvegardée</button>' +
          '<button type="button" class="gl-so-retour" data-act="close-scan">Retour</button>' +
        "</div>" +
        '<input id="gl-so-file" type="file" accept="image/*" hidden>' +
      "</div>"
    );
  }

  function escapeHtml(s) {
    var map = {"&": "&amp;", "<": "&lt;", ">": "&gt;"};
    map['"'] = "&quot;";
    map["'"] = "&#39;";
    return String(s).replace(/[&<>"']/g, function (ch) { return map[ch]; });
  }

  function renderFriendProfile() {
    var p = viewedProfile;
    if (!p) {
      return (
        '<div class="gl-so-page has-float">' + header("Social", "Profil") +
        '<div class="gl-so-scroll"><p class="gl-so-empty">Chargement du profil…</p></div>' +
        backBar() +
        "</div>"
      );
    }
    var slots = "";
    for (var i = 0; i < 3; i++) {
      var id = (p.favs || [])[i];
      var card = id && ((catalog && catalog.cards) || []).find(function (c) { return c.id === id; });
      slots += card
        ? '<div class="gl-so-fav"><img alt="' + escapeHtml(card.name || "") + '" src="' + srcOf(card) + '"></div>'
        : '<div class="gl-so-fav is-empty"></div>';
    }
    var ownedLabel = (p.owned || 0).toLocaleString("fr-FR");
    return (
      '<div class="gl-so-page has-float">' +
        header("Social", "Profil") +
        '<div class="gl-so-scroll gl-so-profile">' +
          avatarHtmlFor(p.avatar, p.name, "gl-so-av gl-so-av-lg") +
          '<p class="gl-so-name">' + escapeHtml(p.name || "Pirate") + "</p>" +
          (p.motto ? '<p class="gl-so-motto">« ' + escapeHtml(p.motto) + " »</p>" : "") +
          '<p class="gl-so-idline">ID ami <b>' + prettyId(p.code) + "</b></p>" +
          '<div class="gl-so-stats">' +
            "<div><b>" + (p.wins || 0) + "</b><span>Victoires</span></div>" +
            "<div><b>" + (p.losses || 0) + "</b><span>Défaites</span></div>" +
            "<div><b>" + ownedLabel + "</b><span>Cartes</span></div>" +
            "<div><b>" + (p.opened || 0) + "</b><span>Boosters</span></div>" +
          "</div>" +
          '<div class="gl-so-add-title">Sélection personnelle</div>' +
          '<div class="gl-so-favs">' + slots + "</div>" +
        "</div>" +
        backBar() +
      "</div>"
    );
  }

  function tradeBadgeCount() {
    var meId = session.me && session.me.id;
    return ((session.trades || []).filter(function (t) { return t.toId === meId; }).length);
  }

  function setTileBadge(btn, n) {
    if (!btn) return;
    var em = btn.querySelector(":scope > .gl-so-badge");
    n = Number(n) || 0;
    if (n) {
      if (!em) {
        em = document.createElement("em");
        em.className = "gl-so-badge";
        btn.appendChild(em);
      }
      em.textContent = String(n);
    } else if (em) {
      em.remove();
    }
  }

  function patchHubBadges() {
    var el = rootEl();
    setTileBadge(el.querySelector('[data-act="trade"]'), tradeBadgeCount());
    setTileBadge(el.querySelector('[data-act="friends"]'), (session.incoming || []).length);
    paintDockBadge();
  }

  function paint() {
    var el = mountRoot();
    ensureShell(el);
    ensureHub(el);
    var main = el.querySelector(":scope > .gl-so-main") || el;
    var isHub = view === "hub" || view === "friends" || view === "search" || view === "scan";
    el.classList.toggle("is-showing-hub", isHub);

    if (isHub) {
      if (main.getAttribute("data-view") !== "hub") {
        main.innerHTML = "";
        main.setAttribute("data-view", "hub");
      }
      patchHubBadges();
    } else {
      var page = "";
      if (view === "share") page = renderShare();
      else if (view === "trade") page = renderTrade();
      else if (view === "history") page = renderHistory();
      else if (view === "pick-friend") page = renderPickFriend(pickMode);
      else if (view === "pick-card") page = renderPickCard();
      else if (view === "friend-profile") page = renderFriendProfile();
      else page = "";
      main.innerHTML = page;
      main.setAttribute("data-view", view);
    }

    var overlays = "";
    var wantFriends = view === "friends" || view === "search" || view === "scan";
    if (wantFriends) overlays += renderFriends();
    if (view === "search") overlays += renderDlg();
    if (view === "scan") overlays += renderScan();
    if (confirmOpen) overlays += confirmHtml();
    var portal = portalEl();
    portal.innerHTML = overlays;
    portal.hidden = !overlays;
    var sheet = portal.querySelector(".gl-so-friends-sheet .dossier-sheet");
    if (sheet) {
      if (!shownFriends) slideIn(sheet, friendsHeight());
      else restSheet(sheet);
      bindGrab(sheet, closeFriendsAnim);
    }
    shownFriends = !!sheet;
    document.documentElement.classList.toggle("gl-so-sheet-on", wantFriends);
    if (view === "scan") startScan();
    if (view === "search") {
      var inp = portal.querySelector("#gl-so-id-in");
      if (inp) {
        setTimeout(function () { try { inp.focus(); inp.click(); } catch (e) {} }, 80);
        inp.onkeydown = function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            addFriend(inp.value).then(function (ok) {
              if (ok) { view = "friends"; paint(); }
            });
          }
        };
      }
    }
    if (view === "pick-card") bindPickTools(el);
    var av = portal.querySelector(".gl-so-av") || el.querySelector(".gl-so-av");
    if (av && window.GLPortrait && window.GLPortrait.get) {
      var saved = window.GLPortrait.get();
      if (saved) {
        av.style.setProperty("--gl-av-x", (saved.x != null ? saved.x : 50) + "%");
        av.style.setProperty("--gl-av-y", (saved.y != null ? saved.y : 16) + "%");
        av.style.setProperty("--gl-av-s", String(saved.s != null ? saved.s : 1.8));
      }
    }
  }

  function publishMe() {
    if (!session.signedIn) return;
    var p = {};
    try { p = JSON.parse(localStorage.getItem("gl-profile-v1") || "{}") || {}; } catch (e) {}
    var st = {};
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      st = (raw && (raw.state || raw)) || {};
    } catch (e) {}
    var owned = 0;
    var coll = st.collection || {};
    Object.keys(coll).forEach(function (id) { owned += Number(coll[id]) || 0; });
    fetch("/api/social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "publish",
        name: p.name || displayName(),
        motto: p.motto || "",
        favs: Array.isArray(p.favs) ? p.favs : [],
        wins: st.wins || 0,
        losses: st.losses || 0,
        opened: st.opened || 0,
        owned: owned,
      }),
    }).catch(function () {});
  }

  function openSocial(page) {
    view = page || "hub";
    socialOpen = true;
    try { document.documentElement.classList.add("gl-entered"); } catch (e) {}
    try {
      if (window.GLVersus) {
        var vsClose = window.GLVersus.closeMenu || window.GLVersus.close;
        if (typeof vsClose === "function") vsClose();
      }
    } catch (eVs) {}
    var el = mountRoot();
    ensureShell(el);
    ensureHub(el);
    el.classList.toggle("is-showing-hub", view === "hub" || view === "friends" || view === "search" || view === "scan");
    el.hidden = false;
    document.documentElement.classList.add("gl-social-on");
    markNav(true);
    paint();
    publishMe();
    refreshSocial().then(function () {
      if (!socialOpen) return;
      publishMe();
      if (view === "hub" || view === "friends" || view === "search" || view === "scan") patchHubBadges();
      else paint();
    });
  }
  function closeSocial() {
    socialOpen = false;
    stopScan();
    view = "hub";
    viewedProfile = null;
    shownFriends = false;
    sheetBusy = false;
    var el = document.getElementById("gl-so-root");
    if (el) el.hidden = true;
    var p = document.getElementById("gl-so-portal");
    if (p) { p.innerHTML = ""; p.hidden = true; }
    document.documentElement.classList.remove("gl-social-on", "gl-so-sheet-on");
    markNav(false);
  }

  function markNav(on) {
    document.documentElement.classList.toggle("gl-social-on", !!on);
    try {
      if (window.GLBgm && typeof window.GLBgm.setSocial === "function") window.GLBgm.setSocial(!!on);
      else if (window.GLBgm && window.GLBgm.sync) window.GLBgm.sync();
    } catch (eBgm) {}
  }

  function addFriend(id) {
    if (!session.signedIn) {
      toast("Connecte-toi d’abord");
      return Promise.resolve(false);
    }
    id = normId(id);
    if (id.length !== 16) { toast("ID ami invalide"); return Promise.resolve(false); }
    return fetch("/api/social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: id }),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          toast(j.message || "Impossible d’ajouter cet ami");
          return false;
        }
        toast(j.already ? "Déjà dans l’équipage" : j.accepted ? "Demande acceptée — nakama ajouté" : "Demande d’ami envoyée");
        return refreshSocial().then(function () { return true; });
      });
    }).catch(function () {
      toast("Réseau indisponible");
      return false;
    });
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function sendShare() {
    if (!selectedFriend || !selectedCard) return;
    var have = Number(collection()[selectedCard.id]) || 0;
    if (storeApi && storeApi.getState) {
      have = Number((storeApi.getState().collection || {})[selectedCard.id]) || have;
    }
    if (have < 1) { toast("Tu n’as plus cette carte."); return; }
    var card = selectedCard;
    var friend = selectedFriend;
    mutateCollection(card.id, -1);
    fetch("/api/social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "share", to: friend.id, cardId: card.id }),
    }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        if (!x.r.ok) {
          mutateCollection(card.id, 1);
          toast(x.j.message || "Partage impossible");
          return;
        }
        data.history.push({ kind: "share", label: (card.name || card.id) + " → " + friend.name, at: Date.now() });
        save(data);
        selectedCard = null;
        selectedFriend = null;
        confirmOpen = false;
        view = "share";
        paint();
        playFx({
          kind: "share",
          title: "Partage réussi",
          sub: (card.name || "Carte") + " → " + friend.name,
          img: srcOf(card),
        });
      })
      .catch(function () {
        mutateCollection(card.id, 1);
        toast("Réseau indisponible");
      });
  }

  function sendTrade() {
    if (!selectedCard) return;
    if (tradeReplyId) {
      var haveR = Number(collection()[selectedCard.id]) || 0;
      if (storeApi && storeApi.getState) {
        haveR = Number((storeApi.getState().collection || {})[selectedCard.id]) || haveR;
      }
      if (haveR < 1) { toast("Tu n’as plus cette carte."); return; }
      var cardR = selectedCard;
      var offer = pendingOffer;
      mutateCollection(cardR.id, -1);
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "trade-reply", id: tradeReplyId, cardId: cardR.id }),
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          if (!x.r.ok) {
            mutateCollection(cardR.id, 1);
            toast(x.j.message || "Échange impossible");
            return;
          }
          toast("Échange conclu");
          tradeReplyId = "";
          pendingOffer = null;
          selectedCard = null;
          selectedFriend = null;
          confirmOpen = false;
          view = "trade";
          refreshSocial().then(paint);
          playFx({
            kind: "trade",
            title: "Échange conclu",
            sub: (cardR.name || "Ta carte") + (offer ? " ⇄ " + (offer.name || "") : ""),
            img: srcOf(cardR),
          });
        })
        .catch(function () {
          mutateCollection(cardR.id, 1);
          toast("Réseau indisponible");
        });
      return;
    }
    if (!selectedFriend) return;
    var n = Number(collection()[selectedCard.id]) || 0;
    if (storeApi && storeApi.getState) {
      n = Number((storeApi.getState().collection || {})[selectedCard.id]) || n;
    }
    if (n < 1) { toast("Tu n’as plus cette carte."); return; }
    var cardT = selectedCard;
    var friendT = selectedFriend;
    mutateCollection(cardT.id, -1);
    fetch("/api/social", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "trade", to: friendT.id, cardId: cardT.id }),
    }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        if (!x.r.ok) {
          mutateCollection(cardT.id, 1);
          toast(x.j.message || "Échange impossible");
          return;
        }
        data.history.push({ kind: "trade", label: (cardT.name || cardT.id) + " → " + friendT.name, at: Date.now() });
        save(data);
        selectedCard = null;
        selectedFriend = null;
        confirmOpen = false;
        view = "trade";
        refreshSocial().then(paint);
        playFx({
          kind: "trade",
          title: "Proposition envoyée",
          sub: (cardT.name || "Carte") + " → " + friendT.name,
          img: srcOf(cardT),
        });
      })
      .catch(function () {
        mutateCollection(cardT.id, 1);
        toast("Réseau indisponible");
      });
  }

  function onClick(e) {
    if (sheetBusy) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    var root = document.getElementById("gl-so-root");
    var portal = document.getElementById("gl-so-portal");
    if (root && !root.contains(e.target) && portal && !portal.contains(e.target)) return;
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var stop = e.target.closest("[data-stop]");
    if (stop && !stop.contains(btn)) return;
    var act = btn.getAttribute("data-act");
    if (act === "back") {
      if (view === "pick-card") view = tradeReplyId ? "trade" : "pick-friend";
      else if (view === "pick-friend" || view === "history") view = pickMode || "hub";
      else if (view === "friend-profile") { viewedProfile = null; view = "friends"; }
      else view = "hub";
      paint();
      return;
    }
    if (act === "help") { toast("Partage, échange et amis entre nakama."); return; }
    if (act === "zoom-qr") {
      var img = btn.querySelector("img") || (e.target.tagName === "IMG" ? e.target : null);
      if (img && img.src) showQrZoom(img.src);
      return;
    }
    if (act === "share") { pickMode = "share"; view = "share"; refreshSocial().then(paint); return; }
    if (act === "trade") { pickMode = "trade"; view = "trade"; refreshSocial().then(paint); return; }
    if (act === "friends") {
      view = "friends";
      refreshSocial().then(paint);
      return;
    }
    if (act === "go-login") {
      window.location.href = "/login.html";
      return;
    }
    if (act === "close-sheet") {
      closeFriendsAnim();
      return;
    }
    if (act === "history") { view = "history"; paint(); return; }
    if (act === "copy-id") {
      var code = session.me && session.me.code ? session.me.code : data.myId;
      try { navigator.clipboard.writeText(prettyId(code)); } catch (err) {}
      toast("ID copié");
      return;
    }
    if (act === "search-id") {
      if (!session.signedIn) { toast("Connecte-toi d’abord"); return; }
      view = "search"; paint(); return;
    }
    if (act === "close-dlg") { view = "friends"; paint(); return; }
    if (act === "ok-id" || act === "ok-scan-id") {
      var host = document.getElementById("gl-so-portal") || rootEl();
      var inp = host.querySelector(act === "ok-scan-id" ? "#gl-so-scan-id" : "#gl-so-id-in");
      addFriend(inp && inp.value).then(function (ok) {
        if (ok) { stopScan(); view = "friends"; paint(); }
      });
      return;
    }
    if (act === "scan") {
      if (!session.signedIn) { toast("Connecte-toi d’abord"); return; }
      view = "scan"; paint(); return;
    }
    if (act === "close-scan") { stopScan(); view = "friends"; paint(); return; }
    if (act === "scan-file") {
      var host = document.getElementById("gl-so-portal") || rootEl();
      var file = host.querySelector("#gl-so-file");
      if (file) {
        file.onchange = function () {
          var f = file.files && file.files[0];
          if (!f) return;
          window.GLQr.fromFile(f, function (raw) {
            if (raw) acceptQr(raw);
            else toast("QR illisible");
          });
        };
        file.click();
      }
      return;
    }
    if (act === "unfriend") {
      e.stopPropagation();
      var fid = btn.getAttribute("data-fid");
      fetch("/api/social?id=" + encodeURIComponent(fid), { method: "DELETE", credentials: "include" })
        .then(function () { return refreshSocial(); })
        .then(paint);
      return;
    }
    if (act === "accept" || act === "decline") {
      e.stopPropagation();
      var rid = btn.getAttribute("data-fid");
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: act, id: rid }),
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); })
        .then(function (x) {
          toast(x.j && x.j.accepted ? "Nakama ajouté" : act === "decline" ? "Demande refusée" : (x.j.message || "OK"));
          return refreshSocial();
        })
        .then(paint);
      return;
    }
    if (act === "share-go" || act === "trade-go") {
      pickMode = act === "trade-go" ? "trade" : "share";
      tradeReplyId = "";
      selectedCard = null;
      selectedFriend = null;
      function goPick() {
        if (!session.signedIn) { view = "friends"; paint(); toast("Connecte-toi d’abord"); return; }
        if (!data.friends.length) { view = "friends"; paint(); toast("Ajoute un ami d’abord"); return; }
        view = "pick-friend";
        paint();
      }
      var ready = catalog && catalog.cards
        ? Promise.resolve()
        : (window.GLLoadCatalog
            ? window.GLLoadCatalog()
            : fetch("/data/catalog.json").then(function (r) { return r.json(); })
          ).then(function (d) { catalog = d; });
      Promise.all([refreshSocial(), ready]).then(goPick);
      return;
    }
    if (act === "pick-friend") {
      var id = btn.getAttribute("data-fid");
      selectedFriend = data.friends.find(function (f) { return f.id === id; }) || null;
      view = "pick-card";
      paint();
      return;
    }
    if (act === "view-friend") {
      e.stopPropagation();
      var vid = btn.getAttribute("data-fid");
      var local = findListedFriend(vid);
      viewedProfile = local
        ? {
            id: local.id,
            name: local.name,
            code: local.code,
            avatar: local.avatar,
            motto: local.motto || "",
            favs: local.favs || [],
            wins: local.wins || 0,
            losses: local.losses || 0,
            opened: local.opened || 0,
            owned: local.owned || 0,
          }
        : { id: vid, name: "Pirate", code: "", avatar: null, motto: "", favs: [], wins: 0, losses: 0, opened: 0, owned: 0 };
      view = "friend-profile";
      paint();
      fetch("/api/social?profile=" + encodeURIComponent(vid), { credentials: "include" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.profile) viewedProfile = j.profile;
          else if (j && j.message) toast(j.message);
          paint();
        })
        .catch(function () { paint(); });
      return;
    }
    if (act === "pick-set") {
      pickSet = btn.getAttribute("data-set") || "";
      paint();
      return;
    }
    if (act === "pick-sort") {
      pickSort = btn.getAttribute("data-sort") || "set";
      paint();
      return;
    }
    if (act === "pick-card") {
      var cid = btn.getAttribute("data-cid") || "";
      var cards = ownedShareable();
      selectedCard = cards.find(function (c) { return c.id === cid; }) ||
        (((catalog && catalog.cards) || []).find(function (c) { return c.id === cid; }) || null);
      if (!selectedCard && cid) selectedCard = { id: cid, name: cid, rarity: "C" };
      e.preventDefault();
      e.stopPropagation();
      paint();
      return;
    }
    if (act === "confirm-send") {
      if (!selectedCard) { toast("Choisis une carte."); return; }
      confirmOpen = true;
      paint();
      return;
    }
    if (act === "confirm-no") {
      confirmOpen = false;
      paint();
      return;
    }
    if (act === "confirm-yes") {
      confirmOpen = false;
      if (pickMode === "trade" || tradeReplyId) sendTrade();
      else sendShare();
      paint();
      return;
    }
    if (act === "trade-answer") {
      tradeReplyId = btn.getAttribute("data-tid") || "";
      var tr = (session.trades || []).find(function (t) { return t.id === tradeReplyId; });
      pendingOffer = tr ? cardById(tr.offerCard) : null;
      pickMode = "trade";
      selectedCard = null;
      view = "pick-card";
      paint();
      return;
    }
    if (act === "trade-cancel") {
      var cid = btn.getAttribute("data-tid");
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "trade-cancel", id: cid }),
      }).then(function () { return refreshSocial(); }).then(paint);
      return;
    }
  }

  function stopScan() {
    if (scanStream) {
      scanStream.getTracks().forEach(function (t) { t.stop(); });
      scanStream = null;
    }
  }

  function startScan() {
    var video = document.getElementById("gl-so-cam");
    if (!video) return;
    window.GLQr.load(function () {});
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("Caméra indisponible — saisis l’ID");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (stream) {
      scanStream = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      window.GLQr.loop(video, function () { return view === "scan" && !!scanStream; }, acceptQr);
    }).catch(function () { toast("Caméra refusée — saisis l’ID"); });
  }

  function acceptQr(raw) {
    if (qrBusy) return;
    var m = String(raw || "").match(/(\d{16}|\d{4}-\d{4}-\d{4}-\d{4})/);
    var id = m ? m[1] : "";
    if (String(raw).indexOf("GLTCG:") === 0) id = raw.slice(6);
    if (!id) { toast("QR ami illisible"); return; }
    qrBusy = true;
    stopScan();
    addFriend(id).then(function (ok) {
      qrBusy = false;
      if (ok) { view = "friends"; paint(); }
    });
  }

  function findListedFriend(id) {
    var lists = [session.friends, session.incoming, session.outgoing, data.friends];
    for (var i = 0; i < lists.length; i++) {
      var arr = lists[i] || [];
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && arr[j].id === id) return arr[j];
      }
    }
    return null;
  }

  function bindPickTools(el) {
    var q = el.querySelector("#gl-so-pick-q");
    if (!q) return;
    q.value = pickQuery;
    q.addEventListener("input", function () {
      pickQuery = q.value || "";
      var grid = el.querySelector(".gl-so-grid");
      if (grid) grid.innerHTML = pickGridHtml();
    });
    q.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
  }

  function noticeCount() {
    var n = (session.incoming && session.incoming.length) || 0;
    var meId = session.me && session.me.id;
    (session.trades || []).forEach(function (t) {
      if (t && t.toId === meId) n += 1;
    });
    return n;
  }

  function paintDockBadge() {
    var li = findSocialLi();
    if (!li) return;
    var n = noticeCount();
    var b = li.querySelector(".gl-dock-badge");
    if (!n) {
      if (b) b.remove();
      return;
    }
    if (!b) {
      b = document.createElement("em");
      b.className = "gl-dock-badge";
      li.appendChild(b);
    }
    b.textContent = n > 9 ? "9+" : String(n);
  }

  function findSocialLi() {
    return Array.from(document.querySelectorAll(".app-dock li")).find(function (li) {
      return (li.textContent || "").indexOf("Social") >= 0;
    }) || null;
  }

  function promoteNav() {
    paintDockBadge();
    if (!socialOpen) {
      document.documentElement.classList.remove("gl-social-on", "gl-so-sheet-on");
      var el = document.getElementById("gl-so-root");
      if (el && !el.hidden) el.hidden = true;
    }
  }

  function popSocial() {
    stopScan();
    shownFriends = false;
    sheetBusy = false;
    viewedProfile = null;
    confirmOpen = false;
    pickMode = null;
    selectedCard = null;
    selectedFriend = null;
    tradeReplyId = "";
    try { closeFriendsAnim(); } catch (e) {}
    var p = document.getElementById("gl-so-portal");
    if (p) { p.innerHTML = ""; p.hidden = true; }
    document.documentElement.classList.remove("gl-so-sheet-on");
    view = "hub";
    paint();
    var root = document.getElementById("gl-so-root");
    if (root && root.scrollTo) root.scrollTo({ top: 0, behavior: "smooth" });
    var page = root && root.querySelector(".gl-so-page");
    if (page && page.scrollTo) page.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onDockClick(e) {
    var li = e.target.closest(".app-dock li");
    if (!li) return;
    var label = (li.textContent || "");
    var isSocial = label.indexOf("Social") >= 0;
    if (isSocial) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      if (!socialOpen) openSocial("hub");
      else popSocial();
      return;
    }
    if (socialOpen) {
      var isMenu = !!(li.querySelector('[aria-label="Paramètres"]') || /Menu/.test(label));
      if (!isMenu) closeSocial();
    }
  }

  document.addEventListener("click", onDockClick, true);

  try {
    var _setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      _setItem(k, v);
      if (k === SAVE) {
        setTimeout(function () { promoteNav(); }, 0);
      }
    };
  } catch (e) {}

  (window.GLLoadCatalog
    ? window.GLLoadCatalog()
    : fetch("/data/catalog.json").then(function (r) { return r.json(); })
  ).then(function (d) { catalog = d; }).catch(function () {});

  var obs = new MutationObserver(function () {
    if (navTimer) return;
    navTimer = requestAnimationFrame(function () {
      navTimer = 0;
      paintDockBadge();
    });
  });
  var navTimer = 0;
  function boot() {
    paintDockBadge();
    obs.observe(document.body, { childList: true, subtree: false });
    setInterval(paintDockBadge, 4000);
    refreshSocial();
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
  if (document.body) afterHydrate(boot);
  else document.addEventListener("DOMContentLoaded", function () { afterHydrate(boot); });

  setInterval(function () {
    if (document.hidden) return;
    refreshSocial().then(function () {
      if (!socialOpen || confirmOpen) return;
      if (view === "pick-card" || view === "pick-friend" || view === "scan" || view === "search") return;
      if (view === "hub" || view === "friends") patchHubBadges();
      else if (view === "trade" || view === "share") paint();
    });
  }, 10000);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    refreshSocial().then(function () {
      if (!socialOpen || confirmOpen || view === "pick-card") return;
      if (view === "hub" || view === "friends") patchHubBadges();
      else paint();
    });
  });

  window.GLSocial = {
    open: openSocial,
    close: closeSocial,
    zoomQr: showQrZoom,
    isOpen: function () {
      if (!socialOpen) return false;
      var el = document.getElementById("gl-so-root");
      return !!(el && !el.hidden);
    },
  };
})();
