import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { PRODUCT_CATEGORIES } from "@/lib/store";

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
