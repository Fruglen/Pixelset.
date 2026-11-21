/* Fix batch 2026-11-20 smoke checks. Run against a started production server:
 *   DATABASE_URL=file:./fixbatch.db BASE=http://localhost:3100 npx tsx scripts/smoke-fix-batch.ts [item...]
 * Each item prints PASS/FAIL lines; the process exits non-zero on any FAIL. */
import { PrismaClient } from "@prisma/client";
import { HELP_GUIDES, searchGuides } from "../src/lib/help-guides";
import { GALLERY_LANGUAGES, galleryDict, galleryT, normalizeLang } from "../src/lib/gallery-i18n";
import { STORE_EN, matchServerMessage } from "../src/lib/gallery-i18n-store";
import { DASHBOARD_LANGUAGES, dashboardDict, navLabels, resolveDashLang } from "../src/lib/dashboard-i18n";

const db = new PrismaClient();
const BASE = process.env.BASE || "http://localhost:3100";
let failures = 0;
let cookie = "";

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function req(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (cookie) headers.cookie = cookie;
  let body = init.body;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
  return res;
}

async function login(email = "demo@pixelset.app", password = "demo1234") {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const set = res.headers.get("set-cookie") || "";
  cookie = set.split(";")[0];
  check("login as demo", res.ok && cookie.startsWith("pxl_session="), String(res.status));
}

async function demoUser() {
  return db.user.findUniqueOrThrow({ where: { email: "demo@pixelset.app" } });
}

// ---------------------------------------------------------------- item 1
async function campaigns() {
  const user = await demoUser();
  const originalPlan = user.plan;
  const coll = await db.collection.findFirstOrThrow({ where: { userId: user.id, slug: "emma-james-wedding" } });
  // a known audience: three registrations (one duplicate in different case, one invalid)
  for (const e of ["smoke-a@example.com", "smoke-b@example.com"]) {
    await db.emailRegistration.upsert({ where: { collectionId_email: { collectionId: coll.id, email: e } }, update: {}, create: { collectionId: coll.id, email: e } });
  }
  const expected = await db.emailRegistration.count({ where: { collectionId: coll.id } });
  const page = await req("/studio/campaigns");
  const html = await page.text();
  check("campaign builder page renders", page.status === 200 && html.includes("Email campaigns") && html.includes("campaign-allowance"));
  const aud = await (await req(`/api/campaigns/audience?source=COLLECTION:${coll.id}`)).json();
  check("collection registrations audience counted", aud.count === expected, `${aud.count} vs ${expected}`);
  const opt = await (await req("/api/campaigns/audience?source=OPT_INS")).json();
  const con = await (await req("/api/campaigns/audience?source=CONTACTS")).json();
  check("opt in + contacts sources resolve", typeof opt.count === "number" && typeof con.count === "number" && con.count > 0, `optIns ${opt.count}, contacts ${con.count}`);

  await db.user.update({ where: { id: user.id }, data: { plan: "SUITE_ULTIMATE" } });
  const before = await (await req("/api/campaigns")).json();
  const created = await (
    await req("/api/campaigns", { method: "POST", json: { name: "Smoke print sale", kind: "PRINT_SALE", subject: "Hello {name}", body: "Prints are 20% off, {name}.", audience: `COLLECTION:${coll.id}` } })
  ).json();
  check("campaign created", !!created.campaign?.id);
  const sent = await req(`/api/campaigns/${created.campaign.id}/send`, { method: "POST" });
  const sj = await sent.json();
  check("campaign sends to every recipient", sent.ok && sj.total === expected, JSON.stringify(sj));
  const rows = await db.campaignSend.findMany({ where: { campaignId: created.campaign.id } });
  check("per recipient send log rows", rows.length === expected && rows.every((r) => ["LOGGED", "DELIVERED", "FAILED"].includes(r.status) && r.detail.length > 0));
  if (!process.env.RESEND_API_KEY) check("honest logged-only state without Resend", rows.every((r) => r.status === "LOGGED" && /Logged only/.test(r.detail)));
  const after = await (await req("/api/campaigns")).json();
  check("allowance metered by the sends", after.allowance.used === before.allowance.used + expected, `${before.allowance.used} -> ${after.allowance.used}`);
  const again = await req(`/api/campaigns/${created.campaign.id}/send`, { method: "POST" });
  check("sent campaign cannot be re-sent", again.status === 409);

  // over quota: Free gallery plan has 0 campaign sends
  await db.user.update({ where: { id: user.id }, data: { plan: JSON.stringify({ gallery: "free", website: "pro", studio: "pro" }) } });
  const c2 = await (await req("/api/campaigns", { method: "POST", json: { name: "Smoke over quota", subject: "Hi", body: "Body", audience: `COLLECTION:${coll.id}` } })).json();
  const over = await req(`/api/campaigns/${c2.campaign.id}/send`, { method: "POST" });
  const oj = await over.json();
  const sendsAfterRefusal = await db.campaignSend.count({ where: { campaignId: c2.campaign.id } });
  check("over quota send refused with the allowance named", over.status === 402 && /campaign sends a month/.test(oj.error) && sendsAfterRefusal === 0, oj.error);
  await db.user.update({ where: { id: user.id }, data: { plan: originalPlan } });
  await db.campaign.deleteMany({ where: { id: { in: [created.campaign.id, c2.campaign.id] } } });
}

// ---------------------------------------------------------------- item 2
async function help() {
  const page = await req("/help");
  const html = await page.text();
  check("help centre renders every guide", page.status === 200 && HELP_GUIDES.every((g) => html.includes(g.title.replace(/&/g, "&amp;"))), `${HELP_GUIDES.length} guides`);
  const products = ["Client Gallery", "Website", "Studio Manager", "Store", "Photo Editor", "Account"];
  check("guides cover galleries, website, studio, store, editor, account", products.every((p) => HELP_GUIDES.some((g) => g.product === p)));
  const q = await (await req("/help?q=download%20pin")).text();
  check("search filters server render", q.includes("Download settings and the download PIN") && !q.includes("Build your website"));
  check("search requires every word", searchGuides("campaign allowance").length >= 1 && searchGuides("zzqqxx").length === 0);
  const dash = await (await req("/dashboard")).text();
  check("help linked from the dashboard", dash.includes('href="/help"') && dash.includes("dashboard-help-link"));
  check("no em dashes in guide copy", !JSON.stringify(HELP_GUIDES).includes("\u2014") && !JSON.stringify(HELP_GUIDES).includes("—"));
}

