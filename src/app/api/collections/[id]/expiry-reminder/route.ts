import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendExpiryReminder } from "@/lib/expiry-reminders";

// Phase 5B: send the expiry reminder for one collection now.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.expiresAt) return NextResponse.json({ error: "Set an expiry date first" }, { status: 400 });
  if (collection.expiresAt < new Date()) return NextResponse.json({ error: "This gallery has already expired" }, { status: 400 });
  const r = await sendExpiryReminder(collection.id);
  if (!r || r.recipients.length === 0) {
    return NextResponse.json({ error: "Nobody to remind yet: no registered, invited or favorite list emails on this gallery" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...r });
}
