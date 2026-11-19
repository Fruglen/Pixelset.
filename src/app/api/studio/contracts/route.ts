import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtMoney, renderSmartFields, retainerAmount } from "@/lib/studio";
import { STUDIO_LIMITS, capMessage, planFor, tierLabel } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

// Create a contract from a template (smart fields rendered against the chosen
// contact / session type) or from scratch.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Night build (Pricing lane): Studio Manager Free plan cap, 3 contracts.
  {
    const plan = await planFor(user.id);
    const limit = STUDIO_LIMITS[plan.studio].contracts;
    if (Number.isFinite(limit)) {
      const count = await db.contract.count({ where: { userId: user.id } });
      if (count >= limit) {
        return NextResponse.json({ error: capMessage("contracts", limit, tierLabel("studio", plan.studio)) }, { status: 403 });
      }
    }
  }
  const body = await req.json();

  const template =
    typeof body.templateId === "string" && body.templateId
      ? await db.contractTemplate.findFirst({ where: { id: body.templateId, userId: user.id } })
      : null;
  const contact =
    typeof body.contactId === "string" && body.contactId
      ? await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } })
      : null;
  const sessionType =
    typeof body.sessionTypeId === "string" && body.sessionTypeId
      ? await db.sessionType.findFirst({ where: { id: body.sessionTypeId, userId: user.id } })
      : null;

  const title =
    (typeof body.title === "string" && body.title.trim()) ||
    template?.name ||
    "Contract";

  const rendered = renderSmartFields(template?.body ?? "", {
    client_name: contact?.name ?? "",
    client_email: contact?.email ?? "",
    client_phone: contact?.phone ?? "",
    session_type: sessionType?.name ?? "",
    session_location: sessionType?.location ?? "",
    session_price: sessionType ? fmtMoney(sessionType.priceCents) : "",
    retainer: sessionType
      ? fmtMoney(retainerAmount(sessionType.retainerType, sessionType.retainerValue, sessionType.priceCents))
      : "",
    business_name: user.businessName || user.name,
    photographer_name: user.name,
    today: formatDate(new Date()),
  });

  const contract = await db.contract.create({
    data: {
      userId: user.id,
      templateId: template?.id ?? null,
      contactId: contact?.id ?? null,
      title,
      body: rendered,
      status: "DRAFT",
      brandLogoUrl: template?.brandLogoUrl ?? "",
      brandColor: template?.brandColor ?? "",
      headerImageUrl: template?.headerImageUrl ?? "",
    },
  });
  return NextResponse.json({ id: contract.id });
}
