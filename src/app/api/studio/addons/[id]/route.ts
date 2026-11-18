import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.sessionAddOn.findFirst({ where: { id, sessionType: { userId: user.id } } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const addOn = await own(params.id);
  if (!addOn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (body.priceCents !== undefined) data.priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
  await db.sessionAddOn.update({ where: { id: addOn.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const addOn = await own(params.id);
  if (!addOn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.sessionAddOn.delete({ where: { id: addOn.id } });
  return NextResponse.json({ ok: true });
}
