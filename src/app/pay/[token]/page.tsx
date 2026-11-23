import { notFound } from "next/navigation";
import { brandFor } from "@/lib/brand";
import { documentTheme, docVars } from "@/lib/doc-theme";
import { DocThemeHead } from "@/components/doc-theme-head";
import { BrandMark } from "@/components/brand-mark";
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
import { invoiceTemplate } from "@/lib/invoice-templates";
import { clientPaymentMethods } from "@/lib/processors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Invoice" };

export default async function PayPage({ params, searchParams }: { params: { token: string }; searchParams?: { template?: string } }) {
  const invoice = await db.invoice.findUnique({
    where: { token: params.token },
    include: { contact: true, user: true, installments: { orderBy: { order: "asc" } } },
  });
  if (!invoice) notFound();
  // Drafts are visible only as a template preview (the editor links here with ?template=).
  if (invoice.status === "DRAFT" && !searchParams?.template) notFound();
  const tpl = invoiceTemplate(searchParams?.template || invoice.template);
  const w = tpl.words;
  const modern = tpl.id === "MODERN";
  const minimal = tpl.id === "MINIMAL";

  const profile = await getStudioProfile(invoice.userId);
  const items = parseItems(invoice.items);
  const totals = calcTotals(items, invoice.taxRate, invoice.discountType, invoice.discountValue, invoice.tipCents);
  const status = invoiceEffectiveStatus(invoice.status, invoice.installments);
  const business = invoice.user.businessName || invoice.user.name;

  const brand = await brandFor(invoice.userId);
  // Fix batch 2026-11-20: site palette + font theme for the document
  const theme = await documentTheme(invoice.userId);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-10 px-4 branded doc-themed print-area print-page-number" style={docVars(theme)} data-doc-palette={theme.paletteId} data-doc-font={theme.fontThemeId}>
      <DocThemeHead theme={theme} />
      <div className="max-w-2xl mx-auto">
        {/* Night build (Extras): repeated studio header on printed invoices */}
        <div className="print-header hidden">
          <p className="font-display text-xl">{brand.name}</p>
          <p className="text-xs text-neutral-500">
            Invoice {invoice.number} · {invoice.title} · Printed {new Date().toLocaleDateString()}
          </p>
        </div>
        {!modern ? <div className={`mb-3 ${minimal ? "[&>div]:items-start" : ""}`}><BrandMark brand={brand} align={minimal ? "left" : "center"} /></div> : null}
        {invoice.status === "DRAFT" ? (
          <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
            Template preview, this invoice is still a draft and cannot be paid yet.
          </p>
        ) : null}
        {!modern ? (
          <>
            <p className={`text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2 ${minimal ? "" : "text-center"}`}>{business}</p>
            <h1 className={`${minimal ? "text-xl font-semibold" : "font-display text-2xl text-center"}`}>
              {w.heading} {invoice.number}
            </h1>
          </>
        ) : null}
        <p className={`text-sm mt-2 mb-8 ${minimal ? "" : "text-center"} ${modern ? "hidden" : ""}`}>
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

        {invoice.featuredPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={invoice.featuredPhotoUrl}
            alt={invoice.title || `Invoice ${invoice.number}`}
            className="w-full max-h-72 object-cover rounded-md border border-neutral-200 shadow-sm mb-6"
          />
        ) : null}
        <div
          className={`text-sm ${
            minimal ? "bg-white px-2 py-6" : modern ? "bg-white border border-neutral-200 shadow-sm rounded-md overflow-hidden" : "bg-white border border-neutral-200 shadow-sm rounded-sm px-8 py-10"
          }`}
        >
          {modern ? (
            <div className="doc-on-accent bg-neutral-900 text-white px-8 py-8 flex items-end justify-between gap-6" style={{ background: theme.accent }}>
              <div>
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt={`${business} logo`} className="max-h-10 max-w-[180px] object-contain mb-2 bg-white/90 rounded p-1" />
                ) : null}
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">{business}</p>
                <h1 className="font-display text-3xl mt-1">{w.heading}</h1>
                <p className="text-neutral-400 text-xs mt-1">
                  {invoice.number} · {status === "PARTIAL" ? "PARTIALLY PAID" : status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-neutral-400">{w.total}</p>
                <p className="text-3xl font-display">{fmtMoney(totals.total)}</p>
              </div>
            </div>
          ) : null}
          <div className={modern ? "px-8 py-8" : ""}>
          <div className="flex justify-between gap-6 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">{w.billedTo}</p>
              <p className="font-medium">{invoice.contact?.name ?? "-"}</p>
              {invoice.contact?.email ? <p className="text-neutral-500">{invoice.contact.email}</p> : null}
            </div>
            <div className="text-right">
              {invoice.title ? <p className="font-medium">{invoice.title}</p> : null}
              <p className="text-neutral-500">
                {w.issued} {formatDate(invoice.issueDate)}
              </p>
              {invoice.dueDate ? (
                <p className="text-neutral-500">
                  {w.due} {formatDate(invoice.dueDate)}
                </p>
              ) : null}
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className={`text-xs uppercase tracking-wide text-neutral-400 ${minimal ? "" : "border-b border-neutral-200"}`}>
                <th className="text-left py-2 font-medium">{w.item}</th>
                <th className="text-right py-2 font-medium">Qty</th>
                <th className="text-right py-2 font-medium">Price</th>
                <th className="text-right py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className={minimal ? "" : modern ? "border-b border-neutral-100 even:bg-neutral-50" : "border-b border-neutral-100"}>
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
              <div className={`flex justify-between font-semibold pt-1.5 ${minimal ? "" : "border-t border-neutral-200"}`}>
                <span>{w.total}</span>
                <span>{fmtMoney(totals.total)}</span>
              </div>
            </div>
          </div>

          {invoice.notes ? (
            <div className="mt-8 border-t border-neutral-100 pt-4">
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">{w.notes}</p>
              <p className="text-neutral-500 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          ) : null}
          </div>
        </div>

        <div className={`mt-8 ${invoice.status === "DRAFT" ? "hidden" : ""}`}>
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
              live: clientPaymentMethods(profile),
            }}
          />
        </div>
        <p className="text-center text-xs text-neutral-400 mt-8">
          {business} · powered by Pixora ·{" "}
          {(profile.showStripe && clientPaymentMethods(profile).stripeLive) || (profile.showPaypal && clientPaymentMethods(profile).paypalLive)
            ? "payments are processed securely by the connected payment provider"
            : "online payment is not enabled yet"}
        </p>
      </div>
    </div>
  );
}
