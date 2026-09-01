/**
 * Account UI injected into the live game without touching the compiled React
 * bundle: everything here is plain DOM appended to <body> (or into the game's
 * own menu panel once it opens), outside React's root, so it can never
 * conflict with the bundle's own rendering.
 *
 * - A one-time welcome overlay shown right after the intro splash closes, if
 *   the visitor isn't signed in yet (dismissible, never blocks play).
 * - A "Connexion" / "Se déconnecter" row injected into the hamburger menu
 *   (the ☰ side panel), replacing the old floating chip.
 * - The desktop/wide-viewport stylesheet, added at runtime (not in the SSR'd
 *   <head>) so React's own stylesheet management never fights over it.
 */
(function () {
  if (!document.getElementById("gl-desktop-css")) {
    var link = document.createElement("link");
    link.id = "gl-desktop-css";
    link.rel = "stylesheet";
    link.href = "/desktop.css";
    document.head.appendChild(link);
  }

  var WELCOME_SEEN_KEY = "gl-welcome-seen";
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
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
    } catch (err) {
      /* ignore — reload either way so the session state re-syncs */
    }
    window.location.href = "/";
  }

  // ---- Welcome overlay (once, only when signed out) ------------------------

  function showWelcomeOverlay() {
    if (document.getElementById("gl-welcome")) return;
    var root = document.createElement("div");
    root.id = "gl-welcome";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:1.2rem",
      "background:#05070ccc",
      "font-family:Figtree,ui-sans-serif,system-ui,sans-serif",
    ].join(";");

    var card = document.createElement("div");
    card.style.cssText = [
      "width:100%",
      "max-width:360px",
      "border:1px solid #f3eee438",
      "border-radius:26px",
      "padding:1.6rem 1.3rem",
      "background:linear-gradient(#1a2130,#121820)",
      "box-shadow:0 18px 40px #0007",
      "text-align:center",
      "color:#f3eee4",
    ].join(";");
    card.innerHTML =
      '<h2 style="font-family:Cinzel,serif;font-size:1.15rem;letter-spacing:.05em;margin:0 0 .6rem;color:#c9a227">BIENVENUE</h2>' +
      '<p style="margin:0 0 1.2rem;font-size:.86rem;color:#9aa3b2;line-height:1.5">Crée un compte pour sauvegarder ta progression, ou continue en tant qu\u2019invité.</p>';

    var signInBtn = document.createElement("button");
    signInBtn.type = "button";
    signInBtn.textContent = "Se connecter / Créer un compte";
    signInBtn.style.cssText =
      "width:100%;height:2.9rem;border:0;border-radius:12px;background:#c9a227;color:#0a101c;font:700 .9rem inherit;cursor:pointer;margin-bottom:.6rem";
    signInBtn.onclick = function () {
      localStorage.setItem(WELCOME_SEEN_KEY, "1");
      window.location.href = "/login.html";
    };

    var skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.textContent = "Continuer sans compte";
    skipBtn.style.cssText =
      "width:100%;height:2.6rem;border:1px solid #f3eee438;border-radius:12px;background:none;color:#9aa3b2;font:600 .85rem inherit;cursor:pointer";
    skipBtn.onclick = function () {
      localStorage.setItem(WELCOME_SEEN_KEY, "1");
      root.remove();
    };

    card.appendChild(signInBtn);
    card.appendChild(skipBtn);
    root.appendChild(card);
    document.body.appendChild(root);
  }

  function watchIntroDismissed(cb) {
    var check = function () {
      if (!document.querySelector(".intro-root")) {
        cb();
        return true;
      }
      return false;
    };
    if (check()) return;
    var obs = new MutationObserver(function () {
      if (check()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  watchIntroDismissed(async function () {
    if (localStorage.getItem(WELCOME_SEEN_KEY)) return;
    var status = await getStatus(true);
    if (!status.signedIn) showWelcomeOverlay();
  });

  // ---- Menu row: "Connexion" / "Se déconnecter" -----------------------------

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
    if (foot.querySelector("#gl-auth-row")) return;
    var status = await getStatus();

    if (status.isAdmin) {
      var adminRow = makeRow("Administration des cartes", "gl-admin-row", ICON_ADMIN);
      adminRow.onclick = function () {
        window.location.href = "/admin.html";
      };
      foot.appendChild(adminRow);
    }

    var authRow = makeRow(
      status.signedIn ? "Se déconnecter" : "Connexion",
      "gl-auth-row",
      status.signedIn ? ICON_LOGOUT : ICON_LOGIN,
    );
    authRow.onclick = function () {
      if (status.signedIn) void signOut();
      else window.location.href = "/login.html";
    };
    foot.appendChild(authRow);
  }

  function watchMenu() {
    var obs = new MutationObserver(function () {
      var foot = document.querySelector(".side-foot") || document.querySelector(".side-list");
      if (foot) void injectMenuRow(foot);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) watchMenu();
  else document.addEventListener("DOMContentLoaded", watchMenu);
})();
