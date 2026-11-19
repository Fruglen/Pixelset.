import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { giftCardCode } from "@/lib/store";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const amount = Math.round(Number(body.amountCents) || 0);
  if (amount <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  let code = typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : giftCardCode();
  // Ensure uniqueness for generated codes
  while (await db.giftCard.findUnique({ where: { userId_code: { userId: user.id, code } } })) {
    if (typeof body.code === "string" && body.code.trim())
      return NextResponse.json({ error: "That code already exists" }, { status: 409 });
    code = giftCardCode();
  }

  const gc = await db.giftCard.create({
    data: {
      userId: user.id,
      code,
      initialCents: amount,
      balanceCents: amount,
      recipient: typeof body.recipient === "string" ? body.recipient.trim() : "",
    },
  });
  return NextResponse.json({ id: gc.id, code: gc.code });
}
