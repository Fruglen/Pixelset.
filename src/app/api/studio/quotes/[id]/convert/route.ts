import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { convertQuoteToInvoice } from "@/lib/studio";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const quote = await db.quote.findFirst({ where: { id: params.id, userId: user.id } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await convertQuoteToInvoice(quote);
  return NextResponse.json({ invoiceId: invoice.id });
}
