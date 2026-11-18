import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { getStoreProfile } from "@/lib/store";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("settings");
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
  if (typeof body.labEmail === "string") data.labEmail = body.labEmail.trim();
  if (typeof body.labEndpoint === "string") data.labEndpoint = body.labEndpoint.trim();

  await db.storeProfile.update({ where: { id: profile.id }, data });
  return NextResponse.json({ ok: true });
}
