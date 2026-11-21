import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { contractDerivedStatus, invoiceEffectiveStatus } from "@/lib/studio";
import { ContactDetail } from "./contact-detail";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const contact = await db.contact.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { startsAt: "desc" } },
      invoices: { include: { installments: true }, orderBy: { createdAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
      responses: { include: { questionnaire: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) notFound();

  // Gallery history: galleries assigned to this client (e.g. by CSV import), plus
  // collections where this email registered or kept favorite lists.
  const galleries = await db.collection.findMany({
    where: {
      userId: user.id,
      OR: [
        { contactId: contact.id },
        ...(contact.email
          ? [{ registrations: { some: { email: contact.email } } }, { favoriteLists: { some: { clientEmail: contact.email } } }]
          : []),
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  return (
    <ContactDetail
      contact={{
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        company: contact.company,
        tags: contact.tags,
      }}
      notes={contact.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() }))}
      bookings={contact.bookings.map((b) => ({
        id: b.id,
        title: b.title,
        startsAt: b.startsAt.toISOString(),
        status: b.status,
        paymentStatus: b.paymentStatus,
        totalCents: b.totalCents,
      }))}
      invoices={contact.invoices.map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        status: invoiceEffectiveStatus(i.status, i.installments),
        createdAt: i.createdAt.toISOString(),
      }))}
      quotes={contact.quotes.map((q) => ({
        id: q.id,
        number: q.number,
        title: q.title,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      }))}
      contracts={contact.contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: contractDerivedStatus(c),
        createdAt: c.createdAt.toISOString(),
      }))}
      responses={contact.responses.map((r) => ({
        id: r.id,
        questionnaire: r.questionnaire.name,
        createdAt: r.createdAt.toISOString(),
      }))}
      galleries={galleries.map((g) => ({ id: g.id, name: g.name, slug: g.slug }))}
    />
  );
}
