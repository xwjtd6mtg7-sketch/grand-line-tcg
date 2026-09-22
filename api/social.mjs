import { randomBytes } from "node:crypto";
import { getSql } from "./_lib/db.mjs";
import { getSessionUser } from "./_lib/require-admin.mjs";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function digits16() {
  const buf = randomBytes(16);
  let s = "";
  for (const b of buf) s += (b % 10).toString();
  return s;
}

function normCode(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 16);
}

function avatarOf(row) {
  if (!row || !row.avatar_card) return null;
  return {
    cardId: row.avatar_card,
    x: row.avatar_x != null ? Number(row.avatar_x) : 50,
    y: row.avatar_y != null ? Number(row.avatar_y) : 16,
    s: row.avatar_s != null ? Number(row.avatar_s) : 1.8,
  };
}

function publicUser(row) {
  return {
    id: row.user_id || row.id,
    name: row.name,
    code: row.friend_code || row.code,
    avatar: avatarOf(row),
  };
}

async function ensureProfile(sql, user) {
  const existing = await sql.query(
    `select user_id, friend_code, name, avatar_card, avatar_x, avatar_y, avatar_s,
            motto, favs, wins, losses, opened, owned
       from profiles where user_id = $1`,
    [user.id],
  );
  if (existing[0]) {
    const current = String(existing[0].name || "").trim();
    const placeholder = !current || /^pirate$/i.test(current);
    if (placeholder && user.name && user.name !== current) {
      await sql.query("update profiles set name = $1, updated_at = now() where user_id = $2", [user.name, user.id]);
      existing[0].name = user.name;
    }
    if (!existing[0].avatar_card && typeof user.image === "string" && user.image.startsWith("glcard:")) {
      const cardId = user.image.slice(7);
      if (cardId) {
        await sql.query(
          "update profiles set avatar_card = $1, updated_at = now() where user_id = $2",
          [cardId, user.id],
        );
        existing[0].avatar_card = cardId;
      }
    }
    return existing[0];
  }
  let cardId = null;
  if (typeof user.image === "string" && user.image.startsWith("glcard:")) cardId = user.image.slice(7);
  for (let i = 0; i < 8; i += 1) {
    const code = digits16();
    try {
      const rows = await sql.query(
        `insert into profiles (user_id, friend_code, name, avatar_card, avatar_x, avatar_y, avatar_s)
         values ($1, $2, $3, $4, 50, 16, 1.8)
         returning user_id, friend_code, name, avatar_card, avatar_x, avatar_y, avatar_s,
                   motto, favs, wins, losses, opened, owned`,
        [user.id, code, user.name || "Pirate", cardId],
      );
      return rows[0];
    } catch (err) {
      if (!String(err?.message || "").includes("unique")) throw err;
    }
  }
  throw new Error("friend_code_failed");
}

async function isBanned(sql, userId) {
  const rows = await sql.query("select 1 from bans where user_id = $1", [userId]);
  return !!rows[0];
}

async function listFriends(sql, userId) {
  return sql.query(
    `select p.user_id as id, p.name, p.friend_code as code,
            p.avatar_card, p.avatar_x, p.avatar_y, p.avatar_s
       from friendships f
       join profiles p on p.user_id = f.friend_id
      where f.user_id = $1
      order by f.created_at desc`,
    [userId],
  );
}

async function listRequests(sql, userId, dir) {
  const col = dir === "in" ? "to_id" : "from_id";
  const other = dir === "in" ? "from_id" : "to_id";
  return sql.query(
    `select p.user_id as id, p.name, p.friend_code as code,
            p.avatar_card, p.avatar_x, p.avatar_y, p.avatar_s, r.created_at
       from friend_requests r
       join profiles p on p.user_id = r.${other}
      where r.${col} = $1
      order by r.created_at desc`,
    [userId],
  );
}

function parseFavs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, 3);
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(Boolean).slice(0, 3) : [];
  } catch {
    return [];
  }
}

