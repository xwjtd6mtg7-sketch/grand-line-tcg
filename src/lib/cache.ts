import { useEffect, useState } from "react";
import meta from "@/lib/tcg/meta.json";
import type { Catalog } from "@/lib/tcg/types";
import { cosmeticUrls } from "@/lib/tcg/cosmetics";

export const CATALOG_VER = "fr-cards-opcollec-13";
export const CACHE_NAME = "gl-tcg-assets";
const IDB_NAME = "gl-tcg";
const STATUS_KEY = "gl-tcg-cache-status";

export type CacheStatus = {
  complete: boolean;
  at: string;
  files: number;
  total: number;
};

type Job = {
  running: boolean;
  done: number;
  total: number;
  error: string | null;
};

let job: Job = { running: false, done: 0, total: 0, error: null };
const listeners = new Set<() => void>();
let cancelled = false;

function emit() {
  for (const fn of listeners) fn();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const q = db.transaction("kv", "readonly").objectStore("kv").get(key);
      q.onsuccess = () => resolve(q.result as T | undefined);
      q.onerror = () => reject(q.error);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const q = db.transaction("kv", "readwrite").objectStore("kv").put(value, key);
      q.onsuccess = () => resolve();
      q.onerror = () => reject(q.error);
    });
  } catch {
    /* ignore quota */
  }
}

export function readCacheStatus(): CacheStatus | null {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as CacheStatus) : null;
  } catch {
    return null;
  }
}

function writeCacheStatus(s: CacheStatus) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(s));
}

export function coreAssetUrls(): string[] {
  const list = meta as { boosters: { id: string }[]; starters: { id: string }[] };
  const packs = [...list.boosters, ...list.starters].map((s) => `/boosters/${s.id}.webp`);
  return [
    "/card-back.png",
    "/logo-gltcg.png?v=3",
    "/apple-touch-icon.png",
    "/favicon.svg",
    "/favicon-32.png",
    "/icon-192.png",
    "/icon-512.png",
    "/don.jpg",
    "/don/official.jpg",
    "/playmat/felt.svg",
    `/data/catalog.json?v=${CATALOG_VER}`,
    "/data/meta.json",
    "/audio/we-are.mp3",
    ...packs,
    ...cosmeticUrls(),
  ];
}

function cardUrls(catalog: Catalog): string[] {
  const urls: string[] = [];
  for (const c of catalog.cards) {
    if (c.image) urls.push(c.image);
  }
  return urls;
}

function liveShellUrls(): string[] {
  const urls: string[] = [];
  try {
    document.querySelectorAll("script[src], link[href], img[src]").forEach((el) => {
      const href = (el as HTMLScriptElement).src || (el as HTMLLinkElement).href || (el as HTMLImageElement).src;
      if (href) urls.push(href);
    });
    for (const e of performance.getEntriesByType("resource")) {
      if (e.name) urls.push(e.name);
    }
  } catch {
    /* ignore */
  }
  return urls;
}

async function openCache() {
  if (typeof caches === "undefined") throw new Error("no-cache");
  return caches.open(CACHE_NAME);
}

async function putUrl(cache: Cache, url: string) {
  try {
    const hit = await cache.match(url, { ignoreSearch: true });
    if (hit) return true;
  } catch {
    /* continue */
  }
  if (url.startsWith("http") && !url.startsWith(location.origin)) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      const done = () => resolve();
      const t = window.setTimeout(done, 12000);
      img.onload = () => {
        window.clearTimeout(t);
        done();
      };
      img.onerror = () => {
        window.clearTimeout(t);
        done();
      };
      img.referrerPolicy = "no-referrer";
      img.src = url;
    });
    try {
      await cache.add(new Request(url, { mode: "no-cors", cache: "reload" }));
    } catch {
      /* opaque optional */
    }
    return true;
  }
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "reload" });
    window.clearTimeout(t);
    if (res.ok) await cache.put(url, res.clone());
    return res.ok;
  } catch {
    return false;
  }
}

async function runBatch(urls: string[], onTick: (done: number) => void, conc = 4) {
  const cache = await openCache();
  const n = Math.max(1, Math.min(conc, urls.length));
  let i = 0;
  let finished = 0;
  async function worker() {
    while (i < urls.length && !cancelled) {
      const url = urls[i++]!;
      await putUrl(cache, url);
      finished += 1;
      onTick(finished);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
}

export async function prefetchCore() {
  return bootPrefetch();
}

type BootJob = {
  running: boolean;
  done: number;
  total: number;
  complete: boolean;
};

let boot: BootJob = { running: false, done: 0, total: 0, complete: false };
const bootListeners = new Set<() => void>();
let bootWait: Promise<void> | null = null;

function emitBoot() {
  for (const fn of bootListeners) fn();
}

export function bootState(): BootJob {
  return boot;
}

export function bootPrefetch(): Promise<void> {
  if (boot.complete) return Promise.resolve();
  if (bootWait) return bootWait;
  bootWait = (async () => {
    const urls = coreAssetUrls();
    boot = { running: true, done: 0, total: urls.length, complete: false };
    emitBoot();
    try {
      await Promise.race([
        runBatch(urls, (done) => {
          boot = { ...boot, done };
          emitBoot();
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 12000)),
      ]);
    } catch {
      /* still mark complete so the intro never hangs */
    } finally {
      boot = { running: false, done: urls.length, total: urls.length, complete: true };
      emitBoot();
    }
  })();
  return bootWait;
}

export function useBootProgress() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    bootListeners.add(fn);
    return () => {
      bootListeners.delete(fn);
    };
  }, []);
  return boot;
}

export async function prefetchOwned(urls: string[]) {
  const unique = [...new Set(urls.filter((u) => u && !u.startsWith("http")))].slice(0, 64);
  if (!unique.length) return;
  await new Promise<void>((resolve) => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (ric) ric(() => resolve(), { timeout: 2200 });
    else window.setTimeout(() => resolve(), 700);
  });
  await runBatch(unique, () => undefined, 2);
}

export async function downloadAll(catalog: Catalog) {
  if (job.running) return;
  cancelled = false;
  const urls = [...coreAssetUrls(), ...cardUrls(catalog), ...liveShellUrls()];
  const unique = [...new Set(urls.filter(Boolean))];
  job = { running: true, done: 0, total: unique.length, error: null };
  emit();
  try {
    await runBatch(unique, (done) => {
      job = { ...job, done };
      emit();
    }, 6);
    if (!cancelled) {
      writeCacheStatus({ complete: true, at: new Date().toISOString(), files: job.done, total: job.total });
      try {
        const catalogJson = JSON.stringify(catalog);
        await idbSet("catalog", catalog);
        await idbSet("catalog-json", catalogJson);
      } catch {
        /* quota */
      }
    }
  } catch (e) {
    job = { ...job, error: e instanceof Error ? e.message : "Échec du téléchargement" };
  } finally {
    job = { ...job, running: false };
    emit();
  }
}

export function cancelDownload() {
  cancelled = true;
}

export function registerGameWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
}

export function useCacheJob() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return job;
}
