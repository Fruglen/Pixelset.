import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { isSupportOwner } from "@/lib/support";
import { deliveryNote, sendMail } from "@/lib/mailer";

// Fix batch 2026-11-20: the site owner replies to (by email) or closes a support message.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  const me = session ? await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }) : null;
  if (!isSupportOwner(me?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const msg = await db.supportMessage.findUnique({ where: { id: params.id } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "close" || body.action === "reopen") {
    const updated = await db.supportMessage.update({ where: { id: msg.id }, data: { status: body.action === "close" ? "CLOSED" : msg.reply ? "ANSWERED" : "OPEN" } });
    return NextResponse.json({ message: updated });
  }
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 10000) : "";
  if (!reply) return NextResponse.json({ error: "Write a reply first" }, { status: 400 });
  const result = await sendMail({
    to: msg.fromEmail,
    subject: "Re: your Pixora support message",
    text: `Hi ${msg.fromName.split(" ")[0] || "there"},\n\n${reply}\n\nYour message:\n${msg.body}\n\nPixora support`,
  });
  const updated = await db.supportMessage.update({
    where: { id: msg.id },
    data: { reply, replyNote: deliveryNote(result), repliedAt: new Date(), status: "ANSWERED" },
  });
  return NextResponse.json({ message: updated, delivered: result.sent });
}
