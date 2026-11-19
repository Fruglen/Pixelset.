import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { crmContactsCsv, invoicesIif, invoicesQboCsv, paymentsCsv, paymentsIif } from "@/lib/accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 5B: accounting and CRM export files.
const KINDS: Record<string, { fn: (u: string) => Promise<string>; name: string; type: string }> = {
  "qb-invoices-iif": { fn: invoicesIif, name: "quickbooks-invoices", type: "iif" },
  "qb-payments-iif": { fn: paymentsIif, name: "quickbooks-payments", type: "iif" },
  "qbo-invoices-csv": { fn: invoicesQboCsv, name: "quickbooks-online-invoices", type: "csv" },
  "payments-csv": { fn: paymentsCsv, name: "payments", type: "csv" },
  "crm-contacts-csv": { fn: crmContactsCsv, name: "crm-contacts-hubspot", type: "csv" },
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = KINDS[req.nextUrl.searchParams.get("kind") ?? ""];
  if (!kind) return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  const body = await kind.fn(user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": kind.type === "csv" ? "text/csv" : "text/plain",
      "Content-Disposition": `attachment; filename="${kind.name}-${stamp}.${kind.type}"`,
    },
  });
}
