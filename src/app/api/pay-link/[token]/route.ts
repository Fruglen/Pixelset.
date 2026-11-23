import { NextResponse } from "next/server";

// Public payment link. Online payment is parked (GLE-135, same rule as
// GLE-120), and payment links have no processor path, so this route records
// no ledger entry, inbox message, or notification.
export async function POST() {
  return NextResponse.json(
    {
      error: "Online payment is not enabled yet. You have not been charged, and your photographer will arrange payment with you.",
      onlinePaymentEnabled: false,
    },
    { status: 409 }
  );
}
