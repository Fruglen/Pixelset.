import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; clientId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = await db.mobileAppClient.findFirst({ where: { id: params.clientId, appId: params.id, userId: user.id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.greeting === "string") data.greeting = body.greeting.trim().slice(0, 300);
  if (typeof body.clientName === "string" && body.clientName.trim()) data.clientName = body.clientName.trim().slice(0, 120);
  await db.mobileAppClient.update({ where: { id: client.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; clientId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const client = await db.mobileAppClient.findFirst({ where: { id: params.clientId, appId: params.id, userId: user.id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.mobileAppClient.delete({ where: { id: client.id } });
  return NextResponse.json({ ok: true });
}
