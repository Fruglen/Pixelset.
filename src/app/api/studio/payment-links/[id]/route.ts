import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.paymentLink.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const link = await own(params.id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.amountCents !== undefined) data.amountCents = Math.max(0, Math.round(Number(body.amountCents) || 0));
  await db.paymentLink.update({ where: { id: link.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const link = await own(params.id);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.paymentLink.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
