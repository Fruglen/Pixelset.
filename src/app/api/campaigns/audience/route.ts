import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { audienceLabel, resolveAudience, validAudience } from "@/lib/campaigns";

// Fix batch 2026-11-20: recipient count preview for a source before sending.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const source = req.nextUrl.searchParams.get("source") || "";
  if (!validAudience(source)) return NextResponse.json({ error: "Unknown recipient source" }, { status: 400 });
  const recipients = await resolveAudience(user.id, source);
  return NextResponse.json({ source, label: await audienceLabel(user.id, source), count: recipients.length, sample: recipients.slice(0, 5).map((r) => r.email) });
}
