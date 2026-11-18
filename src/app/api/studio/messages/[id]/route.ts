import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.studioMessage.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const message = await own(params.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  if (typeof body.read === "boolean") {
    await db.studioMessage.update({ where: { id: message.id }, data: { read: body.read } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const message = await own(params.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.studioMessage.delete({ where: { id: message.id } });
  return NextResponse.json({ ok: true });
}
