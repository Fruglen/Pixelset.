import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.priceSheet.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sheet = await owned(params.id);
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  // Pixieset: the lab cannot be changed on an existing price sheet, fulfillment is fixed after creation.
  await db.priceSheet.update({ where: { id: sheet.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sheet = await owned(params.id);
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.priceSheet.delete({ where: { id: sheet.id } });
  return NextResponse.json({ ok: true });
}
