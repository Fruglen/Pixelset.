import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Final pass: reusable gallery invite templates (GalleryEmailTemplate),
// created and picked from the collection Share dialog.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await db.galleryEmailTemplate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, subject: true },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const tplBody = typeof body.body === "string" ? body.body : "";
  if (!name || !subject || !tplBody.trim()) {
    return NextResponse.json({ error: "Name, subject and body are required" }, { status: 400 });
  }
  const tpl = await db.galleryEmailTemplate.create({ data: { userId: user.id, name, subject, body: tplBody } });
  return NextResponse.json({ ok: true, id: tpl.id });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  await db.galleryEmailTemplate.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
