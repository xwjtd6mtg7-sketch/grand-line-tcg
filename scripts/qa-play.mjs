import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/screenshots/qa-home.png" });
console.log("HOME", (await page.locator("body").innerText()).slice(0, 180));

await page.goto("http://127.0.0.1:8080/play", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/screenshots/qa-lobby.png" });
console.log("LOBBY", (await page.locator("body").innerText()).slice(0, 300));

const launch = page.getByRole("button", { name: /Lancer le duel/i });
const disabled = await launch.isDisabled().catch(() => true);
console.log("LAUNCH_DISABLED", disabled);
if (!disabled) {
  await launch.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/qa-cine.png" });
  console.log("CINE", (await page.locator("body").innerText()).slice(0, 220));
  await page.locator(".cine-root").click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const keepWait = page.getByRole("button", { name: /Garder cette main/i });
  if (!(await keepWait.count())) {
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: "/workspace/screenshots/qa-mulligan.png" });
  console.log("AFTER_CINE", (await page.locator("body").innerText()).slice(0, 400));
  const keep = page.getByRole("button", { name: /Garder cette main/i });
  if (await keep.count()) {
    await keep.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: "/workspace/screenshots/qa-board.png" });
    console.log("BOARD", (await page.locator("body").innerText()).slice(0, 400));
    const end = page.getByRole("button", { name: /Fin du tour/i });
    console.log("END_TURN", await end.count());
  } else {
    console.log("NO_MULLIGAN_BUTTON");
  }
}

await page.goto("http://127.0.0.1:8080/shop", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "/workspace/screenshots/qa-shop.png" });
const openBtn = page.getByRole("button", { name: /Ouvrir/i }).first();
if (await openBtn.count()) {
  await openBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/qa-pack.png" });
  console.log("PACK", (await page.locator("body").innerText()).slice(0, 220));
}
await browser.close();
