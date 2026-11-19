import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fmtMoney, logStudioMessage } from "@/lib/studio";
import { recordPayment } from "@/lib/studio-flow";
import { notify } from "@/lib/notify";

// Phase 5B: public payment link checkout, mocked per the owner's payments exclusion.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const link = await db.paymentLink.findUnique({ where: { token: params.token } });
  if (!link || !link.active) return NextResponse.json({ error: "This payment link is not active." }, { status: 404 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const amount = link.amountCents > 0 ? link.amountCents : Math.round(Number(body.amountCents) || 0);
  if (amount < 100) return NextResponse.json({ error: "Enter an amount of at least $1.00" }, { status: 400 });
  const method = ["card", "paypal", "manual"].includes(body.method) ? body.method : "card";
  await recordPayment({ userId: link.userId, source: "PAYMENT_LINK", sourceId: link.id, label: link.title, payerName: name, payerEmail: email, amountCents: amount, method });
  await logStudioMessage(link.userId, {
    kind: "PAYMENT",
    name,
    email,
    subject: `Payment received: ${fmtMoney(amount)}, ${link.title}`,
    body: `${name} paid ${fmtMoney(amount)} by ${method} through the payment link "${link.title}".`,
    meta: `Mock payment · ${method}`,
  });
  await notify(link.userId, "INVOICE_PAID", `${name} paid ${fmtMoney(amount)}`, link.title, "/studio/reports");
  return NextResponse.json({ ok: true, amountCents: amount });
}
