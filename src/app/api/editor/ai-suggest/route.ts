import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { analyzePhoto, loadPhotoBytes, suggestFromStats } from "@/lib/photo-analysis";
import { geminiConfigured, geminiVisionJson, GeminiNotConnectedError } from "@/lib/gemini";

export const runtime = "nodejs";

// Night build (Photo Editor): AI editing suggestions for one photo, from
// Google Gemini (server side only, GEMINI_API_KEY). The measured photo
// analysis rides along as context. Without the key the route answers 503
// with the honest not connected state; the editor then offers the on device
// suggestion computed from the same measurements.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const photo = await db.photo.findFirst({
    where: { id: String(body.photoId ?? ""), collection: { userId: user.id } },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const bytes = await loadPhotoBytes(photo);
  if (!bytes) return NextResponse.json({ error: "Could not read this photo" }, { status: 400 });
  const stats = await analyzePhoto(bytes);
  const local = stats ? suggestFromStats(stats) : null;

  if (!geminiConfigured()) {
    return NextResponse.json(
      { error: "AI is not connected", aiConnected: false, local, stats },
      { status: 503 }
    );
  }
  try {
    const sharp = (await import("sharp")).default;
    const thumb = await sharp(bytes).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const result = await geminiVisionJson<{ adjust: { brightness: number; contrast: number; saturation: number; warmth: number }; reason: string }>(
      [
        "You are a professional photo editor. Suggest slider settings for this photo in a browser editor.",
        "Sliders: brightness 50-150 (100 = unchanged), contrast 50-150, saturation 0-200, warmth -50..50 (positive = warmer).",
        stats
          ? `Measured analysis: brightness ${(stats.brightness * 100).toFixed(0)}% of range, contrast ${(stats.contrast * 100).toFixed(0)}%, saturation ${(stats.saturation * 100).toFixed(0)}%, colour cast ${stats.warmthCast > 0.05 ? "warm" : stats.warmthCast < -0.05 ? "cool" : "neutral"}.`
          : "",
        "Answer with JSON only: {\"adjust\":{\"brightness\":100,\"contrast\":100,\"saturation\":100,\"warmth\":0},\"reason\":\"one short sentence\"}. Keep corrections tasteful, do not overcook.",
      ].join("\n"),
      [{ mimeType: "image/jpeg", dataBase64: thumb.toString("base64") }],
      { maxTokens: 2000 }
    );
    const clamp = (v: number, lo: number, hi: number, d: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
    };
    const adjust = {
      brightness: clamp(result.adjust?.brightness, 50, 150, 100),
      contrast: clamp(result.adjust?.contrast, 50, 150, 100),
      saturation: clamp(result.adjust?.saturation, 0, 200, 100),
      warmth: clamp(result.adjust?.warmth, -50, 50, 0),
      sepia: 0,
      grayscale: 0,
    };
    return NextResponse.json({ aiConnected: true, adjust, reason: String(result.reason ?? ""), local, stats });
  } catch (e) {
    if (e instanceof GeminiNotConnectedError) {
      return NextResponse.json({ error: "AI is not connected", aiConnected: false, local, stats }, { status: 503 });
    }
    return NextResponse.json({ error: (e as Error).message || "AI suggestion failed", aiConnected: true, local, stats }, { status: 502 });
  }
}
