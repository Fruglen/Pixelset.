import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { markOrderPaid } from "@/lib/store-orders";
import { settleOrderMaths } from "@/lib/order-maths";

// Phase 5B: the photographer received an offline payment. Releases download
// links (emailed) and lab orders, and settles the payout record.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const result = await markOrderPaid(params.id, user.id);
  if ("error" in result && result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  // Night build (Pricing lane): refresh the payout maths snapshot now the
  // offline payment has landed (commission, fee, payout).
  await settleOrderMaths(params.id).catch(() => undefined);
  return NextResponse.json(result);
}
