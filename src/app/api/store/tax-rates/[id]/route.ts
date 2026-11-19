import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { cleanRate } from "@/lib/store-admin";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.taxRate.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rate = await owned(params.id);
  if (!rate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.taxRate.update({ where: { id: rate.id }, data: cleanRate(await req.json()) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const rate = await owned(params.id);
  if (!rate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.taxRate.delete({ where: { id: rate.id } });
  return NextResponse.json({ ok: true });
}
