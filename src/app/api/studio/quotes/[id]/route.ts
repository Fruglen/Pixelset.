import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logStudioMessage, parseItems } from "@/lib/studio";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const quote = await db.quote.findFirst({ where: { id, userId: user.id }, include: { contact: true } });
  return quote ? { user, quote } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { quote } = ctx;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.notes === "string") data.notes = body.notes;
  if (Array.isArray(body.items)) data.items = JSON.stringify(parseItems(JSON.stringify(body.items)));
  if (body.taxRate !== undefined) {
    const r = Number(body.taxRate);
    if (!isNaN(r) && r >= 0 && r <= 100) data.taxRate = r;
  }
  if (["NONE", "PERCENT", "FIXED"].includes(body.discountType)) data.discountType = body.discountType;
  if (body.discountValue !== undefined) data.discountValue = Math.max(0, Math.round(Number(body.discountValue) || 0));
  if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(`${body.validUntil}T23:59:59`) : null;
  if (body.contactId !== undefined) {
    if (!body.contactId) data.contactId = null;
    else {
      const c = await db.contact.findFirst({ where: { id: body.contactId, userId: ctx.user.id } });
      if (c) data.contactId = c.id;
    }
  }

  if (body.action === "send" && quote.status === "DRAFT") {
    data.status = "SENT";
    data.sentAt = new Date();
    const businessName = ctx.user.businessName || ctx.user.name;
    const mail = await sendMail({
      userId: ctx.user.id,
      to: quote.contact?.email ?? "",
      subject: `Quote ${quote.number} from ${businessName}`,
      text: `Hi ${quote.contact?.name || "there"},

Your quote ${quote.number}${quote.title ? ` (${quote.title})` : ""} is ready to review. You can accept it online here:

${absoluteUrl(`/quote/${quote.token}`)}
${quote.validUntil ? `\nThis quote is valid until ${quote.validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.\n` : ""}
${businessName}`,
    });
    await logStudioMessage(ctx.user.id, {
      kind: "EMAIL",
      email: quote.contact?.email ?? "",
      name: quote.contact?.name ?? "",
      subject: `Quote ${quote.number} sent`,
      body: `Quote ${quote.number} was emailed to ${quote.contact?.name || "the client"} for review (/quote/${quote.token}).`,
      meta: [quote.contact?.email ? `To ${quote.contact.email}` : "", deliveryNote(mail)]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (body.action === "revertToDraft" && quote.status === "SENT") {
    data.status = "DRAFT";
    data.sentAt = null;
  }

  await db.quote.update({ where: { id: quote.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.quote.delete({ where: { id: ctx.quote.id } });
  return NextResponse.json({ ok: true });
}
