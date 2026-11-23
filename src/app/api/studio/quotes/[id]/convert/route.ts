import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { convertQuoteToInvoice } from "@/lib/studio";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("send_documents");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const quote = await db.quote.findFirst({ where: { id: params.id, userId: user.id } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await convertQuoteToInvoice(quote);
  return NextResponse.json({ invoiceId: invoice.id });
}
