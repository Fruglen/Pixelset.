import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5A, lab order actions on a store order (create / send / reprint /
// setStatus) — PARKED behind Coming Soon (owner's call, Nov 19, 2026).
// Print lab fulfillment is presented as Coming Soon and the lab order path
// is blocked with that message. The complete pipeline (payload generation,
// Prodigi adapter, status timeline) stays in src/lib/lab.ts, dormant; the
// previous action dispatch for this route is in git history and comes back
// with the lab launch.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const order = await db.order.findFirst({ where: { id: params.id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  void req;
  return NextResponse.json(
    { error: "Print lab fulfillment is coming soon. Print orders are recorded as usual; sending them to a lab switches on when labs launch." },
    { status: 403 }
  );
}