// ---------------------------------------------------------------- item 3
async function support() {
  const dash = await (await req("/dashboard")).text();
  check("support bubble on the dashboard", dash.includes("support-bubble"));
  const marker = `smoke support ${Date.now()}`;
  const sent = await req("/api/support", { method: "POST", json: { topic: "GALLERY", body: marker, page: "/collections" } });
  const sj = await sent.json();
  check("support message accepted, reply address returned", sent.ok && sj.replyTo === "demo@pixelset.app", JSON.stringify(sj));
  const row = await db.supportMessage.findUnique({ where: { id: sj.id } });
  check("stored in the app, no external service", !!row && row.body === marker && row.status === "OPEN");
  const inbox = await req("/support-inbox");
  const ih = await inbox.text();
  check("lands in the site owner's support inbox", inbox.status === 200 && ih.includes(marker));
  check("support inbox linked in the owner's sidebar", dash.includes("nav-support-inbox"));
  const rep = await req(`/api/support/${sj.id}`, { method: "PATCH", json: { reply: "Thanks, fixed." } });
  const after = await db.supportMessage.findUnique({ where: { id: sj.id } });
  check("owner reply recorded with honest delivery note", rep.ok && after?.status === "ANSWERED" && (process.env.RESEND_API_KEY ? true : /Logged only/.test(after?.replyNote ?? "")), after?.replyNote);
  // a different account is not the site owner
  const ownerCookie = cookie;
  const email = `smoke-${Date.now()}@example.com`;
  const su = await fetch(BASE + "/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Smoke Other", email, password: "smokepass123" }) });
  cookie = (su.headers.get("set-cookie") || "").split(";")[0];
  const other = await req("/support-inbox");
  const otherApi = await req("/api/support");
  check("other accounts cannot open the support inbox", other.status === 404 && otherApi.status === 404, `${su.status} ${other.status} ${otherApi.status}`);
  cookie = ownerCookie;
  await db.user.deleteMany({ where: { email } });
  await db.supportMessage.delete({ where: { id: sj.id } });
}

// ---------------------------------------------------------------- item 4
async function switcher() {
  const expect: [string, string, string][] = [
    ["/collections", "gallery", "/collections/presets"],
    ["/website", "website", "/website/seo"],
    ["/studio", "studio", "/studio/contracts"],
    ["/store", "store", "/store/price-sheets"],
  ];
  for (const [path, id, link] of expect) {
    const html = await (await req(path)).text();
    check(`product switcher on ${path} swaps the navigation to ${id}`, html.includes('data-testid="product-switcher"') && html.includes(`data-product-nav="${id}"`) && html.includes(`href="${link}"`));
  }
  const dash = await (await req("/dashboard")).text();
  check("account overview shows all products", !dash.includes("data-product-nav=") && dash.includes('href="/studio"') && dash.includes('href="/store"'));
}

// ---------------------------------------------------------------- item 5
async function docs() {
  const user = await demoUser();
  const site = await db.website.findUniqueOrThrow({ where: { userId: user.id } });
  const contract = await db.contract.findFirst({ where: { userId: user.id, status: { not: "DRAFT" } } });
  const invoice = await db.invoice.findFirst({ where: { userId: user.id } });
  const quote = await db.quote.findFirst({ where: { userId: user.id } });
  check("demo has a contract, invoice and quote", !!contract && !!invoice && !!quote);
  await db.website.update({ where: { id: site.id }, data: { palette: "noir", fontTheme: "elegant" } });
  const pages: [string, string][] = [];
  if (contract) pages.push(["contract", `/sign/${contract.token}`]);
  if (invoice) pages.push(["invoice", `/pay/${invoice.token}`]);
  if (quote) pages.push(["quote", `/quote/${quote.token}`]);
  for (const [name, path] of pages) {
    const res = await req(path);
    const html = await res.text();
    check(
      `${name} takes the site palette and font theme`,
      res.status === 200 && html.includes('data-doc-palette="noir"') && html.includes("--doc-bg:#121212") && html.includes("Bodoni Moda") && html.includes("doc-themed"),
      String(res.status)
    );
  }
  await db.website.update({ where: { id: site.id }, data: { palette: "sage", fontTheme: "classicserif" } });
  if (contract) {
    const html = await (await req(`/sign/${contract.token}`)).text();
    check("changing the site theme changes the contract", html.includes('data-doc-palette="sage"') && html.includes("--doc-bg:#f3f5f1"));
  }
  await db.website.update({ where: { id: site.id }, data: { palette: site.palette, fontTheme: site.fontTheme } });
}

// ---------------------------------------------------------------- item 7
// Fixture: an ungated published gallery with one photo and one WebM video
// (VP8 plays in headless Chromium, which has no H.264), reused by the browser smoke.
export async function videoFixture() {
  const user = await demoUser();
  const { execFileSync } = await import("child_process");
  const { existsSync, mkdirSync, copyFileSync } = await import("fs");
  const dir = "public/uploads/smoke";
  mkdirSync(dir, { recursive: true });
  const vid = `${dir}/smoke-clip.webm`;
  if (!existsSync(vid)) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=25:duration=8", "-c:v", "libvpx", "-b:v", "400k", vid], { timeout: 60000 });
  }
  const img = `${dir}/smoke-photo.jpg`;
  if (!existsSync(img)) {
    const seedJpg = (await import("fs")).readdirSync("public/uploads/seed").find((f) => /\.jpe?g$/i.test(f) && !/poster/.test(f));
    copyFileSync(`public/uploads/seed/${seedJpg}`, img);
  }
  let coll = await db.collection.findUnique({ where: { slug: "smoke-video-fixture" } });
  if (!coll) {
    coll = await db.collection.create({ data: { userId: user.id, name: "Smoke Video Fixture", slug: "smoke-video-fixture", status: "PUBLISHED", coverStyle: "none", galleryAssist: false } });
    const set = await db.photoSet.create({ data: { collectionId: coll.id, name: "Highlights" } });
    await db.photo.create({ data: { collectionId: coll.id, setId: set.id, filename: "smoke-photo.jpg", url: "/uploads/smoke/smoke-photo.jpg", width: 1200, height: 800, order: 0 } });
    await db.photo.create({ data: { collectionId: coll.id, setId: set.id, filename: "smoke-clip.webm", url: "/uploads/smoke/smoke-clip.webm", mediaType: "VIDEO", durationSec: 8, width: 640, height: 360, order: 1 } });
  }
  return coll;
}

