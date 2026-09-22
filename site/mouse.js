/**
 * PC mouse layer — the compiled game is a touch client (narrow hand hits,
 * drag-only plays, horizontal swipe carousels). On fine pointers we:
 *  - expand hit targets
 *  - click a card then click a zone to play / attach / attack
 *  - map the wheel onto horizontal strips
 *  - show grab / pointer cursors
 *
 * Shop overlay: restore the native CSS scroll-behavior:smooth spin
 * (the compiled .buy-swipe already has it). We only pin scroll at 0
 * until React's instant scrollTo(auto) is done, then assign dest.
 */
(function () {
  setupShopFx();
  setupWheel();
  setupFieldDons();

  function setupShopFx() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var tries = 0;
    var swipeMo = 0;

    function spin() {
      var swipe = document.querySelector(".shop-overlay .buy-swipe");
      if (!swipe) {
        tries = 0;
        return;
      }
      if (swipe.dataset.glSpun) return;
      var on =
        swipe.querySelector(".buy-swipe-item.is-on") ||
        swipe.querySelector(".buy-swipe-item");
      if (!on || !on.offsetWidth || swipe.clientWidth < 40) {
        if (tries++ < 40) requestAnimationFrame(spin);
        return;
      }

      var dest = Math.max(
        0,
        on.offsetLeft - (swipe.clientWidth - on.clientWidth) / 2
      );
      swipe.dataset.glSpun = "1";
      swipe.dataset.glSpinning = "1";
      tries = 0;

      if (reduce || dest < 16) {
        swipe.scrollLeft = dest;
        delete swipe.dataset.glSpinning;
        return;
      }

      swipe.style.scrollSnapType = "none";
      swipe.style.scrollBehavior = "auto";
      swipe.scrollLeft = 0;
      var t0 = performance.now();
      function hold(now) {
        if (!swipe.isConnected) return;
        swipe.scrollLeft = 0;
        if (now - t0 < 80) {
          requestAnimationFrame(hold);
          return;
        }
        on =
          swipe.querySelector(".buy-swipe-item.is-on") ||
          swipe.querySelector(".buy-swipe-item");
        dest = Math.max(
          0,
          on.offsetLeft - (swipe.clientWidth - on.clientWidth) / 2
        );
        swipe.style.scrollBehavior = "smooth";
        swipe.scrollLeft = dest;
        setTimeout(function () {
          swipe.style.scrollBehavior = "";
          swipe.style.scrollSnapType = "";
          delete swipe.dataset.glSpinning;
        }, 700);
      }
      requestAnimationFrame(hold);
    }

    new MutationObserver(function () {
      if (swipeMo) return;
      swipeMo = setTimeout(function () {
        swipeMo = 0;
        var swipe = document.querySelector(".shop-overlay .buy-swipe");
        if (swipe) {
          tries = 0;
          spin();
        }
      }, 80);
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener(
      "click",
      function (e) {
        if (!e.target || !e.target.closest) return;
        if (!e.target.closest(".pack-banner-item, .shop-row")) return;
        tries = 0;
        var swipe = document.querySelector(".shop-overlay .buy-swipe");
        if (swipe) delete swipe.dataset.glSpun;
        setTimeout(spin, 16);
        setTimeout(spin, 80);
        setTimeout(spin, 180);
      },
      true
    );
  }

  function setupWheel() {
    var fine = false;
    try { fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e0) {}
    if (!fine) return;
    document.addEventListener(
      "wheel",
      function (e) {
        if (!e.target || !e.target.closest) return;
        var overlay = e.target.closest(".shop-overlay");
        var swipe = overlay && overlay.querySelector(".buy-swipe");
        if (
          swipe &&
          !e.target.closest(".shop-qty, .shop-bar, .shop-link, .pack-contents-scroll, .chase-mask")
        ) {
          onSwipeWheel(e, swipe);
          return;
        }
        var banner = e.target.closest(".pack-banner");
        var track =
          (banner && banner.querySelector(".pack-banner-track")) ||
          e.target.closest(".pack-banner-track");
        if (track) onBannerWheel(e, track);
      },
      { passive: false, capture: true }
    );
  }

  var mq = window.matchMedia(
    "(min-width: 1120px) and (hover: hover) and (pointer: fine)"
  );
  if (!mq.matches) return;

  document.documentElement.classList.add("gl-mouse");

  var selected = null;
  var drag = null;
  var suppressClick = false;

  function clearSel() {
    document.querySelectorAll(".gl-sel").forEach(function (el) {
      el.classList.remove("gl-sel");
    });
    document.documentElement.classList.remove("gl-has-sel");
    selected = null;
  }

  function selectEl(el) {
    clearSel();
    if (!el) return;
    selected = el;
    el.classList.add("gl-sel");
    document.documentElement.classList.add("gl-has-sel");
  }

  function itemDest(swipe, item) {
    return item.offsetLeft - (swipe.clientWidth - item.clientWidth) / 2;
  }

  function pingSwipe(swipe) {
    if (!swipe || swipe.dataset.glSpinning) return;
    swipe.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      })
    );
    swipe.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      })
    );
  }

  function wheelDelta(e) {
    var d = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    if (e.deltaMode === 2) d *= e.currentTarget ? e.currentTarget.clientWidth : 400;
    return d;
  }

  function onSwipeWheel(e, swipe) {
    if (swipe.dataset.glSpinning) {
      e.preventDefault();
      return;
    }
    var d = wheelDelta(e);
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    if (!swipe._glGest) {
      swipe._glGest = true;
      swipe._glStart = swipe.scrollLeft;
    }
    swipe.style.scrollSnapType = "none";
    swipe.style.scrollBehavior = "auto";
    swipe.scrollLeft += d;
    clearTimeout(swipe._glT);
    swipe._glT = setTimeout(function () {
      endSwipeGesture(swipe);
    }, 70);
  }

  function onBannerWheel(e, track) {
    var d = wheelDelta(e);
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    if (!track._glGest) {
      track._glGest = true;
      track._glStart = track.scrollLeft;
    }
    track.style.scrollSnapType = "none";
    track.style.scrollBehavior = "auto";
    track.scrollLeft += d;
    clearTimeout(track._glT);
    track._glT = setTimeout(function () {
      endBannerGesture(track);
    }, 70);
  }

  function nearestItem(swipe) {
    var items = swipe.querySelectorAll(".buy-swipe-item");
    if (!items.length) return null;
    var mid = swipe.scrollLeft + swipe.clientWidth / 2;
    var best = items[0];
    var bestD = Infinity;
    for (var i = 0; i < items.length; i++) {
      var c = items[i].offsetLeft + items[i].clientWidth / 2;
      var d = Math.abs(c - mid);
      if (d < bestD) {
        bestD = d;
        best = items[i];
      }
    }
    return best;
  }

  function endSwipeGesture(swipe) {
    swipe._glGest = false;
    if (swipe.dataset.glSpinning) return;
    var item = nearestItem(swipe);
    swipe.style.scrollSnapType = "";
    if (item) {
      swipe.style.scrollBehavior = "smooth";
      swipe.scrollLeft = Math.max(0, itemDest(swipe, item));
    }
    setTimeout(function () {
      swipe.style.scrollBehavior = "";
      pingSwipe(swipe);
    }, 160);
  }

  function endBannerGesture(track) {
    var w = track.clientWidth;
    var start = track._glStart || 0;
    var moved = track.scrollLeft - start;
    track._glGest = false;
    track.style.scrollSnapType = "";
    if (w <= 0) return;
    var page = Math.round(start / w);
    if (moved > 40) page += 1;
    else if (moved < -40) page -= 1;
    var max = Math.max(0, Math.round((track.scrollWidth - w) / w));
    page = Math.max(0, Math.min(max, page));
    track.style.scrollBehavior = "smooth";
    track.scrollLeft = page * w;
    setTimeout(function () {
      track.style.scrollBehavior = "";
    }, 280);
  }

  function bindElWheel(el, fn) {
    if (!el || el.dataset.glWheel) return;
    el.dataset.glWheel = "1";
    el.addEventListener("wheel", fn, { passive: false, capture: true });
  }

  function bindSwipeLand(swipe) {
    if (!swipe || swipe.dataset.glLand) return;
    swipe.dataset.glLand = "1";
    var t = 0;
    function land() {
      if (swipe.dataset.glSpinning) return;
      pingSwipe(swipe);
    }
    swipe.addEventListener(
      "scroll",
      function () {
        clearTimeout(t);
        t = setTimeout(land, 120);
      },
      { passive: true }
    );
    swipe.addEventListener("scrollend", function () {
      clearTimeout(t);
      land();
    });
  }

  function goSwipe(swipe, dir) {
    var items = swipe.querySelectorAll(".buy-swipe-item");
    var on = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].classList.contains("is-on")) on = i;
    }
    var next = items[Math.max(0, Math.min(items.length - 1, on + dir))];
    if (!next) return;
    swipe.style.scrollBehavior = "smooth";
    swipe.scrollLeft = Math.max(0, itemDest(swipe, next));
    setTimeout(function () {
      swipe.style.scrollBehavior = "";
      pingSwipe(swipe);
    }, 280);
  }

  function goBanner(track, dir) {
    var page = track.querySelector(".pack-banner-page");
    var step = (page && page.offsetWidth) || track.clientWidth;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  function mountArrows(swipe) {
    var parent = swipe.parentNode;
    if (!parent || parent.querySelector(".gl-swipe-nav")) return;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }
    function btn(cls, dir, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gl-swipe-nav " + cls;
      b.setAttribute("aria-label", label);
      b.textContent = dir < 0 ? "‹" : "›";
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        goSwipe(swipe, dir);
      });
      parent.appendChild(b);
    }
    btn("is-prev", -1, "Booster précédent");
    btn("is-next", 1, "Booster suivant");
  }

  function mountBannerArrows() {
    var banner = document.querySelector(".pack-banner");
    var track = banner && banner.querySelector(".pack-banner-track");
    if (!banner || !track || banner.querySelector(".gl-swipe-nav")) return;
    if (!window.matchMedia("(min-width: 1120px) and (hover: hover) and (pointer: fine)").matches) return;
    function btn(cls, dir, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gl-swipe-nav " + cls;
      b.setAttribute("aria-label", label);
      b.textContent = dir < 0 ? "‹" : "›";
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        goBanner(track, dir);
      });
      banner.appendChild(b);
    }
    btn("is-prev", -1, "Boosters précédents");
    btn("is-next", 1, "Boosters suivants");
  }

  var homeBuyWait = false;

  function clearHomeBuy() {
    homeBuyWait = false;
    var freeze = document.getElementById("gl-home-freeze");
    if (freeze && freeze.parentNode) freeze.parentNode.removeChild(freeze);
    document.documentElement.classList.remove("gl-home-buy");
  }

  function snapshotHome() {
    var home = document.querySelector(".home-page");
    var host = document.querySelector("[data-app-scroll], .tab-host");
    if (!home || !host) return;
    var old = document.getElementById("gl-home-freeze");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var r = host.getBoundingClientRect();
    var wrap = document.createElement("div");
    wrap.id = "gl-home-freeze";
    wrap.className = "gl-home-freeze";
    wrap.style.left = r.left + "px";
    wrap.style.top = r.top + "px";
    wrap.style.width = r.width + "px";
    wrap.style.height = r.height + "px";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
    var clone = home.cloneNode(true);
    clone.querySelectorAll("button, a").forEach(function (el) {
      el.setAttribute("tabindex", "-1");
      el.removeAttribute("href");
    });
    wrap.appendChild(clone);
    document.body.appendChild(wrap);
    document.documentElement.classList.add("gl-home-buy");
    homeBuyWait = true;
  }

  document.addEventListener(
    "click",
    function (e) {
      if (!e.target || !e.target.closest) return;
      if (suppressClick) return;
      if (!e.target.closest(".home-page .pack-banner-item")) return;
      snapshotHome();
    },
    true
  );

  mountBannerArrows();
  function bindCarousels() {
    var swipe = document.querySelector(".shop-overlay .buy-swipe");
    if (swipe) {
      mountArrows(swipe);
      bindSwipeLand(swipe);
      bindElWheel(swipe, function (e) {
        onSwipeWheel(e, swipe);
      });
      var overlay = document.querySelector(".shop-overlay");
      if (overlay)
        bindElWheel(overlay, function (e) {
          if (e.target.closest(".shop-qty, .shop-bar, .shop-link, .pack-contents-scroll, .chase-mask"))
            return;
          onSwipeWheel(e, swipe);
        });
    }
    var banner = document.querySelector(".pack-banner");
    var track = banner && banner.querySelector(".pack-banner-track");
    if (track) {
      mountBannerArrows();
      bindElWheel(track, function (e) {
        onBannerWheel(e, track);
      });
      bindElWheel(banner, function (e) {
        onBannerWheel(e, track);
      });
    }
  }
  bindCarousels();
  var bindMo = 0;
  new MutationObserver(function () {
    if (bindMo) return;
    bindMo = setTimeout(function () {
      bindMo = 0;
      bindCarousels();
      if (document.querySelector(".shop-overlay")) homeBuyWait = false;
      else if (!homeBuyWait) clearHomeBuy();
    }, 80);
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener(
    "pointerdown",
    function (e) {
      if (e.pointerType === "touch") return;
      if (!e.target || !e.target.closest) return;
      if (e.target.closest(".gl-swipe-nav")) return;

      var strip = e.target.closest(".buy-swipe, .pack-banner-track");
      if (strip) {
        var item = e.target.closest(".buy-swipe-item, .pack-banner-item");
        drag = {
          swipe: strip,
          item: item,
          buy: strip.classList.contains("buy-swipe"),
          x: e.clientX,
          sl: strip.scrollLeft,
          moved: false,
          captured: false,
          id: e.pointerId,
        };
        return;
      }

      var drop = e.target.closest("[data-drop]");
      if (drop && selected) {
        e.preventDefault();
        e.stopPropagation();
        dragFromTo(selected, drop);
        clearSel();
        return;
      }

      var card = e.target.closest(
        "[data-hand-i], [data-drag], .hand-hit, .char-well.is-me"
      );
      if (card) {
        var host = card.closest("[data-hand-i], [data-drag]") || card;
        if (selected === host) {
          clearSel();
          return;
        }
        selectEl(host);
        return;
      }

      if (selected && !e.target.closest(".gl-sel")) clearSel();
    },
    true
  );

  document.addEventListener(
    "pointermove",
    function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 24) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.sl = drag.swipe.scrollLeft;
        drag.x = e.clientX;
        drag.swipe.style.scrollBehavior = "auto";
        try {
          drag.swipe.setPointerCapture(drag.id);
          drag.captured = true;
        } catch (err) {}
        dx = 0;
      }
      drag.swipe.scrollLeft = drag.sl - (e.clientX - drag.x);
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "pointerup",
    function () {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (d.captured) {
        try {
          d.swipe.releasePointerCapture(d.id);
        } catch (err) {}
      }
      if (d.moved) {
        suppressClick = true;
        if (d.buy) {
          setTimeout(function () {
            pingSwipe(d.swipe);
          }, 80);
        }
      } else if (d.buy && d.item) {
        d.swipe.scrollLeft = Math.max(0, itemDest(d.swipe, d.item));
      }
      d.swipe.style.scrollBehavior = "";
    },
    true
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      if (e.target && e.target.closest && e.target.closest(".pack-banner-item, .buy-swipe-item")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  function point(el, type, x, y) {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        isPrimary: true,
        buttons: type === "pointerup" ? 0 : 1,
      })
    );
  }

  function dragFromTo(src, dest) {
    var a = src.getBoundingClientRect();
    var b = dest.getBoundingClientRect();
    var x0 = a.left + a.width / 2;
    var y0 = a.top + a.height / 2;
    var x1 = b.left + b.width / 2;
    var y1 = b.top + b.height / 2;
    var hit = src.querySelector(".hand-hit") || src;
    point(hit, "pointerdown", x0, y0);
    point(hit, "pointermove", x1, y1);
    point(dest, "pointermove", x1, y1);
    point(dest, "pointerup", x1, y1);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") clearSel();
    var swipe = document.querySelector(".shop-overlay .buy-swipe");
    if (!swipe) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goSwipe(swipe, -1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goSwipe(swipe, 1);
    }
  });

  function setupFieldDons() {
    var pc = window.matchMedia(
      "(min-width: 1120px) and (hover: hover) and (pointer: fine)"
    );
    var gap = 8;
    var ticking = false;

    function setBox(el, x, y) {
      if (!el) return;
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("left", Math.round(x) + "px", "important");
      el.style.setProperty("top", Math.round(y) + "px", "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
      el.style.setProperty("margin", "0", "important");
      el.style.setProperty("z-index", "12", "important");
    }

    function rowRect(fs, whose) {
      var sel =
        whose === "me"
          ? ".mat-field.is-me .char-well.is-me, .mat-field.is-me .char-hole.is-me, .mat-field.is-me > .mat-cell"
          : ".mat-field.is-opp .char-well.is-opp, .mat-field.is-opp .char-hole.is-opp, .mat-field.is-opp > .mat-cell";
      var el = fs.querySelector(sel);
      return el && el.getClientRects().length ? el.getBoundingClientRect() : null;
    }

    function pinDonStage(don, stage, deck, whose) {
      if (!don) return;
      var deckCard = deck && (deck.querySelector(".pile-card") || deck);
      var deckR =
        deckCard && deckCard.getClientRects().length
          ? deckCard.getBoundingClientRect()
          : null;
      var row = don.closest(".fight-fs") || document.querySelector(".fight-fs");
      var rowR = rowRect(row, whose);
      var pile = don.querySelector(".don-pile") || don;
      don.style.left = "0px";
      don.style.top = "0px";
      var dr = don.getBoundingClientRect();
      var pr = pile.getBoundingClientRect();
      var pileOff = pr.top - dr.top;
      var x = deckR ? deckR.left : 24;
      var y = rowR ? rowR.top - pileOff : 0;
      setBox(don, x, y);

      if (!stage || !stage.getClientRects().length) return;
      var after = don.getBoundingClientRect();
      var pileNow = (don.querySelector(".don-pile") || don).getBoundingClientRect();
      var sw = stage.getBoundingClientRect().width || after.width;
      var sx =
        whose === "me" ? pileNow.right + gap : after.left - gap - sw;
      var sy = rowR ? rowR.top : pileNow.top;
      setBox(stage, sx, sy);
    }

    function pinLife(life, leader, side) {
      if (!life) return;
      if (!leader || !leader.getClientRects().length) return;
      var r = leader.getBoundingClientRect();
      var lr = life.getBoundingClientRect();
      var y = r.top + (r.height - lr.height) / 2;
      var pad = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.25;
      var x = side === "opp" ? window.innerWidth - lr.width - pad : pad;
      setBox(life, x, y);
      life.style.setProperty("z-index", "14", "important");
    }

    function pinOnLife(el, life, topEl, botEl, z) {
      if (!el || !life || !life.getClientRects().length) return;
      function cardBox(node) {
        if (!node) return null;
        var card = node.querySelector(".pile-card, .don-pile") || node;
        return card.getClientRects().length ? card.getBoundingClientRect() : null;
      }
      var lr = life.getBoundingClientRect();
      var w = el.offsetWidth || 70;
      var h = el.offsetHeight || 42;
      var x = lr.left + lr.width / 2 - w / 2;
      var a = cardBox(topEl);
      var b = cardBox(botEl);
      var y =
        a && b ? (a.bottom + b.top) / 2 - h / 2 : lr.bottom + 12;
      setBox(el, x, y);
      if (z) el.style.setProperty("z-index", String(z), "important");
    }

    function place() {
      ticking = false;
      if (!pc.matches) return;
      var fs = document.querySelector(".fight-fs");
      if (!fs) return;
      pinDonStage(
        fs.querySelector('[data-don-stack="me"]'),
        fs.querySelector(".stage-mini.is-me"),
        fs.querySelector('[data-deck="opp"]'),
        "me"
      );
      pinDonStage(
        fs.querySelector('[data-don-stack="opp"]'),
        fs.querySelector(".stage-mini.is-opp:not(.invisible)"),
        fs.querySelector('[data-deck="me"]'),
        "opp"
      );
      pinLife(
        fs.querySelector('[data-life="me"]'),
        fs.querySelector(".leader-well.is-me"),
        "me"
      );
      pinLife(
        fs.querySelector('[data-life="opp"]'),
        fs.querySelector(".leader-well.is-opp"),
        "opp"
      );
      pinOnLife(
        fs.querySelector(".wait-orb"),
        fs.querySelector('[data-life="opp"]'),
        fs.querySelector('[data-don-stack="opp"]'),
        fs.querySelector('[data-deck="me"]'),
        24
      );
      pinOnLife(
        fs.querySelector(".fight-burger"),
        fs.querySelector('[data-life="me"]'),
        fs.querySelector('[data-deck="opp"]'),
        fs.querySelector('[data-don-stack="me"]'),
        40
      );
    }

    function ask() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(place);
    }

    var donMo = 0;
    new MutationObserver(function () {
      if (donMo) return;
      donMo = setTimeout(function () {
        donMo = 0;
        ask();
      }, 50);
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", ask);
    pc.addEventListener("change", ask);
    ask();
  }
})();
