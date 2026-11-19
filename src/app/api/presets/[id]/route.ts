import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preset = await db.preset.findFirst({ where: { id: params.id, userId: user.id } });
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  // Preset option: auto-generate a fresh gallery password for every
  // collection the preset is applied to (stored inside the settings JSON).
  if (typeof body.autoPassword === "boolean") {
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(preset.settings) as Record<string, unknown>;
    } catch {
      settings = {};
    }
    if (body.autoPassword) settings.autoPassword = true;
    else delete settings.autoPassword;
    data.settings = JSON.stringify(settings);
  }
  if (Object.keys(data).length > 0) {
    await db.preset.update({ where: { id: preset.id }, data });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preset = await db.preset.findFirst({ where: { id: params.id, userId: user.id } });
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.preset.delete({ where: { id: preset.id } });
  return NextResponse.json({ ok: true });
}
