/**
 * Account UI + desktop chrome injected into the live game without touching
 * the compiled React bundle.
 */
(function () {
  window.GLMergeCatalog = function (catalog, overrides) {
    if (!catalog || !Array.isArray(catalog.cards) || !Array.isArray(overrides) || !overrides.length) return catalog;
    var byId = new Map(catalog.cards.map(function (c) { return [c.id, c]; }));
    for (var i = 0; i < overrides.length; i++) {
      var o = overrides[i];
      if (!o || !o.id) continue;
      if (o.action === "delete") byId.delete(o.id);
      else if (o.card && typeof o.card === "object") {
        var prev = byId.get(o.id) || {};
        byId.set(o.id, Object.assign({}, prev, o.card, { id: o.id }));
      }
    }
    catalog.cards = Array.from(byId.values());
    return catalog;
  };
  window.GLLoadCatalog = function () {
    return Promise.all([
      fetch("/data/catalog.json").then(function (r) { return r.json(); }),
      fetch("/api/card-overrides", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    ]).then(function (pair) {
      return window.GLMergeCatalog(pair[0], pair[1]);
    });
  };

  function injectLazyScript(src) {
    if (document.querySelector('script[src^="' + src.split("?")[0] + '"]')) return;
    var s = document.createElement("script");
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  if (!document.getElementById("gl-desktop-css")) {
    var link = document.createElement("link");
    link.id = "gl-desktop-css";
    link.rel = "stylesheet";
    link.href = "/desktop.css?v=pc149";
    link.media = "(min-width: 900px)";
    document.head.appendChild(link);
  } else {
    var desk = document.getElementById("gl-desktop-css");
    desk.href = "/desktop.css?v=pc149";
    if (!desk.media) desk.media = "(min-width: 900px)";
  }

  if (!document.querySelector('script[src^="/music.js"]')) injectLazyScript("/music.js?v=30");
  injectLazyScript("/portrait.js?v=33");
  injectLazyScript("/mouse.js?v=48");
  injectLazyScript("/profile.js?v=27");
  injectLazyScript("/social.js?v=29");
  injectLazyScript("/road.js?v=57");
  injectLazyScript("/versus.js?v=34");
  injectLazyScript("/missions.js?v=11");
  injectLazyScript("/cloud-save.js?v=8");

  function goPath(path) {
    try {
      if (window.GLBgm) {
        if (window.GLBgm.stopIntro) window.GLBgm.stopIntro();
        if (window.GLBgm.unlock) window.GLBgm.unlock();
        if (window.GLBgm.setRoute) window.GLBgm.setRoute(path);
        else if (window.GLBgm.sync) window.GLBgm.sync();
      }
    } catch (e0) {}
    try { if (window.GLSocial && window.GLSocial.close) window.GLSocial.close(); } catch (eS) {}
    try { if (window.GLVersus && window.GLVersus.closeMenu) window.GLVersus.closeMenu(); } catch (eV) {}
    if (window.history && window.history.pushState) {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      location.href = path;
    }
  }
  window.GLGoPath = goPath;

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var intro = t.closest(".intro-root");
    if (intro && intro.classList.contains("is-ready") && !intro.classList.contains("is-out")) {
      return;
    }
    var btn = t.closest("a,button");
    if (btn && btn.classList.contains("coll-hub-tile") && /Decks/i.test((btn.textContent || "").trim())) {
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      goPath("/decks");
    }
  }, true);

  var statusCache = null;
  var statusFetchedAt = 0;
  async function getStatus(fresh) {
    if (!fresh && statusCache && Date.now() - statusFetchedAt < 4000) return statusCache;
    try {
      var r = await fetch("/api/admin/status", { credentials: "include" });
      statusCache = await r.json();
    } catch (err) {
      statusCache = { signedIn: false, isAdmin: false };
    }
    statusFetchedAt = Date.now();
    return statusCache;
  }
  async function signOut() {
    try { await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" }); } catch (err) {}
    window.location.href = "/";
  }

  var ICON_LOGIN =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>';
  var ICON_LOGOUT =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  var ICON_ADMIN =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>';

  function makeRow(label, id, iconSvg) {
    var btn = document.createElement("button");
    btn.type = "button";
    if (id) btn.id = id;
    btn.className = "side-row";
    btn.innerHTML = iconSvg + "<span>" + label + "</span>";
    return btn;
  }

  async function injectMenuRow(foot) {
    if (!foot) return;
    if (document.getElementById("gl-auth-row") || foot.dataset.glAuthBusy === "1") return;
    foot.dataset.glAuthBusy = "1";
    var status;
    try { status = await getStatus(); }
    catch (e) { foot.dataset.glAuthBusy = "0"; return; }
    if (document.getElementById("gl-auth-row")) return;
    if (status.isAdmin && !document.getElementById("gl-admin-row")) {
      var adminRow = makeRow("Administrateur", "gl-admin-row", ICON_ADMIN);
      adminRow.onclick = function () { window.location.href = "/admin.html"; };
      foot.appendChild(adminRow);
    }
    var authRow = makeRow(
      status.signedIn ? "Se déconnecter" : "Connexion",
      "gl-auth-row",
      status.signedIn ? ICON_LOGOUT : ICON_LOGIN
    );
    authRow.onclick = function () {
      if (status.signedIn) void signOut();
      else window.location.href = "/login.html";
    };
    foot.appendChild(authRow);
  }

  function isPc() {
    try {
      return window.matchMedia("(min-width: 1120px) and (hover: hover) and (pointer: fine)").matches;
    } catch (e) { return false; }
  }

  function layoutSidePanel() {
    var root = document.querySelector(".side-root");
    var panel = root && root.querySelector(".side-panel");
    if (!root || !panel || !isPc()) return;
    root.style.setProperty("top", "0px", "important");
    root.style.setProperty("right", "0px", "important");
    root.style.setProperty("bottom", "0px", "important");
    root.style.setProperty("left", "var(--gl-rail, 13.25rem)", "important");
    root.style.setProperty("z-index", "2147483000", "important");
    panel.style.setProperty("top", "1.25rem", "important");
    panel.style.setProperty("right", "0px", "important");
    panel.style.setProperty("bottom", "1.25rem", "important");
    panel.style.setProperty("left", "auto", "important");
    panel.style.setProperty("width", "24.5rem", "important");
    panel.style.setProperty("height", "auto", "important");
    panel.style.setProperty("max-height", "none", "important");
    panel.style.setProperty("overflow", "auto", "important");
    panel.style.setProperty("background", "#070B14", "important");
    panel.style.setProperty("color", "#f4ead4", "important");
    panel.style.setProperty("border-radius", "22px 0 0 22px", "important");
  }

  function restoreMenuDock() {
    document.querySelectorAll(".app-dock [data-gl-extra]").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll(".app-dock > li").forEach(function (li) {
      var t = (li.textContent || "").replace(/\s+/g, " ").trim();
      if (/^Menu/i.test(t)) {
        li.style.removeProperty("display");
        li.setAttribute("data-gl-item", "menu");
      }
    });
    document.documentElement.classList.remove("gl-pc-prefs", "gl-pc-side-ghost");
  }

  function closeSideIfOpen() {
    var side = document.querySelector(".side-root.is-in");
    if (!side) return false;
    side.click();
    setTimeout(syncDock, 40);
    return true;
  }

  function bindMenuToggle() {
    if (document.documentElement.dataset.glMenuBound === "1") return;
    document.documentElement.dataset.glMenuBound = "1";
    document.addEventListener("click", function (e) {
      if (!isPc()) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var li = t.closest(".app-dock li");
      var label = li ? (li.textContent || "").replace(/\s+/g, " ").trim() : "";
      var side = document.querySelector(".side-root.is-in");

      if (/^Social/i.test(label)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        closeSideIfOpen();
        var opened = false;
        try { opened = !!(window.GLSocial && window.GLSocial.isOpen && window.GLSocial.isOpen()); } catch (e0) {}
        if (opened && window.GLSocial.close) window.GLSocial.close();
        else if (window.GLSocial && typeof window.GLSocial.open === "function") window.GLSocial.open();
        setTimeout(syncDock, 40);
        return;
      }

      if (/^Menu/i.test(label)) {
        if (side) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          side.click();
          setTimeout(syncDock, 40);
        }
        return;
      }

      if (!side) return;
      if (t.closest(".side-panel") || t.closest(".pref-sheet")) return;
      if (t.closest(".side-root")) {
        setTimeout(syncDock, 40);
        return;
      }
      side.click();
      setTimeout(syncDock, 40);
    }, true);
  }

  function syncDock() {
    if (!isPc()) {
      document.documentElement.removeAttribute("data-gl-dock");
      return "off";
    }
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var menu = document.querySelector(".side-root.is-in");
    var social = false;
    try { social = !!(window.GLSocial && window.GLSocial.isOpen && window.GLSocial.isOpen()); } catch (e0) {}
    if (!social) {
      var so = document.getElementById("gl-so-root");
      social = document.documentElement.classList.contains("gl-social-on") && !!(so && !so.hidden);
    }
    var playOn = path.indexOf("/play") === 0 || path.indexOf("/versus") === 0;
    var collOn = path.indexOf("/decks") === 0 || path.indexOf("/collection") === 0 || path.indexOf("/cards") === 0;
    var homeOn = !!document.querySelector(".tab-pane.is-on .home-page");
    var vs = !!document.getElementById("gl-vs-root");
    var tab = "home";
    if (menu) tab = "menu";
    else if (social) tab = "social";
    else if (playOn || vs) tab = "combat";
    else if (collOn) tab = "collection";
    else if (homeOn || path === "/") tab = "home";
    document.documentElement.setAttribute("data-gl-dock", tab);
    document.documentElement.classList.toggle("gl-pc-home", tab === "home");
    document.querySelectorAll(".app-dock > li").forEach(function (li) {
      var t = (li.textContent || "").replace(/\s+/g, " ").trim();
      var item = "";
      if (/^Accueil/i.test(t)) item = "home";
      else if (/^Collection/i.test(t)) item = "collection";
      else if (/^Combat/i.test(t)) item = "combat";
      else if (/^Social/i.test(t)) item = "social";
      else if (/^Menu/i.test(t)) item = "menu";
      if (item) li.setAttribute("data-gl-item", item);
    });
    return tab;
  }

  function playerPseudo() {
    try {
      if (window.GLProfile && typeof window.GLProfile.get === "function") {
        var gp = window.GLProfile.get();
        if (gp && gp.name) return String(gp.name).slice(0, 14);
      }
    } catch (e0) {}
    try {
      var p = JSON.parse(localStorage.getItem("gl-profile-v1") || "{}");
      if (p && p.name) return String(p.name).slice(0, 14);
    } catch (e1) {}
    return "Pirate";
  }

  function leaderCardId() {
    try {
      var raw = JSON.parse(localStorage.getItem("gl-tcg-save") || "{}");
      var st = raw.state || raw;
      var decks = st.decks || [];
      var id = st.activeDeckId;
      var d = decks.find(function (x) { return x && x.id === id; }) || decks[0];
      if (d && d.leaderId) return d.leaderId;
    } catch (e) {}
    return "ST01-001";
  }

  function cardSrc(id) {
    var src = "/cards-fr/" + id + ".webp";
    try { if (window.GL_cardSrc) src = window.GL_cardSrc(src); } catch (e) {}
    return src;
  }

  function paintPcAccount() {
    var el = document.querySelector(".gl-pc-account .gl-pc-av");
    if (!el) return;
    el.classList.add("gl-av-target");
    var saved = null;
    try { saved = window.GLPortrait && window.GLPortrait.get && window.GLPortrait.get(); } catch (e0) {}
    if (!saved || !saved.cardId) {
      try { saved = JSON.parse(localStorage.getItem("gl-portrait") || "null"); } catch (e1) { saved = null; }
    }
    var cardId = (saved && saved.cardId) || leaderCardId() || "ST01-001";
    var x = saved && saved.x != null ? saved.x : 50;
    var y = saved && saved.y != null ? saved.y : 18;
    var s = saved && saved.s != null ? saved.s : 2.35;
    var src = cardSrc(cardId);
    el.style.setProperty("--gl-av", "url(\"" + src + "\")");
    el.style.setProperty("--gl-av-x", x + "%");
    el.style.setProperty("--gl-av-y", y + "%");
    el.style.setProperty("--gl-av-s", String(s));
    el.style.backgroundImage = "url(\"" + src + "\")";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "50% 16%";
    el.style.backgroundRepeat = "no-repeat";
    var img = el.querySelector("img.gl-av-img") || el.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.className = "gl-av-img";
      img.alt = "";
      img.draggable = false;
      el.appendChild(img);
    }
    img.style.setProperty("position", "absolute", "important");
    img.style.setProperty("inset", "0", "important");
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("height", "100%", "important");
    img.style.setProperty("object-fit", "cover", "important");
    img.style.setProperty("object-position", "50% 16%", "important");
    img.style.setProperty("transform", "none", "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("max-width", "none", "important");
    img.style.setProperty("opacity", "1", "important");
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.onerror = function () {
      if (img.dataset.glFb === "1") return;
      img.dataset.glFb = "1";
      img.setAttribute("src", "/card-back.png");
      el.style.backgroundImage = "url(\"/card-back.png\")";
    };
    var sm = document.querySelector(".gl-pc-account small");
    if (sm) sm.textContent = playerPseudo();
  }
  window.paintPcAccount = paintPcAccount;

  function layoutRail() {
    if (!isPc()) return;
    var nav = document.querySelector(".app-nav");
    var dock = document.querySelector(".app-dock");
    if (nav) {
      nav.style.removeProperty("padding-top");
      nav.style.removeProperty("padding-bottom");
    }
    if (!dock) return;
    ["height", "flex", "gap", "margin-top"].forEach(function (p) { dock.style.removeProperty(p); });
    dock.querySelectorAll(":scope > li").forEach(function (li) {
      ["height", "min-height", "max-height", "flex", "overflow"].forEach(function (p) { li.style.removeProperty(p); });
      Array.prototype.forEach.call(li.children, function (ch) {
        ["height", "min-height", "max-height", "flex-direction", "align-items", "justify-content", "display"].forEach(function (p) {
          ch.style.removeProperty(p);
        });
      });
    });
  }

  function lockHomeHeader() {
    if (!isPc()) return;
    var home = document.querySelector(".tab-pane.is-on .home-page") || document.querySelector(".home-page");
    if (!home) return;
    var head = home.querySelector(".gl-head");
    if (!head) return;
    head.style.setProperty("padding-top", "0", "important");
    head.style.setProperty("padding-bottom", "0", "important");
    head.style.setProperty("padding-left", "1.55rem", "important");
    head.style.setProperty("padding-right", "1.55rem", "important");
    head.style.setProperty("height", "76px", "important");
    head.style.setProperty("min-height", "76px", "important");
    head.style.setProperty("max-height", "76px", "important");
    head.style.setProperty("display", "flex", "important");
    head.style.setProperty("flex-direction", "row", "important");
    head.style.setProperty("align-items", "center", "important");
    head.style.setProperty("justify-content", "center", "important");
    head.style.setProperty("overflow", "visible", "important");
    var row = head.querySelector(".gl-head-row");
    if (row) {
      row.style.setProperty("padding-top", "0", "important");
      row.style.setProperty("padding-bottom", "0", "important");
      row.style.setProperty("margin-top", "0", "important");
      row.style.setProperty("margin-bottom", "0", "important");
      row.style.setProperty("height", "100%", "important");
      row.style.setProperty("min-height", "0", "important");
      row.style.setProperty("align-items", "center", "important");
    }
    var rule = head.querySelector(".gl-rule");
    if (rule) {
      rule.style.setProperty("display", "none", "important");
      rule.style.setProperty("margin", "0", "important");
      rule.style.setProperty("height", "0", "important");
    }
  }

  function enhancePcHome() {
    var tab = syncDock();
    if (tab === "off") return;
    bindMenuToggle();
    restoreMenuDock();
    layoutRail();
    lockHomeHeader();

    var nav = document.querySelector(".app-nav");
    if (nav && !nav.querySelector(".gl-pc-motto")) {
      var motto = document.createElement("p");
      motto.className = "gl-pc-motto";
      motto.innerHTML = "Plus qu’un jeu,<br>une aventure";
      nav.appendChild(motto);
    }
    var railAv = document.getElementById("gl-rail-av");
    if (railAv && railAv.parentNode) railAv.parentNode.removeChild(railAv);
    var homeAv = document.getElementById("gl-home-av");
    if (homeAv && homeAv.parentNode) homeAv.parentNode.removeChild(homeAv);
    document.querySelectorAll(".home-page .gl-head-row > button.gl-av-target:not(.gl-pc-account)").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    var home = document.querySelector(".tab-pane.is-on .home-page") || document.querySelector(".home-page");
    if (!home) {
      paintPcAccount();
      return;
    }

    var row = home.querySelector(".gl-head-row");
    var brand = home.querySelector(".brand-header") || home.querySelector(".home-brand");
    if (brand) {
      brand.querySelectorAll("img.gl-pc-logo").forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }
    if (row && !row.querySelector(".gl-pc-links")) {
      var links = document.createElement("nav");
      links.className = "gl-pc-links";
      links.setAttribute("aria-hidden", "true");
      links.innerHTML =
        "<span>Cartes</span><span class=\"dot\">·</span>" +
        "<span>Duels</span><span class=\"dot\">·</span>" +
        "<span>Collection</span><span class=\"dot\">·</span>" +
        "<span>Une nouvelle légende</span>";
      var wallet = row.querySelector(".wallet");
      if (wallet) row.insertBefore(links, wallet);
      else row.appendChild(links);
    } else if (row) {
      var old = row.querySelector(".gl-pc-links");
      if (old && old.querySelector("a")) {
        old.innerHTML =
          "<span>Cartes</span><span class=\"dot\">·</span>" +
          "<span>Duels</span><span class=\"dot\">·</span>" +
          "<span>Collection</span><span class=\"dot\">·</span>" +
          "<span>Une nouvelle légende</span>";
      }
    }
    if (row && !row.querySelector(".gl-pc-account")) {
      var acc = document.createElement("button");
      acc.type = "button";
      acc.className = "gl-pc-account";
      acc.innerHTML =
        '<span class="gl-pc-av gl-av-target"></span>' +
        "<div><b>Mon compte</b><small>" + playerPseudo().replace(/</g, "") + "</small></div>";
      acc.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (window.GLProfile && typeof window.GLProfile.open === "function") window.GLProfile.open();
      });
      row.appendChild(acc);
    } else if (row) {
      var sm = row.querySelector(".gl-pc-account small");
      if (sm) sm.textContent = playerPseudo();
    }
    if (row) {
      var right = row.querySelector(".gl-pc-head-right");
      if (!right) {
        right = document.createElement("div");
        right.className = "gl-pc-head-right";
        row.appendChild(right);
      }
      var walletEl = row.querySelector(".wallet");
      var accEl = row.querySelector(".gl-pc-account");
      if (walletEl && walletEl.parentNode !== right) right.appendChild(walletEl);
      if (accEl && accEl.parentNode !== right) right.appendChild(accEl);
    }
    paintPcAccount();

    var berries = home.querySelector(".shop-berries");
    if (berries && !berries.querySelector(".gl-pc-plus")) {
      var plus = document.createElement("span");
      plus.className = "gl-pc-plus";
      plus.setAttribute("role", "button");
      plus.setAttribute("aria-label", "Boutique");
      plus.textContent = "+";
      plus.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (window.GLGoPath) window.GLGoPath("/shop");
        else location.href = "/shop";
      });
      berries.appendChild(plus);
    }

    var shopSub = home.querySelector(".home-tile.is-shop .home-tile-sub");
    if (shopSub && shopSub.textContent.indexOf("Découvre") < 0) {
      shopSub.textContent = "Découvre nos boosters, decks et accessoires officiels.";
    }
    var shop = home.querySelector(".home-tile.is-shop");
    if (shop && !shop.querySelector(".gl-pc-shop-cta")) {
      var cta = document.createElement("span");
      cta.className = "gl-pc-shop-cta";
      cta.textContent = "Accéder à la boutique";
      shop.appendChild(cta);
    }

    var banner = home.querySelector(".pack-banner");
    if (banner && !banner.querySelector(".gl-pc-feat")) {
      var feat = document.createElement("div");
      feat.className = "gl-pc-feat";
      feat.innerHTML =
        "<div><h2>Boosters en vedette</h2>" +
        "<p>Des cartes légendaires pour écrire votre propre histoire.</p></div>" +
        '<a class="gl-pc-feat-cta" href="/shop">Voir toutes les extensions</a>';
      banner.insertBefore(feat, banner.firstChild);
    } else if (banner) {
      var featEl = banner.querySelector(".gl-pc-feat");
      if (featEl && featEl !== banner.firstElementChild) {
        banner.insertBefore(featEl, banner.firstChild);
      }
      if (featEl) {
        var ctaLink = featEl.querySelector("a");
        if (ctaLink) {
          ctaLink.classList.add("gl-pc-feat-cta");
          ctaLink.textContent = (ctaLink.textContent || "").replace(/\s*→\s*$/, "").trim();
        }
      }
    }
    if (banner) {
      banner.querySelectorAll(".pack-banner-item").forEach(function (btn) {
        if (btn.querySelector(".gl-pc-cap")) return;
        var img = btn.querySelector("img");
        var alt = (img && img.alt) || "";
        var id = "";
        var src = (img && img.getAttribute("src")) || "";
        var m = src.match(/\/boosters\/([^./]+)/);
        if (m) id = m[1];
        var cap = document.createElement("span");
        cap.className = "gl-pc-cap";
        cap.innerHTML = "<b>" + (id || "") + "</b>" + (alt ? alt : "");
        btn.appendChild(cap);
      });
      var track = banner.querySelector(".pack-banner-track");
      var pages = banner.querySelectorAll(".pack-banner-page");
      if (track && pages.length && !banner.querySelector(".gl-pc-dots")) {
        var dots = document.createElement("div");
        dots.className = "gl-pc-dots";
        pages.forEach(function (_, i) {
          var d = document.createElement("span");
          if (i === 0) d.className = "is-on";
          dots.appendChild(d);
        });
        banner.appendChild(dots);
        track.addEventListener("scroll", function () {
          var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
          dots.querySelectorAll("span").forEach(function (el, n) {
            el.classList.toggle("is-on", n === i);
          });
        }, { passive: true });
      }
    }

    var free = home.querySelector(".home-tile.is-free");
    var eta = free && free.querySelector(".free-eta");
    var rail = free && free.querySelector(".free-rail");
    if (free && rail && eta && !free.querySelector(".gl-pc-free-row")) {
      var row = document.createElement("div");
      row.className = "gl-pc-free-row";
      rail.parentNode.insertBefore(row, rail);
      row.appendChild(rail);
      row.appendChild(eta);
    }
    if (eta) {
      var raw = (eta.textContent || "").replace(/\s+/g, " ").trim();
      if (raw) eta.setAttribute("data-gl-eta", raw);
      eta.classList.toggle("is-max", /^max$/i.test(raw));
      eta.classList.toggle("is-claim", /r[eé]cup[eé]rer/i.test(raw));
    }

    var duel = home.querySelector(".home-duel");
    if (duel) {
      var rec = duel.querySelector(".home-record");
      if (rec && !duel.querySelector(".gl-pc-stats")) {
        var box = document.createElement("div");
        box.className = "gl-pc-stats";
        var txt = rec.textContent || "";
        var mm = txt.match(/(\d+)\s*V[^\d]*(\d+)\s*D/);
        var w = mm ? mm[1] : "0";
        var l = mm ? mm[2] : "0";
        box.innerHTML =
          '<i class="gl-pc-swords" aria-hidden="true"></i>' +
          "<div><b>" + w + " V</b><span>Victoires</span></div>" +
          "<div><b class='is-loss'>" + l + " D</b><span>Défaites</span></div>" +
          "<div><b>—</b><span>Série actuelle</span></div>";
        var copy = duel.querySelector(".home-duel-copy");
        if (copy) copy.appendChild(box);
        else duel.appendChild(box);
      }
      var statsBox = duel.querySelector(".gl-pc-stats");
      if (statsBox && !statsBox.querySelector(".gl-pc-swords")) {
        var sw = document.createElement("i");
        sw.className = "gl-pc-swords";
        sw.setAttribute("aria-hidden", "true");
        statsBox.insertBefore(sw, statsBox.firstChild);
      }
      if (!duel.querySelector(".gl-pc-quote")) {
        var q = document.createElement("p");
        q.className = "gl-pc-quote";
        q.textContent = "« Chaque duel est un pas de plus vers la légende. »";
        var copy2 = duel.querySelector(".home-duel-copy");
        if (copy2) copy2.appendChild(q);
        else duel.appendChild(q);
      }
    }
  }

  var sideRaf = 0;
  function tickSide() {
    sideRaf = 0;
    layoutSidePanel();
    if (document.querySelector(".side-root")) sideRaf = requestAnimationFrame(tickSide);
  }

  function watchAll() {
    var scheduled = false;
    var obs = new MutationObserver(function () {
      document.querySelectorAll("#gl-auth-row").forEach(function (el, i) { if (i > 0) el.remove(); });
      document.querySelectorAll("#gl-admin-row").forEach(function (el, i) { if (i > 0) el.remove(); });
      var foot = document.querySelector(".side-foot") || document.querySelector(".side-list");
      if (foot) void injectMenuRow(foot);
      if (document.querySelector(".side-root") && !sideRaf) sideRaf = requestAnimationFrame(tickSide);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(function () {
          scheduled = false;
          layoutSidePanel();
          enhancePcHome();
        });
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    layoutSidePanel();
    enhancePcHome();
    setInterval(enhancePcHome, 1200);
  }

  if (document.body) watchAll();
  else document.addEventListener("DOMContentLoaded", watchAll);
})();
