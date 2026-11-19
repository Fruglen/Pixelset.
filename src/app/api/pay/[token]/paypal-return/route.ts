import { NextRequest, NextResponse } from "next/server";
import { applyInvoicePayment } from "@/lib/invoice-pay";
import { capturePayPalOrder } from "@/lib/processors";

// PayPal sends the client back here after approval; capture, then settle the
// invoice through the shared payment path and land on the pay page.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token") || "";
  const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const cap = orderId ? await capturePayPalOrder(orderId) : { error: "Missing PayPal order" };
  if ("error" in cap || cap.status !== "COMPLETED") {
    return NextResponse.redirect(`${origin}/pay/${params.token}?paypal=failed`);
  }
  await applyInvoicePayment(params.token, {
    installmentId: url.searchParams.get("installmentId") || undefined,
    method: "paypal",
    tipCents: Number(url.searchParams.get("tipCents") || 0),
    live: true,
    processorRef: orderId,
  });
  return NextResponse.redirect(`${origin}/pay/${params.token}?paid=1`);
}
