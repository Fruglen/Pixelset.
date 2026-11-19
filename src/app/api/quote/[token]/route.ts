import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { convertQuoteToInvoice, fmtMoney, logStudioMessage, calcTotals, parseQuoteItems, selectedQuoteItems, validateQuoteSelection } from "@/lib/studio";
import { notify } from "@/lib/notify";

// Public quote response: accept (converts to a draft invoice) or decline.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const quote = await db.quote.findUnique({
    where: { token: params.token },
    include: { contact: true },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.status === "DRAFT") {
    return NextResponse.json({ error: "This quote isn't open for review yet." }, { status: 400 });
  }
  if (quote.status !== "SENT") {
    return NextResponse.json({ ok: true, status: quote.status });
  }
  if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
    return NextResponse.json({ error: "This quote has expired, ask for a fresh one." }, { status: 400 });
  }

  const body = await req.json();
  const action = body.action === "decline" ? "decline" : body.action === "accept" ? "accept" : "";
  if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  if (action === "accept") {
    // Phase 5B: the client's package and option selection is validated and stored.
    const items = parseQuoteItems(quote.items);
    const checked = validateQuoteSelection(items, body.selection ?? items.map((_, i) => i).filter((i) => items[i].kind === "fixed"));
    if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
    const selection = JSON.stringify(checked.selection);
    const total = calcTotals(selectedQuoteItems(items, checked.selection), quote.taxRate, quote.discountType, quote.discountValue).total;
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), selection },
    });
    const invoice = await convertQuoteToInvoice({ ...quote, selection });
    await notify(quote.userId, "QUOTE_ACCEPTED", `${quote.contact?.name ?? "A client"} accepted ${quote.number}`, `${fmtMoney(total)}, draft ${invoice.number} created`, `/studio/invoices/${invoice.id}`);
    await logStudioMessage(quote.userId, {
      kind: "QUOTE",
      name: quote.contact?.name ?? "",
      email: quote.contact?.email ?? "",
      subject: `Quote ${quote.number} accepted`,
      body: `${quote.contact?.name ?? "The client"} accepted quote ${quote.number}. Selected: ${selectedQuoteItems(items, checked.selection).map((i) => i.description).join(", ")} (${fmtMoney(total)}). A draft invoice (${invoice.number}) was created from it.`,
    });
    return NextResponse.json({ ok: true, status: "ACCEPTED" });
  }

  await db.quote.update({
    where: { id: quote.id },
    data: { status: "DECLINED", declinedAt: new Date() },
  });
  await logStudioMessage(quote.userId, {
    kind: "QUOTE",
    name: quote.contact?.name ?? "",
    email: quote.contact?.email ?? "",
    subject: `Quote ${quote.number} declined`,
    body: `${quote.contact?.name ?? "The client"} declined quote ${quote.number}.`,
  });
  return NextResponse.json({ ok: true, status: "DECLINED" });
}
