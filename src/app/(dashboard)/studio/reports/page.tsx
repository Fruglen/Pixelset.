import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { outstandingCents, paymentRows } from "@/lib/studio-payments";
import { PaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

// Phase 5B: payments and income report (invoices, booking retainers, payment links) plus payment link management.
export default async function StudioPaymentsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [rows, outstanding, links] = await Promise.all([
    paymentRows(user.id),
    outstandingCents(user.id),
    db.paymentLink.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const ledger = await db.studioPayment.groupBy({ by: ["sourceId"], where: { userId: user.id, source: "PAYMENT_LINK" }, _sum: { amountCents: true }, _count: true });
  return (
    <PaymentsClient
      rows={rows}
      outstandingCents={outstanding}
      from={searchParams.from ?? ""}
      to={searchParams.to ?? ""}
      links={links.map((l) => {
        const g = ledger.find((x) => x.sourceId === l.id);
        return {
          id: l.id,
          title: l.title,
          description: l.description,
          amountCents: l.amountCents,
          token: l.token,
          active: l.active,
          payments: g?._count ?? 0,
          collectedCents: g?._sum.amountCents ?? 0,
        };
      })}
    />
  );
}
