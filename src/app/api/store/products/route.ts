import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { PRODUCT_CATEGORIES } from "@/lib/store";
import { FRAMEABLE, parseFrames } from "@/lib/store-rates";
import { packageItemsJson, parsePackageItems } from "@/lib/store-pricing";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const sheet = await db.priceSheet.findFirst({
    where: { id: String(body.priceSheetId ?? ""), userId: user.id },
  });
  if (!sheet) return NextResponse.json({ error: "Unknown price sheet" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const category = PRODUCT_CATEGORIES.some((c) => c.id === body.category) ? body.category : "PRINT";

  if (category === "FRAMED" && parseFrames(JSON.stringify(body.frames ?? [])).length === 0) {
    return NextResponse.json({ error: "Framed wall art needs at least one frame option" }, { status: 400 });
  }
  const pricingMode = body.pricingMode === "MARKUP" ? "MARKUP" : "FIXED";
  const markupPct = Math.min(1000, Math.max(0, Number(body.markupPct) || 0));
  const components = category === "PACKAGE" ? parsePackageItems(JSON.stringify(body.packageItems ?? [])) : [];
  if (category === "PACKAGE" && components.length === 0) {
    return NextResponse.json({ error: "A package needs at least one component product" }, { status: 400 });
  }

  const count = await db.product.count({ where: { priceSheetId: sheet.id } });
  const product = await db.product.create({
    data: {
      priceSheetId: sheet.id,
      name,
      category,
      description: typeof body.description === "string" ? body.description : "",
      selfFulfilled:
        sheet.fulfillment === "LAB" ? body.selfFulfilled === true : body.selfFulfilled !== false,
      shippingCents: Math.max(0, Math.round(Number(body.shippingCents) || 0)),
      order: count,
      pricingMode,
      markupPct,
      packageItems: packageItemsJson(components),
      frameOptions: FRAMEABLE.includes(category) ? JSON.stringify(parseFrames(JSON.stringify(body.frames ?? []))) : "[]",
      variants: {
        create: Array.isArray(body.variants)
          ? body.variants
              .filter((v: { name?: unknown }) => typeof v.name === "string" && v.name)
              .map((v: { name: string; priceCents?: unknown; labCostCents?: unknown }, i: number) => ({
                name: v.name.trim(),
                priceCents: Math.max(0, Math.round(Number(v.priceCents) || 0)),
                labCostCents: Math.max(0, Math.round(Number(v.labCostCents) || 0)),
                order: i,
              }))
          : [],
      },
    },
  });
  return NextResponse.json({ id: product.id });
}
