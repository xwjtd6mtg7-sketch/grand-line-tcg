#!/usr/bin/env node
/**
 * Serve the restored Grand Line TCG snapshot (exact copy of the live site)
 * on 0.0.0.0:8080 with SPA fallback.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const rel = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(root, "." + rel);
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

function send(res, code, headers, body) {
  res.writeHead(code, headers);
  res.end(body);
}

function serveFile(file, res) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  const stream = fs.createReadStream(file);
  stream.on("error", () => send(res, 500, { "content-type": "text/plain" }, "error"));
  res.writeHead(200, {
    "content-type": type,
    "cache-control": ext === ".html" || ext === ".js" || ext === ".css" || ext === ".json"
      ? "public, max-age=0, must-revalidate"
      : "public, max-age=86400",
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || "/";
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, { "content-type": "text/plain" }, "method not allowed");
    return;
  }
  const file = safeJoin(ROOT, urlPath);
  if (!file) {
    send(res, 403, { "content-type": "text/plain" }, "forbidden");
    return;
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) {
      serveFile(file, res);
      return;
    }
    if (!err && st.isDirectory()) {
      const index = path.join(file, "index.html");
      fs.stat(index, (e2, st2) => {
        if (!e2 && st2.isFile()) serveFile(index, res);
        else serveFile(path.join(ROOT, "index.html"), res);
      });
      return;
    }
    // SPA fallback for client routes
    serveFile(path.join(ROOT, "index.html"), res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[grand-line-tcg] restored live snapshot on http://${HOST}:${PORT}`);
});
