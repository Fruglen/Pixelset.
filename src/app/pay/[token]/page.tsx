import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  calcTotals,
  fmtMoney,
  getStudioProfile,
  invoiceEffectiveStatus,
  parseItems,
} from "@/lib/studio";
import { formatDate } from "@/lib/utils";
import { PayClient } from "./pay-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Invoice" };

export default async function PayPage({ params }: { params: { token: string } }) {
  const invoice = await db.invoice.findUnique({
    where: { token: params.token },
    include: { contact: true, user: true, installments: { orderBy: { order: "asc" } } },
  });
  if (!invoice || invoice.status === "DRAFT") notFound();

  const profile = await getStudioProfile(invoice.userId);
  const items = parseItems(invoice.items);
  const totals = calcTotals(items, invoice.taxRate, invoice.discountType, invoice.discountValue, invoice.tipCents);
  const status = invoiceEffectiveStatus(invoice.status, invoice.installments);
  const business = invoice.user.businessName || invoice.user.name;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{business}</p>
        <h1 className="font-display text-2xl text-center">Invoice {invoice.number}</h1>
        <p className="text-center text-sm mt-2 mb-8">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === "PAID"
                ? "bg-emerald-100 text-emerald-700"
                : status === "OVERDUE"
                  ? "bg-red-100 text-red-700"
                  : status === "PARTIAL"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {status === "PARTIAL" ? "PARTIALLY PAID" : status}
          </span>
        </p>

        <div className="bg-white border border-neutral-200 shadow-sm rounded-sm px-8 py-10 text-sm">
          <div className="flex justify-between gap-6 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Billed to</p>
              <p className="font-medium">{invoice.contact?.name ?? "-"}</p>
              {invoice.contact?.email ? <p className="text-neutral-500">{invoice.contact.email}</p> : null}
            </div>
            <div className="text-right">
              {invoice.title ? <p className="font-medium">{invoice.title}</p> : null}
              <p className="text-neutral-500">Issued {formatDate(invoice.issueDate)}</p>
              {invoice.dueDate ? <p className="text-neutral-500">Due {formatDate(invoice.dueDate)}</p> : null}
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-200">
                <th className="text-left py-2 font-medium">Item</th>
                <th className="text-right py-2 font-medium">Qty</th>
                <th className="text-right py-2 font-medium">Price</th>
                <th className="text-right py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2.5">{it.description}</td>
                  <td className="py-2.5 text-right">{it.qty}</td>
                  <td className="py-2.5 text-right">{fmtMoney(it.unitCents)}</td>
                  <td className="py-2.5 text-right">{fmtMoney(Math.round(it.qty * it.unitCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-56 space-y-1.5">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{fmtMoney(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 ? (
                <div className="flex justify-between text-neutral-600">
                  <span>Discount</span>
                  <span>-{fmtMoney(totals.discount)}</span>
                </div>
              ) : null}
              {totals.tax > 0 ? (
                <div className="flex justify-between text-neutral-600">
                  <span>Tax ({invoice.taxRate}%)</span>
                  <span>{fmtMoney(totals.tax)}</span>
                </div>
              ) : null}
              {totals.tip > 0 ? (
                <div className="flex justify-between text-neutral-600">
                  <span>Tip</span>
                  <span>{fmtMoney(totals.tip)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold border-t border-neutral-200 pt-1.5">
                <span>Total</span>
                <span>{fmtMoney(totals.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes ? (
            <p className="mt-8 text-neutral-500 whitespace-pre-wrap border-t border-neutral-100 pt-4">{invoice.notes}</p>
          ) : null}
        </div>

        <div className="mt-8">
          <PayClient
            token={params.token}
            status={status}
            totalCents={totals.total}
            installments={invoice.installments.map((i) => ({
              id: i.id,
              label: i.label || `Payment ${i.order + 1}`,
              dueDate: formatDate(i.dueDate),
              overdue: !i.paidAt && i.dueDate.getTime() < Date.now(),
              amountCents: i.amountCents,
              paid: !!i.paidAt,
              paidAt: i.paidAt ? formatDate(i.paidAt) : "",
              method: i.paymentMethod,
            }))}
            payMethods={{
              stripe: profile.showStripe,
              paypal: profile.showPaypal,
              manual: profile.showManual && profile.manualEnabled,
              manualInstructions: profile.manualInstructions,
            }}
          />
        </div>
        <p className="text-center text-xs text-neutral-400 mt-8">
          {business} · powered by Pixelset · payments are processed at 2.9% + $0.30 per transaction (demo)
        </p>
      </div>
    </div>
  );
}
