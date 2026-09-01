/**
 * Small floating account chip, injected into the live game's page without
 * touching the compiled React bundle: it's a plain DOM node appended to
 * <body>, outside the app's own React root, so it can never conflict with
 * React's rendering. Links to /login.html or /admin.html (also plain pages).
 */
(function () {
  var chip = document.createElement("button");
  chip.id = "gl-account-chip";
  chip.type = "button";
  chip.textContent = "…";
  chip.style.cssText = [
    "position:fixed",
    "z-index:2147483000",
    "right:10px",
    "bottom:calc(10px + env(safe-area-inset-bottom))",
    "background:#101828",
    "border:1px solid #f3eee438",
    "border-radius:999px",
    "padding:7px 14px",
    "font:600 12px Figtree,ui-sans-serif,system-ui,sans-serif",
    "color:#f3eee4",
    "cursor:pointer",
    "box-shadow:0 6px 18px #0007",
  ].join(";");

  function mount() {
    document.body.appendChild(chip);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  function goto(href) {
    window.location.href = href;
  }

  async function refresh() {
    try {
      var r = await fetch("/api/admin/status", { credentials: "include" });
      var data = await r.json();
      if (!data.signedIn) {
        chip.textContent = "Connexion";
        chip.onclick = function () {
          goto("/login.html");
        };
        return;
      }
      chip.textContent = data.isAdmin ? (data.name || "Compte") + " · Admin" : data.name || "Compte";
      chip.onclick = function () {
        goto(data.isAdmin ? "/admin.html" : "/login.html");
      };
    } catch (err) {
      chip.textContent = "Connexion";
      chip.onclick = function () {
        goto("/login.html");
      };
    }
  }

  refresh();
})();
