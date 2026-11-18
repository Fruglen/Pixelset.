import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

const TYPES = ["PERCENT", "FIXED", "FREE_SHIPPING", "FREE_PRODUCT"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  const type = TYPES.includes(body.type) ? body.type : "PERCENT";
  const value = Math.max(0, Math.round(Number(body.value) || 0));
  if (type === "PERCENT" && value > 100)
    return NextResponse.json({ error: "Percent discount cannot exceed 100" }, { status: 400 });

  const clash = await db.coupon.findUnique({ where: { userId_code: { userId: user.id, code } } });
  if (clash) return NextResponse.json({ error: "That code already exists" }, { status: 409 });

  const coupon = await db.coupon.create({
    data: {
      userId: user.id,
      code,
      type,
      value,
      minSpendCents: Math.max(0, Math.round(Number(body.minSpendCents) || 0)),
      useLimit: body.useLimit ? Math.max(1, Math.round(Number(body.useLimit))) : null,
      expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T23:59:59`) : null,
    },
  });
  return NextResponse.json({ id: coupon.id });
}
