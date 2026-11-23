import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { logStudioMessage } from "@/lib/studio";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const contract = await db.contract.findFirst({
    where: { id, userId: user.id },
    include: { contact: true },
  });
  return contract ? { user, contract } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { contract } = ctx;
  const body = await req.json();
  const signed = !!contract.signedAt;

  const data: Record<string, unknown> = {};
  if (!signed) {
    if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
    if (typeof body.body === "string") data.body = body.body;
    for (const k of ["brandLogoUrl", "headerImageUrl"] as const) {
      if (typeof body[k] === "string") data[k] = body[k].trim().slice(0, 1000);
    }
    if (typeof body.brandColor === "string") data.brandColor = /^#[0-9a-fA-F]{6}$/.test(body.brandColor) ? body.brandColor : "";
    if (typeof body.secondSignerEmail === "string") data.secondSignerEmail = body.secondSignerEmail.trim();
    if (body.contactId !== undefined) {
      if (!body.contactId) data.contactId = null;
      else {
        const c = await db.contact.findFirst({ where: { id: body.contactId, userId: ctx.user.id } });
        if (c) data.contactId = c.id;
      }
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(`${body.expiresAt}T23:59:59`) : null;
    }
    if (body.scheduledSendAt !== undefined) {
      data.scheduledSendAt = body.scheduledSendAt ? new Date(body.scheduledSendAt) : null;
    }
  }

  // Actions
  if (body.action === "send" && contract.status === "DRAFT") {
    data.status = "SENT";
    data.sentAt = new Date();
    data.scheduledSendAt = null;
    const businessName = ctx.user.businessName || ctx.user.name;
    const mail = await sendMail({
      userId: ctx.user.id,
      to: contract.contact?.email ?? "",
      subject: `Your contract from ${businessName}: ${contract.title}`,
      text: `Hi ${contract.contact?.name || "there"},

Your contract "${contract.title}" is ready to review and sign. It only takes a minute:

${absoluteUrl(`/sign/${contract.token}`)}

If anything looks off, just reply and we'll sort it out.

${businessName}`,
    });
    await logStudioMessage(ctx.user.id, {
      kind: "EMAIL",
      email: contract.contact?.email ?? "",
      name: contract.contact?.name ?? "",
      subject: `Contract sent: ${contract.title}`,
      body: `“${contract.title}” was emailed to ${contract.contact?.name || "the client"} with a signing link (/sign/${contract.token}).`,
      meta: [contract.contact?.email ? `To ${contract.contact.email}` : "", deliveryNote(mail)]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (body.action === "revertToDraft" && contract.status === "SENT" && !signed) {
    data.status = "DRAFT";
    data.sentAt = null;
  }

  await db.contract.update({ where: { id: contract.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.contract.delete({ where: { id: ctx.contract.id } });
  return NextResponse.json({ ok: true });
}