function publicProfile(row) {
  return {
    id: row.user_id || row.id,
    name: row.name,
    code: row.friend_code || row.code,
    avatar: avatarOf(row),
    motto: row.motto || "",
    favs: parseFavs(row.favs),
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    opened: Number(row.opened) || 0,
    owned: Number(row.owned) || 0,
  };
}

async function getProfileRow(sql, id) {
  const rows = await sql.query(
    `select user_id, friend_code, name, avatar_card, avatar_x, avatar_y, avatar_s,
            motto, favs, wins, losses, opened, owned
       from profiles where user_id = $1`,
    [id],
  );
  return rows[0] || null;
}

function packList(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    avatar: avatarOf(r),
  }));
}

function newId() {
  return randomBytes(8).toString("hex");
}

async function ensureMail(sql) {
  await sql.query(`create table if not exists card_transfers (
    id text primary key,
    kind text not null,
    from_id text not null,
    to_id text not null,
    offer_card text not null,
    reply_card text,
    status text not null default 'pending',
    created_at timestamptz not null default now()
  )`);
  await sql.query(`create table if not exists card_mail (
    id text primary key,
    user_id text not null,
    from_id text not null,
    card_id text not null,
    kind text not null,
    created_at timestamptz not null default now()
  )`);
}

async function areFriends(sql, a, b) {
  const rows = await sql.query(
    "select 1 from friendships where user_id = $1 and friend_id = $2",
    [a, b],
  );
  return !!rows[0];
}

function validCardId(id) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{1,40}$/.test(String(id || ""));
}

function isStarterCardId(id) {
  const s = String(id || "");
  return /^ST\d{0,2}[-_]/i.test(s) || /^ST-/i.test(s);
}

function pick(row, keys) {
  if (!row) return "";
  for (var i = 0; i < keys.length; i++) {
    if (row[keys[i]] != null && row[keys[i]] !== "") return row[keys[i]];
  }
  return "";
}

function mapMail(r) {
  return {
    id: r.id,
    kind: r.kind,
    cardId: pick(r, ["cardId", "cardid", "card_id"]),
    fromId: pick(r, ["fromId", "fromid", "from_id"]),
    fromName: pick(r, ["fromName", "fromname", "from_name"]) || "Nakama",
  };
}

