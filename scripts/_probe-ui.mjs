import { chromium } from "playwright";

const url = "http://127.0.0.1:8080/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 180)));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.locator(".intro-root.is-ready").waitFor({ timeout: 15000 });
await page.locator(".intro-root").click({ force: true });
await page.waitForTimeout(500);

async function snap(name) {
  const info = await page.evaluate(() => {
    const on = document.querySelector(".tab-pane.is-on");
    const so = document.getElementById("gl-so-root");
    const intro = document.querySelector(".intro-root");
    return {
      path: location.pathname,
      entered: document.documentElement.classList.contains("gl-entered"),
      introOut: !intro || intro.classList.contains("is-out") || getComputedStyle(intro).display === "none",
      coll: !!document.querySelector(".tab-pane.is-on .coll-hub"),
      cmb: !!document.querySelector(".tab-pane.is-on .cmb-page"),
      decks: /Mes decks/i.test((on && on.innerText) || ""),
      social: !!(so && !so.hidden),
      socialText: so && !so.hidden ? (so.innerText || "").replace(/\s+/g, " ").slice(0, 140) : "",
      title: (document.querySelector(".tab-pane.is-on h2, #gl-so-root h2, .gl-head-title") || {}).textContent,
      onText: ((on && on.innerText) || "").replace(/\s+/g, " ").slice(0, 140),
      router: !!(window.__TSR_ROUTER__ && window.__TSR_ROUTER__.navigate),
    };
  });
  await page.screenshot({ path: `/tmp/d-${name}.png` });
  console.log(name, JSON.stringify(info));
  return info;
}

async function tap(sel) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.click();
  }, sel);
  await page.waitForTimeout(900);
}

await snap("home");
await tap('a[href="/collection"]');
await snap("collection");
await tap('a[href="/play"]');
await snap("combat");
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".tab-pane.is-on button, .cmb-deck-btn")].find((e) => /Decks/.test(e.textContent || ""));
  if (btn) btn.click();
});
await page.waitForTimeout(700);
await snap("combat-decks");
await page.evaluate(() => {
  const li = [...document.querySelectorAll(".app-dock li")].find((e) => /Social/.test(e.textContent || ""));
  if (li) li.click();
});
await page.waitForTimeout(900);
await snap("social");
await page.evaluate(() => {
  const btn = document.querySelector('#gl-so-root [data-act="decks"]');
  if (btn) btn.click();
});
await page.waitForTimeout(900);
await snap("social-decks");
await tap('a[href="/"]');
await snap("home2");
await browser.close();
