import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { parsePresetSettings, presetSettingsData } from "@/lib/preset-apply";

// Multi-gallery bulk edit: apply a preset (design / privacy / download /
// store settings) and/or move folder and/or set status across many
// collections in one action. Returns a per-collection change summary.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("upload");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Select at least one collection" }, { status: 400 });

  const collections = await db.collection.findMany({ where: { id: { in: ids }, userId: user.id } });
  if (collections.length === 0) return NextResponse.json({ error: "No collections found" }, { status: 404 });

  let presetParsed: Record<string, unknown> | null = null;
  if (typeof body.presetId === "string" && body.presetId) {
    const preset = await db.preset.findFirst({ where: { id: body.presetId, userId: user.id } });
    if (!preset) return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    presetParsed = parsePresetSettings(preset.settings);
  }

  let folderChange: string | null = null;
  if (body.folderId !== undefined) {
    if (body.folderId !== null && typeof body.folderId !== "string") {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    }
    if (typeof body.folderId === "string") {
      const folder = await db.folder.findFirst({ where: { id: body.folderId, userId: user.id } });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      folderChange = `moved to folder "${folder.name}"`;
    } else {
      folderChange = "removed from folder";
    }
  }

  const status = typeof body.status === "string" ? body.status : "";
  if (status && !["DRAFT", "PRERELEASE", "PUBLISHED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (presetParsed === null && folderChange === null && !status) {
    return NextResponse.json({ error: "Choose a preset, a folder, or a status to apply" }, { status: 400 });
  }

  const results: { id: string; name: string; changes: string[] }[] = [];
  for (const c of collections) {
    // Preset-derived secrets (download PIN, auto gallery password) are minted
    // per collection inside the loop, never shared across galleries.
    const applied = presetParsed ? presetSettingsData(presetParsed) : { data: {}, changes: [] as string[] };
    const data: Record<string, unknown> = { ...applied.data };
    const changes = [...applied.changes];
    if (folderChange !== null) {
      data.folderId = body.folderId;
      changes.push(folderChange);
    }
    if (status) {
      data.status = status;
      changes.push(`status set to ${status.toLowerCase()}`);
    }
    await db.collection.update({ where: { id: c.id }, data });
    results.push({ id: c.id, name: c.name, changes });
  }
  return NextResponse.json({ ok: true, updated: results.length, results });
}
