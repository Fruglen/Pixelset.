import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deliverInvite, DEFAULT_INVITE_SUBJECT } from "@/lib/invites";

// Phase 5B: Publish and Notify. Publishes the collection and emails everyone
// chosen (by default: everyone who registered during pre-release plus anyone
// typed in), each through the branded invite email.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  await db.collection.update({
    where: { id: collection.id },
    data: { status: "PUBLISHED", publishedAt: collection.publishedAt ?? new Date() },
  });

  const emails = new Set<string>();
  if (body.includeRegistrations !== false) {
    const regs = await db.emailRegistration.findMany({ where: { collectionId: collection.id } });
    regs.forEach((r) => emails.add(r.email));
  }
  if (Array.isArray(body.emails)) {
    for (const e of body.emails) if (typeof e === "string" && e.includes("@")) emails.add(e.toLowerCase().trim());
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const results: { email: string; delivered: boolean; error: string | null }[] = [];
  for (const email of Array.from(emails)) {
    const invite = await db.invite.create({
      data: {
        collectionId: collection.id,
        email,
        subject: typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : DEFAULT_INVITE_SUBJECT,
        message: message
          ? `Hi {client_name},\n\n${message}\n\n{gallery_link}\n\n{business_name}`
          : `Hi {client_name},\n\n"{gallery_name}" is now published and ready for you.\n\n{gallery_link}\n\n{business_name}`,
      },
    });
    const mail = await deliverInvite(invite.id);
    results.push({ email, delivered: !!mail?.sent, error: mail?.error ?? null });
  }
  return NextResponse.json({ ok: true, published: true, notified: results.length, results });
}
