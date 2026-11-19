import { NextRequest, NextResponse } from "next/server";
import { applyInvoicePayment } from "@/lib/invoice-pay";
import { verifyStripeSignature } from "@/lib/processors";

// Night build: Stripe webhook. Settles invoice payments when a Checkout
// session created by /api/pay/[token]/checkout completes. Signature is
// verified against STRIPE_WEBHOOK_SECRET; without it the route is closed.
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, status: "Not connected", reason: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });
  }
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; metadata?: Record<string, string> } };
  };
  if (event.type === "checkout.session.completed") {
    const md = event.data.object.metadata ?? {};
    if (md.invoiceToken) {
      await applyInvoicePayment(md.invoiceToken, {
        installmentId: md.installmentId || undefined,
        method: "card",
        tipCents: Number(md.tipCents || 0),
        live: true,
        processorRef: event.data.object.id,
      });
    }
  }
  return NextResponse.json({ received: true });
}
