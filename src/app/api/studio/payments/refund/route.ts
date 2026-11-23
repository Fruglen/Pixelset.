import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { db } from "@/lib/db";
import { fmtMoney, logStudioMessage } from "@/lib/studio";
import { notify } from "@/lib/notify";

// Night build: refunds for Studio payments. Ledger payments (booking
// retainers, payment links) are refunded as a negative ledger row; invoice
// payments reopen the instalment they settled. When a live processor handled
// the original charge, the refund must also be issued in that processor (the
// Stripe refund API path lives in src/lib/processors.ts); this records the
// refund against the books either way and says so in the inbox.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("payments");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const kind = body.kind === "invoice" ? "invoice" : "ledger";
  const id = String(body.id ?? body.paymentId ?? "");
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

  if (kind === "ledger") {
    const p = await db.studioPayment.findFirst({ where: { id, userId: user.id } });
    if (!p) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (p.amountCents <= 0) return NextResponse.json({ error: "That entry cannot be refunded" }, { status: 400 });
    const amount = Math.min(p.amountCents, Math.max(1, Math.round(Number(body.amountCents) || p.amountCents)));
    await db.studioPayment.create({
      data: {
        userId: user.id,
        source: "REFUND",
        sourceId: p.sourceId,
        label: `Refund: ${p.label}`,
        payerName: p.payerName,
        payerEmail: p.payerEmail,
        amountCents: -amount,
        tipCents: 0,
        method: p.method,
      },
    });
    await logStudioMessage(user.id, {
      kind: "PAYMENT",
      name: p.payerName,
      email: p.payerEmail,
      subject: `Refund issued: ${fmtMoney(amount)}`,
      body: `You refunded ${fmtMoney(amount)} for ${p.label}.${reason ? ` Reason: ${reason}` : ""} If the original charge ran through a live processor, the money moves there; this entry settles your books.`,
    });
    await notify(user.id, "INVOICE_PAID", `Refund issued: ${fmtMoney(amount)}`, p.label, "/studio/reports");
    return NextResponse.json({ ok: true, amountCents: amount });
  }

  // Invoice instalment refund: reopen it and settle the invoice status.
  const inst = await db.invoiceInstallment.findFirst({
    where: { id, invoice: { userId: user.id } },
    include: { invoice: { include: { contact: true } } },
  });
  if (!inst) {
    // No-instalment invoice paid in full: reopen the whole invoice.
    const inv = await db.invoice.findFirst({ where: { id, userId: user.id }, include: { contact: true } });
    if (!inv || inv.status !== "PAID") return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const { calcTotals, parseItems } = await import("@/lib/studio");
    const total = calcTotals(parseItems(inv.items), inv.taxRate, inv.discountType, inv.discountValue, inv.tipCents).total;
    await db.invoice.update({ where: { id: inv.id }, data: { status: "SENT", paidAt: null } });
    await db.studioPayment.create({
      data: {
        userId: user.id,
        source: "REFUND",
        sourceId: inv.id,
        label: `Refund: ${inv.number}, full balance`,
        payerName: inv.contact?.name ?? "",
        payerEmail: inv.contact?.email ?? "",
        amountCents: -total,
        tipCents: 0,
        method: "card",
      },
    });
    await logStudioMessage(user.id, {
      kind: "PAYMENT",
      name: inv.contact?.name ?? "",
      email: inv.contact?.email ?? "",
      subject: `Refund issued: ${fmtMoney(total)} on ${inv.number}`,
      body: `You refunded the full balance of invoice ${inv.number}; it is open again.${reason ? ` Reason: ${reason}` : ""}`,
    });
    return NextResponse.json({ ok: true, amountCents: total });
  }
  if (!inst.paidAt) return NextResponse.json({ error: "That instalment is not paid" }, { status: 400 });
  await db.invoiceInstallment.update({ where: { id: inst.id }, data: { paidAt: null, paymentMethod: "" } });
  await db.invoice.update({ where: { id: inst.invoiceId }, data: { status: "SENT", paidAt: null } });
  await db.studioPayment.create({
    data: {
      userId: user.id,
      source: "REFUND",
      sourceId: inst.invoiceId,
      label: `Refund: ${inst.invoice.number}, ${inst.label || "Payment"}`,
      payerName: inst.invoice.contact?.name ?? "",
      payerEmail: inst.invoice.contact?.email ?? "",
      amountCents: -inst.amountCents,
      tipCents: 0,
      method: inst.paymentMethod || "card",
    },
  });
  await logStudioMessage(user.id, {
    kind: "PAYMENT",
    name: inst.invoice.contact?.name ?? "",
    email: inst.invoice.contact?.email ?? "",
    subject: `Refund issued: ${fmtMoney(inst.amountCents)} on ${inst.invoice.number}`,
    body: `You refunded ${fmtMoney(inst.amountCents)} (${inst.label || "instalment"}) on invoice ${inst.invoice.number}; the instalment is open again.${reason ? ` Reason: ${reason}` : ""}`,
  });
  await notify(user.id, "INVOICE_PAID", `Refund issued: ${fmtMoney(inst.amountCents)}`, inst.invoice.number, "/studio/reports");
  return NextResponse.json({ ok: true, amountCents: inst.amountCents });
}
