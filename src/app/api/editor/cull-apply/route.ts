import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Night build (Photo Editor): apply culling decisions. Starring a photo is
// the photographer's confirm step after reviewing the culling screen.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const star = Array.isArray(body.star) ? body.star.filter((x: unknown) => typeof x === "string") : [];
  const unstar = Array.isArray(body.unstar) ? body.unstar.filter((x: unknown) => typeof x === "string") : [];
  let changed = 0;
  if (star.length) {
    const r = await db.photo.updateMany({ where: { id: { in: star }, collection: { userId: user.id } }, data: { starred: true } });
    changed += r.count;
  }
  if (unstar.length) {
    const r = await db.photo.updateMany({ where: { id: { in: unstar }, collection: { userId: user.id } }, data: { starred: false } });
    changed += r.count;
  }
  return NextResponse.json({ ok: true, changed });
}
