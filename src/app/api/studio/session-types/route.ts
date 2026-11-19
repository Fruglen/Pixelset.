import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { STUDIO_LIMITS, capMessage, planFor, tierLabel } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  // Night build (Pricing lane): session type caps by plan (Free 1, Plus 3).
  {
    const plan = await planFor(user.id);
    const limit = STUDIO_LIMITS[plan.studio].sessionTypes;
    if (Number.isFinite(limit)) {
      const count = await db.sessionType.count({ where: { userId: user.id } });
      if (count >= limit) {
        return NextResponse.json({ error: capMessage("session types", limit, tierLabel("studio", plan.studio)) }, { status: 403 });
      }
    }
  }
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
