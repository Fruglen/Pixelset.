import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { CAMPAIGN_KINDS, validAudience } from "@/lib/campaigns";
import { campaignAllowance } from "@/lib/plans";

// Fix batch 2026-11-20: email campaigns, list + create.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [campaigns, allowance] = await Promise.all([
    db.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sends: true } } },
    }),
    campaignAllowance(user.id),
  ]);
  return NextResponse.json({
    campaigns,
    allowance: { limit: allowance.limit, used: allowance.used, remaining: allowance.remaining },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "Give the campaign a name" }, { status: 400 });
  const kind = CAMPAIGN_KINDS.some((k) => k.id === body.kind) ? body.kind : "CUSTOM";
  const audience = validAudience(body.audience) ? body.audience : "OPT_INS";
  const campaign = await db.campaign.create({
    data: {
      userId: user.id,
      name,
      kind,
      audience,
      subject: typeof body.subject === "string" ? body.subject.slice(0, 200) : "",
      body: typeof body.body === "string" ? body.body.slice(0, 20000) : "",
    },
  });
  return NextResponse.json({ campaign });
}
