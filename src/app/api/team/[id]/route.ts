import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.teamMember.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const member = await owned(params.id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.role === "ASSISTANT" || body.role === "SECOND_SHOOTER") data.role = body.role;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  await db.teamMember.update({ where: { id: member.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const member = await owned(params.id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.teamMember.delete({ where: { id: member.id } });
  return NextResponse.json({ ok: true });
}
