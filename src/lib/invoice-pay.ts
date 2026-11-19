import { db } from "./db";
import { calcTotals, fmtMoney, logStudioMessage, parseItems } from "./studio";
import { recordPayment } from "./studio-flow";
import { notify } from "./notify";

// Night build: one code path for settling an invoice payment, used by the
// recorded (demo) checkout, by the Stripe webhook when a live Checkout
// session completes, and by the PayPal capture return. `live` payments carry
// their processor reference in the inbox log line.
export async function applyInvoicePayment(
  token: string,
  opts: { installmentId?: string; method: string; tipCents?: number; live?: boolean; processorRef?: string }
): Promise<{ ok: true; status: string; paidCents: number } | { error: string; status?: number }> {
  const invoice = await db.invoice.findUnique({
    where: { token },
    include: { contact: true, installments: { orderBy: { order: "asc" } } },
  });
  if (!invoice) return { error: "Invoice not found", status: 404 };
  if (invoice.status === "DRAFT") return { error: "This invoice isn't open for payment yet.", status: 400 };
  if (invoice.status === "PAID") return { ok: true, status: "PAID", paidCents: 0 };

  const method = opts.method;
  const tip = Math.max(0, Math.round(opts.tipCents || 0));
  const now = new Date();
  let paidCents = 0;
  let label = "";

  if (invoice.installments.length > 0) {
    const inst = invoice.installments.find((i) => i.id === String(opts.installmentId ?? ""));
    if (!inst) return { error: "Pick a payment to make", status: 400 };
    if (inst.paidAt) return { error: "That instalment is already paid.", status: 400 };
    await db.invoiceInstallment.update({ where: { id: inst.id }, data: { paidAt: now, paymentMethod: method } });
    paidCents = inst.amountCents;
    label = inst.label || `Payment ${inst.order + 1}`;
  } else {
    const totals = calcTotals(parseItems(invoice.items), invoice.taxRate, invoice.discountType, invoice.discountValue, invoice.tipCents);
    paidCents = totals.total;
    label = "Full balance";
  }

  const data: Record<string, unknown> = {};
  if (tip > 0) data.tipCents = invoice.tipCents + tip;
  const fresh = await db.invoice.findUnique({ where: { id: invoice.id }, include: { installments: true } });
  const allPaid = !fresh || fresh.installments.length === 0 || fresh.installments.every((i) => i.paidAt);
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
    meta: opts.live ? `Paid via processor · ${method}${opts.processorRef ? ` · ${opts.processorRef}` : ""}` : `Mock payment · ${method}`,
  });

  await recordPayment({
    userId: invoice.userId,
    source: "INVOICE",
    sourceId: invoice.id,
    label: `${invoice.number}, ${label}`,
    payerName: invoice.contact?.name,
    payerEmail: invoice.contact?.email,
    amountCents: paidCents,
    tipCents: tip,
    method,
  });
  await notify(
    invoice.userId,
    "INVOICE_PAID",
    `${invoice.contact?.name ?? "A client"} paid ${fmtMoney(paidCents + tip)}`,
    `${invoice.number}${allPaid ? ", now fully paid" : `, ${label}`}`,
    `/studio/invoices/${invoice.id}`
  );
  return { ok: true, status: allPaid ? "PAID" : "PARTIAL", paidCents };
}

/** Amount currently due for a pay page action (one instalment or full balance). */
export async function invoiceAmountDue(token: string, installmentId?: string): Promise<{ invoice: NonNullable<Awaited<ReturnType<typeof loadInvoice>>>; dueCents: number } | { error: string }> {
  const invoice = await loadInvoice(token);
  if (!invoice) return { error: "Invoice not found" };
  if (invoice.installments.length > 0) {
    const inst = invoice.installments.find((i) => i.id === String(installmentId ?? "")) ?? invoice.installments.find((i) => !i.paidAt);
    if (!inst) return { error: "Nothing left to pay on this invoice" };
    return { invoice, dueCents: inst.amountCents };
  }
  const totals = calcTotals(parseItems(invoice.items), invoice.taxRate, invoice.discountType, invoice.discountValue, invoice.tipCents);
  return { invoice, dueCents: totals.total };
}

function loadInvoice(token: string) {
  return db.invoice.findUnique({ where: { token }, include: { contact: true, installments: { orderBy: { order: "asc" } } } });
}
