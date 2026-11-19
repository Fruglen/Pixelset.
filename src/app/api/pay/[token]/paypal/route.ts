import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoiceAmountDue } from "@/lib/invoice-pay";
import { clientPaymentMethods, createPayPalOrder } from "@/lib/processors";

// Night build: start a live PayPal order for an invoice payment; the capture
// happens on /api/pay/[token]/paypal-return after the client approves.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}));
  const due = await invoiceAmountDue(params.token, body.installmentId);
  if ("error" in due) return NextResponse.json({ error: due.error }, { status: 400 });
  const profile = await db.studioProfile.findUnique({ where: { userId: due.invoice.userId } });
  if (!profile) return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  const methods = clientPaymentMethods(profile);
  if (!methods.paypalLive) {
    return NextResponse.json({ error: "PayPal is not connected for this studio yet." }, { status: 409 });
  }
  const tip = Math.max(0, Math.round(Number(body.tipCents) || 0));
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const out = await createPayPalOrder({
    amountCents: due.dueCents + tip,
    description: `Invoice ${due.invoice.number}`,
    returnUrl: `${origin}/api/pay/${params.token}/paypal-return?installmentId=${body.installmentId ? String(body.installmentId) : ""}&tipCents=${tip}`,
    cancelUrl: `${origin}/pay/${params.token}?cancelled=1`,
    customId: params.token,
  });
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: 502 });
  return NextResponse.json({ url: out.approveUrl });
}
