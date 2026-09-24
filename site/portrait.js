/**
 * Card-portrait picker for Grand Line TCG.
 * Uses owned collection (local save) and the game's navy/gold chrome.
 */
(function () {
  var KEY = "gl-portrait";
  var SAVE = "gl-tcg-save";
  var catalogCache = null;
  var catalogPromise = null;

  function getSaved() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.cardId) {
        if (raw.x == null) raw.x = 50;
        if (raw.y == null) raw.y = 16;
        if (raw.s == null) raw.s = 1.8;
        return raw;
      }
    } catch (e) {}
    return null;
  }

  function setSaved(cardId, name, crop) {
    crop = crop || {};
    var payload = {
      cardId: cardId,
      name: name || "",
      x: crop.x != null ? crop.x : 50,
      y: crop.y != null ? crop.y : 16,
      s: crop.s != null ? crop.s : 1.8,
      at: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {}
    try {
      fetch("/api/auth/update-user", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: "glcard:" + cardId }),
      }).catch(function () {});
      fetch("/api/social", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "avatar",
          cardId: cardId,
          x: payload.x,
          y: payload.y,
          s: payload.s,
        }),
      }).catch(function () {});
    } catch (e) {}
    try {
      if (window.GLCloudSave && typeof window.GLCloudSave.push === "function") window.GLCloudSave.push();
    } catch (e2) {}
    return payload;
  }

  function applyCropVars(el, crop) {
    if (!el) return;
    crop = crop || getSaved() || { x: 50, y: 16, s: 1.8 };
    el.style.setProperty("--gl-av-x", (crop.x != null ? crop.x : 50) + "%");
    el.style.setProperty("--gl-av-y", (crop.y != null ? crop.y : 16) + "%");
    el.style.setProperty("--gl-av-s", String(crop.s != null ? crop.s : 1.8));
  }

  function ownedMap() {
    try {
      var raw = JSON.parse(localStorage.getItem(SAVE) || "{}");
      var coll = (raw.state && raw.state.collection) || raw.collection || {};
      if (coll && typeof coll === "object" && !Array.isArray(coll)) return coll;
    } catch (e) {}
    return {};
  }

  function loadCatalog() {
    if (catalogCache) return Promise.resolve(catalogCache);
    if (catalogPromise) return catalogPromise;
    catalogPromise = (window.GLLoadCatalog
      ? window.GLLoadCatalog()
      : fetch("/data/catalog.json", { cache: "no-store" }).then(function (r) { return r.json(); })
    )
      .then(function (data) {
        catalogCache = data;
        return data;
      })
      .catch(function () {
        catalogPromise = null;
        return { cards: [] };
      });
    return catalogPromise;
  }

  function srcList(card) {
    if (!card) return ["/card-back.png"];
    var id = card.id;
    var base = String(id).replace(/_p\d+$/i, "").replace(/_r\d+$/i, "");
    var list = [];
    if (card.image) list.push(card.image);
    list.push("https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main/site/cards-fr/" + id + ".webp");
    if (base !== id) list.push("https://raw.githubusercontent.com/xwjtd6mtg7-sketch/grand-line-tcg/main/site/cards-fr/" + base + ".webp");
    return list;
  }

  function bindImg(img, card) {
    var srcs = srcList(card);
    var i = 0;
    img.decoding = "async";
    img.loading = "lazy";
    img.alt = card && card.name ? card.name : "";
    img.src = srcs[0];
    img.onerror = function () {
      i += 1;
      if (i < srcs.length) img.src = srcs[i];
      else img.onerror = null;
    };
  }

  function portraitCards(catalog) {
    var owned = ownedMap();
    var ids = Object.keys(owned).filter(function (id) {
      return Number(owned[id]) > 0;
    });
    var byId = {};
    (catalog.cards || []).forEach(function (c) {
      byId[c.id] = c;
    });
    var cards = ids
      .map(function (id) {
        return byId[id];
      })
      .filter(function (c) {
        return c && (c.type === "Leader" || c.type === "Character");
      });
    if (!cards.length) {
      cards = (catalog.cards || []).filter(function (c) {
        return (c.set === "ST-01" || String(c.id).indexOf("ST01-") === 0) &&
          (c.type === "Leader" || c.type === "Character") &&
          !c.parallel;
      });
    }
    cards.sort(function (a, b) {
      if (a.type !== b.type) return a.type === "Leader" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), "fr");
    });
    return cards;
  }

  function applyToAvatars(card) {
    if (!card) return;
    var srcs = srcList(card);
    function paint(src) {
      var url = 'url("' + String(src).replace(/"/g, "") + '")';
      document.querySelectorAll(".side-avatar, .gl-av-target").forEach(function (el) {
        el.dataset.glCard = card.id;
        el.style.setProperty("--gl-av", url);
        var img = el.querySelector(":scope > img.gl-av-img");
        if (!img) {
          img = document.createElement("img");
          img.className = "gl-av-img";
          img.alt = card.name || "";
          img.setAttribute("aria-hidden", "true");
          el.appendChild(img);
        }
        if (img.getAttribute("data-card") !== card.id) {
          img.setAttribute("data-card", card.id);
          bindImg(img, card);
        }
        applyCropVars(el, getSaved());
      });
    }
    paint(srcs[0]);
    if (srcs.length < 2) return;
    var i = 0;
    var probe = new Image();
    probe.onload = function () {
      paint(srcs[i]);
    };
    probe.onerror = function () {
      i += 1;
      if (i < srcs.length) probe.src = srcs[i];
    };
    probe.src = srcs[0];
  }

  function motionMs() {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    } catch (e) {}
    return 400;
  }

  function closeRoot(cb) {
    var root = document.getElementById("gl-portrait");
    if (!root) {
      if (typeof cb === "function") cb();
      return;
    }
    if (root.dataset.closing === "1") return;
    root.dataset.closing = "1";
    var sheet = root.querySelector(".gl-p-sheet");
    if (sheet) {
      sheet.classList.remove("is-drag");
    }
    root.classList.remove("is-in");
    window.setTimeout(function () {
      if (root.parentNode) root.remove();
      if (typeof cb === "function") cb();
    }, motionMs());
  }

  function bindGrab(root, sheet, onDismiss) {
    var grab = sheet.querySelector(".gl-p-grab");
    if (!grab) return;
    var drag = null;
    grab.addEventListener("pointerdown", function (e) {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      grab.setPointerCapture(e.pointerId);
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

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function defaultCrop(saved, cardId) {
    if (saved && saved.cardId === cardId) {
      return {
        x: saved.x != null ? Number(saved.x) : 50,
        y: saved.y != null ? Number(saved.y) : 16,
        s: saved.s != null ? Number(saved.s) : 1.8,
      };
    }
    return { x: 50, y: 16, s: 1.8 };
  }

  function openPicker(opts) {
    opts = opts || {};
    var existing = document.getElementById("gl-portrait");
    if (existing) existing.remove();
    loadCatalog().then(function (catalog) {
      var cards = portraitCards(catalog);
      var saved = getSaved();
      var selected = cards.find(function (c) {
        return saved && c.id === saved.cardId;
      }) || cards[0] || null;

      var root = document.createElement("div");
      root.id = "gl-portrait";
      root.className = "gl-p-root" + (opts.float ? " is-float" : "");
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-labelledby", "gl-p-title");

      var sheet = document.createElement("div");
      sheet.className = "gl-p-sheet";
      sheet.innerHTML =
        '<div class="gl-p-grab">' +
        '  <div class="gl-p-handle" aria-hidden="true"></div>' +
        '  <h2 class="gl-p-head" id="gl-p-title">Ton portrait</h2>' +
        '  <div class="gl-p-rule" aria-hidden="true"></div>' +
        "</div>" +
        '<p class="gl-p-sub">Choisis une carte, puis recadre-la dans la bulle.</p>' +
        '<div class="gl-p-body">' +
        '  <div class="gl-p-stage">' +
        '    <button type="button" class="gl-p-card" id="gl-p-card" tabindex="-1" aria-hidden="true"></button>' +
        '    <div class="gl-p-crop">' +
        '      <div class="gl-p-ring" id="gl-p-ring" role="img" aria-label="Aperçu de l\'avatar, glisse pour recadrer"></div>' +
        '      <label class="gl-p-zoom"><span aria-hidden="true">−</span><input id="gl-p-zoom" type="range" min="120" max="280" step="1" aria-label="Zoom" /><span aria-hidden="true">+</span></label>' +
        '      <p class="gl-p-crop-hint">Glisse · pince pour zoomer</p>' +
        '      <div class="gl-p-meta" id="gl-p-meta"></div>' +
        '    </div>' +
        "  </div>" +
        '  <div class="gl-p-main">' +
        '    <div class="gl-p-tools">' +
        '      <input class="gl-p-search" id="gl-p-q" type="search" placeholder="Chercher un nom ou un code…" autocomplete="off" />' +
        '      <button type="button" class="gl-p-chip is-on" data-type="all">Tous</button>' +
        '      <button type="button" class="gl-p-chip" data-type="Leader">Leaders</button>' +
        '      <button type="button" class="gl-p-chip" data-type="Character">Persos</button>' +
        "    </div>" +
        '    <div class="gl-p-grid" id="gl-p-grid"></div>' +
        "  </div>" +
        "</div>" +
        '<div class="gl-p-actions">' +
        '  <button type="button" class="gl-p-go" id="gl-p-go">Valider le portrait</button>' +
        '  <button type="button" class="gl-p-skip" id="gl-p-skip">' +
        (opts.required ? "Continuer sans portrait" : "Annuler") +
        "</button>" +
        "</div>";

      root.appendChild(sheet);
      sheet.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      document.body.appendChild(root);
      window.setTimeout(function () {
        root.classList.add("is-in");
      }, 24);

      var typeFilter = "all";
      var query = "";
      var crop = defaultCrop(saved, selected && selected.id);

      function paintCrop() {
        var ring = document.getElementById("gl-p-ring");
        if (!ring) return;
        ring.style.setProperty("--gl-av-x", crop.x + "%");
        ring.style.setProperty("--gl-av-y", crop.y + "%");
        ring.style.setProperty("--gl-av-s", String(crop.s));
        var zoom = document.getElementById("gl-p-zoom");
        if (zoom && document.activeElement !== zoom) zoom.value = String(Math.round(crop.s * 100));
      }

      function bindLiveCrop(ring) {
        if (!ring || ring.dataset.cropBound === "1") return;
        ring.dataset.cropBound = "1";
        var pts = {};
        var pan = null;
        var pinch = null;

        function count() {
          return Object.keys(pts).length;
        }

        ring.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          try { ring.setPointerCapture(e.pointerId); } catch (err) {}
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          ring.classList.add("is-drag");
          var ids = Object.keys(pts);
          if (ids.length === 2) {
            var a = pts[ids[0]];
            var b = pts[ids[1]];
            pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), s: crop.s };
            pan = null;
          } else {
            pinch = null;
            pan = { x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y };
          }
        });
        ring.addEventListener("pointermove", function (e) {
          if (!pts[e.pointerId]) return;
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          var ids = Object.keys(pts);
          if (pinch && ids.length === 2) {
            var a = pts[ids[0]];
            var b = pts[ids[1]];
            var dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
            crop.s = clamp(pinch.s * (dist / pinch.dist), 1.2, 2.8);
            paintCrop();
            return;
          }
          if (!pan) return;
          var rect = ring.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          crop.x = clamp(pan.ox + ((e.clientX - pan.x) / rect.width) * 100, 0, 100);
          crop.y = clamp(pan.oy + ((e.clientY - pan.y) / rect.height) * 100, 0, 100);
          paintCrop();
        });
        function endPtr(e) {
          delete pts[e.pointerId];
          if (!count()) {
            pan = null;
            pinch = null;
            ring.classList.remove("is-drag");
          } else if (count() === 1) {
            pinch = null;
            var id = Object.keys(pts)[0];
            pan = { x: pts[id].x, y: pts[id].y, ox: crop.x, oy: crop.y };
          }
        }
        ring.addEventListener("pointerup", endPtr);
        ring.addEventListener("pointercancel", endPtr);
        ring.addEventListener("dblclick", function (e) {
          e.preventDefault();
          crop = { x: 50, y: 16, s: 1.8 };
          paintCrop();
        });
        ring.addEventListener("wheel", function (e) {
          e.preventDefault();
          crop.s = clamp(crop.s + (e.deltaY < 0 ? 0.06 : -0.06), 1.2, 2.8);
          paintCrop();
        }, { passive: false });

        var zoom = document.getElementById("gl-p-zoom");
        if (zoom) {
          zoom.value = String(Math.round(crop.s * 100));
          zoom.oninput = function () {
            crop.s = clamp(Number(zoom.value) / 100, 1.2, 2.8);
            paintCrop();
          };
        }
      }

      function paintPreview(card) {
        selected = card;
        var cardBtn = document.getElementById("gl-p-card");
        var ring = document.getElementById("gl-p-ring");
        var meta = document.getElementById("gl-p-meta");
        var go = document.getElementById("gl-p-go");
        cardBtn.innerHTML = "";
        ring.innerHTML = "";
        if (!card) {
          meta.textContent = "Aucune carte";
          go.disabled = true;
          return;
        }
        go.disabled = false;
        var full = document.createElement("img");
        bindImg(full, card);
        cardBtn.appendChild(full);
        var face = document.createElement("img");
        face.className = "gl-av-img";
        face.draggable = false;
        bindImg(face, card);
        ring.appendChild(face);
        meta.textContent = card.name;
        bindLiveCrop(ring);
        paintCrop();
      }

      function paintGrid() {
        var grid = document.getElementById("gl-p-grid");
        var q = query.trim().toLowerCase();
        var list = cards.filter(function (c) {
          if (typeFilter !== "all" && c.type !== typeFilter) return false;
          if (!q) return true;
          return (
            String(c.name).toLowerCase().indexOf(q) >= 0 ||
            String(c.id).toLowerCase().indexOf(q) >= 0
          );
        });
        grid.innerHTML = "";
        if (!list.length) {
          var empty = document.createElement("p");
          empty.className = "gl-p-empty";
          empty.textContent = cards.length
            ? "Aucun résultat dans ta collection."
            : "Ta collection est vide. Ouvre le starter Straw Hat, puis reviens choisir un portrait.";
          grid.appendChild(empty);
          return;
        }
        var frag = document.createDocumentFragment();
        list.slice(0, 120).forEach(function (c) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "gl-p-tile" + (selected && selected.id === c.id ? " is-on" : "");
          btn.setAttribute("aria-label", c.name);
          var img = document.createElement("img");
          bindImg(img, c);
          btn.appendChild(img);
          btn.onclick = function () {
            selected = c;
            crop = defaultCrop(getSaved(), c.id);
            paintPreview(c);
            grid.querySelectorAll(".gl-p-tile").forEach(function (el) {
              el.classList.toggle("is-on", el === btn);
            });
          };
          frag.appendChild(btn);
        });
        grid.appendChild(frag);
      }

      paintPreview(selected);
      paintGrid();

      sheet.querySelectorAll(".gl-p-chip").forEach(function (chip) {
        chip.onclick = function () {
          typeFilter = chip.getAttribute("data-type") || "all";
          sheet.querySelectorAll(".gl-p-chip").forEach(function (el) {
            el.classList.toggle("is-on", el === chip);
          });
          paintGrid();
        };
      });

      document.getElementById("gl-p-q").oninput = function (e) {
        query = e.target.value || "";
        paintGrid();
      };

      function dismiss(kind, payload) {
        closeRoot(function () {
          if (kind === "done" && typeof opts.onDone === "function") opts.onDone(payload);
          else if (kind === "skip") {
            if (typeof opts.onSkip === "function") opts.onSkip();
            else if (typeof opts.onDone === "function") opts.onDone(null);
          }
        });
      }

      bindGrab(root, sheet, function () {
        dismiss("skip");
      });

      document.getElementById("gl-p-go").onclick = function () {
        if (!selected) return;
        var payload = setSaved(selected.id, selected.name, crop);
        applyToAvatars(selected);
        document.querySelectorAll(".gl-av-target, .side-avatar").forEach(function (el) {
          applyCropVars(el, payload);
        });
        dismiss("done", selected);
      };

      document.getElementById("gl-p-skip").onclick = function () {
        dismiss("skip");
      };

      root.addEventListener("click", function (e) {
        if (e.target === root) {
          if (opts.required) return;
          dismiss("skip");
        }
      });

      document.addEventListener("keydown", function onKey(e) {
        if (e.key !== "Escape") return;
        if (!document.getElementById("gl-portrait")) {
          document.removeEventListener("keydown", onKey);
          return;
        }
        if (opts.required) return;
        document.removeEventListener("keydown", onKey);
        dismiss("skip");
      });
    });
  }

  function hydrateFromSave(catalog) {
    var saved = getSaved();
    if (!saved || !catalog) return;
    var card = (catalog.cards || []).find(function (c) {
      return c.id === saved.cardId;
    });
    if (card) applyToAvatars(card);
  }

  function watchMenu() {
    var obs = new MutationObserver(function () {
      var profile = document.querySelector(".side-profile");
      if (!profile) return;
      if (!profile.dataset.glBound) {
        profile.dataset.glBound = "1";
        profile.setAttribute("role", "button");
        profile.setAttribute("tabindex", "0");
        profile.title = "Profil";
        profile.addEventListener("click", function (e) {
          e.stopPropagation();
          if (window.GLProfile) window.GLProfile.open();
          else openPicker();
        });
        profile.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (window.GLProfile) window.GLProfile.open();
            else openPicker();
          }
        });
      }
      var saved = getSaved();
      if (saved && catalogCache) {
        var av = document.querySelector(".side-avatar");
        if (av && (av.dataset.glCard !== saved.cardId || !av.querySelector("img.gl-av-img"))) {
          hydrateFromSave(catalogCache);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function ensureCss() {
    var link = document.getElementById("gl-portrait-css");
    if (!link) {
      link = document.createElement("link");
      link.id = "gl-portrait-css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = "/portrait.css?v=34";
  }

  function boot() {
    ensureCss();
    loadCatalog().then(function (catalog) {
      var saved = getSaved();
      if (!saved) {
        fetch("/api/admin/status", { credentials: "include" })
          .then(function (r) {
            return r.json();
          })
          .then(function (s) {
            var img = s && s.image;
            if (!img) return;
            var id = null;
            if (String(img).indexOf("glcard:") === 0) id = img.slice(7);
            else {
              var m = String(img).match(/\/cards-fr\/([^/.]+)/);
              if (m) id = m[1];
            }
            if (!id) return;
            localStorage.setItem(KEY, JSON.stringify({ cardId: id, at: Date.now() }));
            hydrateFromSave(catalog);
          })
          .catch(function () {});
      } else {
        hydrateFromSave(catalog);
      }
    });
    if (document.body) watchMenu();
    else document.addEventListener("DOMContentLoaded", watchMenu);
  }

  window.GLPortrait = {
    open: openPicker,
    get: getSaved,
    hydrate: function (payload) {
      if (!payload || !payload.cardId) return;
      try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}
      loadCatalog().then(function (catalog) { hydrateFromSave(catalog); });
    },
    apply: function (id) {
      loadCatalog().then(function (catalog) {
        var card = (catalog.cards || []).find(function (c) {
          return c.id === id;
        });
        if (!card) return;
        setSaved(card.id, card.name);
        applyToAvatars(card);
      });
    },
  };

  window.addEventListener("gl-progress-applied", function (ev) {
    var port = ev && ev.detail && ev.detail.portrait;
    if (port && port.cardId) {
      try { localStorage.setItem(KEY, JSON.stringify(port)); } catch (e) {}
    }
    loadCatalog().then(function (catalog) { hydrateFromSave(catalog); });
  });
  window.addEventListener("gl-identity-applied", function () {
    loadCatalog().then(function (catalog) { hydrateFromSave(catalog); });
  });

  boot();
})();
