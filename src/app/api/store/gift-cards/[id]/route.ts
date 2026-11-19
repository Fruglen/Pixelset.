import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.giftCard.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gc = await owned(params.id);
  if (!gc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  await db.giftCard.update({ where: { id: gc.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const gc = await owned(params.id);
  if (!gc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.giftCard.delete({ where: { id: gc.id } });
  return NextResponse.json({ ok: true });
}
