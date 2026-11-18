import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getStudioProfile } from "@/lib/studio";
import { slugify } from "@/lib/utils";
import { permissionError } from "@/lib/team";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getStudioProfile(user.id);
  const body = await req.json();

  // Payment configuration is Owner-only (team-role enforcement).
  const paymentKeys = [
    "pixelsetPaymentsConnected", "stripeConnected", "paypalConnected", "manualEnabled",
    "showStripe", "showPaypal", "showManual", "stripeAccount", "paypalEmail", "manualInstructions",
  ];
  if (paymentKeys.some((k) => k in body)) {
    const denied = permissionError("payments");
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  const strings = [
    "welcomeText",
    "businessEmail",
    "businessPhone",
    "businessAddress",
    "taxId",
    "stripeAccount",
    "paypalEmail",
    "manualInstructions",
  ];
  for (const k of strings) if (typeof body[k] === "string") data[k] = body[k].trim();
  const bools = [
    "pixelsetPaymentsConnected",
    "stripeConnected",
    "paypalConnected",
    "manualEnabled",
    "showStripe",
    "showPaypal",
    "showManual",
    "googleCalendarSync",
  ];
  for (const k of bools) if (typeof body[k] === "boolean") data[k] = body[k];
  if (body.defaultTaxRate !== undefined) {
    const r = Number(body.defaultTaxRate);
    if (!isNaN(r) && r >= 0 && r <= 100) data.defaultTaxRate = r;
  }
  if (typeof body.bookingSlug === "string") {
    const slug = slugify(body.bookingSlug);
    if (!slug) return NextResponse.json({ error: "Invalid booking link" }, { status: 400 });
    if (slug !== profile.bookingSlug) {
      const taken = await db.studioProfile.findUnique({ where: { bookingSlug: slug } });
      if (taken) return NextResponse.json({ error: "That booking link is taken" }, { status: 400 });
      data.bookingSlug = slug;
    }
  }

  const updated = await db.studioProfile.update({ where: { id: profile.id }, data });
  return NextResponse.json({ ok: true, bookingSlug: updated.bookingSlug });
}
