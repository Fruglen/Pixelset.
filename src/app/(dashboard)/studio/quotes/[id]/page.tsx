import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseQuoteItems } from "@/lib/studio";
import { QuoteEditor } from "./quote-editor";

export const dynamic = "force-dynamic";

export default async function QuoteEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const quote = await db.quote.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, invoice: { select: { id: true, number: true } } },
  });
  if (!quote) notFound();

  const contacts = await db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

  return (
    <QuoteEditor
      quote={{
        id: quote.id,
        number: quote.number,
        title: quote.title,
        status: quote.status,
        token: quote.token,
        contactId: quote.contactId ?? "",
        validUntil: quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : "",
        items: parseQuoteItems(quote.items),
        selection: quote.selection ? (JSON.parse(quote.selection) as number[]) : null,
        taxRate: quote.taxRate,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
        notes: quote.notes,
        invoiceId: quote.invoice?.id ?? "",
        invoiceNumber: quote.invoice?.number ?? "",
      }}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