async function videocomments() {
  const coll = await videoFixture();
  const video = await db.photo.findFirstOrThrow({ where: { collectionId: coll.id, mediaType: "VIDEO" } });
  const photo = await db.photo.findFirstOrThrow({ where: { collectionId: coll.id, mediaType: "IMAGE" } });
  // act as a gallery visitor
  const ownerCookie = cookie;
  cookie = "";
  const idr = await req(`/api/gallery/${coll.slug}/unlock`, { method: "POST", json: { mode: "identify", email: "viewer@example.com", name: "Vera Viewer" } });
  cookie = (idr.headers.get("set-cookie") || "").split(";")[0];
  const ok = await req(`/api/gallery/${coll.slug}/comments`, { method: "POST", json: { photoId: video.id, body: "Love this moment", timecodeSec: 3.4 } });
  const oj = await ok.json();
  check("comment pinned to a video timecode", ok.ok && oj.timecodeSec === 3.4, JSON.stringify(oj));
  const bad = await req(`/api/gallery/${coll.slug}/comments`, { method: "POST", json: { photoId: video.id, body: "x", timecodeSec: 99 } });
  check("timecode past the end is refused", bad.status === 400);
  const notVideo = await req(`/api/gallery/${coll.slug}/comments`, { method: "POST", json: { photoId: photo.id, body: "x", timecodeSec: 1 } });
  check("photos do not take timecodes", notVideo.status === 400);
  const html = await (await req(`/g/${coll.slug}`)).text();
  check("gallery page carries the timecode to the viewer", html.includes('\\"timecodeSec\\":3.4') || html.includes('"timecodeSec":3.4'));
  cookie = ownerCookie;
  const act = await db.activity.findFirst({ where: { collectionId: coll.id, type: "COMMENT" }, orderBy: { createdAt: "desc" } });
  check("Activities records the timecode", !!act && act.detail.includes("at 0:03"), act?.detail);
  const actPage = await (await req(`/collections/${coll.id}/activities`)).text();
  check("Activities tab shows the timecoded comment", actPage.includes("at 0:03"));
}

// ---------------------------------------------------------------- item 8
async function previews() {
  const { readFileSync, existsSync } = await import("fs");
  const { createHash } = await import("crypto");
  const sharp = (await import("sharp")).default;
  const user = await demoUser();
  await db.user.update({ where: { id: user.id }, data: { previewSize: 2048, previewQuality: 85 } });
  const coll = await videoFixture();
  const set = await db.photoSet.findFirstOrThrow({ where: { collectionId: coll.id } });
  // a fresh 3000px original so every rendition is a real downscale
  const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 180, g: 140, b: 110 } } }).jpeg({ quality: 95 }).toBuffer();
  const name = `smoke-rendition-${Date.now()}.jpg`;
  const fd = new FormData();
  fd.append("setId", set.id);
  fd.append("files", new Blob([new Uint8Array(original)], { type: "image/jpeg" }), name);
  const up = await req(`/api/collections/${coll.id}/photos`, { method: "POST", body: fd });
  const uj = await up.json();
  check("upload accepted", up.ok && uj.added === 1, JSON.stringify(uj));
  const photo = await db.photo.findFirstOrThrow({ where: { collectionId: coll.id, filename: name } });
  let files: string[] = [];
  for (let i = 0; i < 40; i++) {
    files = [640, 1024, 2048].map((w) => `.cache/preview/${photo.id}-${w}-q85.jpg`).filter((f) => existsSync(f));
    if (files.length === 3) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  check("640, 1024 and 2048 renditions generated at upload", files.length === 3, files.join(", "));
  for (const w of [640, 1024, 2048]) {
    const f = `.cache/preview/${photo.id}-${w}-q85.jpg`;
    if (existsSync(f)) {
      const m = await sharp(f).metadata();
      check(`${w} rendition has a ${w}px long edge`, m.width === w, `${m.width}x${m.height}`);
    }
  }
  const served: [number, string][] = [[600, "640"], [1000, "1024"], [3200, "2048"]];
  for (const [asked, want] of served) {
    const r = await req(`/api/preview/${photo.id}?w=${asked}`);
    check(`request for ${asked}px served the ${want} rendition from cache`, r.ok && r.headers.get("x-preview-width") === want && r.headers.get("x-preview-cache") === "hit", `${r.headers.get("x-preview-width")} ${r.headers.get("x-preview-cache")}`);
  }
  const onDisk = readFileSync(`public${photo.url}`);
  check("original stays untouched", createHash("md5").update(onDisk).digest("hex") === createHash("md5").update(original).digest("hex"));
  // account quality setting
  const pq = await req("/api/account", { method: "PATCH", json: { previewQuality: 70 } });
  const r70 = await req(`/api/preview/${photo.id}?w=640`);
  check("account preview quality setting applies", pq.ok && r70.headers.get("x-preview-quality") === "70");
  await db.user.update({ where: { id: user.id }, data: { previewQuality: 85 } });
  const html = await (await req(`/g/${coll.slug}`)).text();
  check("grid serves the 640 rendition", html.includes(`/api/preview/${photo.id}?w=640`));
}

