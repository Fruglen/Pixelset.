import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStudioProfile, nextQuoteNumber } from "@/lib/studio";
import { STUDIO_LIMITS, capMessage, planFor, tierLabel } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getStudioProfile(user.id);
  // Night build (Pricing lane): Studio Manager Free plan cap, 3 quotes.
  {
    const plan = await planFor(user.id);
    const limit = STUDIO_LIMITS[plan.studio].quotes;
    if (Number.isFinite(limit)) {
      const count = await db.quote.count({ where: { userId: user.id } });
      if (count >= limit) {
        return NextResponse.json({ error: capMessage("quotes", limit, tierLabel("studio", plan.studio)) }, { status: 403 });
      }
    }
  }
  const body = await req.json();

  let contactId: string | null = null;
  if (typeof body.contactId === "string" && body.contactId) {
    const c = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
    if (c) contactId = c.id;
  }
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const quote = await db.quote.create({
    data: {
      userId: user.id,
      contactId,
      number: await nextQuoteNumber(user.id),
      title: typeof body.title === "string" ? body.title.trim() : "",
      status: "DRAFT",
      taxRate: profile.defaultTaxRate,
      validUntil,
    },
  });
  return NextResponse.json({ id: quote.id });
}
