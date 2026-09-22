import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });

async function run(name, viewport) {
  const page = await browser.newPage({ viewport });
  const logs = [];
  page.on("console", (m) => { if (m.type()==="error") logs.push("CONSOLE "+m.text().slice(0,280)); });
  page.on("pageerror", (e) => logs.push("PAGEERROR "+String(e).slice(0,400)));
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
  try { await page.locator(".intro-root.is-ready").waitFor({ timeout: 15000 }); } catch {}
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector(".intro-root");
    if (!el) return;
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch" }));
    el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch" }));
    el.click();
  });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const intro = document.querySelector(".intro-root");
    const on = document.querySelector(".tab-pane.is-on");
    const cs = intro ? getComputedStyle(intro) : null;
    return {
      entered: document.documentElement.classList.contains("gl-entered"),
      vsOn: document.documentElement.classList.contains("gl-versus-on"),
      intro: intro ? { cls: intro.className, display: cs.display, opacity: cs.opacity, pe: cs.pointerEvents } : null,
      home: /Combattre|Collection|Duel/i.test((on && on.innerText) || ""),
      onText: ((on && on.innerText) || "").replace(/\s+/g," ").slice(0,140),
      errors418: false,
    };
  });
  await page.screenshot({ path: `/tmp/d-after-intro-${name}.png` });
  console.log(name, JSON.stringify(info));
  logs.forEach(l => console.log(name, l));
  await page.close();
}

await run("mobile", { width: 390, height: 844 });
await browser.close();
