import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createLabOrder } from "@/lib/lab";
import { notify } from "@/lib/notify";

// Night build (Extras): the client support and reprint process for a store
// order. Opening a case records it in the photographer's notifications (and
// in the activity feed of the support card); a reprint case also clones the
// lab order with the reprint flag through the existing lab flow, so the lab
// side is one click from being sent. The published policy lives on the
// order page (REPRINT_POLICY in support-actions).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const order = await db.order.findFirst({ where: { id: params.id, userId: user.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; note?: unknown };
  const kind = body.kind === "REPRINT" ? "REPRINT" : "ISSUE";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  let detail = "";
  if (kind === "REPRINT") {
    const labOrder = await createLabOrder(order.id, { reprint: true });
    detail = labOrder
      ? "A reprint lab order was created from this order. Review it in the lab panel below and send it when ready."
      : "This order has no lab fulfilled items, so no reprint lab order was created. Reprint self fulfilled items from your own lab or printer.";
  } else {
    detail = "The issue was logged on this order for follow up with the client.";
  }

  await notify(
    user.id,
    "ORDER",
    kind === "REPRINT" ? `Reprint case opened on order ${order.number}` : `Support case opened on order ${order.number}`,
    [note, detail].filter(Boolean).join(" "),
    `/store/orders/${order.id}`,
  );

  return NextResponse.json({ ok: true, detail });
}
