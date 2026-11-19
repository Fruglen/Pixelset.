import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B: reusable payment links (fixed amount or client entered amount).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Add a title" }, { status: 400 });
  const link = await db.paymentLink.create({
    data: {
      userId: user.id,
      title,
      description: typeof body.description === "string" ? body.description.slice(0, 1000) : "",
      amountCents: Math.max(0, Math.round(Number(body.amountCents) || 0)),
    },
  });
  return NextResponse.json({ id: link.id, token: link.token });
}
