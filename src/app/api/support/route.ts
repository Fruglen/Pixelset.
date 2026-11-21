import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { SUPPORT_TOPICS, isSupportOwner } from "@/lib/support";

// Fix batch 2026-11-20: support bubble submissions (POST) and the owner's inbox list (GET).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getCurrentSession();
  // a team member writes in under their own login email
  const writer = session ? await db.user.findUnique({ where: { id: session.userId }, select: { email: true, name: true } }) : null;
  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
  if (text.length < 5) return NextResponse.json({ error: "Write a short message so we know how to help" }, { status: 400 });
  const topic = SUPPORT_TOPICS.some((t) => t.id === body.topic) ? body.topic : "GENERAL";
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : "";
  const msg = await db.supportMessage.create({
    data: {
      userId: user.id,
      fromName: writer?.name || user.name,
      fromEmail: writer?.email || user.email,
      topic,
      body: text,
      page,
    },
  });
  return NextResponse.json({ ok: true, id: msg.id, replyTo: msg.fromEmail });
}

export async function GET() {
  const user = await getCurrentUser();
  const session = await getCurrentSession();
  const me = session ? await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }) : null;
  if (!user || !isSupportOwner(me?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await db.supportMessage.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ messages });
}
