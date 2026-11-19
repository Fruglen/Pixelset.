import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B: in-dashboard notification feed for the header bell.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: n.read, createdAt: n.createdAt.toISOString() })),
  });
}

// { id } marks one read, { all: true } marks everything read.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.all === true) await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  else if (typeof body.id === "string") await db.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
