import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { PRODUCT_CATEGORIES } from "@/lib/store";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const sheet = await db.priceSheet.findFirst({
    where: { id: String(body.priceSheetId ?? ""), userId: user.id },
  });
  if (!sheet) return NextResponse.json({ error: "Unknown price sheet" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const category = PRODUCT_CATEGORIES.some((c) => c.id === body.category) ? body.category : "PRINT";

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
      variants: {
        create: Array.isArray(body.variants)
          ? body.variants
              .filter((v: { name?: unknown }) => typeof v.name === "string" && v.name)
              .map((v: { name: string; priceCents?: unknown }, i: number) => ({
                name: v.name.trim(),
                priceCents: Math.max(0, Math.round(Number(v.priceCents) || 0)),
                order: i,
              }))
          : [],
      },
    },
  });
  return NextResponse.json({ id: product.id });
}
