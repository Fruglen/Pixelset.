import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcTotals, fmtMoney, logStudioMessage, parseItems } from "@/lib/studio";

const METHODS = ["card", "paypal", "manual"];

// Public invoice payment (mock). Pays one instalment, or the whole invoice when
// there is no payment schedule. Optionally records a tip on the final payment.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const invoice = await db.invoice.findUnique({
    where: { token: params.token },
    include: { contact: true, installments: { orderBy: { order: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "DRAFT") {
    return NextResponse.json({ error: "This invoice isn't open for payment yet." }, { status: 400 });
  }
  if (invoice.status === "PAID") return NextResponse.json({ ok: true, status: "PAID" });

  const body = await req.json();
  const method = METHODS.includes(body.method) ? body.method : "card";
  const tip = Math.max(0, Math.round(Number(body.tipCents) || 0));
  const now = new Date();

  let paidCents = 0;
  let label = "";

  if (invoice.installments.length > 0) {
    const inst = invoice.installments.find((i) => i.id === String(body.installmentId ?? ""));
    if (!inst) return NextResponse.json({ error: "Pick a payment to make" }, { status: 400 });
    if (inst.paidAt) return NextResponse.json({ error: "That instalment is already paid." }, { status: 400 });
    await db.invoiceInstallment.update({
      where: { id: inst.id },
      data: { paidAt: now, paymentMethod: method },
    });
    paidCents = inst.amountCents;
    label = inst.label || `Payment ${inst.order + 1}`;
  } else {
    const totals = calcTotals(
      parseItems(invoice.items),
      invoice.taxRate,
      invoice.discountType,
      invoice.discountValue,
      invoice.tipCents
    );
    paidCents = totals.total;
    label = "Full balance";
  }

  const data: Record<string, unknown> = {};
  if (tip > 0) data.tipCents = invoice.tipCents + tip;

  const fresh = await db.invoice.findUnique({
    where: { id: invoice.id },
    include: { installments: true },
  });
  const allPaid =
    !fresh || fresh.installments.length === 0 || fresh.installments.every((i) => i.paidAt);
  if (allPaid) {
    data.status = "PAID";
    data.paidAt = now;
  }
  await db.invoice.update({ where: { id: invoice.id }, data });

  await logStudioMessage(invoice.userId, {
    kind: "PAYMENT",
    name: invoice.contact?.name ?? "",
    email: invoice.contact?.email ?? "",
    subject: `Payment received: ${fmtMoney(paidCents + tip)} on ${invoice.number}`,
    body: `${invoice.contact?.name ?? "The client"} paid ${fmtMoney(paidCents)} (${label}) by ${method} on invoice ${invoice.number}${tip ? ` plus a ${fmtMoney(tip)} tip` : ""}.${allPaid ? " The invoice is now fully paid." : ""}`,
    meta: `Mock payment · ${method}`,
  });

  return NextResponse.json({ ok: true, status: allPaid ? "PAID" : "PARTIAL" });
}
