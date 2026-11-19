import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

// Album/book designer (night build follow-up, store lane): the studio
// creates a design for an album product (optionally tied to a store order),
// and the client designs the cover + spreads on a token page.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const designs = await db.albumDesign.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const productId = typeof body.productId === "string" ? body.productId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";

  let clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  let clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase() : "";
  let title = typeof body.title === "string" ? body.title.trim() : "";

  if (productId) {
    const product = await db.product.findFirst({
      where: { id: productId, priceSheet: { userId: user.id } },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (!title) title = product.name;
  }
  if (orderId) {
    const order = await db.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!clientName) clientName = order.customerName;
    if (!clientEmail) clientEmail = order.customerEmail;
  }
  if (!title) return NextResponse.json({ error: "Give the album a title" }, { status: 400 });

  const design = await db.albumDesign.create({
    data: {
      userId: user.id,
      productId,
      orderId,
      clientName,
      clientEmail,
      title,
      coverJson: JSON.stringify({ material: "Linen", color: "Ivory", debossText: "", photoUrl: "" }),
      pagesJson: JSON.stringify([{ layout: "FULL", slots: [{ photoUrl: "", caption: "" }] }]),
      status: "DRAFT",
    },
  });
  return NextResponse.json({ id: design.id, token: design.token });
}
