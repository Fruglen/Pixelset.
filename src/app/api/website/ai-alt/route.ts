import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks";
import { collectImageRefs, setImageAlt, basicAltSuggestion, type ImageRef } from "@/lib/image-alt";
import { geminiConfigured, geminiVision, GeminiNotConnectedError } from "@/lib/gemini";

export const runtime = "nodejs";

// Night build (Website): AI alt text generation. With a Gemini key the
// image itself is described; without one, a clearly labelled basic
// suggestion comes back from the filename and page context for the
// photographer to review (it is not saved automatically in that mode).

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

async function loadImage(url: string, origin: string): Promise<{ dataBase64: string; mimeType: string } | null> {
  try {
    if (url.startsWith("/uploads/")) {
      const data = await readFile(path.join(process.cwd(), "public", url));
      const ext = url.split(".").pop()?.toLowerCase() ?? "";
      return { dataBase64: data.toString("base64"), mimeType: MIME_BY_EXT[ext] ?? "image/jpeg" };
    }
    if (url.startsWith("/")) {
      const res = await fetch(`${origin}${url}`);
      if (!res.ok) return null;
      return { dataBase64: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: res.headers.get("content-type") ?? "image/jpeg" };
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return { dataBase64: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch {
    return null;
  }
}

async function describe(ref: ImageRef, context: string, origin: string): Promise<string | null> {
  const img = await loadImage(ref.url, origin);
  if (!img) return null;
  const out = await geminiVision(
    `Write alt text for this image on a photographer's website (page: ${context}, section: ${ref.blockType}). One concise sentence, at most 125 characters, describing who or what is shown and the setting. No quotation marks, do not start with "Image of" or "Photo of".`,
    [img],
    { maxTokens: 120, temperature: 0.3 }
  );
  const alt = out.trim().replace(/^["']|["']$/g, "").slice(0, 200);
  return alt || null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const page = await db.sitePage.findFirst({ where: { id: String(body.pageId ?? ""), websiteId: website.id } });
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  let blocks = parseBlocks(page.blocks);
  const refs = collectImageRefs(blocks);
  const origin = req.nextUrl.origin;

  // Bulk: every image on the page that is missing alt text.
  if (body.all === true) {
    if (!geminiConfigured()) {
      return NextResponse.json({ aiConnected: false, updated: 0, error: "AI is not connected yet, so bulk generation is off. Single images still get a basic suggestion." }, { status: 503 });
    }
    const missing = refs.filter((r) => !r.alt).slice(0, 20);
    let updated = 0;
    for (const ref of missing) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const alt = await describe(ref, page.title, origin);
        if (alt) {
          blocks = setImageAlt(blocks, ref, alt);
          updated++;
        }
      } catch {
        // skip this image, keep going
      }
    }
    if (updated > 0) {
      await db.sitePage.update({ where: { id: page.id }, data: { blocks: JSON.stringify(blocks) } });
    }
    return NextResponse.json({ aiConnected: true, updated, total: missing.length });
  }

  const ref = refs.find((r) => r.blockId === String(body.blockId ?? "") && r.path === String(body.path ?? ""));
  if (!ref) return NextResponse.json({ error: "Image not found on this page" }, { status: 404 });

  if (!geminiConfigured()) {
    return NextResponse.json({
      aiConnected: false,
      basic: true,
      alt: basicAltSuggestion(ref.url, `${page.title} ${ref.blockType.replace(/([A-Z])/g, " $1").toLowerCase()}`),
      note: "AI is not connected yet. This is a basic suggestion from the file name, review it before saving.",
    });
  }
  try {
    const alt = await describe(ref, page.title, origin);
    if (!alt) return NextResponse.json({ error: "Could not read that image" }, { status: 502 });
    blocks = setImageAlt(blocks, ref, alt);
    await db.sitePage.update({ where: { id: page.id }, data: { blocks: JSON.stringify(blocks) } });
    return NextResponse.json({ aiConnected: true, alt, saved: true });
  } catch (e) {
    if (e instanceof GeminiNotConnectedError) {
      return NextResponse.json({ error: "AI is not connected yet.", aiConnected: false }, { status: 503 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: 502 });
  }
}
