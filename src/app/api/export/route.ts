import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtMoney, invoiceEffectiveStatus } from "@/lib/studio";

export const runtime = "nodejs";

// Bulk export: clients / invoices / bookings / orders as CSV or JSON, plus
// per-collection favorites lists as CSV (a Lightroom-style filename copy list).

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  return lines.join("\n") + "\n";
}

function respond(rows: Record<string, unknown>[], format: string, name: string) {
  if (format === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${name}.json"`,
      },
    });
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const what = req.nextUrl.searchParams.get("what") ?? "";
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (what === "clients") {
    const contacts = await db.contact.findMany({
      where: { userId: user.id },
      include: { _count: { select: { bookings: true, invoices: true } } },
      orderBy: { name: "asc" },
    });
    return respond(
      contacts.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        company: c.company,
        tags: c.tags,
        bookings: c._count.bookings,
        invoices: c._count.invoices,
        created: c.createdAt.toISOString(),
      })),
      format,
      `clients-${stamp}`
    );
  }

  if (what === "invoices") {
    const invoices = await db.invoice.findMany({
      where: { userId: user.id },
      include: { contact: true, installments: true },
      orderBy: { createdAt: "desc" },
    });
    return respond(
      invoices.map((inv) => {
        const paid = inv.installments.filter((i) => i.paidAt).reduce((s, i) => s + i.amountCents, 0);
        const total = inv.installments.reduce((s, i) => s + i.amountCents, 0);
        return {
          number: inv.number,
          title: inv.title,
          client: inv.contact?.name ?? "",
          clientEmail: inv.contact?.email ?? "",
          status: invoiceEffectiveStatus(inv.status, inv.installments),
          issued: inv.issueDate.toISOString().slice(0, 10),
          due: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : "",
          total: fmtMoney(total),
          paid: fmtMoney(paid),
          outstanding: fmtMoney(total - paid),
        };
      }),
      format,
      `invoices-${stamp}`
    );
  }

  if (what === "bookings") {
    const bookings = await db.booking.findMany({
      where: { userId: user.id },
      include: { contact: true, sessionType: true },
      orderBy: { startsAt: "desc" },
    });
    return respond(
      bookings.map((b) => ({
        title: b.title,
        client: b.contact?.name ?? "",
        clientEmail: b.contact?.email ?? "",
        starts: b.startsAt.toISOString(),
        ends: b.endsAt.toISOString(),
        status: b.status,
        paymentStatus: b.paymentStatus,
        total: fmtMoney(b.totalCents),
        source: b.source,
      })),
      format,
      `bookings-${stamp}`
    );
  }

  if (what === "orders") {
    const orders = await db.order.findMany({
      where: { userId: user.id },
      include: { collection: true, items: true },
      orderBy: { createdAt: "desc" },
    });
    return respond(
      orders.map((o) => ({
        number: o.number,
        status: o.status,
        customer: o.customerName,
        email: o.customerEmail,
        gallery: o.collection?.name ?? "",
        items: o.items.reduce((s, i) => s + i.qty, 0),
        total: fmtMoney(o.totalCents),
        fulfillment: o.fulfillment,
        created: o.createdAt.toISOString(),
      })),
      format,
      `orders-${stamp}`
    );
  }

  if (what === "favorites") {
    const collectionId = req.nextUrl.searchParams.get("collection") ?? "";
    const where = collectionId
      ? { collectionId, collection: { userId: user.id } }
      : { collection: { userId: user.id } };
    const lists = await db.favoriteList.findMany({
      where,
      include: { collection: true, favorites: { include: { photo: true } } },
      orderBy: { createdAt: "asc" },
    });
    return respond(
      lists.flatMap((l) =>
        l.favorites.map((f) => ({
          gallery: l.collection.name,
          list: l.name,
          client: l.clientName || l.clientEmail,
          clientEmail: l.clientEmail,
          filename: f.photo.filename,
          note: f.note,
        }))
      ),
      format,
      collectionId ? `favorites-${stamp}` : `favorites-all-${stamp}`
    );
  }

  return NextResponse.json({ error: "Unknown export" }, { status: 400 });
}
