import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { convertQuoteToInvoice, logStudioMessage } from "@/lib/studio";

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
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    const invoice = await convertQuoteToInvoice(quote);
    await logStudioMessage(quote.userId, {
      kind: "QUOTE",
      name: quote.contact?.name ?? "",
      email: quote.contact?.email ?? "",
      subject: `Quote ${quote.number} accepted`,
      body: `${quote.contact?.name ?? "The client"} accepted quote ${quote.number}. A draft invoice (${invoice.number}) was created from it.`,
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
