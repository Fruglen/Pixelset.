import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const isMini = body.isMini === true;

  const st = await db.sessionType.create({
    data: {
      userId: user.id,
      name,
      isMini,
      durationMin: Math.max(5, Number(body.durationMin) || (isMini ? 15 : 60)),
      priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)),
      // minis start unpublished (publish flow); regular types start active
      published: !isMini,
      active: true,
      retainerType: isMini ? "FULL" : "NONE",
    },
  });
  return NextResponse.json({ id: st.id });
}
