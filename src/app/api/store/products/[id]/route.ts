import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { PRODUCT_CATEGORIES } from "@/lib/store";
import { FRAMEABLE, parseFrames } from "@/lib/store-rates";
import { packageItemsJson, parsePackageItems } from "@/lib/store-pricing";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.product.findFirst({ where: { id, priceSheet: { userId: user.id } } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const product = await owned(params.id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (PRODUCT_CATEGORIES.some((c) => c.id === body.category)) data.category = body.category;
  if (typeof body.selfFulfilled === "boolean") data.selfFulfilled = body.selfFulfilled;
  if (typeof body.active === "boolean") data.active = body.active;
  if ("shippingCents" in body) data.shippingCents = Math.max(0, Math.round(Number(body.shippingCents) || 0));
  // Night build follow-up: markup pricing + package components.
  if (body.pricingMode === "MARKUP" || body.pricingMode === "FIXED") data.pricingMode = body.pricingMode;
  if ("markupPct" in body) data.markupPct = Math.min(1000, Math.max(0, Number(body.markupPct) || 0));
  if (Array.isArray(body.packageItems)) {
    const cat = String(data.category ?? product.category);
    const components = cat === "PACKAGE" ? parsePackageItems(JSON.stringify(body.packageItems)) : [];
    if (cat === "PACKAGE" && components.length === 0) {
      return NextResponse.json({ error: "A package needs at least one component product" }, { status: 400 });
    }
    data.packageItems = packageItemsJson(components);
  }

  if (Array.isArray(body.frames)) {
    const cat = String(data.category ?? product.category);
    const frames = FRAMEABLE.includes(cat) ? parseFrames(JSON.stringify(body.frames)) : [];
    if (cat === "FRAMED" && frames.length === 0) {
      return NextResponse.json({ error: "Framed wall art needs at least one frame option" }, { status: 400 });
    }
    data.frameOptions = JSON.stringify(frames);
  }
  await db.product.update({ where: { id: product.id }, data });

  // Full variant replacement when provided (existing order-item snapshots are unaffected).
  if (Array.isArray(body.variants)) {
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    let i = 0;
    for (const v of body.variants) {
      if (typeof v.name !== "string" || !v.name.trim()) continue;
      await db.productVariant.create({
        data: {
          productId: product.id,
          name: v.name.trim(),
          priceCents: Math.max(0, Math.round(Number(v.priceCents) || 0)),
          labCostCents: Math.max(0, Math.round(Number(v.labCostCents) || 0)),
          order: i++,
        },
      });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const product = await owned(params.id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.product.delete({ where: { id: product.id } });
  return NextResponse.json({ ok: true });
}
