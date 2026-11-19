import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildInviteEmail, deliverInvite, DEFAULT_INVITE_BODY, DEFAULT_INVITE_SUBJECT } from "@/lib/invites";
import { GALLERY_LIMITS, planFor } from "@/lib/plans";
import { appBaseUrl } from "@/lib/mailer";

// Phase 5B: invites to one or many recipients (per recipient name for
// personalisation), from a reusable template or a one-off message, sent now
// or scheduled for a date and time.
//
// Body: { recipients?: [{ email, name }], email?, name?, message?, subject?,
//         templateId?, sendAt? (ISO) }

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();

  let recipients: { email: string; name: string }[] = [];
  if (Array.isArray(body.recipients)) {
    recipients = body.recipients
      .map((r: { email?: unknown; name?: unknown }) => ({
        email: typeof r?.email === "string" ? r.email.toLowerCase().trim() : "",
        name: typeof r?.name === "string" ? r.name.trim() : "",
      }))
      .filter((r: { email: string }) => r.email.includes("@"));
  } else if (typeof body.email === "string" && body.email.includes("@")) {
    recipients = [{ email: body.email.toLowerCase().trim(), name: typeof body.name === "string" ? body.name.trim() : "" }];
  }
  // de-duplicate
  recipients = recipients.filter((r, i, a) => a.findIndex((x) => x.email === r.email) === i);
  if (recipients.length === 0) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  if (recipients.length > 1) {
    const plan = await planFor(user.id);
    if (!GALLERY_LIMITS[plan.gallery].bulkSharing) {
      return NextResponse.json({ error: "Bulk sharing to several clients at once needs the Client Gallery Pro plan or higher." }, { status: 403 });
    }
  }

  let subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : DEFAULT_INVITE_SUBJECT;
  let message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : "";
  if (typeof body.templateId === "string" && body.templateId) {
    const tpl = await db.galleryEmailTemplate.findFirst({ where: { id: body.templateId, userId: user.id } });
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    subject = tpl.subject;
    message = message ? `${tpl.body}\n\n${message}` : tpl.body;
  } else if (message) {
    // A personal message on top of the default branded body.
    message = DEFAULT_INVITE_BODY.replace("{gallery_link}", `${message}\n\n{gallery_link}`);
  }

  let sendAt: Date | null = null;
  if (typeof body.sendAt === "string" && body.sendAt) {
    const d = new Date(body.sendAt);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid send time" }, { status: 400 });
    if (d.getTime() > Date.now() + 30_000) sendAt = d;
  }

  const results: { email: string; status: string; delivered: boolean; error: string | null }[] = [];
  for (const r of recipients) {
    const invite = await db.invite.create({
      data: {
        collectionId: collection.id,
        email: r.email,
        recipientName: r.name,
        subject,
        message,
        sendAt,
        status: sendAt ? "SCHEDULED" : "SENT",
      },
    });
    if (sendAt) {
      results.push({ email: r.email, status: "SCHEDULED", delivered: false, error: null });
    } else {
      const mail = await deliverInvite(invite.id);
      results.push({ email: r.email, status: mail?.error ? "FAILED" : "SENT", delivered: !!mail?.sent, error: mail?.error ?? null });
    }
  }
  const first = results[0];
  return NextResponse.json({
    ok: true,
    results,
    scheduled: !!sendAt,
    delivered: first.delivered,
    deliveryError: first.error,
  });
}

// Phase 5B: GET ?preview=1&message=&name= renders the branded invite exactly as
// it would be sent (cover image, personal message, download instructions).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const message = (sp.get("message") || "").trim();
  const body = message ? DEFAULT_INVITE_BODY.replace("{gallery_link}", `${message}\n\n{gallery_link}`) : DEFAULT_INVITE_BODY;
  const email = await buildInviteEmail(collection, user.businessName || user.name, DEFAULT_INVITE_SUBJECT, body, (sp.get("name") || "").trim());
  // Inside the dashboard the preview loads images from this same server.
  const html = email.html.split(appBaseUrl()).join("");
  return NextResponse.json({ subject: email.subject, html, text: email.text });
}
