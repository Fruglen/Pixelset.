import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ipAllowlistFor, setIpAllowlist } from "@/lib/ip-guard";
import { planFor } from "@/lib/plans";

// Night build (Pricing lane): the sign-in IP allowlist API. Reading is open
// to the account owner; saving requires an active Studio Manager Volume
// plan, because whitelisting is a Volume feature in the research.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await planFor(user.id);
  return NextResponse.json({
    entries: await ipAllowlistFor(user.id),
    volume: plan.billing.volume,
    enforced: !!plan.billing.volume,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await planFor(user.id);
  if (!plan.billing.volume) {
    return NextResponse.json(
      { error: "IP whitelisting needs a Studio Manager Volume plan. Choose one on this page first." },
      { status: 403 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { entries?: unknown };
  const entries = Array.isArray(body.entries) ? body.entries.filter((e): e is string => typeof e === "string") : [];
  try {
    const saved = await setIpAllowlist(user.id, entries);
    return NextResponse.json({ ok: true, entries: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save the allowlist" }, { status: 400 });
  }
}
