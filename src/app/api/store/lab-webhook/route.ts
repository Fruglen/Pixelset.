import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { applyLabStatus, normaliseLabStatus } from "@/lib/lab";

// Phase 5B: status callbacks from the print lab. The lab POSTs
//   { labOrderId | reference, status, trackingNumber?, carrier?, note? }
// with "Authorization: Bearer <LAB_WEBHOOK_SECRET>". Without the env var the
// endpoint is disabled and says so (no lab is connected).
function authorised(req: NextRequest, secret: string): boolean {
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.LAB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Lab webhook not connected (LAB_WEBHOOK_SECRET is not set)" }, { status: 503 });
  if (!authorised(req, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const status = normaliseLabStatus(String(body.status ?? ""));
  if (!status) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  const labOrder = body.labOrderId
    ? await db.labOrder.findUnique({ where: { id: String(body.labOrderId) } })
    : body.reference
      ? await db.labOrder.findFirst({ where: { labReference: String(body.reference) } })
      : null;
  if (!labOrder) return NextResponse.json({ error: "Lab order not found" }, { status: 404 });

  await applyLabStatus(labOrder.id, status, {
    source: "LAB",
    note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    trackingNumber: typeof body.trackingNumber === "string" ? body.trackingNumber.slice(0, 120) : undefined,
    carrier: typeof body.carrier === "string" ? body.carrier.slice(0, 60) : undefined,
  });
  return NextResponse.json({ ok: true, status });
}
