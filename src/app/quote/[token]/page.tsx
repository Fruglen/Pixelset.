import { notFound } from "next/navigation";
import { brandFor } from "@/lib/brand";
import { documentTheme, docVars } from "@/lib/doc-theme";
import { DocThemeHead } from "@/components/doc-theme-head";
import { BrandMark } from "@/components/brand-mark";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { calcTotals, defaultQuoteSelection, fmtMoney, parseQuoteItems, selectedQuoteItems } from "@/lib/studio";
import { formatDate } from "@/lib/utils";
import { QuoteClient } from "./quote-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: { token: string } }) {
  const quote = await db.quote.findUnique({
    where: { token: params.token },
    include: { contact: true, user: true },
  });
  if (!quote || quote.status === "DRAFT") notFound();

  const quoteItems = parseQuoteItems(quote.items);
  const chosen: number[] = quote.selection ? (JSON.parse(quote.selection) as number[]) : defaultQuoteSelection(quoteItems);
  const hasChoices = quoteItems.some((it) => it.kind !== "fixed");
  const open = quote.status === "SENT";
  // Accepted quotes show exactly what the client chose; open quotes show the included items, choices are picked below.
  const items = open && hasChoices ? quoteItems.filter((it) => it.kind === "fixed") : selectedQuoteItems(quoteItems, chosen);
  const totals = calcTotals(selectedQuoteItems(quoteItems, chosen), quote.taxRate, quote.discountType, quote.discountValue);
  const business = quote.user.businessName || quote.user.name;
  const expired = !!quote.validUntil && quote.validUntil.getTime() < Date.now() && quote.status === "SENT";

  const brand = await brandFor(quote.userId);
  // Fix batch 2026-11-20: site palette + font theme for the document
  const theme = await documentTheme(quote.userId);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-10 px-4 branded doc-themed" style={docVars(theme)} data-doc-palette={theme.paletteId} data-doc-font={theme.fontThemeId}>
      <DocThemeHead theme={theme} />
      <div className="max-w-2xl mx-auto">
        <div className="mb-3"><BrandMark brand={brand} /></div>
        {brand.logoUrl ? <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{business}</p> : null}
        <h1 className="font-display text-2xl text-center mb-8">Quote {quote.number}</h1>

        <div className="bg-white border border-neutral-200 shadow-sm rounded-sm px-8 py-10 text-sm">
          <div className="flex justify-between gap-6 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Prepared for</p>
              <p className="font-medium">{quote.contact?.name ?? "-"}</p>
              {quote.contact?.email ? <p className="text-neutral-500">{quote.contact.email}</p> : null}
            </div>
            <div className="text-right">
              {quote.title ? <p className="font-medium">{quote.title}</p> : null}
              {quote.validUntil ? (
                <p className="text-neutral-500">Valid until {formatDate(quote.validUntil)}</p>
              ) : null}
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

          <div className={`flex justify-end mt-4 ${open && hasChoices ? "hidden" : ""}`}>
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
                  <span>Tax ({quote.taxRate}%)</span>
                  <span>{fmtMoney(totals.tax)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold border-t border-neutral-200 pt-1.5">
                <span>Total</span>
                <span>{fmtMoney(totals.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes ? (
            <p className="mt-8 text-neutral-500 whitespace-pre-wrap border-t border-neutral-100 pt-4">{quote.notes}</p>
          ) : null}
        </div>

        <div className="mt-8">
          {quote.status === "ACCEPTED" ? (
            <p className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
              You accepted this quote{quote.acceptedAt ? ` on ${formatDate(quote.acceptedAt)}` : ""}. {business} will
              send an invoice shortly.
            </p>
          ) : quote.status === "DECLINED" ? (
            <p className="text-center text-sm text-neutral-600 bg-neutral-100 border border-neutral-200 rounded-md px-4 py-3">
              You declined this quote{quote.declinedAt ? ` on ${formatDate(quote.declinedAt)}` : ""}.
            </p>
          ) : expired ? (
            <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
              This quote has expired, contact {business} for a fresh one.
            </p>
          ) : (
            <QuoteClient
              token={params.token}
              items={quoteItems.map((it, i) => ({ ...it, index: i }))}
              initial={chosen}
              taxRate={quote.taxRate}
              discountType={quote.discountType}
              discountValue={quote.discountValue}
            />
          )}
        </div>
        <p className="text-center text-xs text-neutral-400 mt-8">{business} · powered by Pixora</p>
      </div>
    </div>
  );
}
