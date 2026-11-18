import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const st = await db.sessionType.findFirst({ where: { id: params.id, userId: user.id } });
  if (!st) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const max = await db.sessionAddOn.aggregate({ where: { sessionTypeId: st.id }, _max: { order: true } });
  const addOn = await db.sessionAddOn.create({
    data: {
      sessionTypeId: st.id,
      name,
      priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
      description: typeof body.description === "string" ? body.description : "",
      order: (max._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json({ id: addOn.id });
}
