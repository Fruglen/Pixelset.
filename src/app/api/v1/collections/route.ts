import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromBearer } from "@/lib/api-token";

// Phase 5B platform: token authenticated API. GET lists collections and sets.
export async function GET(req: NextRequest) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });
  const rows = await db.collection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, status: true, sets: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ collections: rows });
}
