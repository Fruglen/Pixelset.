import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { getStoreProfile } from "@/lib/store";
import { STORE_CURRENCIES } from "@/lib/store-rates";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const profile = await getStoreProfile(user.id);
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.taxEnabled === "boolean") data.taxEnabled = body.taxEnabled;
  if ("taxRate" in body) data.taxRate = Math.min(50, Math.max(0, Number(body.taxRate) || 0));
  if (typeof body.digitalLicense === "string") data.digitalLicense = body.digitalLicense;
  if (typeof body.termsOfSale === "string") data.termsOfSale = body.termsOfSale;
  // Phase 5A, lab fulfillment settings
  if (typeof body.labEnabled === "boolean") data.labEnabled = body.labEnabled;
  if (typeof body.labName === "string") data.labName = body.labName.trim() || "WHCC";
  // Night build follow-up: white label packaging for lab shipments.
  if (typeof body.whiteLabelPackaging === "boolean") data.whiteLabelPackaging = body.whiteLabelPackaging;
  if (typeof body.labEmail === "string") data.labEmail = body.labEmail.trim();
  if (typeof body.labEndpoint === "string") data.labEndpoint = body.labEndpoint.trim();

  // Phase 5B: store status, currency, payment methods (mocked), offline payments, tax mode
  if (typeof body.storeOpen === "boolean") data.storeOpen = body.storeOpen;
  if (typeof body.closedMessage === "string") data.closedMessage = body.closedMessage.slice(0, 300);
  if (typeof body.currency === "string" && (STORE_CURRENCIES as readonly string[]).includes(body.currency)) data.currency = body.currency;
  if (typeof body.cardPayments === "boolean") data.cardPayments = body.cardPayments;
  if (typeof body.offlinePayments === "boolean") data.offlinePayments = body.offlinePayments;
  if (typeof body.offlineInstructions === "string") data.offlineInstructions = body.offlineInstructions.slice(0, 1000);
  if (body.taxMode === "AUTO" || body.taxMode === "MANUAL") data.taxMode = body.taxMode;
  if (typeof body.taxShipping === "boolean") data.taxShipping = body.taxShipping;
  if (typeof body.taxNexus === "string") {
    data.taxNexus = body.taxNexus
      .split(",")
      .map((x: string) => x.trim().toUpperCase())
      .filter((x: string) => /^[A-Z]{2}-[A-Z]{2}$/.test(x))
      .join(",");
  }
  const card = typeof data.cardPayments === "boolean" ? data.cardPayments : profile.cardPayments;
  const offline = typeof data.offlinePayments === "boolean" ? data.offlinePayments : profile.offlinePayments;
  if (!card && !offline) return NextResponse.json({ error: "Keep at least one payment method switched on" }, { status: 400 });

  await db.storeProfile.update({ where: { id: profile.id }, data });
  return NextResponse.json({ ok: true });
}
