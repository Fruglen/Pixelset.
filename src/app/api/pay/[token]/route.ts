import { NextRequest, NextResponse } from "next/server";
import { applyInvoicePayment } from "@/lib/invoice-pay";

const METHODS = ["card", "paypal", "manual"];

// Public invoice payment (recorded checkout; the owner's payments are parked,
// so no processor is charged here. Live Stripe and PayPal payments settle
// through /api/pay/[token]/checkout, the Stripe webhook, and the PayPal
// capture return, all of which share applyInvoicePayment.)
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json();
  const method = METHODS.includes(body.method) ? body.method : "card";
  const out = await applyInvoicePayment(params.token, {
    installmentId: body.installmentId,
    method,
    tipCents: Math.max(0, Math.round(Number(body.tipCents) || 0)),
  });
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json({ ok: true, status: out.status });
}
