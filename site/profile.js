/**
 * Player profile — Grand Line TCG (Pocket-style, navy/gold DA).
 */
(function () {
  var KEY = "gl-profile-v1";
  var SAVE = "gl-tcg-save";
  var MOTTOS = [
    "Je serai le Roi des Pirates !",
    "Je ne bats jamais en retraite !",
    "Je combats avec mon équipage !",
    "Donne-moi de la viande !",
    "Je vise le One Piece !",
    "Nakama d'abord, toujours !",
    "Je n'ai pas encore tout donné !",
    "La mer n'attend personne !",
    "Je construis le meilleur deck !",
    "J'ouvre des boosters dès l'aube !",
    "Je cherche des nakama !",
    "Rien ne peut m'arrêter !",
    "En avant, vers Grand Line !",
    "Je suis le plus fort du monde !",
    "Un pirate ne ment jamais !",
    "Le vent tourne en ma faveur !",
    "Je protège mes compagnons !",
    "Aujourd'hui, on prend la mer !",
  ];
  var PEN =
    '<svg class="gl-pf-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var STAT_ICO =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></svg>';
  var CHEV =
    '<svg class="side-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';

  if (!document.getElementById("gl-profile-css")) {
    var link = document.createElement("link");
    link.id = "gl-profile-css";
    link.rel = "stylesheet";
    link.href = "/profile.css?v=19";
    document.head.appendChild(link);
  }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
      return {
        name: String(p.name || "").slice(0, 14),
        motto: MOTTOS.indexOf(p.motto) >= 0 ? p.motto : MOTTOS[0],
        favs: Array.isArray(p.favs) ? p.favs.filter(Boolean).slice(0, 3) : [],
      };
    } catch (e) {
      return { name: "", motto: MOTTOS[0], favs: [] };
    }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    try {
      var st = gameSave();
      var owned = cardCount(st);
      var name = String(p.name || "").trim().slice(0, 14);
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
          owned: owned,
        }),
      }).catch(function () {});
      if (name) {
        fetch("/api/auth/update-user", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name }),
        }).catch(function () {});
      }
    } catch (e) {}
    try {
      if (window.GLCloudSave && typeof window.GLCloudSave.push === "function") window.GLCloudSave.push();
    } catch (e2) {}
  }
  function gameSave() {
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "null");
      return (raw && (raw.state || raw)) || {};
    } catch (e) { return {}; }
  }
  function cardCount(st) {
    var coll = st.collection || {};
    var n = 0;
    Object.keys(coll).forEach(function (id) { n += Number(coll[id]) || 0; });
    return n;
  }
  function displayName() {
    var p = load();
    if (p.name) return p.name;
    return "Pirate";
  }

  var catalog = null;
  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    return (window.GLLoadCatalog
      ? window.GLLoadCatalog()
      : fetch("/data/catalog.json", { cache: "no-store" }).then(function (r) { return r.json(); })
    )
      .then(function (d) { catalog = d; return d; })
      .catch(function () { return { cards: [] }; });
  }
  function cardById(id) {
    if (!catalog || !id) return null;
    return (catalog.cards || []).find(function (c) { return c.id === id; }) || null;
  }
  function srcOf(card) {
    if (!card) return "/card-back.png";
    if (window.GL_cardSrc) {
      var s = card.image || "/cards-fr/" + card.id + ".webp";
      return window.GL_cardSrc(s);
    }
    return card.image || "/card-back.png";
  }
  function ownedCards() {
    var coll = gameSave().collection || {};
    var ids = Object.keys(coll).filter(function (id) { return (Number(coll[id]) || 0) > 0; });
    return (catalog && catalog.cards || []).filter(function (c) { return ids.indexOf(c.id) >= 0; });
  }

  function paintAvatarEl(el) {
    if (!el) return;
    el.classList.add("gl-av-target");
    var saved = window.GLPortrait && window.GLPortrait.get && window.GLPortrait.get();
    var card = saved && catalog ? cardById(saved.cardId) : null;
    var key = (card ? card.id : "") + "|" + displayName() + "|" + (saved ? saved.x + "," + saved.y + "," + saved.s : "");
    if (el.dataset.glPainted === key) return;
    if (!card) {
      if (el.classList.contains("gl-pc-av") && el.querySelector("img")) return;
      if (window.paintPcAccount) try { window.paintPcAccount(); } catch (e) {}
      return;
    }
    el.dataset.glPainted = key;
    el.innerHTML = "";
    var img = document.createElement("img");
    img.className = "gl-av-img";
    img.alt = "";
    img.src = srcOf(card);
    el.appendChild(img);
    el.style.setProperty("--gl-av-x", (saved.x != null ? saved.x : 50) + "%");
    el.style.setProperty("--gl-av-y", (saved.y != null ? saved.y : 18) + "%");
    el.style.setProperty("--gl-av-s", String(saved.s != null ? saved.s : 2.35));
    try { el.style.setProperty("--gl-av", "url(\"" + srcOf(card) + "\")"); } catch (e2) {}
  }

  function inCombat() {
    if (document.querySelector(".fight-fs, .mul-root, .vs-root, .coin-root, .over-root")) return true;
    var intro = document.querySelector(".intro-root");
    return !!(intro && !intro.classList.contains("is-out"));
  }
  function isHome() {
    if (inCombat()) return false;
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    if (path !== "/") return false;
    if (document.getElementById("gl-pf-root")) return false;
    return !!document.querySelector(".home-page");
  }

  function isPc() {
    try {
      return window.matchMedia("(min-width: 1120px) and (hover: hover) and (pointer: fine)").matches;
    } catch (e) {
      return false;
    }
  }

  function injectHomeAv() {
    var homeFab = document.getElementById("gl-home-av");
    var railFab = document.getElementById("gl-rail-av");
    if (isPc()) {
      if (homeFab) homeFab.classList.add("is-hidden");
      if (railFab) railFab.classList.add("is-hidden");
      return;
    }
    if (railFab) railFab.classList.add("is-hidden");
    var row = document.querySelector(".home-page .gl-head-row");
    var fab = homeFab;
    if (!row) {
      if (fab) fab.classList.add("is-hidden");
      return;
    }
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "gl-home-av";
      fab.type = "button";
      fab.className = "gl-home-av gl-av-target";
      fab.setAttribute("aria-label", "Profil");
      fab.addEventListener("click", function (e) {
        e.stopPropagation();
        openProfile();
      });
      row.appendChild(fab);
    } else if (fab.parentNode !== row) {
      row.appendChild(fab);
    }
    var hide = !isHome();
    fab.classList.toggle("is-hidden", hide);
    paintAvatarEl(fab);
  }

  function restyleMenu() {
    var profile = document.querySelector(".side-profile");
    if (!profile) return;
    var nameEl = profile.querySelector(".side-name");
    var nm = displayName();
    if (nameEl && nameEl.textContent !== nm) nameEl.textContent = nm;
    if (!profile.querySelector(".side-chev")) {
      profile.insertAdjacentHTML("beforeend", CHEV);
    }
    if (!profile.dataset.glPf) {
      profile.dataset.glPf = "1";
      profile.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        openProfile();
      }, true);
    }
    var av = profile.querySelector(".side-avatar");
    if (av) {
      av.classList.add("gl-av-target");
      paintAvatarEl(av);
    }
  }

  function closeProfile() {
    var root = document.getElementById("gl-pf-root");
    if (!root) return;
    root.classList.remove("is-in");
    setTimeout(function () { if (root.parentNode) root.remove(); }, 400);
  }

  function openNameDlg(root) {
    var p = load();
    var dlg = document.createElement("div");
    dlg.className = "gl-pf-dlg";
    dlg.innerHTML =
      '<div class="gl-pf-box">' +
        "<h3>Pseudonyme</h3>" +
        '<input id="gl-pf-name" maxlength="14" value="' + (p.name || displayName()).replace(/"/g, "") + '" />' +
        '<p class="gl-pf-hint">14 caractères maximum</p>' +
        '<p class="gl-pf-warn">N\'utilise pas d\'informations personnelles.</p>' +
        '<div class="gl-pf-btns"><button type="button" class="is-ghost" data-x>Annuler</button><button type="button" class="is-ok" data-ok>OK</button></div>' +
      "</div>";
    root.appendChild(dlg);
    var input = dlg.querySelector("input");
    requestAnimationFrame(function () {
      input.focus();
      var len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (e) {}
    });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-x]")) dlg.remove();
      if (e.target.closest("[data-ok]")) {
        var n = input.value.trim().slice(0, 14);
        if (n) {
          p.name = n;
          save(p);
        }
        dlg.remove();
        paintSheet();
        restyleMenu();
      }
    });
  }

  function closePick(pick) {
    if (!pick || pick.dataset.closing === "1") return;
    pick.dataset.closing = "1";
    pick.classList.remove("is-in");
    setTimeout(function () {
      if (pick.parentNode) pick.remove();
    }, 400);
  }

  function bindGrab(sheet, grab, onDismiss) {
    if (!grab) return;
    var drag = null;
    grab.addEventListener("pointerdown", function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      try { grab.setPointerCapture(e.pointerId); } catch (err) {}
      drag = { y: e.clientY, dy: 0 };
      sheet.classList.add("is-drag");
    });
    grab.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dy = Math.max(0, e.clientY - drag.y);
      drag.dy = dy;
      sheet.style.setProperty("--pull", dy + "px");
    });
    function endDrag() {
      if (!drag) return;
      var dy = drag.dy;
      drag = null;
      sheet.classList.remove("is-drag");
      if (dy > 88) onDismiss();
      else sheet.style.setProperty("--pull", "0px");
    }
    grab.addEventListener("pointerup", endDrag);
    grab.addEventListener("pointercancel", endDrag);
  }

  function mountPick(root, pick) {
    var sheet = pick.querySelector(".gl-pf-pick-sheet");
    root.appendChild(pick);
    bindGrab(sheet, pick.querySelector(".gl-pf-grab"), function () {
      closePick(pick);
    });
    requestAnimationFrame(function () { pick.classList.add("is-in"); });
    return sheet;
  }

  function openMotto(root) {
    var p = load();
    var pick = document.createElement("div");
    pick.className = "gl-pf-pick";
    pick.innerHTML =
      '<div class="gl-pf-pick-sheet">' +
        '<div class="gl-pf-grab"><span></span><h3>Message</h3></div>' +
        '<button type="button" class="gl-pf-xbtn" data-xpick aria-label="Fermer">×</button>' +
        '<div class="gl-pf-motto-list">' +
          MOTTOS.map(function (m) {
            return '<button type="button" class="' + (m === p.motto ? "is-on" : "") + '" data-m="' + m.replace(/"/g, "") + '">' + m + "</button>";
          }).join("") +
        "</div>" +
        '<div class="gl-pf-float"><button type="button" class="gl-pf-ok" data-ok>OK</button></div>' +
      "</div>";
    mountPick(root, pick);
    var cur = p.motto;
    pick.addEventListener("click", function (e) {
      e.stopPropagation();
      var b = e.target.closest("[data-m]");
      if (b) {
        cur = b.getAttribute("data-m");
        pick.querySelectorAll("[data-m]").forEach(function (el) {
          el.classList.toggle("is-on", el === b);
        });
      }
      if (e.target.closest("[data-ok]") || e.target.closest("[data-xpick]")) {
        if (e.target.closest("[data-ok]")) {
          p.motto = cur;
          save(p);
          paintSheet();
        }
        closePick(pick);
      } else if (e.target === pick) {
        closePick(pick);
      }
    });
  }

  function openFavs(root, slot) {
    var p = load();
    var cards = ownedCards();
    var pick = document.createElement("div");
    pick.className = "gl-pf-pick";
    pick.innerHTML =
      '<div class="gl-pf-pick-sheet">' +
        '<div class="gl-pf-grab"><span></span><h3>Cartes favorites</h3></div>' +
        '<button type="button" class="gl-pf-xbtn" data-xpick aria-label="Fermer">×</button>' +
        '<div class="gl-pf-grid"></div>' +
        '<div class="gl-pf-float"><button type="button" class="gl-pf-ok" data-ok>OK</button></div>' +
      "</div>";
    var grid = pick.querySelector(".gl-pf-grid");
    cards.slice(0, 160).forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.id = c.id;
      if (p.favs.indexOf(c.id) >= 0) btn.classList.add("is-on");
      var img = document.createElement("img");
      img.src = srcOf(c);
      img.alt = c.name || "";
      btn.appendChild(img);
      grid.appendChild(btn);
    });
    mountPick(root, pick);
    pick.addEventListener("click", function (e) {
      e.stopPropagation();
      var b = e.target.closest("[data-id]");
      if (b) {
        var id = b.getAttribute("data-id");
        var i = p.favs.indexOf(id);
        if (i >= 0) p.favs.splice(i, 1);
        else if (typeof slot === "number") {
          p.favs[slot] = id;
          p.favs = p.favs.filter(Boolean).slice(0, 3);
        } else if (p.favs.length < 3) p.favs.push(id);
        pick.querySelectorAll("[data-id]").forEach(function (el) {
          el.classList.toggle("is-on", p.favs.indexOf(el.getAttribute("data-id")) >= 0);
        });
      }
      if (e.target.closest("[data-ok]") || e.target.closest("[data-xpick]")) {
        if (e.target.closest("[data-ok]")) {
          save(p);
          paintSheet();
        }
        closePick(pick);
      } else if (e.target === pick) {
        closePick(pick);
      }
    });
  }

  function openStats(root) {
    var st = gameSave();
    var pick = document.createElement("div");
    pick.className = "gl-pf-pick";
    pick.innerHTML =
      '<div class="gl-pf-pick-sheet">' +
        '<div class="gl-pf-grab"><span></span><h3>Statistiques</h3></div>' +
        '<button type="button" class="gl-pf-xbtn" data-xpick aria-label="Fermer">×</button>' +
        '<div class="gl-pf-stats">' +
          "<div><b>" + (st.wins || 0) + "</b><span>Victoires</span></div>" +
          "<div><b>" + (st.losses || 0) + "</b><span>Défaites</span></div>" +
          "<div><b>" + (st.opened || 0) + "</b><span>Boosters ouverts</span></div>" +
          "<div><b>" + cardCount(st) + "</b><span>Cartes possédées</span></div>" +
        "</div>" +
        '<div class="gl-pf-float"><button type="button" class="gl-pf-ok" data-ok>OK</button></div>' +
      "</div>";
    mountPick(root, pick);
    pick.addEventListener("click", function (e) {
      e.stopPropagation();
      if (e.target === pick || e.target.closest("[data-ok]") || e.target.closest("[data-xpick]")) closePick(pick);
    });
  }

  function paintSheet() {
    var root = document.getElementById("gl-pf-root");
    if (!root) return;
    var p = load();
    var st = gameSave();
    root.querySelector("[data-name]").textContent = displayName();
    root.querySelector("[data-motto]").textContent = p.motto;
    root.querySelector("[data-count]").textContent = cardCount(st).toLocaleString("fr-FR");
    paintAvatarEl(root.querySelector(".gl-pf-av"));
    var favs = root.querySelector(".gl-pf-favs");
    favs.innerHTML = "";
    for (var i = 0; i < 3; i++) {
      var slot = document.createElement("button");
      slot.type = "button";
      slot.className = "gl-pf-slot";
      slot.dataset.slot = String(i);
      var card = cardById(p.favs[i]);
      if (card) {
        var img = document.createElement("img");
        img.src = srcOf(card);
        img.alt = card.name || "";
        slot.appendChild(img);
        var x = document.createElement("span");
        x.className = "gl-pf-x";
        x.textContent = "×";
        x.dataset.rm = String(i);
        slot.appendChild(x);
      } else {
        slot.classList.add("is-empty");
        slot.textContent = "+";
      }
      favs.appendChild(slot);
    }
  }

  function openProfile() {
    if (document.getElementById("gl-pf-root")) return;
    loadCatalog().then(function () {
      var root = document.createElement("div");
      root.id = "gl-pf-root";
      root.className = "gl-pf-root";
      root.innerHTML =
        '<div class="gl-pf-sheet">' +
          '<button type="button" class="gl-pf-xbtn" data-close aria-label="Fermer">×</button>' +
          '<div class="gl-pf-grab"><span></span></div>' +
          '<div class="gl-pf-scroll">' +
            '<div class="gl-pf-hero">' +
              '<div class="gl-pf-av-wrap"><button type="button" class="gl-pf-av gl-av-target" data-photo></button><span class="gl-pf-edit">' + PEN + "</span></div>" +
              '<button type="button" class="gl-pf-pill" data-edit-name><span data-name></span>' + PEN + "</button>" +
              '<button type="button" class="gl-pf-pill gl-pf-motto" data-edit-motto><span data-motto></span></button>' +
              '<button type="button" class="gl-pf-statbtn" data-stats>' + STAT_ICO + "</button>" +
              '<p class="gl-pf-statcap">Statistiques</p>' +
            "</div>" +
            '<p class="gl-pf-sec">Sélection personnelle</p><div class="gl-pf-rule"></div>' +
            '<div class="gl-pf-favs"></div>' +
            '<p class="gl-pf-sec">Cartes possédées</p><div class="gl-pf-rule"></div>' +
            '<div class="gl-pf-count"><span data-count>0</span></div>' +
          "</div>" +
        "</div>";
      document.body.appendChild(root);
      var sheet = root.querySelector(".gl-pf-sheet");
      bindGrab(sheet, sheet.querySelector(".gl-pf-grab"), closeProfile);
      root.addEventListener("click", function (e) {
        if (e.target === root || e.target.closest("[data-close]")) closeProfile();
        if (e.target.closest("[data-photo]")) {
          if (window.GLPortrait) window.GLPortrait.open({ float: true, onDone: function () { paintSheet(); injectHomeAv(); restyleMenu(); } });
        }
        if (e.target.closest("[data-edit-name]")) openNameDlg(root);
        if (e.target.closest("[data-edit-motto]")) openMotto(root);
        if (e.target.closest("[data-stats]")) openStats(root);
        var rm = e.target.closest("[data-rm]");
        if (rm) {
          e.stopPropagation();
          var p = load();
          p.favs.splice(Number(rm.getAttribute("data-rm")), 1);
          save(p);
          paintSheet();
          return;
        }
        var slot = e.target.closest("[data-slot]");
        if (slot) openFavs(root, Number(slot.getAttribute("data-slot")));
      });
      paintSheet();
      requestAnimationFrame(function () { root.classList.add("is-in"); });
    });
  }

  window.GLProfile = { open: openProfile, close: closeProfile, get: load, paint: function () {
    document.querySelectorAll(".gl-pc-av, .gl-av-target, .side-avatar").forEach(paintAvatarEl);
  } };

  window.addEventListener("gl-progress-applied", function () {
    tick();
    var sheet = document.getElementById("gl-pf-root");
    if (sheet) paintSheet();
  });
  window.addEventListener("gl-identity-applied", function () {
    tick();
    var sheet = document.getElementById("gl-pf-root");
    if (sheet) paintSheet();
  });

  var scheduled = false;
  function tick() {
    scheduled = false;
    injectHomeAv();
    restyleMenu();
  }
  var obs = new MutationObserver(function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(tick);
  });
  function boot() {
    loadCatalog().then(function () {
      tick();
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }
  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
