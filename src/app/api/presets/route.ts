import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PRESET_FIELDS } from "@/lib/design";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  let settings: Record<string, unknown> = {};
  if (typeof body.fromCollectionId === "string") {
    const collection = await db.collection.findFirst({
      where: { id: body.fromCollectionId, userId: user.id },
    });
    if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    const source = collection as unknown as Record<string, unknown>;
    for (const field of PRESET_FIELDS) settings[field] = source[field];
  } else if (body.settings && typeof body.settings === "object") {
    for (const field of PRESET_FIELDS) {
      if (field in body.settings) settings[field] = body.settings[field];
    }
  }

  const preset = await db.preset.create({
    data: { userId: user.id, name, settings: JSON.stringify(settings) },
  });
  return NextResponse.json({ id: preset.id });
}
