import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLabOrder, LAB_STATUSES, sendLabOrder } from "@/lib/lab";

// Phase 5A, lab order actions on a store order:
//   { action: "create" }                     generate the payload (orders placed before 5A)
//   { action: "send", labOrderId }           POST the payload to the configured lab now
//   { action: "reprint" }                    clone the payload with the reprint flag
//   { action: "setStatus", labOrderId, status }  move the lab order through the status flow
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const order = await db.order.findFirst({ where: { id: params.id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const action = String(body.action ?? "");

  if (action === "create" || action === "reprint") {
    const labOrder = await createLabOrder(order.id, { reprint: action === "reprint" });
    if (!labOrder) {
      return NextResponse.json({ error: "This order has no lab-fulfilled items" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, labOrderId: labOrder.id });
  }

  const labOrderId = String(body.labOrderId ?? "");
  const labOrder = await db.labOrder.findFirst({ where: { id: labOrderId, orderId: order.id } });
  if (!labOrder) return NextResponse.json({ error: "Lab order not found" }, { status: 404 });

  if (action === "send") {
    const result = await sendLabOrder(labOrder.id);
    if (!result.sent) return NextResponse.json({ error: result.detail }, { status: 400 });
    return NextResponse.json({ ok: true, detail: result.detail });
  }

  if (action === "setStatus") {
    const status = String(body.status ?? "");
    if (!LAB_STATUSES.includes(status as (typeof LAB_STATUSES)[number])) {
      return NextResponse.json({ error: "Unknown lab status" }, { status: 400 });
    }
    await db.labOrder.update({ where: { id: labOrder.id }, data: { status } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
