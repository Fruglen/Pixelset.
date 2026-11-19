import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadPhotoBytes } from "@/lib/photo-analysis";
import { geminiConfigured, geminiVisionJson, GeminiNotConnectedError } from "@/lib/gemini";

export const runtime = "nodejs";

// Night build (Photo Editor): AI culling with Google Gemini. Sends small
// thumbnails in batches and asks for the keeper of each burst plus any
// frames to drop (closed eyes, blur, bad expressions), with a one line
// reason per call. Without GEMINI_API_KEY it answers 503 and the culling
// screen falls back to the on device analysis alone, clearly labelled.
const BATCH = 10;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!geminiConfigured()) {
    return NextResponse.json({ error: "AI is not connected", aiConnected: false }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const collection = await db.collection.findFirst({
    where: { id: String(body.collectionId ?? ""), userId: user.id },
    include: {
      photos: {
        where: { OR: [{ mediaType: "IMAGE" }, { mediaType: "RAW", posterUrl: { not: "" } }] },
        orderBy: { order: "asc" },
        select: { id: true, url: true, filename: true, isExternal: true, mediaType: true, posterUrl: true },
      },
    },
  });
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  const photos = collection.photos.slice(0, 120);

  const sharp = (await import("sharp")).default;
  const picks: Record<string, { verdict: "pick" | "drop" | "keep"; reason: string }> = {};
  try {
    for (let start = 0; start < photos.length; start += BATCH) {
      const batch = photos.slice(start, start + BATCH);
      const images: { mimeType: string; dataBase64: string }[] = [];
      const usable: typeof batch = [];
      for (const p of batch) {
        const bytes = await loadPhotoBytes(p);
        if (!bytes) continue;
        const thumb = await sharp(bytes).resize(384, 384, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
        images.push({ mimeType: "image/jpeg", dataBase64: thumb.toString("base64") });
        usable.push(p);
      }
      if (usable.length === 0) continue;
      const list = usable.map((p, i) => `Image ${i + 1}: ${p.filename}`).join("\n");
      const result = await geminiVisionJson<{ calls: { index: number; verdict: "pick" | "drop" | "keep"; reason: string }[] }>(
        [
          "You are culling a photographer's gallery like a professional editor.",
          list,
          "For each image answer: pick = the strongest frame of its moment (sharp, eyes open, best expression and light), keep = solid and worth delivering, drop = blurry, eyes closed, badly exposed or a weaker duplicate.",
          "Answer with JSON only: {\"calls\":[{\"index\":1,\"verdict\":\"pick\",\"reason\":\"short reason\"}]} covering every image.",
        ].join("\n"),
        images,
        { maxTokens: 1200 }
      );
      for (const call of result.calls ?? []) {
        const p = usable[call.index - 1];
        if (!p) continue;
        picks[p.id] = {
          verdict: call.verdict === "pick" || call.verdict === "drop" ? call.verdict : "keep",
          reason: String(call.reason ?? "").slice(0, 140),
        };
      }
    }
  } catch (e) {
    if (e instanceof GeminiNotConnectedError) {
      return NextResponse.json({ error: "AI is not connected", aiConnected: false }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message || "AI culling failed", aiConnected: true }, { status: 502 });
  }
  return NextResponse.json({ aiConnected: true, calls: picks });
}
