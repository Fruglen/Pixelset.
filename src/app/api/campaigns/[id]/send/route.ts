import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { sendCampaign } from "@/lib/campaigns";

// Fix batch 2026-11-20: send a campaign. Metered against campaignAllowance() at send time.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const out = await sendCampaign(user.id, params.id);
  if (!out.ok) return NextResponse.json({ error: out.error, allowance: out.allowance }, { status: out.status });
  return NextResponse.json(out);
}
