import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { email, message } = await req.json();
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const normalized = email.toLowerCase().trim();
  await db.invite.create({
    data: {
      collectionId: collection.id,
      email: normalized,
      message: typeof message === "string" ? message : "",
    },
  });

  const businessName = user.businessName || user.name;
  const galleryUrl = absoluteUrl(`/g/${collection.slug}`);
  const personalMessage = typeof message === "string" && message.trim() ? `${message.trim()}\n\n` : "";
  const mail = await sendMail({
    userId: user.id,
    to: normalized,
    subject: `${businessName} shared a gallery with you: ${collection.name}`,
    text: `Hi,

${personalMessage}Your gallery "${collection.name}" is ready to view:

${galleryUrl}
${collection.password ? "\nThis gallery is password protected. Your photographer will share the password with you separately.\n" : ""}
You can favorite the photos you love, leave comments, and download images where enabled.

${businessName}`,
  });

  await logActivity(
    collection.id,
    "INVITE_SENT",
    `Invite email to ${normalized} (${deliveryNote(mail)})`,
    normalized
  );
  return NextResponse.json({ ok: true, delivered: mail.sent, deliveryError: mail.error ?? null });
}
