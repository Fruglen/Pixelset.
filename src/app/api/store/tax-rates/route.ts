import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { cleanRate } from "@/lib/store-admin";

// Phase 5B: manual tax rates by region.

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const data = cleanRate(await req.json());
  if (!data.name) return NextResponse.json({ error: "Give the rate a name" }, { status: 400 });
  const rate = await db.taxRate.create({
    data: {
      userId: user.id,
      name: String(data.name),
      country: String(data.country ?? "US"),
      region: String(data.region ?? ""),
      ratePct: Number(data.ratePct ?? 0),
    },
  });
  return NextResponse.json({ id: rate.id });
}
