import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const DEFAULT_BODY = `PHOTOGRAPHY SERVICES AGREEMENT

This agreement is made on {{today}} between {{business_name}} ("Photographer") and {{client_name}} ("Client").

1. SERVICES
The Photographer will provide the {{session_type}} session on {{session_date}} at {{session_location}}.

2. FEES
The total fee for the session is {{session_price}}. A retainer of {{retainer}} is due at booking and is non-refundable. The remaining balance is due on or before the session date.

3. CANCELLATION
If the Client cancels more than 14 days before the session, any payment beyond the retainer will be refunded. Rescheduling is subject to availability.

4. COPYRIGHT & USAGE
The Photographer retains copyright of all images. The Client receives a personal-use license for delivered photographs.

5. DELIVERY
Edited photographs will be delivered via an online gallery within 6 weeks of the session date.

Agreed and accepted by the parties below.`;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const template = await db.contractTemplate.create({
    data: {
      userId: user.id,
      name,
      body: typeof body.body === "string" && body.body.trim() ? body.body : DEFAULT_BODY,
    },
  });
  return NextResponse.json({ id: template.id });
}
