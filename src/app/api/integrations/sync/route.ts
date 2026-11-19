import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { syncHubSpot, syncQuickBooks, syncStatus } from "@/lib/accounting";

export const runtime = "nodejs";

// Phase 5B: live accounting / CRM sync. Honest Not connected (409) when the env tokens are absent.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncStatus(user.id));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const { provider } = await req.json().catch(() => ({}));
  const result = provider === "hubspot" ? await syncHubSpot(user.id) : provider === "quickbooks" ? await syncQuickBooks(user.id) : null;
  if (!result) return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  return NextResponse.json(result, { status: result.connected ? 200 : 409 });
}
