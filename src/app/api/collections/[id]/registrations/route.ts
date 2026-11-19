import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { csvEscape } from "@/lib/utils";

// Phase 5B: CSV export of the emails registered on a gallery (plus marketing opt ins).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const regs = await db.emailRegistration.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "asc" } });
  const optIns = await db.campaignOptIn.findMany({ where: { collectionId: collection.id } });
  const opted = new Set(optIns.map((o) => o.email));
  const rows = [["email", "registered_at", "marketing_opt_in", "gallery"]];
  for (const r of regs) rows.push([r.email, r.createdAt.toISOString(), opted.has(r.email) ? "yes" : "no", collection.name]);
  for (const o of optIns) if (!regs.some((r) => r.email === o.email)) rows.push([o.email, o.createdAt.toISOString(), "yes", collection.name]);
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collection.slug}-registered-emails.csv"`,
    },
  });
}
