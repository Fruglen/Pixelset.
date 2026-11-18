import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify, generatePin } from "@/lib/utils";
import { PRESET_FIELDS } from "@/lib/design";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  let slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : name);
  // Ensure slug uniqueness
  let candidate = slug;
  let i = 1;
  while (await db.collection.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${++i}`;
  }
  slug = candidate;

  // Apply preset defaults if provided
  let presetData: Record<string, unknown> = {};
  if (typeof body.presetId === "string" && body.presetId) {
    const preset = await db.preset.findFirst({ where: { id: body.presetId, userId: user.id } });
    if (preset) {
      try {
        const parsed = JSON.parse(preset.settings) as Record<string, unknown>;
        for (const field of PRESET_FIELDS) {
          if (field in parsed) presetData[field] = parsed[field];
        }
        if (presetData.pinEnabled) presetData.downloadPin = generatePin();
      } catch {
        presetData = {};
      }
    }
  }

  const collection = await db.collection.create({
    data: {
      userId: user.id,
      name,
      slug,
      eventDate: body.eventDate ? new Date(`${body.eventDate}T12:00:00`) : null,
      folderId: typeof body.folderId === "string" ? body.folderId : null,
      ...presetData,
      sets: { create: [{ name: "Highlights", order: 0 }] },
    },
  });

  return NextResponse.json({ id: collection.id, slug: collection.slug });
}