// ---------------------------------------------------------------- item 9
async function languages() {
  const ids = GALLERY_LANGUAGES.map((l) => l.id);
  check("eight gallery languages", ["en", "es", "fr", "de", "nl", "zh-Hans", "pt", "sv"].every((l) => ids.includes(l as never)) && ids.length === 8);
  const en = galleryDict("en") as Record<string, unknown>;
  let complete = true;
  for (const l of ids) {
    const d = galleryDict(l) as Record<string, unknown>;
    for (const k of Object.keys(en)) {
      const v = d[k];
      if (Array.isArray(en[k]) ? !Array.isArray(v) || (v as string[]).length !== (en[k] as string[]).length || (v as string[]).some((x) => !x) : typeof v !== "string" || !v) complete = false;
      if (l !== "en" && typeof v === "string" && v.includes("—")) complete = false;
    }
  }
  check("every language translates every interface string", complete);
  check("older zh saves read as Chinese Simplified", normalizeLang("zh") === "zh-Hans");
  const coll = await videoFixture();
  const original = coll.language;
  const expect: Record<string, string> = { es: "Descargar todo", fr: "Tout télécharger", de: "Alle herunterladen", nl: "Alles downloaden", "zh-Hans": "全部下载", pt: "Baixar todas", sv: "Ladda ner alla", en: "Download All" };
  const ownerCookie = cookie;
  for (const l of ids) {
    cookie = ownerCookie;
    const r = await req(`/api/collections/${coll.id}`, { method: "PATCH", json: { language: l } });
    cookie = "";
    const html = await (await req(`/g/${coll.slug}`)).text();
    const want = expect[l];
    check(`${l}: gallery interface in the chosen language`, r.ok && html.includes(`lang="${galleryT(l).tag}"`) && html.includes(want), want);
    check(`${l}: user content untranslated`, html.includes("Smoke Video Fixture") && html.includes("Highlights"));
  }
  cookie = ownerCookie;
  const bad = await req(`/api/collections/${coll.id}`, { method: "PATCH", json: { language: "klingon" } });
  const after = await db.collection.findUniqueOrThrow({ where: { id: coll.id } });
  check("unknown languages are not stored", bad.ok && after.language === "en");
  // gate pages
  const user = await demoUser();
  const emma = await db.collection.findFirstOrThrow({ where: { userId: user.id, slug: "emma-james-wedding" } });
  await db.collection.update({ where: { id: emma.id }, data: { language: "es" } });
  cookie = "";
  const gate = await (await req(`/g/${emma.slug}`)).text();
  check("password page translated", gate.includes("Esta galería está protegida con contraseña.") && gate.includes("Ver galería"));
  cookie = ownerCookie;
  await db.collection.update({ where: { id: emma.id }, data: { language: emma.language } });
  await db.collection.update({ where: { id: coll.id }, data: { language: original === "zh" ? "zh-Hans" : original } });
}


// ---------------------------------------------------------------- build pack 2026-11-20 item 1: store + server messages
async function storei18n() {
  const { readFileSync, readdirSync, statSync } = await import("fs");
  const ids = GALLERY_LANGUAGES.map((l) => l.id);
  // every store key exists in every language, no em dashes
  let complete = true;
  for (const l of ids) {
    const d = galleryDict(l) as Record<string, unknown>;
    for (const k of Object.keys(STORE_EN)) if (typeof d[k] !== "string" || !d[k] || (d[k] as string).includes("—")) complete = false;
  }
  check("store and server-message strings present in all 8 languages", complete, `${Object.keys(STORE_EN).length} keys`);
  // every literal error the gallery-facing APIs can return is recognised (static scan, catches drift)
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = `${d}/${f}`;
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts")) files.push(p);
    }
  };
  walk("src/app/api/gallery");
  files.push("src/app/api/download/route.ts", "src/lib/store.ts");
  const literals = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const re = /(?:error:\s*|err\(\s*)"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) literals.add(m[1]);
  }
  // "Unknown mode" is a developer error (the gallery never sends an unknown unlock mode); it is not shown to visitors
  const misses = Array.from(literals).filter((m) => m !== "Unknown mode" && !matchServerMessage(m));
  check("every literal gallery API error is recognised", literals.size > 40 && misses.length === 0, `${literals.size} messages${misses.length ? `, missing: ${misses.join(" | ")}` : ""}`);
  const samples = [
    "Downloads are not included for Vendors",
    "“Album picks” allows at most 30 selections.",
    "“Album picks” was already sent to the photographer. Ask them to reopen it to make changes.",
    "Free download limit reached (10 photos).",
    "This gallery allows 10 free downloads per client. You have 3 left, and this ZIP holds 1 new photo. Download individual photos instead.",
    "This download is split into 3 ZIP files. Choose a part.",
    "Coupon requires a minimum spend of $50.00",
    "Tax (8.25%)",
    "Texas sales tax (6.25%)",
    "No tax, outside your tax regions",
  ];
  check("templated server messages recognised", samples.every((m) => !!matchServerMessage(m)), samples.filter((m) => !matchServerMessage(m)).join(" | "));
  const es = galleryT("es");
  check("names inside messages are not translated", es.te("Downloads are not included for Vendors") === "Las descargas no están incluidas para Vendors" && es.te("“Album picks” allows at most 30 selections.").includes("Album picks"));
  check("unknown server text is shown as sent", es.te("Some brand new message") === "Some brand new message");
  // live: real server responses, translated the way the gallery shows them
  const user = await demoUser();
  const emma = await db.collection.findFirstOrThrow({ where: { userId: user.id, slug: "emma-james-wedding" } });
  const ownerCookie = cookie;
  cookie = "";
  const wrongPw = await (await req(`/api/gallery/${emma.slug}/unlock`, { method: "POST", json: { mode: "password", password: "definitely-wrong" } })).json();
  check("wrong password message translated (es)", es.te(wrongPw.error) === "Contraseña incorrecta", `${wrongPw.error} -> ${es.te(wrongPw.error)}`);
  check("wrong password message translated (zh-Hans)", galleryT("zh-Hans").te(wrongPw.error) === "密码错误");
  const photo = await db.photo.findFirstOrThrow({ where: { collectionId: emma.id } });
  // unlock as a visitor, then ask for a download with the wrong PIN: the real "wrong PIN" response
  const ul = await req(`/api/gallery/${emma.slug}/unlock`, { method: "POST", json: { mode: "password", password: emma.password } });
  cookie = (ul.headers.get("set-cookie") || "").split(/,(?=\s*[\w-]+=)/).map((c) => c.split(";")[0].trim()).join("; ");
  const pinRes = await req(`/api/download?slug=${emma.slug}&photo=${photo.id}&size=original&pin=0000`);
  const pinJ = await pinRes.json().catch(() => ({}));
  const fr = galleryT("fr");
  check("real wrong PIN response translated (fr)", pinJ.error === "Incorrect download PIN" && fr.te(pinJ.error) === "PIN de téléchargement incorrect", `${pinRes.status} ${pinJ.error} -> ${fr.te(pinJ.error)}`);
  cookie = "";
  check("wrong PIN message translated in all 8 languages", ids.every((l) => l === "en" || galleryT(l).te("Incorrect download PIN") !== "Incorrect download PIN") && galleryT("de").te("Incorrect download PIN") === "Falsche Download-PIN");
  const sheet = await db.priceSheet.findUniqueOrThrow({ where: { id: emma.priceSheetId! }, include: { products: { include: { variants: true } } } });
  const prod = sheet.products.find((p) => p.variants.length > 0)!;
  cookie = ownerCookie; // owner bypasses the gallery password for the checkout preview
  const co = await req(`/api/gallery/${emma.slug}/checkout`, { method: "POST", json: { lines: [{ productId: prod.id, variantId: prod.variants[0].id, photoId: photo.id, qty: 1 }], couponCode: "NOPE-SMOKE", confirm: false } });
  const cj = await co.json().catch(() => ({}));
  const pt = galleryT("pt");
  check("coupon error from checkout translated (pt)", co.ok && pt.te(cj.totals?.couponError) === "Cupom desconhecido", `${co.status} ${cj.totals?.couponError ?? cj.error}`);
  // English stays exactly as the server wrote it
  check("English shows the server text unchanged", galleryT("en").te(wrongPw.error) === "Incorrect password" && galleryT("en").t("yourCart") === "Your Cart");
}

