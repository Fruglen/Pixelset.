import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { AI_TOOLS, aiToolsConfigured, aiToolsEndpoint, type AiToolId } from "@/lib/ai-tools";
import { isStoredUrl, readStoredBytes, saveStoredBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// AI tools (background removal, object removal, upscale, face restore).
// The heavy lifting runs on a self-hosted open-source endpoint named by
// AI_TOOLS_ENDPOINT (see src/lib/ai-tools.ts for the contract). Until an
// endpoint is connected this route reports connected:false and POSTs are
// refused with 501: the UI shows an honest "not connected" state and no
// result is ever faked.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    connected: aiToolsConfigured(),
    tools: AI_TOOLS.map((t) => ({ id: t.id, label: t.label })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("upload");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  if (!aiToolsConfigured()) {
    return NextResponse.json(
      { error: "AI tools are coming soon (the AI endpoint is not connected yet).", connected: false },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const tool = String(body.tool ?? "") as AiToolId;
  if (!AI_TOOLS.some((t) => t.id === tool)) {
    return NextResponse.json({ error: "Unknown AI tool" }, { status: 400 });
  }
  const photo = await db.photo.findFirst({
    where: { id: String(body.photoId ?? ""), collection: { userId: user.id } },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  // Source bytes, same rules as /api/editor/photo (RAW edits its preview).
  const srcUrl = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  if (!srcUrl) return NextResponse.json({ error: "This RAW file has no preview to edit" }, { status: 400 });
  let source: Buffer;
  if (!photo.isExternal && isStoredUrl(srcUrl)) {
    const stored = await readStoredBytes(srcUrl);
    if (!stored) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    source = stored;
  } else {
    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error();
      source = Buffer.from(await res.arrayBuffer());
    } catch {
      return NextResponse.json({ error: "Could not fetch the photo" }, { status: 502 });
    }
  }

  // Call the endpoint. The contract accepts an optional mask (used by
  // object removal when a client paints one); this client sends none, so
  // object removal runs in the endpoint's automatic mode.
  let resultB64 = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    const res = await fetch(aiToolsEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool,
        image: source.toString("base64"),
        mask: typeof body.maskDataUrl === "string" ? body.maskDataUrl.replace(/^data:image\/\w+;base64,/, "") : null,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`endpoint HTTP ${res.status}`);
    const json = (await res.json()) as { image?: string };
    resultB64 = typeof json.image === "string" ? json.image.replace(/^data:image\/\w+;base64,/, "") : "";
    if (!resultB64) throw new Error("endpoint returned no image");
  } catch (e) {
    return NextResponse.json(
      { error: `AI endpoint failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }

  // Persist exactly like an editor save: a NEW photo in the original's own
  // set, the original untouched, JPEG-normalised through sharp.
  const buffer = Buffer.from(resultB64, "base64");
  if (buffer.length > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "AI result is too large" }, { status: 413 });
  }
  const sharp = (await import("sharp")).default;
  let width: number | null = null;
  let height: number | null = null;
  let jpeg: Buffer;
  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    jpeg = await img.jpeg({ quality: 90 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not process the AI result" }, { status: 400 });
  }

  const base = photo.filename.replace(/\.[a-z0-9]+$/i, "");
  const filename = `${base}-${tool}-${Date.now().toString(36)}.jpg`;
  const url = await saveStoredBuffer(`uploads/${photo.collectionId}/${filename}`, jpeg, "image/jpeg");

  const count = await db.photo.count({ where: { setId: photo.setId } });
  const created = await db.photo.create({
    data: {
      collectionId: photo.collectionId,
      setId: photo.setId,
      filename,
      url,
      isExternal: false,
      width,
      height,
      order: count,
    },
  });

  const homeCol = await db.collection.findUnique({ where: { id: photo.collectionId }, select: { name: true } });
  const homeSet = await db.photoSet.findUnique({ where: { id: photo.setId }, select: { name: true } });
  return NextResponse.json({
    id: created.id,
    url: created.url,
    filename: created.filename,
    collectionId: photo.collectionId,
    destination: homeCol && homeSet ? `${homeCol.name}, ${homeSet.name}` : "Same set as the original",
  });
}
