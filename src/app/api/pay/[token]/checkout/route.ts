import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoiceAmountDue } from "@/lib/invoice-pay";
import { clientPaymentMethods, createStripeCheckout } from "@/lib/processors";

// Night build: start a live Stripe Checkout for an invoice payment. Only
// answers when Stripe is configured on the server and switched on for this
// studio; otherwise the pay page keeps its recorded demo checkout.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}));
  const due = await invoiceAmountDue(params.token, body.installmentId);
  if ("error" in due) return NextResponse.json({ error: due.error }, { status: 400 });
  const profile = await db.studioProfile.findUnique({ where: { userId: due.invoice.userId } });
  if (!profile) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const methods = clientPaymentMethods(profile);
  if (!methods.stripeLive) {
    return NextResponse.json({ error: "Card payments are not connected for this studio yet." }, { status: 409 });
  }
  const tip = Math.max(0, Math.round(Number(body.tipCents) || 0));
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const out = await createStripeCheckout({
    amountCents: due.dueCents + tip,
    description: `Invoice ${due.invoice.number}${due.invoice.title ? `, ${due.invoice.title}` : ""}`,
    successUrl: `${origin}/pay/${params.token}?paid=1`,
    cancelUrl: `${origin}/pay/${params.token}?cancelled=1`,
    customerEmail: due.invoice.contact?.email || undefined,
    stripeAccount: profile.stripeConnected && profile.stripeAccount ? profile.stripeAccount : undefined,
    metadata: {
      invoiceToken: params.token,
      installmentId: body.installmentId ? String(body.installmentId) : "",
      tipCents: String(tip),
    },
  });
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: 502 });
  return NextResponse.json({ url: out.url });
}
