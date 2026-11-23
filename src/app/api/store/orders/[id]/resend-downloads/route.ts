import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";
import { logStudioMessage } from "@/lib/studio";

// Phase 5B: resend purchased digital downloads. Every digital item on the order
// gets a fresh link valid for 7 days (the old link stops working) and the
// buyer is emailed the new links through the mailer.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const order = await db.order.findFirst({ where: { id: params.id, userId: user.id }, include: { items: true, collection: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status === "CANCELLED") return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });
  const digital = order.items.filter((i) => i.downloadToken || i.category === "DIGITAL");
  if (digital.length === 0) return NextResponse.json({ error: "This order has no digital downloads" }, { status: 400 });
  if (!order.customerEmail.includes("@")) return NextResponse.json({ error: "The order has no customer email" }, { status: 400 });

  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const links: string[] = [];
  for (const item of digital) {
    const token = randomBytes(16).toString("hex");
    await db.orderItem.update({ where: { id: item.id }, data: { downloadToken: token, downloadExpires: expires } });
    links.push(`${item.photoName || item.productName}: ${absoluteUrl(`/api/store/download/${token}`)}`);
  }
  const brand = user.businessName || user.name;
  const until = expires.toLocaleDateString("en-US", { timeZone: user.timezone, month: "long", day: "numeric", year: "numeric" });
  const subject = `Your download links for order ${order.number}`;
  // Night build: large orders also get a bundled ZIP link (split into parts
  // when the files are big), keyed by the first fresh token.
  const firstToken = /download\/([a-f0-9]+)/.exec(links[0] ?? "")?.[1];
  const bundleLine = firstToken
    ? `\n\nPrefer everything at once? Download the full order as ZIP file(s): ${absoluteUrl(`/api/store/download/${firstToken}/bundle`)} (large orders split into parts; add ?part=2, ?part=3 for the rest)`
    : "";
  const text = `Hi ${order.customerName || "there"},\n\nHere are fresh download links for your digital purchase from ${brand}. They work until ${until}.\n\n${links.join("\n")}${bundleLine}\n\nThank you,\n${brand}`;
  const mail = await sendMail({ userId: user.id, to: order.customerEmail, subject, text });
  const note = deliveryNote(mail);
  await logStudioMessage(user.id, { kind: "EMAIL", name: order.customerName, email: order.customerEmail, subject, body: text, meta: `Download links resent · ${note}` });
  if (order.collectionId) await logActivity(order.collectionId, "DOWNLOAD_LINK_RESENT", `${order.number}: ${digital.length} download link(s) resent (${note})`, order.customerEmail);
  return NextResponse.json({ ok: true, count: digital.length, expires: expires.toISOString(), delivered: mail.sent, error: mail.error ?? null, note });
}
