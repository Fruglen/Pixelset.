import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preset = await db.preset.findFirst({ where: { id: params.id, userId: user.id } });
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name } = await req.json();
  if (typeof name === "string" && name.trim()) {
    await db.preset.update({ where: { id: preset.id }, data: { name: name.trim() } });
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
