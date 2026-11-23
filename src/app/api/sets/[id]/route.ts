import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

async function ownedSet(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.photoSet.findFirst({
    where: { id, collection: { userId: user.id } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const set = await ownedSet(params.id);
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.clientExclusive === "boolean") data.clientExclusive = body.clientExclusive;
  if (typeof body.clientEmail === "string") data.clientEmail = body.clientEmail.toLowerCase().trim();
  if (typeof body.clientPassword === "string") data.clientPassword = body.clientPassword;
  await db.photoSet.update({ where: { id: set.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await ownedSet(params.id);
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.photoSet.delete({ where: { id: set.id } });
  return NextResponse.json({ ok: true });
}
