import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeName } from "@/lib/uploads";
import { WEBSITE_LIMITS, capMessage, planFor, tierLabel } from "@/lib/plans";
import { saveStoredBuffer } from "@/lib/storage";

// Website media library: uploads made inside the block editor.
// Accepts JPEG, PNG, GIF, WebP, SVG images and MP4/WebM/MOV video.
const TYPES: Record<string, { kind: "IMAGE" | "GIF" | "VIDEO"; max: number }> = {
  "image/jpeg": { kind: "IMAGE", max: 25 * 1024 * 1024 },
  "image/png": { kind: "IMAGE", max: 25 * 1024 * 1024 },
  "image/webp": { kind: "IMAGE", max: 25 * 1024 * 1024 },
  "image/svg+xml": { kind: "IMAGE", max: 2 * 1024 * 1024 },
  "image/gif": { kind: "GIF", max: 40 * 1024 * 1024 },
  "video/mp4": { kind: "VIDEO", max: 500 * 1024 * 1024 },
  "video/webm": { kind: "VIDEO", max: 500 * 1024 * 1024 },
  "video/quicktime": { kind: "VIDEO", max: 500 * 1024 * 1024 },
};
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml",
  gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind");
  const media = await db.siteMedia.findMany({
    where: { userId: user.id, ...(kind === "VIDEO" ? { kind: "VIDEO" } : kind === "IMAGE" ? { kind: { in: ["IMAGE", "GIF"] } } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ media });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Choose a file" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = TYPES[file.type] ? file.type : EXT_MIME[ext] ?? "";
  const rule = TYPES[mime];
  if (!rule) return NextResponse.json({ error: "Use a JPEG, PNG, GIF, WebP, SVG, MP4, WebM or MOV file" }, { status: 400 });
  if (file.size > rule.max) return NextResponse.json({ error: `That file is too large (limit ${Math.round(rule.max / 1024 / 1024)} MB)` }, { status: 400 });
  // Night build (Pricing lane): Website Free plan cap, 100 photos.
  if (rule.kind === "IMAGE" || rule.kind === "GIF") {
    const plan = await planFor(user.id);
    const limit = WEBSITE_LIMITS[plan.website].photos;
    if (Number.isFinite(limit)) {
      const count = await db.siteMedia.count({ where: { userId: user.id, kind: { in: ["IMAGE", "GIF"] } } });
      if (count >= limit) {
        return NextResponse.json({ error: capMessage("website photos", limit, tierLabel("website", plan.website)) }, { status: 403 });
      }
    }
  }

  const dirName = `site-${user.id}`;
  const stored = `${randomBytes(5).toString("hex")}-${safeName(file.name)}`;
  const url = await saveStoredBuffer(`uploads/${dirName}/${stored}`, Buffer.from(await file.arrayBuffer()), mime);

  const media = await db.siteMedia.create({
    data: { userId: user.id, filename: file.name, url, mime, kind: rule.kind, size: file.size },
  });
  return NextResponse.json({ media });
}