function mapTrade(r) {
  return {
    id: r.id,
    kind: r.kind,
    fromId: pick(r, ["fromId", "fromid", "from_id"]),
    toId: pick(r, ["toId", "toid", "to_id"]),
    offerCard: pick(r, ["offerCard", "offercard", "offer_card"]),
    replyCard: pick(r, ["replyCard", "replycard", "reply_card"]),
    status: r.status,
    fromName: pick(r, ["fromName", "fromname", "from_name"]) || "Pirate",
    toName: pick(r, ["toName", "toname", "to_name"]) || "Pirate",
  };
}

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      json(res, 401, { error: "auth_required", message: "Connecte-toi pour gérer tes amis." });
      return;
    }
    const sql = await getSql();
    if (await isBanned(sql, user.id)) {
      json(res, 403, { error: "banned", message: "Ce compte a été banni." });
      return;
    }
    const me = await ensureProfile(sql, user);
    await ensureMail(sql);

    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://local");
      const pid = url.searchParams.get("profile") || "";
      if (pid) {
        if (pid !== user.id) {
          const pal = await sql.query(
            "select 1 from friendships where user_id = $1 and friend_id = $2",
            [user.id, pid],
          );
          const pending = pal[0]
            ? [{ ok: 1 }]
            : await sql.query(
                `select 1 from friend_requests
                  where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)`,
                [user.id, pid],
              );
          if (!pal[0] && !pending[0]) {
            json(res, 403, { error: "not_friend", message: "Profil réservé aux nakama." });
            return;
          }
        }
        const row = await getProfileRow(sql, pid);
        if (!row) {
          json(res, 404, { error: "not_found", message: "Profil introuvable." });
          return;
        }
        json(res, 200, { profile: publicProfile(row) });
        return;
      }
      const [friends, incoming, outgoing, mail, trades] = await Promise.all([
        listFriends(sql, user.id),
        listRequests(sql, user.id, "in"),
        listRequests(sql, user.id, "out"),
        sql.query(
          `select m.id, m.kind, m.card_id as "cardId", m.from_id as "fromId", p.name as "fromName"
             from card_mail m
             left join profiles p on p.user_id = m.from_id
            where m.user_id = $1
            order by m.created_at desc`,
          [user.id],
        ),
        sql.query(
          `select t.id, t.kind, t.from_id as "fromId", t.to_id as "toId",
                  t.offer_card as "offerCard", t.reply_card as "replyCard", t.status,
                  pf.name as "fromName", pt.name as "toName"
             from card_transfers t
             left join profiles pf on pf.user_id = t.from_id
             left join profiles pt on pt.user_id = t.to_id
            where t.status = 'pending' and (t.from_id = $1 or t.to_id = $1)
            order by t.created_at desc`,
          [user.id],
        ),
      ]);
      json(res, 200, {
        me: publicProfile(me),
        friends: packList(friends),
        incoming: packList(incoming),
        outgoing: packList(outgoing),
        mail: (mail || []).map(mapMail),
        trades: (trades || []).map(mapTrade),
      });
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const action = String(body.action || "");

      if (action === "publish") {
        const motto = String(body.motto || "").slice(0, 80);
        const favs = Array.isArray(body.favs) ? body.favs.filter(Boolean).slice(0, 3) : [];
        const incoming = String(body.name || "").trim().slice(0, 24);
        const name = incoming || me.name || "Pirate";
        const wins = Math.max(0, Number(body.wins) || 0);
        const losses = Math.max(0, Number(body.losses) || 0);
        const opened = Math.max(0, Number(body.opened) || 0);
        const owned = Math.max(0, Number(body.owned) || 0);
        await sql.query(
          `update profiles set
              name = $1, motto = $2, favs = $3,
              wins = $4, losses = $5, opened = $6, owned = $7, updated_at = now()
            where user_id = $8`,
          [name, motto, JSON.stringify(favs), wins, losses, opened, owned, user.id],
        );
        json(res, 200, { ok: true });
        return;
      }

      if (action === "avatar") {
        const cardId = String(body.cardId || "").slice(0, 32);
        const x = Number(body.x);
        const y = Number(body.y);
        const s = Number(body.s);
        await sql.query(
          `update profiles set avatar_card = $1, avatar_x = $2, avatar_y = $3, avatar_s = $4, updated_at = now()
            where user_id = $5`,
          [cardId || null, Number.isFinite(x) ? x : 50, Number.isFinite(y) ? y : 16, Number.isFinite(s) ? s : 1.8, user.id],
        );
        json(res, 200, { ok: true });
        return;
      }

      if (action === "claim") {
        const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean).slice(0, 40) : [];
        if (!ids.length) {
          json(res, 200, { ok: true });
          return;
        }
        for (const id of ids) {
          await sql.query("delete from card_mail where user_id = $1 and id = $2", [user.id, id]);
        }
        json(res, 200, { ok: true });
        return;
      }

      if (action === "share") {
        const toId = String(body.to || "");
        const cardId = String(body.cardId || "");
        if (!validCardId(cardId) || !toId) {
          json(res, 400, { error: "bad_card", message: "Carte ou destinataire manquant." });
          return;
        }
        if (isStarterCardId(cardId)) {
          json(res, 400, { error: "starter", message: "Les cartes des starters ne peuvent pas être partagées." });
          return;
        }
        if (!(await areFriends(sql, user.id, toId))) {
          json(res, 403, { error: "not_friend", message: "Uniquement avec un nakama." });
          return;
        }
        const today = await sql.query(
          `select 1 from card_transfers
            where kind = 'share' and from_id = $1 and to_id = $2
              and created_at >= date_trunc('day', now())
              and status <> 'cancelled'`,
          [user.id, toId],
        );
        if (today[0]) {
          json(res, 400, { error: "limit", message: "Déjà partagé avec ce nakama aujourd’hui." });
          return;
        }
        const tid = newId();
        await sql.query(
          `insert into card_transfers (id, kind, from_id, to_id, offer_card, status)
           values ($1, 'share', $2, $3, $4, 'done')`,
          [tid, user.id, toId, cardId],
        );
        await sql.query(
          `insert into card_mail (id, user_id, from_id, card_id, kind)
           values ($1, $2, $3, $4, 'share')`,
          [newId(), toId, user.id, cardId],
        );
        json(res, 200, { ok: true, shared: true });
        return;
      }

      if (action === "trade") {
        const toId = String(body.to || "");
        const cardId = String(body.cardId || "");
        if (!validCardId(cardId) || !toId) {
          json(res, 400, { error: "bad_card", message: "Carte ou destinataire manquant." });
          return;
        }
        if (isStarterCardId(cardId)) {
          json(res, 400, { error: "starter", message: "Les cartes des starters ne peuvent pas être échangées." });
          return;
        }
        if (!(await areFriends(sql, user.id, toId))) {
          json(res, 403, { error: "not_friend", message: "Uniquement avec un nakama." });
          return;
        }
        const open = await sql.query(
          `select 1 from card_transfers
            where kind = 'trade' and status = 'pending'
              and ((from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1))`,
          [user.id, toId],
        );
        if (open[0]) {
          json(res, 400, { error: "busy", message: "Un échange est déjà en cours avec ce nakama." });
          return;
        }
        const tid = newId();
        await sql.query(
          `insert into card_transfers (id, kind, from_id, to_id, offer_card, status)
           values ($1, 'trade', $2, $3, $4, 'pending')`,
          [tid, user.id, toId, cardId],
        );
        json(res, 200, { ok: true, tradeId: tid });
        return;
      }

      if (action === "trade-reply") {
        const tid = String(body.id || "");
        const cardId = String(body.cardId || "");
        if (!tid || !validCardId(cardId)) {
          json(res, 400, { error: "bad_card", message: "Carte manquante." });
          return;
        }
        const rows = await sql.query(
          `select * from card_transfers where id = $1 and kind = 'trade' and status = 'pending'`,
          [tid],
        );
        const t = rows[0];
        const toId = t && (t.to_id || t.toid || t.toId);
        const fromId = t && (t.from_id || t.fromid || t.fromId);
        const offer = t && (t.offer_card || t.offercard || t.offerCard);
        if (!t || toId !== user.id) {
          json(res, 404, { error: "not_found", message: "Échange introuvable." });
          return;
        }
        await sql.query(
          `update card_transfers set reply_card = $1, status = 'done' where id = $2`,
          [cardId, tid],
        );
        await sql.query(
          `insert into card_mail (id, user_id, from_id, card_id, kind)
           values ($1, $2, $3, $4, 'trade')`,
          [newId(), fromId, user.id, cardId],
        );
        await sql.query(
          `insert into card_mail (id, user_id, from_id, card_id, kind)
           values ($1, $2, $3, $4, 'trade')`,
          [newId(), toId, fromId, offer],
        );
        json(res, 200, { ok: true, done: true });
        return;
      }

      if (action === "trade-cancel") {
        const tid = String(body.id || "");
        const rows = await sql.query(
          `select * from card_transfers where id = $1 and kind = 'trade' and status = 'pending'`,
          [tid],
        );
        const t = rows[0];
        const fromId = t && (t.from_id || t.fromid || t.fromId);
        const toId = t && (t.to_id || t.toid || t.toId);
        const offer = t && (t.offer_card || t.offercard || t.offerCard);
        if (!t || (fromId !== user.id && toId !== user.id)) {
          json(res, 404, { error: "not_found", message: "Échange introuvable." });
          return;
        }
        await sql.query(`update card_transfers set status = 'cancelled' where id = $1`, [tid]);
        await sql.query(
          `insert into card_mail (id, user_id, from_id, card_id, kind)
           values ($1, $2, $3, $4, 'refund')`,
          [newId(), fromId, user.id, offer],
        );
        json(res, 200, { ok: true, cancelled: true });
        return;
      }

      if (action === "accept" || action === "decline") {
        const fromId = String(body.id || "");
        if (!fromId) {
          json(res, 400, { error: "missing_id", message: "Demande manquante." });
          return;
        }
        const reqRow = await sql.query(
          "select 1 from friend_requests where from_id = $1 and to_id = $2",
          [fromId, user.id],
        );
        if (!reqRow[0]) {
          json(res, 404, { error: "not_found", message: "Demande introuvable." });
          return;
        }
        await sql.query("delete from friend_requests where from_id = $1 and to_id = $2", [fromId, user.id]);
        if (action === "accept") {
          await sql.query(
            "insert into friendships (user_id, friend_id) values ($1, $2) on conflict do nothing",
            [user.id, fromId],
          );
          await sql.query(
            "insert into friendships (user_id, friend_id) values ($1, $2) on conflict do nothing",
            [fromId, user.id],
          );
          await sql.query("delete from friend_requests where from_id = $1 and to_id = $2", [user.id, fromId]);
        }
        json(res, 200, { ok: true, accepted: action === "accept" });
        return;
      }

      const code = normCode(body.code || body.id);
      if (code.length !== 16) {
        json(res, 400, { error: "invalid_id", message: "ID ami invalide." });
        return;
      }
      if (code === me.friend_code) {
        json(res, 400, { error: "self", message: "C’est ton propre ID." });
        return;
      }
      const found = await sql.query(
        "select user_id, name, friend_code, avatar_card, avatar_x, avatar_y, avatar_s from profiles where friend_code = $1",
        [code],
      );
      const target = found[0];
      if (!target) {
        json(res, 404, { error: "not_found", message: "Aucun pirate avec cet ID." });
        return;
      }
      if (await isBanned(sql, target.user_id)) {
        json(res, 404, { error: "not_found", message: "Aucun pirate avec cet ID." });
        return;
      }
      const already = await sql.query(
        "select 1 from friendships where user_id = $1 and friend_id = $2",
        [user.id, target.user_id],
      );
      if (already[0]) {
        json(res, 200, { ok: true, already: true, friend: publicUser(target) });
        return;
      }
      const reverse = await sql.query(
        "select 1 from friend_requests where from_id = $1 and to_id = $2",
        [target.user_id, user.id],
      );
      if (reverse[0]) {
        await sql.query("delete from friend_requests where from_id = $1 and to_id = $2", [target.user_id, user.id]);
        await sql.query(
          "insert into friendships (user_id, friend_id) values ($1, $2) on conflict do nothing",
          [user.id, target.user_id],
        );
        await sql.query(
          "insert into friendships (user_id, friend_id) values ($1, $2) on conflict do nothing",
          [target.user_id, user.id],
        );
        json(res, 200, { ok: true, accepted: true, friend: publicUser(target) });
        return;
      }
      await sql.query(
        "insert into friend_requests (from_id, to_id) values ($1, $2) on conflict do nothing",
        [user.id, target.user_id],
      );
      json(res, 200, { ok: true, requested: true, friend: publicUser(target) });
      return;
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url || "/", "http://local");
      const friendId = url.searchParams.get("id") || "";
      if (!friendId) {
        json(res, 400, { error: "missing_id", message: "Ami manquant." });
        return;
      }
      await sql.query("delete from friendships where user_id = $1 and friend_id = $2", [user.id, friendId]);
      await sql.query("delete from friendships where user_id = $1 and friend_id = $2", [friendId, user.id]);
      await sql.query("delete from friend_requests where (from_id = $1 and to_id = $2) or (from_id = $2 and to_id = $1)", [
        user.id,
        friendId,
      ]);
      json(res, 200, { ok: true });
      return;
    }

    json(res, 405, { error: "method" });
  } catch (err) {
    json(res, 500, { error: "internal_error", message: err?.message || "Erreur serveur" });
  }
}
