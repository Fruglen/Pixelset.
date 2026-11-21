import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { CAMPAIGN_KINDS, validAudience } from "@/lib/campaigns";

// Fix batch 2026-11-20: one campaign, read + edit (drafts only) + delete, with its per recipient send log.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await db.campaign.findFirst({
    where: { id: params.id, userId: user.id },
    include: { sends: { orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const campaign = await db.campaign.findFirst({ where: { id: params.id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status === "SENT") return NextResponse.json({ error: "Sent campaigns cannot be edited" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (typeof body.subject === "string") data.subject = body.subject.slice(0, 200);
  if (typeof body.body === "string") data.body = body.body.slice(0, 20000);
  if (CAMPAIGN_KINDS.some((k) => k.id === body.kind)) data.kind = body.kind;
  if (body.audience !== undefined) {
    if (!validAudience(body.audience)) return NextResponse.json({ error: "Unknown recipient source" }, { status: 400 });
    data.audience = body.audience;
  }
  const updated = await db.campaign.update({ where: { id: campaign.id }, data });
  return NextResponse.json({ campaign: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const campaign = await db.campaign.findFirst({ where: { id: params.id, userId: user.id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.campaign.delete({ where: { id: campaign.id } });
  return NextResponse.json({ ok: true });
}
