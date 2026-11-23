import { NextResponse } from "next/server";

// Public invoice payment. Online payment is parked (GLE-134, same rule as
// GLE-120), so a client request never settles an invoice or instalment, for
// any method, amount, or tip. Live payments settle only through the
// signature-checked Stripe webhook and the PayPal capture return; the
// photographer records anything else from the dashboard.
export async function POST() {
  return NextResponse.json(
    {
      error: "Online payment is not enabled yet. You have not been charged, and your photographer will arrange payment with you.",
      onlinePaymentEnabled: false,
    },
    { status: 409 }
  );
}
