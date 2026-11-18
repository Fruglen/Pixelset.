import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const fulfillment = body.fulfillment === "LAB" ? "LAB" : "SELF";

  const sheet = await db.priceSheet.create({
    data: {
      userId: user.id,
      name,
      fulfillment,
      lab: fulfillment === "LAB" ? (typeof body.lab === "string" && body.lab ? body.lab : "WHCC") : "",
    },
  });
  return NextResponse.json({ id: sheet.id });
}
