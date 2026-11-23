import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { db } from "@/lib/db";
import { logStudioMessage } from "@/lib/studio";

// Night build: chargeback and dispute tracking. Real disputes arrive from the
// processor (Stripe sends charge.dispute.created webhooks); this route lets
// the photographer record and work a dispute that arrived by letter or from a
// processor dashboard. Disputes live in the inbox log with a DISPUTE kind and
// a JSON meta the reports page reads back.
interface DisputeRecord {
  id: string;
  paymentLabel: string;
  amountCents: number;
  reason: string;
  status: "OPEN" | "EVIDENCE_SENT" | "WON" | "LOST" | "ACCEPTED";
  processor: string;
  createdAt: string;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.studioMessage.findMany({ where: { userId: user.id, kind: "DISPUTE" }, orderBy: { createdAt: "desc" } });
  const disputes: DisputeRecord[] = [];
  for (const r of rows) {
    try {
      const meta = JSON.parse(r.meta || "{}") as Partial<DisputeRecord>;
      disputes.push({
        id: r.id,
        paymentLabel: meta.paymentLabel ?? r.subject,
        amountCents: meta.amountCents ?? 0,
        reason: meta.reason ?? r.body,
        status: (meta.status as DisputeRecord["status"]) ?? "OPEN",
        processor: meta.processor ?? "",
        createdAt: r.createdAt.toISOString(),
      });
    } catch {
      /* skip malformed rows */
    }
  }
  return NextResponse.json({ disputes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("payments");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();

  if (body.action === "status") {
    const row = await db.studioMessage.findFirst({ where: { id: String(body.id ?? ""), userId: user.id, kind: "DISPUTE" } });
    if (!row) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    const meta = JSON.parse(row.meta || "{}") as Record<string, unknown>;
    meta.status = ["OPEN", "EVIDENCE_SENT", "WON", "LOST", "ACCEPTED"].includes(body.status) ? body.status : "OPEN";
    if (typeof body.note === "string" && body.note.trim()) {
      await logStudioMessage(user.id, {
        kind: "DISPUTE",
        subject: `Dispute update: ${row.subject}`,
        body: body.note.slice(0, 2000),
        meta: JSON.stringify(meta),
      });
      return NextResponse.json({ ok: true });
    }
    await db.studioMessage.update({ where: { id: row.id }, data: { meta: JSON.stringify(meta) } });
    return NextResponse.json({ ok: true });
  }

  const amountCents = Math.max(0, Math.round(Number(body.amountCents) || 0));
  const record: Omit<DisputeRecord, "id" | "createdAt"> = {
    paymentLabel: String(body.paymentLabel ?? "Payment").slice(0, 200),
    amountCents,
    reason: String(body.reason ?? "").slice(0, 1000),
    status: "OPEN",
    processor: String(body.processor ?? "").slice(0, 40),
  };
  await logStudioMessage(user.id, {
    kind: "DISPUTE",
    subject: `Dispute opened: ${record.paymentLabel}`,
    body: record.reason || "A client disputed this payment with their bank.",
    meta: JSON.stringify(record),
    read: false,
  });
  return NextResponse.json({ ok: true });
}