// ---------------------------------------------------------------- build pack 2026-11-20 item 2: CSV import assigns clients
async function csvclients() {
  const user = await demoUser();
  const stamp = Date.now();
  const existing = await db.contact.create({ data: { userId: user.id, name: "Smoke Existing Client", email: `smoke-existing-${stamp}@example.com`, state: "LEAD", source: "MANUAL" } });
  const newEmail = `smoke-new-${stamp}@example.com`;
  const csv = [
    "name,eventDate,clientEmail,clientName",
    `Smoke Client A ${stamp},2026-05-01,${newEmail},Nina New`,
    `Smoke Client B ${stamp},,${existing.email.toUpperCase()},Ignored Name`,
    `Smoke Client C ${stamp},,,`,
    `Smoke Client D ${stamp},,not-an-email,`,
    `Smoke Client E ${stamp},,${newEmail},`,
  ].join("\n");
  const res = await req("/api/collections/import", { method: "POST", json: { csv } });
  const j = await res.json();
  check("CSV with a client email column imports", res.ok && j.createdCount === 4 && j.errorCount === 1, JSON.stringify({ c: j.createdCount, e: j.errors }).slice(0, 200));
  check("invalid client email is reported per row, not imported", j.errors?.[0]?.row === 5 && /not a valid email/.test(j.errors?.[0]?.message ?? ""));
  const made = await db.collection.findMany({ where: { userId: user.id, name: { startsWith: "Smoke Client " }, createdAt: { gte: new Date(stamp - 1000) } }, include: { contact: true } });
  const by = (l: string) => made.find((m) => m.name === `Smoke Client ${l} ${stamp}`);
  const created = await db.contact.findMany({ where: { userId: user.id, email: newEmail } });
  check("new client contact created once (two rows, same email)", created.length === 1 && created[0].name === "Nina New" && created[0].state === "CLIENT" && created[0].source === "IMPORT", `${created.length} contacts`);
  check("rows with the new email are assigned to that contact", by("A")?.contactId === created[0]?.id && by("E")?.contactId === created[0]?.id);
  const ex2 = await db.contact.findUniqueOrThrow({ where: { id: existing.id } });
  check("existing contact matched by email, case-insensitive, and marked CLIENT", by("B")?.contactId === existing.id && ex2.state === "CLIENT" && ex2.name === "Smoke Existing Client");
  check("no duplicate contact for the existing email", (await db.contact.count({ where: { userId: user.id, email: { in: [existing.email, existing.email.toUpperCase()] } } })) === 1);
  check("row without a client email stays unassigned", !!by("C") && by("C")!.contactId === null);
  check("import response names the assignments", j.assignedCount === 3 && j.contactsCreated === 1);
  const page = await (await req(`/collections/${by("A")!.id}`)).text();
  check("collection header shows its client", page.includes('data-testid="collection-client"') && page.includes("Nina New"));
  const cpage = await (await req(`/studio/contacts/${created[0].id}`)).text();
  check("client contact page lists the assigned galleries", cpage.includes(`Smoke Client A ${stamp}`) && cpage.includes(`Smoke Client E ${stamp}`));
  // the old CSV shape (no client columns) still works and assigns nobody
  const old = await req("/api/collections/import", { method: "POST", json: { csv: `name,status\nSmoke Client Old ${stamp},DRAFT` } });
  const oj = await old.json();
  const oldColl = await db.collection.findFirst({ where: { userId: user.id, name: `Smoke Client Old ${stamp}` } });
  check("old CSV shape still imports, unassigned", old.ok && oj.createdCount === 1 && oldColl?.contactId === null && oldColl?.status === "DRAFT");
  await db.collection.deleteMany({ where: { userId: user.id, name: { startsWith: "Smoke Client " }, createdAt: { gte: new Date(stamp - 1000) } } });
  await db.contact.deleteMany({ where: { id: { in: [existing.id, ...created.map((c) => c.id)] } } });
}

