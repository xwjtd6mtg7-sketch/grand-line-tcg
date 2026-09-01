import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message, e.stack?.slice(0,400)));
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
page.on("response", (r) => {
  if (r.status() >= 400) console.log("HTTP", r.status(), r.url());
});
await page.goto("http://127.0.0.1:8081/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4000);
console.log("TEXT", (await page.locator("body").innerText()).slice(0, 400));
await page.screenshot({ path: "/workspace/screenshots/qa-built-wait.png" });
await browser.close();
