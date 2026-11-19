import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { cleanMethod } from "@/lib/store-admin";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.shippingMethod.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const m = await owned(params.id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.shippingMethod.update({ where: { id: m.id }, data: cleanMethod(await req.json()) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const m = await owned(params.id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.shippingMethod.delete({ where: { id: m.id } });
  return NextResponse.json({ ok: true });
}
