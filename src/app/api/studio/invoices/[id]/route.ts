import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calcTotals, fmtMoney, logStudioMessage, parseItems } from "@/lib/studio";
import { permissionError } from "@/lib/team";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const invoice = await db.invoice.findFirst({
    where: { id, userId: user.id },
    include: { contact: true, installments: { orderBy: { order: "asc" } } },
  });
  return invoice ? { user, invoice } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { invoice } = ctx;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.notes === "string") data.notes = body.notes;
  // Night build follow-up: featured photo shown at the top of the pay page.
  if (typeof body.featuredPhotoUrl === "string") data.featuredPhotoUrl = body.featuredPhotoUrl.trim().slice(0, 1000);
  // Phase 5B: template + per invoice reminder schedule (days relative to the due date)
  if (["CLASSIC", "MODERN", "MINIMAL"].includes(body.template)) data.template = body.template;
  if (Array.isArray(body.reminderSchedule)) {
    const offsets = Array.from(
      new Set(body.reminderSchedule.map((n: unknown) => Math.round(Number(n))).filter((n: number) => Number.isFinite(n) && n >= -60 && n <= 120))
    ).sort((a, b) => (a as number) - (b as number));
    if (offsets.length > 8) return NextResponse.json({ error: "Up to 8 reminders per invoice." }, { status: 400 });
    data.reminderSchedule = JSON.stringify(offsets);
  }
  if (Array.isArray(body.items)) data.items = JSON.stringify(parseItems(JSON.stringify(body.items)));
  if (body.taxRate !== undefined) {
    const r = Number(body.taxRate);
    if (!isNaN(r) && r >= 0 && r <= 100) data.taxRate = r;
  }
  if (["NONE", "PERCENT", "FIXED"].includes(body.discountType)) data.discountType = body.discountType;
  if (body.discountValue !== undefined) data.discountValue = Math.max(0, Math.round(Number(body.discountValue) || 0));
  if (body.tipCents !== undefined) data.tipCents = Math.max(0, Math.round(Number(body.tipCents) || 0));
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(`${body.dueDate}T23:59:59`) : null;
  if (body.contactId !== undefined) {
    if (!body.contactId) data.contactId = null;
    else {
      const c = await db.contact.findFirst({ where: { id: body.contactId, userId: ctx.user.id } });
      if (c) data.contactId = c.id;
    }
  }

  // Replace the payment schedule (up to 12 instalments). Paid instalments keep their paidAt.
  if (Array.isArray(body.installments)) {
    if (body.installments.length > 12) {
      return NextResponse.json({ error: "A payment schedule can have at most 12 instalments." }, { status: 400 });
    }
    const paidByOrder = new Map(invoice.installments.filter((i) => i.paidAt).map((i) => [i.order, i]));
    await db.invoiceInstallment.deleteMany({ where: { invoiceId: invoice.id } });
    let order = 0;
    for (const inst of body.installments) {
      const due = inst.dueDate ? new Date(`${inst.dueDate}T23:59:59`) : new Date();
      const prevPaid = paidByOrder.get(order);
      await db.invoiceInstallment.create({
        data: {
          invoiceId: invoice.id,
          label: typeof inst.label === "string" ? inst.label : `Payment ${order + 1}`,
          dueDate: isNaN(due.getTime()) ? new Date() : due,
          amountCents: Math.max(0, Math.round(Number(inst.amountCents) || 0)),
          paidAt: inst.paid === true ? prevPaid?.paidAt ?? new Date() : null,
          paymentMethod: inst.paid === true ? prevPaid?.paymentMethod ?? "manual" : "",
          order,
        },
      });
      order++;
    }
  }

  // Actions
  if (body.action === "send" && invoice.status === "DRAFT") {
    data.status = "SENT";
    data.sentAt = new Date();
    const businessName = ctx.user.businessName || ctx.user.name;
    const totals = calcTotals(parseItems(invoice.items), invoice.taxRate, invoice.discountType, invoice.discountValue);
    const mail = await sendMail({
      userId: ctx.user.id,
      to: invoice.contact?.email ?? "",
      subject: `Invoice ${invoice.number} from ${businessName}`,
      text: `Hi ${invoice.contact?.name || "there"},

Invoice ${invoice.number}${invoice.title ? ` (${invoice.title})` : ""} for ${fmtMoney(totals.total)} is ready. You can view and pay it securely here:

${absoluteUrl(`/pay/${invoice.token}`)}
${invoice.dueDate ? `\nDue date: ${invoice.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}\n` : ""}
Thank you!
${businessName}`,
    });
    await logStudioMessage(ctx.user.id, {
      kind: "EMAIL",
      email: invoice.contact?.email ?? "",
      name: invoice.contact?.name ?? "",
      subject: `Invoice ${invoice.number} sent`,
      body: `Invoice ${invoice.number} was emailed to ${invoice.contact?.name || "the client"} with a payment link (/pay/${invoice.token}).`,
      meta: [invoice.contact?.email ? `To ${invoice.contact.email}` : "", deliveryNote(mail)]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (body.action === "markPaid") {
    const denied = permissionError("payments");
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    data.status = "PAID";
    data.paidAt = new Date();
    await db.invoiceInstallment.updateMany({
      where: { invoiceId: invoice.id, paidAt: null },
      data: { paidAt: new Date(), paymentMethod: "manual" },
    });
  }
  // Night build: Tap to Pay / in-person collection. With Stripe live, the
  // charge runs through Stripe Terminal on the photographer's phone; here we
  // settle the next open instalment (or the full balance) as an in-person
  // card payment and record it like any other payment.
  if (body.action === "tapToPay") {
    const denied = permissionError("payments");
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    const { recordPayment } = await import("@/lib/studio-flow");
    const { notify } = await import("@/lib/notify");
    const next = invoice.installments.find((i) => !i.paidAt);
    if (invoice.installments.length > 0 && next) {
      await db.invoiceInstallment.update({ where: { id: next.id }, data: { paidAt: new Date(), paymentMethod: "Tap to Pay" } });
      await recordPayment({
        userId: ctx.user.id,
        source: "INVOICE",
        sourceId: invoice.id,
        label: `${invoice.number}, ${next.label || "Payment"} (in person)`,
        payerName: invoice.contact?.name,
        payerEmail: invoice.contact?.email,
        amountCents: next.amountCents,
        method: "Tap to Pay",
      });
    } else if (invoice.installments.length === 0) {
      const { calcTotals, parseItems } = await import("@/lib/studio");
      const totals = calcTotals(parseItems(invoice.items), invoice.taxRate, invoice.discountType, invoice.discountValue, invoice.tipCents);
      data.status = "PAID";
      data.paidAt = new Date();
      await recordPayment({
        userId: ctx.user.id,
        source: "INVOICE",
        sourceId: invoice.id,
        label: `${invoice.number}, full balance (in person)`,
        payerName: invoice.contact?.name,
        payerEmail: invoice.contact?.email,
        amountCents: totals.total,
        method: "Tap to Pay",
      });
    }
    await notify(ctx.user.id, "INVOICE_PAID", `In person payment on ${invoice.number}`, "Taken with Tap to Pay", `/studio/invoices/${invoice.id}`);
  }
  if (body.action === "revertToDraft" && invoice.status === "SENT") {
    data.status = "DRAFT";
    data.sentAt = null;
  }

  await db.invoice.update({ where: { id: invoice.id }, data });

  // Recompute whether the invoice is fully paid after schedule edits.
  const fresh = await db.invoice.findUnique({ where: { id: invoice.id }, include: { installments: true } });
  if (fresh && fresh.status === "SENT" && fresh.installments.length > 0 && fresh.installments.every((i) => i.paidAt)) {
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.invoice.delete({ where: { id: ctx.invoice.id } });
  return NextResponse.json({ ok: true });
}

// GET returns computed totals, used by the editor for live validation.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { invoice } = ctx;
  const totals = calcTotals(
    parseItems(invoice.items),
    invoice.taxRate,
    invoice.discountType,
    invoice.discountValue,
    invoice.tipCents
  );
  return NextResponse.json({ totals });
}
