import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStudioProfile, nextInvoiceNumber } from "@/lib/studio";

// Create a draft invoice, blank, or prefilled from a booking.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getStudioProfile(user.id);
  const body = await req.json();

  let contactId: string | null = null;
  if (typeof body.contactId === "string" && body.contactId) {
    const c = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
    if (c) contactId = c.id;
  }

  let bookingId: string | null = null;
  let items: { description: string; qty: number; unitCents: number }[] = [];
  let title = typeof body.title === "string" ? body.title.trim() : "";

  if (typeof body.bookingId === "string" && body.bookingId) {
    const booking = await db.booking.findFirst({
      where: { id: body.bookingId, userId: user.id },
      include: { contact: true },
    });
    if (booking) {
      bookingId = booking.id;
      contactId = contactId ?? booking.contactId;
      title = title || booking.title;
      items = [{ description: booking.title, qty: 1, unitCents: booking.totalCents }];
      const addOns = JSON.parse(booking.addOns || "[]") as { name: string; priceCents: number }[];
      for (const a of addOns) items.push({ description: a.name, qty: 1, unitCents: a.priceCents });
    }
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invoice = await db.invoice.create({
    data: {
      userId: user.id,
      contactId,
      bookingId,
      number: await nextInvoiceNumber(user.id),
      title,
      status: "DRAFT",
      dueDate,
      items: JSON.stringify(items),
      taxRate: profile.defaultTaxRate,
    },
  });
  return NextResponse.json({ id: invoice.id });
}
