import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.bookingCoupon.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const coupon = await owned(params.id);
  if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  await db.bookingCoupon.update({ where: { id: coupon.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const coupon = await owned(params.id);
  if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.bookingCoupon.delete({ where: { id: coupon.id } });
  return NextResponse.json({ ok: true });
}
