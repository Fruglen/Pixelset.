import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { cleanMethod } from "@/lib/store-admin";

// Phase 5B: named shipping methods (standard, express, ...) with their own rates.

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const data = cleanMethod(await req.json());
  if (!data.name) return NextResponse.json({ error: "Give the method a name" }, { status: 400 });
  const count = await db.shippingMethod.count({ where: { userId: user.id } });
  const m = await db.shippingMethod.create({
    data: {
      userId: user.id,
      name: String(data.name),
      speed: String(data.speed ?? ""),
      appliesTo: String(data.appliesTo ?? "ALL"),
      baseCents: Number(data.baseCents ?? 0),
      perItemCents: Number(data.perItemCents ?? 0),
      freeOverCents: Number(data.freeOverCents ?? 0),
      order: count,
    },
  });
  return NextResponse.json({ id: m.id });
}
