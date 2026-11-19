import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";
import { logStudioMessage } from "@/lib/studio";

// Phase 5B: per client installs of a collection's mobile app. Each client gets
// their own link (/app/<client slug>), manifest, and personalised greeting.
// Body: { contactId?, clientName?, clientEmail?, greeting?, send? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const app = await db.mobileApp.findFirst({ where: { id: params.id, userId: user.id } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let clientName = typeof body.clientName === "string" ? body.clientName.trim().slice(0, 120) : "";
  let clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase().slice(0, 200) : "";
  let contactId = "";
  if (typeof body.contactId === "string" && body.contactId) {
    const contact = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
    if (!contact) return NextResponse.json({ error: "Unknown client" }, { status: 400 });
    contactId = contact.id;
    clientName = clientName || contact.name;
    clientEmail = clientEmail || contact.email;
  }
  if (!clientName) return NextResponse.json({ error: "Choose a client or enter a name" }, { status: 400 });
  if (clientEmail && !/.+@.+\..+/.test(clientEmail)) return NextResponse.json({ error: "That email does not look right" }, { status: 400 });

  const slug = `${app.slug}-${slugify(clientName).slice(0, 30) || "client"}-${randomBytes(3).toString("hex")}`;
  const client = await db.mobileAppClient.create({
    data: {
      userId: user.id,
      appId: app.id,
      contactId,
      clientName,
      clientEmail,
      greeting: typeof body.greeting === "string" ? body.greeting.trim().slice(0, 300) : "",
      slug,
    },
  });

  let mail: { sent: boolean; error?: string } | null = null;
  if (body.send === true && clientEmail) {
    const brand = user.businessName || user.name;
    const link = absoluteUrl(`/app/${slug}`);
    const subject = `Your ${app.appName} gallery app`;
    const text = `Hi ${clientName.split(" ")[0]},\n\nYour photos now have their own app. Open this link on your phone and choose Add to Home Screen:\n\n${link}\n\n${brand}`;
    mail = await sendMail({ userId: user.id, to: clientEmail, subject, text });
    await logStudioMessage(user.id, { kind: "EMAIL", name: clientName, email: clientEmail, subject, body: text, meta: `Mobile app link · ${deliveryNote(mail)}` });
  }
  return NextResponse.json({ id: client.id, slug, mail: mail ? deliveryNote(mail) : null, delivered: mail?.sent ?? false });
}
