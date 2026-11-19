import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const folder = await db.folder.findFirst({ where: { id: params.id, userId: user.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  // One share link for the whole folder: turning sharing on mints the public
  // slug (kept stable afterwards); the public page lives at /folder/<slug>
  // and lists the folder's published collections.
  if (typeof body.isPublic === "boolean") {
    data.isPublic = body.isPublic;
    if (body.isPublic && !folder.slug) {
      let slug = slugify(folder.name) || "folder";
      let candidate = slug;
      let i = 1;
      while (await db.folder.findUnique({ where: { slug: candidate } })) {
        candidate = `${slug}-${++i}`;
      }
      data.slug = candidate;
    }
  }
  if (Object.keys(data).length > 0) {
    await db.folder.update({ where: { id: folder.id }, data });
  }
  const fresh = await db.folder.findUnique({ where: { id: folder.id } });
  return NextResponse.json({ ok: true, slug: fresh?.slug ?? null, isPublic: fresh?.isPublic ?? false });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const folder = await db.folder.findFirst({ where: { id: params.id, userId: user.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.folder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
