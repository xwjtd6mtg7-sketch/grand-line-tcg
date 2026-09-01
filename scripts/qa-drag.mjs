import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
await page.goto("http://127.0.0.1:8080/play", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Lancer le duel/i }).click();
await page.waitForTimeout(500);
await page.locator(".cine-root").click({ force: true }).catch(() => {});
await page.getByRole("button", { name: /Garder cette main/i }).waitFor({ timeout: 5000 });
await page.getByRole("button", { name: /Garder cette main/i }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/qa-drag-0.png" });
console.log("BOARD", (await page.locator("body").innerText()).slice(0, 400));

const drops = await page.locator("[data-drop]").evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return { drop: e.getAttribute("data-drop"), x: r.x + r.width / 2, y: r.y + r.height / 2, t: (e.innerText || "").slice(0, 40) };
  }),
);
const dons = await page.locator("[data-drag=don]").evaluateAll((els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: (e.innerText || "").slice(0, 40) };
  }),
);
console.log("DROPS", JSON.stringify(drops));
console.log("DONS", JSON.stringify(dons));

const don = dons[dons.length - 1];
const leader = drops.find((b) => b.drop === "my-leader");
const opp = drops.find((b) => b.drop === "opp-leader");

async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(450);
}

if (don && leader) {
  await drag(don, leader);
  await page.screenshot({ path: "/workspace/screenshots/qa-drag-don.png" });
  console.log("AFTER_DON", (await page.locator("body").innerText()).slice(0, 350));
}

if (leader && opp) {
  const leader2 = await page.locator("[data-drop=my-leader]").evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await drag(leader2, opp);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/qa-drag-atk.png" });
  console.log("AFTER_ATK", (await page.locator("body").innerText()).slice(0, 450));
}

await page.waitForTimeout(2200);
const pass = page.getByRole("button", { name: /Passer|Ne pas bloquer/i });
if (await pass.count()) {
  await pass.first().click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: "/workspace/screenshots/qa-drag-after.png" });
console.log("AFTER", (await page.locator("body").innerText()).slice(0, 400));
await browser.close();
