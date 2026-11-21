/* Fix batch 2026-11-20 smoke checks. Run against a started production server:
 *   DATABASE_URL=file:./fixbatch.db BASE=http://localhost:3100 npx tsx scripts/smoke-fix-batch.ts [item...]
 * Each item prints PASS/FAIL lines; the process exits non-zero on any FAIL. */
import { PrismaClient } from "@prisma/client";
import { HELP_GUIDES, searchGuides } from "../src/lib/help-guides";
import { GALLERY_LANGUAGES, galleryDict, galleryT, normalizeLang } from "../src/lib/gallery-i18n";

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

const ITEMS: Record<string, () => Promise<void>> = { campaigns, help, support, switcher, docs, videocomments, previews, languages, books };

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
