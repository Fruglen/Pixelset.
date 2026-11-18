import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoiceEffectiveStatus, parseItems } from "@/lib/studio";
import { InvoiceEditor } from "./invoice-editor";

export const dynamic = "force-dynamic";

export default async function InvoiceEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const invoice = await db.invoice.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, installments: { orderBy: { order: "asc" } }, booking: true, quote: true },
  });
  if (!invoice) notFound();

  const contacts = await db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

  return (
    <InvoiceEditor
      invoice={{
        id: invoice.id,
        number: invoice.number,
        title: invoice.title,
        status: invoice.status,
        effectiveStatus: invoiceEffectiveStatus(invoice.status, invoice.installments),
        token: invoice.token,
        contactId: invoice.contactId ?? "",
        dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "",
        items: parseItems(invoice.items),
        taxRate: invoice.taxRate,
        discountType: invoice.discountType,
        discountValue: invoice.discountValue,
        tipCents: invoice.tipCents,
        notes: invoice.notes,
        bookingTitle: invoice.booking?.title ?? "",
        quoteNumber: invoice.quote?.number ?? "",
        installments: invoice.installments.map((i) => ({
          label: i.label,
          dueDate: i.dueDate.toISOString().slice(0, 10),
          amount: (i.amountCents / 100).toFixed(2),
          paid: !!i.paidAt,
        })),
      }}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
