import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { ORDER_STATUSES } from "@/lib/store";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.order.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const order = await owned(params.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.status === "string" && (ORDER_STATUSES as readonly string[]).includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.notes === "string") data.notes = body.notes;
  await db.order.update({ where: { id: order.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const order = await owned(params.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.order.delete({ where: { id: order.id } });
  return NextResponse.json({ ok: true });
}
