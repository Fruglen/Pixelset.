import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { CalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; add?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getStudioProfile(user.id);

  const now = new Date();
  const m = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = m.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [monthBookings, upcoming, sessionTypes, contacts] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, startsAt: { gte: monthStart, lt: monthEnd } },
      include: { contact: true },
      orderBy: { startsAt: "asc" },
    }),
    db.booking.findMany({
      where: { userId: user.id, endsAt: { gte: now } },
      include: { contact: true, invoices: { select: { id: true } }, contract: { select: { id: true } } },
      orderBy: { startsAt: "asc" },
      take: 30,
    }),
    db.sessionType.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  const shape = (b: (typeof upcoming)[number] | (typeof monthBookings)[number]) => ({
    id: b.id,
    title: b.title,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    paymentStatus: b.paymentStatus,
    totalCents: b.totalCents,
    retainerCents: b.retainerCents,
    source: b.source,
    notes: b.notes,
    contactName: b.contact?.name ?? "",
    hasInvoice: "invoices" in b ? b.invoices.length > 0 : false,
    hasContract: "contract" in b ? !!b.contract : false,
  });

  return (
    <CalendarClient
      month={m}
      googleCalendarSync={profile.googleCalendarSync}
      monthBookings={monthBookings.map(shape)}
      upcoming={upcoming.map(shape)}
      sessionTypes={sessionTypes.map((t) => ({ id: t.id, name: t.name, isMini: t.isMini }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
      openAdd={searchParams.add === "1"}
    />
  );
}
