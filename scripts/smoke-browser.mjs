/* Fix batch 2026-11-20 browser smoke (client side gallery behaviour).
 *   BASE=http://localhost:3100 PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node scripts/smoke-browser.mjs [item...]
 * Playwright is not an app dependency; point PLAYWRIGHT at any local install. */
const PW = process.env.PLAYWRIGHT || "/home/hatch/workspace/demo-engine/node_modules/playwright/index.mjs";
const { chromium, devices } = await import(PW);
const BASE = process.env.BASE || "http://localhost:3100";
const GALLERY = process.env.GALLERY || "/g/emma-james-wedding";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

async function ownerCookie() {
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "demo@pixelset.app", password: "demo1234" }) });
  const raw = (res.headers.get("set-cookie") || "").split(";")[0];
  const [name, value] = raw.split("=");
  return { name, value, url: BASE };
}

const browser = await chromium.launch();
const cookie = await ownerCookie();

async function openDownload(contextOpts) {
  const ctx = await browser.newContext(contextOpts);
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  await page.goto(BASE + GALLERY, { waitUntil: "networkidle" });
  await page.locator("img[loading=lazy]").first().click();
  await page.getByRole("button", { name: /Download$/ }).last().click();
  return { ctx, page };
}

const items = {
  async languages() {
    // French gallery on an iPhone: the interface and the save steps are French, user content is not
    const { PrismaClient } = (await import("@prisma/client")).default;
    const db = new PrismaClient();
    const before = await db.collection.findUniqueOrThrow({ where: { slug: "smoke-video-fixture" } });
    await db.collection.update({ where: { id: before.id }, data: { language: "fr" } });
    const ctx = await browser.newContext(devices["iPhone 13"]);
    const page = await ctx.newPage();
    await page.goto(BASE + "/g/smoke-video-fixture", { waitUntil: "networkidle" });
    const lang = await page.locator(".gallery-root").getAttribute("lang");
    check("French gallery: page tagged lang=fr", lang === "fr", String(lang));
    await page.locator("img[loading=lazy]").first().click();
    await page.getByRole("button", { name: /Télécharger$/ }).last().click();
    const steps = page.locator('[data-testid="mobile-save-steps"]');
    await steps.waitFor({ timeout: 10000 });
    const text = await steps.innerText();
    check("French gallery: iPhone save steps in French", text.includes("Enregistrer dans Photos") && text.includes("iPhone et iPad"), text.split("\n")[0]);
    check("French gallery: dialog title translated", (await page.getByText("Télécharger la photo").count()) === 1);
    await ctx.close();
    await db.collection.update({ where: { id: before.id }, data: { language: before.language } });
    await db.$disconnect();
  },
  async videocomments() {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/g/smoke-video-fixture", { waitUntil: "networkidle" });
    await page.locator("img[loading=lazy]").first().click();
    await page.keyboard.press("ArrowRight");
    const video = page.locator('[data-testid="lightbox-video"]');
    await video.waitFor({ timeout: 10000 });
    await page.waitForFunction(() => { const v = document.querySelector('[data-testid="lightbox-video"]'); return v && v.readyState >= 1; }, null, { timeout: 15000 });
    await video.evaluate((v) => { v.pause(); v.currentTime = 5.2; });
    await page.waitForFunction(() => document.body.innerText.includes("Pin to 0:05"), null, { timeout: 10000 });
    check("comment box offers the current video time", true);
    const note = `browser timecode ${Date.now()}`;
    await page.locator('textarea[placeholder^="Leave a comment"]').fill(note);
    await page.getByRole("button", { name: "Post Comment" }).click();
    const email = page.locator('input[type=email]');
    if (await email.isVisible().catch(() => false)) {
      await email.fill("browser-viewer@example.com");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(1500);
      await video.evaluate((v) => { v.pause(); v.currentTime = 5.2; });
      await page.waitForFunction(() => document.body.innerText.includes("Pin to 0:05"), null, { timeout: 10000 });
      const ta = page.locator('textarea[placeholder^="Leave a comment"]');
      if (!(await ta.inputValue())) await ta.fill(note);
      await page.getByRole("button", { name: "Post Comment" }).click();
    }
    const mine = page.locator('[data-testid="lightbox-comment"]', { hasText: note });
    await mine.waitFor({ timeout: 10000 });
    const chip = mine.locator('[data-testid="comment-timecode"]');
    check("posted comment shows its timecode in the lightbox", (await chip.innerText()) === "0:05");
    await video.evaluate((v) => { v.pause(); v.currentTime = 0; });
    await chip.click();
    await page.waitForTimeout(400);
    const t = await video.evaluate((v) => v.currentTime);
    check("clicking the timecode jumps the video there", t >= 4.9 && t < 7.5, String(t));
    await ctx.close();
  },
  async mobile() {
    for (const [label, opts, device, phrase] of [
      ["iPhone", devices["iPhone 13"], "ios", "Save to Photos"],
      ["Android Chrome", devices["Pixel 7"], "android", "Download image"],
    ]) {
      const { ctx, page } = await openDownload(opts);
      const steps = page.locator('[data-testid="mobile-save-steps"]');
      await steps.waitFor({ timeout: 10000 });
      const d = await steps.getAttribute("data-device");
      const text = await steps.innerText();
      check(`${label}: download dialog shows ${device} save steps`, d === device && text.includes(phrase), text.split("\n")[0]);
      await page.getByRole("button", { name: /instead\?/ }).click();
      const other = await steps.getAttribute("data-device");
      check(`${label}: other device steps one tap away`, other !== device);
      await ctx.close();
    }
    const { ctx, page } = await openDownload({ viewport: { width: 1280, height: 800 } });
    const summary = page.getByText("Saving on a phone? See the steps");
    check("desktop: phone steps tucked behind a disclosure", (await summary.count()) === 1);
    await ctx.close();
  },
};

const wanted = process.argv.slice(2);
for (const [name, fn] of Object.entries(items)) {
  if (wanted.length && !wanted.includes(name)) continue;
  console.log(`--- ${name} (browser)`);
  try {
    await fn();
  } catch (e) {
    check(`${name} threw`, false, e.message.split("\n")[0]);
  }
}
await browser.close();
console.log(failures ? `BROWSER SMOKE FAILED (${failures})` : "BROWSER SMOKE OK");
process.exit(failures ? 1 : 0);
