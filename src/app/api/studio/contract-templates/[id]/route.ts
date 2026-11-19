import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.contractTemplate.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const template = await own(params.id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.body === "string") data.body = body.body;
  // Phase 5B branding
  for (const k of ["brandLogoUrl", "headerImageUrl"] as const) {
    if (typeof body[k] === "string") data[k] = body[k].trim().slice(0, 1000);
  }
  if (typeof body.brandColor === "string") data.brandColor = /^#[0-9a-fA-F]{6}$/.test(body.brandColor) ? body.brandColor : "";
  await db.contractTemplate.update({ where: { id: template.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const template = await own(params.id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.contractTemplate.delete({ where: { id: template.id } });
  return NextResponse.json({ ok: true });
}
