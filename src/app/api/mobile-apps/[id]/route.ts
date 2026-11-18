import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.mobileApp.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const app = await owned(params.id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.appName === "string" && body.appName.trim()) data.appName = body.appName.trim();
  if (typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)) data.accentColor = body.accentColor;
  if (typeof body.contactEmail === "string") data.contactEmail = body.contactEmail.trim();
  if (typeof body.contactPhone === "string") data.contactPhone = body.contactPhone.trim();
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  await db.mobileApp.update({ where: { id: app.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const app = await owned(params.id);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.mobileApp.delete({ where: { id: app.id } });
  return NextResponse.json({ ok: true });
}
