import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email) {
    const dup = await db.contact.findFirst({ where: { userId: user.id, email } });
    if (dup) return NextResponse.json({ error: "A contact with that email already exists" }, { status: 400 });
  }
  const contact = await db.contact.create({
    data: {
      userId: user.id,
      name,
      email,
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      address: typeof body.address === "string" ? body.address.trim() : "",
      company: typeof body.company === "string" ? body.company.trim() : "",
      tags: typeof body.tags === "string" ? body.tags : "",
    },
  });
  return NextResponse.json({ id: contact.id });
}