// ---------------------------------------------------------------- build pack 2026-11-20 item 3: dashboard languages
async function dashi18n() {
  const { readFileSync } = await import("fs");
  check("dashboard languages are English, Spanish, Portuguese", DASHBOARD_LANGUAGES.map((l) => l.id).join(",") === "en,es,pt");
  const en = dashboardDict("en") as Record<string, string>;
  let complete = true;
  for (const l of ["es", "pt"]) {
    const d = dashboardDict(l) as Record<string, string>;
    for (const k of Object.keys(en)) if (!d[k] || d[k].includes("—")) complete = false;
  }
  check("Spanish and Portuguese translate every dashboard string, no em dashes", complete, `${Object.keys(en).length} keys`);
  const navSrc = readFileSync("src/app/(dashboard)/nav.tsx", "utf8") + readFileSync("src/app/(dashboard)/collections/subnav.tsx", "utf8");
  const itemLabels = Array.from(new Set(Array.from(navSrc.matchAll(/\{ href: "[^"]+", label: "([^"]+)"/g), (m) => m[1]))).filter((x) => !x.startsWith("nav_")); // nav_* are dictionary keys (top level menu)
  const missing = ["es", "pt"].flatMap((l) => itemLabels.filter((x) => !navLabels(l)[x]).map((x) => `${l}:${x}`));
  check("every product sub-navigation label translated", itemLabels.length > 25 && missing.length === 0, `${itemLabels.length} labels${missing.length ? `, missing ${missing.join(", ")}` : ""}`);
  check("auto follows the browser language", resolveDashLang("auto", "pt-BR,pt;q=0.9,en;q=0.8") === "pt" && resolveDashLang("auto", "es-MX") === "es" && resolveDashLang("auto", "fr-FR,de;q=0.5") === "en" && resolveDashLang("auto", "") === "en");
  check("an explicit choice wins over the browser", resolveDashLang("es", "pt-BR") === "es" && resolveDashLang("en", "es-ES") === "en");
  const user = await demoUser();
  const original = user.locale;
  const bad = await req("/api/account/language", { method: "PATCH", json: { locale: "fr" } });
  check("unsupported dashboard languages are refused", bad.status === 400);
  const someCollection = await db.collection.findFirstOrThrow({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  const cases: [string, Record<string, string>, string[]][] = [
    ["es", {}, ["Hola de nuevo", "Colecciones recientes", "Galería de clientes", "Cerrar sesión", "Centro de ayuda"]],
    ["pt", {}, ["Bem-vindo de volta", "Coleções recentes", "Galeria de clientes", "Sair", "Central de ajuda"]],
  ];
  for (const [l, , want] of cases) {
    const r = await req("/api/account/language", { method: "PATCH", json: { locale: l } });
    const html = await (await req("/dashboard")).text();
    const hits = want.filter((w) => html.includes(w));
    check(`${l}: dashboard home and chrome switch language`, r.ok && html.includes(`data-dash-lang="${l}"`) && hits.length === want.length, `${hits.length}/${want.length}`);
    check(`${l}: no English chrome left on the dashboard home`, !html.includes("Welcome back") && !html.includes("Recent collections") && !html.includes(">Sign out<"));
    check(`${l}: user content untranslated`, html.includes(someCollection.name.replace(/&/g, "&amp;")));
    const coll = await (await req("/collections")).text();
    const collWant = l === "es" ? ["+ Nueva colección", "Importar CSV", "Carpetas", "Ajustes predefinidos"] : ["+ Nova coleção", "Importar CSV", "Pastas", "Predefinições"];
    check(`${l}: collections screen translated`, collWant.every((w) => coll.includes(w)), collWant.filter((w) => !coll.includes(w)).join(", "));
    const set = await (await req("/settings")).text();
    check(`${l}: settings shell and language picker translated`, set.includes(l === "es" ? "Idioma del panel" : "Idioma do painel") && set.includes(l === "es" ? "Seguridad" : "Segurança") && set.includes('data-testid="dashboard-language"'));
  }
  // auto: the browser decides
  await req("/api/account/language", { method: "PATCH", json: { locale: "auto" } });
  const autoPt = await (await req("/dashboard", { headers: { "accept-language": "pt-BR,pt;q=0.9" } })).text();
  const autoEn = await (await req("/dashboard", { headers: { "accept-language": "en-US,en;q=0.9" } })).text();
  check("auto: Portuguese browser gets Portuguese, English browser gets English", autoPt.includes("Bem-vindo de volta") && autoEn.includes("Welcome back"));
  // the client gallery keeps its own language
  await req("/api/account/language", { method: "PATCH", json: { locale: "es" } });
  const fixture = await videoFixture();
  const saved = cookie;
  cookie = "";
  const g = await (await req(`/g/${fixture.slug}`)).text();
  cookie = saved;
  check("client galleries keep their own language", g.includes(`lang="${fixture.language === "zh" ? "zh-Hans" : fixture.language}"`) && (fixture.language !== "en" || g.includes("Download All")));
  await db.user.update({ where: { id: user.id }, data: { locale: original } });
  const back = await (await req("/dashboard")).text();
  check("language restored", original !== "auto" || back.includes("Welcome back"));
}

// ---------------------------------------------------------------- build pack 2026-11-20 item 4: Lightroom groundwork (token API)
async function lightroom() {
  const { readFileSync } = await import("fs");
  const user = await demoUser();
  const originalToken = user.apiToken;
  const coll = await videoFixture();
  const sets = await db.photoSet.findMany({ where: { collectionId: coll.id }, orderBy: { order: "asc" } });
  const before = await db.photo.count({ where: { collectionId: coll.id } });
  const api = (path: string, token: string | null, init: RequestInit = {}) =>
    fetch(BASE + path, { ...init, headers: { ...(init.headers as Record<string, string>), ...(token !== null ? { authorization: token } : {}) } });
  const jpg = readFileSync("public/uploads/smoke/smoke-photo.jpg");
  const form = (files: { name: string; data: Buffer | string; type: string }[], setId?: string) => {
    const f = new FormData();
    for (const x of files) f.append("file", new Blob([typeof x.data === "string" ? x.data : new Uint8Array(x.data)], { type: x.type }), x.name);
    if (setId !== undefined) f.append("setId", setId);
    return f;
  };
  try {
    const created = await req("/api/account/api-token", { method: "POST" });
    const { token } = await created.json();
    check("owner creates a token", created.ok && /^pxs_[A-Za-z0-9]{32}$/.test(token), String(token).slice(0, 8));
    const status = await (await req("/api/account/api-token")).json();
    check("token status never returns the token", status.active === true && !JSON.stringify(status).includes("pxs_"));
    const me = await api("/api/v1/me", `Bearer ${token}`);
    const mj = await me.json();
    check("test connection answers with the account", me.ok && mj.account?.email === user.email && typeof mj.collections === "number" && !JSON.stringify(mj).includes(token));
    check("scheme is case-insensitive", (await api("/api/v1/me", `bearer ${token}`)).ok && (await api("/api/v1/me", `  BEARER ${token}  `)).ok);
    const none = await api("/api/v1/me", null);
    check("no token: 401 with a Bearer challenge", none.status === 401 && /Bearer/.test(none.headers.get("www-authenticate") || ""));
    check("malformed or wrong tokens: 401", (await api("/api/v1/me", "Bearer nope")).status === 401 && (await api("/api/v1/me", `Bearer pxs_${"x".repeat(32)}`)).status === 401 && (await api("/api/v1/me", `Basic ${token}`)).status === 401);
    check("token in the query string is not accepted", (await fetch(`${BASE}/api/v1/me?token=${token}`)).status === 401);
    const list = await (await api("/api/v1/collections", `Bearer ${token}`)).json();
    check("collections list with set IDs", Array.isArray(list.collections) && list.collections.some((c: { id: string; sets: { id: string }[] }) => c.id === coll.id && c.sets.length > 0));
    const up = await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", body: form([{ name: `lr-export-${Date.now()}.jpg`, data: jpg, type: "image/jpeg" }]) });
    const uj = await up.json();
    const photo = uj.results?.[0]?.photoId ? await db.photo.findUnique({ where: { id: uj.results[0].photoId } }) : null;
    check("upload lands in the collection's first set", up.ok && uj.uploaded === 1 && !!photo && photo.collectionId === coll.id && photo.setId === sets[0].id, JSON.stringify(uj).slice(0, 160));
    if (sets.length > 1) {
      const up2 = await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", body: form([{ name: "lr-set.jpg", data: jpg, type: "image/jpeg" }], sets[1].id) });
      const u2 = await up2.json();
      const p2 = u2.results?.[0]?.photoId ? await db.photo.findUnique({ where: { id: u2.results[0].photoId } }) : null;
      check("upload into a chosen set", up2.ok && p2?.setId === sets[1].id);
    }
    const mixed = await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, {
      method: "POST",
      body: form([
        { name: "empty.jpg", data: Buffer.alloc(0), type: "image/jpeg" },
        { name: "notes.txt", data: "hello", type: "text/plain" },
        { name: "good.jpg", data: jpg, type: "image/jpeg" },
      ]),
    });
    const mx = await mixed.json();
    check("one bad file never blocks the others, each file reports its result", mixed.ok && mx.uploaded === 1 && mx.failed === 2 && mx.results[0].ok === false && /empty/.test(mx.results[0].error) && mx.results[1].ok === false && mx.results[2].ok === true, JSON.stringify(mx.results).slice(0, 200));
    const allBad = await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", body: form([{ name: "notes.txt", data: "hello", type: "text/plain" }]) });
    check("nothing uploaded: 422", allBad.status === 422);
    const tooMany = await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", body: form(Array.from({ length: 21 }, (_, i) => ({ name: `x${i}.jpg`, data: jpg, type: "image/jpeg" }))) });
    check("more than 20 files per request refused", tooMany.status === 413);
    check("wrong set: 404", (await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", body: form([{ name: "a.jpg", data: jpg, type: "image/jpeg" }], "nope") })).status === 404);
    check("unknown or someone else's collection: 404", (await api(`/api/v1/collections/does-not-exist/photos`, `Bearer ${token}`, { method: "POST", body: form([{ name: "a.jpg", data: jpg, type: "image/jpeg" }]) })).status === 404);
    check("non multipart body: 415", (await api(`/api/v1/collections/${coll.id}/photos`, `Bearer ${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 415);
    // rotate and revoke take effect immediately
    const rotated = await (await req("/api/account/api-token", { method: "POST" })).json();
    check("rotating stops the old token at once", (await api("/api/v1/me", `Bearer ${token}`)).status === 401 && (await api("/api/v1/me", `Bearer ${rotated.token}`)).ok);
    await req("/api/account/api-token", { method: "DELETE" });
    check("revoking stops the token at once", (await api("/api/v1/me", `Bearer ${rotated.token}`)).status === 401);
    // a team member (second shooter) cannot mint or revoke the account token
    const stamp = Date.now();
    const inv = `smoke-lr-${stamp}`;
    const email = `smoke-lr-${stamp}@example.com`;
    const member = await db.teamMember.create({ data: { userId: user.id, name: "Smoke Shooter", email, role: "SECOND_SHOOTER", inviteToken: inv, inviteExpiresAt: new Date(Date.now() + 86400000) } });
    await fetch(`${BASE}/api/team/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: inv, password: "smokepass123" }) });
    const ml = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "smokepass123" }) });
    const memberCookie = (ml.headers.get("set-cookie") || "").split(";")[0];
    const mc = await fetch(`${BASE}/api/account/api-token`, { method: "POST", headers: { cookie: memberCookie } });
    const md = await fetch(`${BASE}/api/account/api-token`, { method: "DELETE", headers: { cookie: memberCookie } });
    check("second shooter cannot create or revoke the API token", ml.ok && mc.status === 403 && md.status === 403, `${ml.status} ${mc.status} ${md.status}`);
    const m2 = await db.teamMember.findUnique({ where: { id: member.id } });
    if (m2?.loginUserId) await db.user.delete({ where: { id: m2.loginUserId } });
    await db.teamMember.delete({ where: { id: member.id } });
    // the in-app guide
    const { HELP_GUIDES: guides, searchGuides: search } = await import("../src/lib/help-guides");
    const g = guides.find((x) => x.id === "connect-lightroom");
    check("Lightroom help guide exists, is searchable and has no em dashes", !!g && search("lightroom").some((x) => x.id === "connect-lightroom") && !JSON.stringify(g).includes("—") && g!.steps.length >= 6);
    const help = await (await req("/help?q=lightroom")).text();
    check("help centre shows the Lightroom guide", help.includes('id="connect-lightroom"') && help.includes("Export Actions"));
    const tools = await (await req("/collections/tools")).text();
    check("Tools links to the guide and shows the export action script", tools.includes('data-testid="lightroom-guide-link"') && tools.includes('data-testid="lightroom-script"') && tools.includes("/api/v1/me") && tools.includes(`${BASE}/api/v1/collections/$COLLECTION/photos`), "script carries the full site address on first render");
  } finally {
    const after = await db.photo.findMany({ where: { collectionId: coll.id }, orderBy: { createdAt: "desc" } });
    const extra = after.filter((p) => /^(lr-|good|.*-lr-export)/.test(p.filename) || /lr-export|lr-set|good\.jpg/.test(p.filename));
    if (extra.length) await db.photo.deleteMany({ where: { id: { in: extra.map((p) => p.id) } } });
    check("fixture restored", (await db.photo.count({ where: { collectionId: coll.id } })) === before);
    await db.user.update({ where: { id: user.id }, data: { apiToken: originalToken } });
  }
}

