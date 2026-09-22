/**
 * Admin — user management panel (Grand Line TCG).
 */
(function () {
  var ROLE_LABEL = {
    user: "Joueur",
    moderator: "Modérateur",
    admin: "Administrateur",
    owner: "Fondateur",
  };
  var ROLE_ORDER = ["owner", "admin", "moderator", "user"];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;")
      .replace(/'/g, "\u0026#39;");
  }
  function pretty(code) {
    return String(code || "").replace(/\D/g, "").replace(/(.{4})(?=.)/g, "$1-");
  }
  function roleOf(u) {
    return ROLE_LABEL[u.role] ? u.role : "user";
  }

  function confirmAsk(title, message, opts) {
    if (window.GLAdminConfirm) return window.GLAdminConfirm(title, message, opts);
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "overlay is-confirm";
      opts = opts || {};
      overlay.innerHTML =
        '<div class="confirm-card">' +
          "<h2>" + esc(title) + "</h2>" +
          "<p>" + esc(message) + "</p>" +
          '<div class="form-foot">' +
            '<button type="button" class="cancel" data-no>' + esc(opts.cancel || "Annuler") + "</button>" +
            '<button type="button" class="save' + (opts.danger ? " is-danger" : "") + '" data-yes>' +
              esc(opts.ok || "Confirmer") +
            "</button>" +
          "</div>" +
        "</div>";
      function done(v) { overlay.remove(); resolve(v); }
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target.closest("[data-no]")) done(false);
        if (e.target.closest("[data-yes]")) done(true);
      });
      document.body.appendChild(overlay);
    });
  }

  async function api(action, body) {
    const r = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, body || {})),
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.message || "Erreur");
    return j;
  }

  async function load() {
    const r = await fetch("/api/admin/users", { credentials: "include" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || "Impossible de charger les comptes");
    return j;
  }

  function promptBox(title, fields) {
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML =
        '<div class="form-card" style="max-width:420px">' +
          '<div class="form-head"><h2>' + esc(title) + '</h2><button type="button" data-x>×</button></div>' +
          fields +
          '<div class="form-foot"><button type="button" class="cancel" data-x>Annuler</button>' +
          '<button type="button" class="save" data-ok>OK</button></div>' +
        "</div>";
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target.closest("[data-x]")) {
          overlay.remove();
          resolve(null);
        }
        if (e.target.closest("[data-ok]")) {
          const vals = {};
          overlay.querySelectorAll("[name]").forEach(function (el) { vals[el.name] = el.value; });
          overlay.remove();
          resolve(vals);
        }
      });
      document.body.appendChild(overlay);
      const first = overlay.querySelector("input, select");
      if (first) first.focus();
    });
  }

  function assignableRoles(me) {
    if (me.role === "owner") return ROLE_ORDER.slice();
    if (me.canRoles) return ["admin", "moderator", "user"];
    return [];
  }

  async function render(host) {
    host.innerHTML = '<div class="wrap"><p class="count">Chargement des comptes…</p></div>';
    let users = [];
    let me = { role: "admin", canRoles: true, id: "" };
    try {
      const data = await load();
      users = data.users || [];
      if (data.me) me = data.me;
    } catch (e) {
      host.innerHTML = '<div class="wrap"><p class="status err">' + esc(e.message) + "</p></div>";
      return;
    }

    const canEdit = me.role === "admin" || me.role === "owner";
    const canRoles = !!me.canRoles;
    const picks = assignableRoles(me);

    host.innerHTML =
      '<div class="wrap">' +
        '<div class="toolbar">' +
          '<div class="search"><span>🔍</span><input id="u-q" placeholder="Rechercher un pseudo, email ou ID…" /></div>' +
          '<select class="filter" id="u-role-f">' +
            '<option value="">Tous les rôles</option>' +
            ROLE_ORDER.map(function (r) {
              return '<option value="' + r + '">' + ROLE_LABEL[r] + "</option>";
            }).join("") +
          "</select>" +
          (canEdit ? '<button class="btn" id="u-new">+ Créer un compte</button>' : "") +
        "</div>" +
        '<p class="status" id="u-status" hidden></p>' +
        '<p class="count" id="u-count"></p>' +
        '<div class="u-list" id="u-list"></div>' +
      "</div>";

    const list = host.querySelector("#u-list");
    const statusEl = host.querySelector("#u-status");
    const countEl = host.querySelector("#u-count");
    let q = "";
    let roleF = "";

    function flash(msg, err) {
      statusEl.hidden = false;
      statusEl.className = "status" + (err ? " err" : "");
      statusEl.textContent = msg;
    }

    function paint() {
      const query = q.trim().toLowerCase();
      const rows = users.filter(function (u) {
        if (roleF && roleOf(u) !== roleF) return false;
        if (!query) return true;
        return [u.name, u.email, u.code, u.id, ROLE_LABEL[roleOf(u)]].join(" ").toLowerCase().indexOf(query) >= 0;
      });
      countEl.textContent = rows.length + " compte" + (rows.length > 1 ? "s" : "");
      list.innerHTML = rows.map(function (u) {
        const role = roleOf(u);
        const locked = role === "owner" && me.role !== "owner";
        return (
          '<article class="u-card' + (u.banned ? " is-ban" : "") + '" data-id="' + esc(u.id) + '">' +
            '<div class="u-top"><b>' + esc(u.name || "—") + "</b>" +
              '<em class="u-role is-' + role + '">' + esc(ROLE_LABEL[role]) + "</em>" +
              (u.banned ? '<em class="u-ban">Banni</em>' : "") +
            "</div>" +
            '<p class="u-mail">' + esc(u.email) + "</p>" +
            '<p class="u-code">ID ami ' + esc(pretty(u.code)) + "</p>" +
            '<div class="u-actions">' +
              (canRoles && !locked
                ? '<button type="button" data-act="role">Rôle</button>'
                : "") +
              (canEdit
                ? '<button type="button" data-act="email">Email</button>' +
                  '<button type="button" data-act="name">Pseudo</button>' +
                  '<button type="button" data-act="password">MDP aléatoire</button>'
                : "") +
              (u.banned
                ? '<button type="button" data-act="unban">Débannir</button>'
                : (locked ? "" : '<button type="button" class="danger" data-act="ban">Bannir</button>')) +
              (canEdit && !locked
                ? '<button type="button" class="danger" data-act="delete">Supprimer</button>'
                : "") +
            "</div>" +
          "</article>"
        );
      }).join("") || '<p class="count">Aucun compte.</p>';
    }

    paint();
    host.querySelector("#u-q").oninput = function (e) { q = e.target.value; paint(); };
    host.querySelector("#u-role-f").onchange = function (e) { roleF = e.target.value; paint(); };

    const newBtn = host.querySelector("#u-new");
    if (newBtn) newBtn.onclick = async function () {
      const vals = await promptBox(
        "Créer un compte",
        '<label class="field"><span>Pseudo</span><input name="name" placeholder="Zoro" /></label>' +
        '<label class="field"><span>Email</span><input name="email" type="email" placeholder="zoro@nakama.test" /></label>',
      );
      if (!vals) return;
      const created = await confirmAsk(
        "Créer un compte",
        "Créer le compte « " + (vals.name || vals.email || "") + " » ?",
        { ok: "Créer" },
      );
      if (!created) return;
      try {
        const j = await api("create", { name: vals.name, email: vals.email });
        flash("Compte créé. Mot de passe : " + j.password);
        const data = await load();
        users = data.users || [];
        paint();
      } catch (e) { flash(e.message, true); }
    };

    list.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const card = btn.closest("[data-id]");
      const id = card && card.getAttribute("data-id");
      const act = btn.getAttribute("data-act");
      const user = users.find(function (u) { return u.id === id; });
      if (!user) return;
      try {
        if (act === "role") {
          const cur = roleOf(user);
          const opts = picks.map(function (r) {
            return '<option value="' + r + '"' + (r === cur ? " selected" : "") + ">" + ROLE_LABEL[r] + "</option>";
          }).join("");
          const vals = await promptBox(
            "Rôle de " + (user.name || ""),
            '<label class="field"><span>Rôle</span><select name="role">' + opts + "</select></label>" +
            '<p class="u-role-help">Joueur : compte normal. Modérateur : ban / liste. Administrateur : cartes + comptes. Fondateur : tout.</p>',
          );
          if (!vals) return;
          if (vals.role === cur) return;
          const ok = await confirmAsk(
            "Changer le rôle",
            "Attribuer le rôle « " + (ROLE_LABEL[vals.role] || vals.role) + " » à " + (user.name || user.email) + " ?",
          );
          if (!ok) return;
          const j = await api("role", { id: id, role: vals.role });
          flash("Rôle : " + (j.label || ROLE_LABEL[vals.role] || vals.role));
        } else if (act === "email") {
          const vals = await promptBox(
            "Nouvel email",
            '<label class="field"><span>Email</span><input name="email" type="email" value="' + esc(user.email) + '" /></label>',
          );
          if (!vals) return;
          const ok = await confirmAsk(
            "Changer l’email",
            "Remplacer l’email de " + (user.name || "") + " par " + vals.email + " ?",
          );
          if (!ok) return;
          await api("email", { id: id, email: vals.email });
          flash("Email mis à jour");
        } else if (act === "name") {
          const vals = await promptBox(
            "Nouveau pseudo",
            '<label class="field"><span>Pseudo</span><input name="name" value="' + esc(user.name || "") + '" /></label>',
          );
          if (!vals) return;
          const ok = await confirmAsk(
            "Changer le pseudo",
            "Renommer " + (user.name || "") + " en « " + vals.name + " » ?",
          );
          if (!ok) return;
          await api("name", { id: id, name: vals.name });
          flash("Pseudo mis à jour");
        } else if (act === "password") {
          const ok = await confirmAsk(
            "Nouveau mot de passe",
            "Générer un nouveau mot de passe pour " + (user.name || "") + " ? Les sessions ouvertes seront coupées.",
            { danger: true, ok: "Générer" },
          );
          if (!ok) return;
          const j = await api("password", { id: id });
          flash("Nouveau mot de passe : " + j.password);
        } else if (act === "ban") {
          const vals = await promptBox(
            "Bannir " + (user.name || ""),
            '<label class="field"><span>Raison</span><input name="reason" placeholder="Triche, spam…" /></label>',
          );
          if (!vals) return;
          const ok = await confirmAsk(
            "Bannir le compte",
            "Bannir " + (user.name || user.email) + (vals.reason ? " (" + vals.reason + ")" : "") + " ?",
            { danger: true, ok: "Bannir" },
          );
          if (!ok) return;
          await api("ban", { id: id, reason: vals.reason });
          flash("Compte banni");
        } else if (act === "unban") {
          const ok = await confirmAsk(
            "Débannir",
            "Rétablir l’accès de " + (user.name || user.email) + " ?",
            { ok: "Débannir" },
          );
          if (!ok) return;
          await api("unban", { id: id });
          flash("Compte débanni");
        } else if (act === "delete") {
          const ok = await confirmAsk(
            "Supprimer le compte",
            "Supprimer définitivement " + (user.email || user.name) + " ? Cette action est irréversible.",
            { danger: true, ok: "Supprimer" },
          );
          if (!ok) return;
          await api("delete", { id: id });
          flash("Compte supprimé");
        }
        const data = await load();
        users = data.users || [];
        if (data.me) me = data.me;
        paint();
      } catch (err) { flash(err.message, true); }
    });
  }

  window.GLAdminUsers = { render: render };
})();
