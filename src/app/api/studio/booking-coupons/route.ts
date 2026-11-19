import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

// Night build follow-up: booking coupons (Studio Manager). Codes discount a
// session booking at the public booking checkout; they are separate from
// Store coupons. A coupon can be limited to one session type or apply to
// every session.

const TYPES = ["PERCENT", "FIXED"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const coupons = await db.bookingCoupon.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  const type = TYPES.includes(body.type) ? body.type : "PERCENT";
  const value = Math.max(0, Math.round(Number(body.value) || 0));
  if (value <= 0) return NextResponse.json({ error: "Enter a discount value" }, { status: 400 });
  if (type === "PERCENT" && value > 100)
    return NextResponse.json({ error: "Percent discount cannot exceed 100" }, { status: 400 });

  let sessionTypeId = "";
  if (typeof body.sessionTypeId === "string" && body.sessionTypeId) {
    const st = await db.sessionType.findFirst({ where: { id: body.sessionTypeId, userId: user.id } });
    if (!st) return NextResponse.json({ error: "Unknown session type" }, { status: 400 });
    sessionTypeId = st.id;
  }

  const clash = await db.bookingCoupon.findUnique({ where: { userId_code: { userId: user.id, code } } });
  if (clash) return NextResponse.json({ error: "That code already exists" }, { status: 409 });

  const coupon = await db.bookingCoupon.create({
    data: {
      userId: user.id,
      code,
      type,
      value,
      minSpendCents: Math.max(0, Math.round(Number(body.minSpendCents) || 0)),
      useLimit: body.useLimit ? Math.max(1, Math.round(Number(body.useLimit))) : null,
      expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T23:59:59`) : null,
      sessionTypeId,
    },
  });
  return NextResponse.json({ id: coupon.id });
}