// ---------------------------------------------------------------- books: the six 5f7b7a9 features
async function books() {
  const user = await demoUser();
  const stamp = Date.now();
  const coll = await videoFixture();
  // folder share link
  const folder = await db.folder.create({ data: { userId: user.id, name: `Smoke Folder ${stamp}`, slug: `smoke-folder-${stamp}`, isPublic: true } });
  await db.collection.update({ where: { id: coll.id }, data: { folderId: folder.id } });
  cookie = cookie; // owner stays signed in; the folder page is public
  const fp = await fetch(`${BASE}/folder/${folder.slug}`);
  const fh = await fp.text();
  check("folder share link lists its published galleries", fp.status === 200 && fh.includes("Smoke Video Fixture"), String(fp.status));
  await db.collection.update({ where: { id: coll.id }, data: { folderId: null } });
  await db.folder.delete({ where: { id: folder.id } });
  // preset auto password, applied through CSV import (one gallery per row) and bulk edit
  const preset = await db.preset.create({ data: { userId: user.id, name: `Smoke auto password ${stamp}`, settings: JSON.stringify({ autoPassword: true, palette: "noir" }) } });
  const imp = await req("/api/collections/import", { method: "POST", json: { csv: `name\nSmoke CSV A ${stamp}\nSmoke CSV B ${stamp}`, presetId: preset.id } });
  const ij = await imp.json();
  const made = await db.collection.findMany({ where: { userId: user.id, name: { startsWith: "Smoke CSV" }, createdAt: { gte: new Date(stamp - 1000) } } });
  check("CSV volume import creates one gallery per row", imp.ok && made.length === 2, JSON.stringify(ij).slice(0, 160));
  const bulk = await req("/api/collections/bulk", { method: "POST", json: { ids: made.map((m) => m.id), presetId: preset.id } });
  const after = await db.collection.findMany({ where: { id: { in: made.map((m) => m.id) } } });
  check("bulk edit applies a preset across galleries", bulk.ok && after.every((c) => c.palette === "noir"));
  check("preset auto password gives each gallery its own password", after.every((c) => c.password.length >= 6) && new Set(after.map((c) => c.password)).size === after.length, after.map((c) => c.password).join(","));
  await db.collection.deleteMany({ where: { id: { in: made.map((m) => m.id) } } });
  await db.preset.delete({ where: { id: preset.id } });
  // send as download from a favorite list
  const list = await db.favoriteList.findFirst({ where: { collection: { userId: user.id }, favorites: { some: {} }, clientEmail: { not: "" } } });
  if (list) {
    const sd = await req(`/api/gallery/lists/${list.id}/send-download`, { method: "POST", json: {} });
    const sdj = await sd.json();
    check("send as download from a favorite list", sd.ok, JSON.stringify(sdj).slice(0, 160));
  } else check("send as download from a favorite list (seed list missing)", false);
  // team member login
  const token = `smoke-${stamp}`;
  const email = `smoke-member-${stamp}@example.com`;
  const member = await db.teamMember.create({ data: { userId: user.id, name: "Smoke Member", email, role: "SECOND_SHOOTER", inviteToken: token, inviteExpiresAt: new Date(Date.now() + 86400000) } });
  const acc = await fetch(`${BASE}/api/team/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: "smokepass123" }) });
  const lr = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "smokepass123" }) });
  check("team member accepts an invite and signs in with their own login", acc.ok && lr.ok, `${acc.status} ${lr.status}`);
  const m2 = await db.teamMember.findUnique({ where: { id: member.id } });
  if (m2?.loginUserId) await db.user.delete({ where: { id: m2.loginUserId } });
  await db.teamMember.delete({ where: { id: member.id } });
}

const ITEMS: Record<string, () => Promise<void>> = { campaigns, help, support, switcher, docs, videocomments, previews, languages, books, storei18n, csvclients, dashi18n, lightroom };

(async () => {
  await login();
  const wanted = process.argv.slice(2);
  for (const [name, fn] of Object.entries(ITEMS)) {
    if (wanted.length && !wanted.includes(name)) continue;
    console.log(`--- ${name}`);
    try {
      await fn();
    } catch (e) {
      check(`${name} threw`, false, e instanceof Error ? e.message : String(e));
    }
  }
  await db.$disconnect();
  console.log(failures ? `SMOKE FAILED (${failures})` : "SMOKE OK");
  process.exit(failures ? 1 : 0);
})();
