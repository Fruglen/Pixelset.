import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ContactsClient } from "./contacts-client";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const contacts = await db.contact.findMany({
    where: { userId: user.id },
    include: { _count: { select: { bookings: true, invoices: true, notes: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <ContactsClient
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        tags: c.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        bookings: c._count.bookings,
        invoices: c._count.invoices,
        notes: c._count.notes,
      }))}
    />
  );
}
