import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcTotals, invoiceEffectiveStatus, parseItems } from "@/lib/studio";
import { InvoicesClient } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: { new?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [invoices, quotes, contacts] = await Promise.all([
    db.invoice.findMany({
      where: { userId: user.id },
      include: { contact: true, installments: true },
      orderBy: { createdAt: "desc" },
    }),
    db.quote.findMany({
      where: { userId: user.id },
      include: { contact: true, invoice: { select: { id: true, number: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <InvoicesClient
      openNew={searchParams.new === "1"}
      invoices={invoices.map((i) => {
        const totals = calcTotals(parseItems(i.items), i.taxRate, i.discountType, i.discountValue, i.tipCents);
        const paid = i.installments.filter((x) => x.paidAt).reduce((n, x) => n + x.amountCents, 0);
        return {
          id: i.id,
          number: i.number,
          title: i.title,
          contactName: i.contact?.name ?? "",
          status: invoiceEffectiveStatus(i.status, i.installments),
          totalCents: totals.total,
          paidCents: i.status === "PAID" && i.installments.length === 0 ? totals.total : paid,
          installments: i.installments.length,
          dueDate: i.dueDate?.toISOString() ?? "",
        };
      })}
      quotes={quotes.map((q) => {
        const totals = calcTotals(parseItems(q.items), q.taxRate, q.discountType, q.discountValue);
        return {
          id: q.id,
          number: q.number,
          title: q.title,
          contactName: q.contact?.name ?? "",
          status: q.status,
          totalCents: totals.total,
          invoiceId: q.invoice?.id ?? "",
          invoiceNumber: q.invoice?.number ?? "",
        };
      })}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
