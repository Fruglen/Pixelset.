import { db } from "./db";
import { calcTotals, invoiceEffectiveStatus, parseItems } from "./studio";
import { processorFeeCents } from "./processors";

// Phase 5B: payment and income reporting across invoices, booking retainers and
// payment links. Invoice income is read from paid instalments (or a fully paid
// invoice without a schedule); retainers and payment links from the payment
// ledger. All payments are mocked per the owner's payments exclusion.

export interface PaymentRow {
  id: string;
  date: string;
  source: "Invoice" | "Booking retainer" | "Payment link" | "Refund";
  label: string;
  payer: string;
  method: string;
  amountCents: number;
  tipCents: number;
  // Night build: the processor's cut, estimated from the published rate for
  // the method (a connected processor reports the exact figure per charge).
  feeCents: number;
  kind: "invoice" | "ledger";
}

export async function paymentRows(userId: string): Promise<PaymentRow[]> {
  const [invoices, ledger] = await Promise.all([
    db.invoice.findMany({ where: { userId }, include: { installments: true, contact: true } }),
    db.studioPayment.findMany({ where: { userId, source: { in: ["BOOKING", "PAYMENT_LINK", "REFUND"] } } }),
  ]);
  const rows: PaymentRow[] = [];
  for (const inv of invoices) {
    const paid = inv.installments.filter((i) => i.paidAt);
    const lastPaid = paid.sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime());
    for (let k = 0; k < lastPaid.length; k++) {
      const i = lastPaid[k];
      rows.push({
        id: i.id,
        date: i.paidAt!.toISOString(),
        source: "Invoice",
        label: `${inv.number}, ${i.label || "Payment"}`,
        payer: inv.contact?.name ?? "",
        method: i.paymentMethod || "card",
        amountCents: i.amountCents,
        tipCents: k === lastPaid.length - 1 ? inv.tipCents : 0,
        feeCents: processorFeeCents(i.amountCents, i.paymentMethod || "card"),
        kind: "invoice",
      });
    }
    if (inv.installments.length === 0 && inv.status === "PAID" && inv.paidAt) {
      const t = calcTotals(parseItems(inv.items), inv.taxRate, inv.discountType, inv.discountValue, 0);
      rows.push({
        id: inv.id,
        date: inv.paidAt.toISOString(),
        source: "Invoice",
        label: `${inv.number}, full balance`,
        payer: inv.contact?.name ?? "",
        method: "card",
        amountCents: t.total,
        tipCents: inv.tipCents,
        feeCents: processorFeeCents(t.total, "card"),
        kind: "invoice",
      });
    }
  }
  for (const p of ledger) {
    rows.push({
      id: p.id,
      date: p.createdAt.toISOString(),
      source: p.source === "BOOKING" ? "Booking retainer" : p.source === "REFUND" ? "Refund" : "Payment link",
      label: p.label,
      payer: p.payerName || p.payerEmail,
      method: p.method,
      amountCents: p.amountCents,
      tipCents: p.tipCents,
      feeCents: p.amountCents > 0 ? processorFeeCents(p.amountCents, p.method) : 0,
      kind: "ledger",
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function outstandingCents(userId: string): Promise<number> {
  const invoices = await db.invoice.findMany({ where: { userId, status: { not: "DRAFT" } }, include: { installments: true } });
  let total = 0;
  for (const inv of invoices) {
    if (invoiceEffectiveStatus(inv.status, inv.installments) === "PAID") continue;
    if (inv.installments.length) total += inv.installments.filter((i) => !i.paidAt).reduce((n, i) => n + i.amountCents, 0);
    else total += calcTotals(parseItems(inv.items), inv.taxRate, inv.discountType, inv.discountValue, inv.tipCents).total;
  }
  return total;
}
