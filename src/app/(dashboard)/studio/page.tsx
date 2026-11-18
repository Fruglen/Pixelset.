import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyScheduledSends,
  contractDerivedStatus,
  fmtMoney,
  invoiceEffectiveStatus,
} from "@/lib/studio";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudioOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await applyScheduledSends(user.id);

  const now = new Date();
  const [upcoming, invoices, contracts, contactCount, sessionTypeCount] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, startsAt: { gte: now }, status: { in: ["CONFIRMED", "PENDING"] } },
      include: { contact: true },
      orderBy: { startsAt: "asc" },
      take: 6,
    }),
    db.invoice.findMany({
      where: { userId: user.id },
      include: { installments: true },
    }),
    db.contract.findMany({ where: { userId: user.id } }),
    db.contact.count({ where: { userId: user.id } }),
    db.sessionType.count({ where: { userId: user.id } }),
  ]);

  let outstanding = 0;
  let overdueCount = 0;
  for (const inv of invoices) {
    const status = invoiceEffectiveStatus(inv.status, inv.installments);
    if (status === "OVERDUE") overdueCount++;
    if (status !== "DRAFT" && status !== "PAID") {
      outstanding += inv.installments
        .filter((i) => !i.paidAt)
        .reduce((n, i) => n + i.amountCents, 0);
    }
  }
  const awaitingSignature = contracts.filter((c) =>
    ["SENT", "AWAITING_SECOND"].includes(contractDerivedStatus(c))
  ).length;

  const stats = [
    { label: "Upcoming bookings", value: String(upcoming.length), href: "/studio/calendar" },
    { label: "Outstanding", value: fmtMoney(outstanding), href: "/studio/invoices", note: overdueCount ? `${overdueCount} overdue` : "" },
    { label: "Awaiting signature", value: String(awaitingSignature), href: "/studio/contracts" },
    { label: "Contacts", value: String(contactCount), href: "/studio/contacts" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 hover:shadow-md transition-shadow">
            <p className="text-xs uppercase tracking-wide text-neutral-400">{s.label}</p>
            <p className="text-2xl font-display mt-1">{s.value}</p>
            {s.note ? <p className="text-xs text-red-600 mt-1">{s.note}</p> : null}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Next up</h2>
            <Link href="/studio/calendar" className="text-sm text-neutral-500 underline">
              Calendar
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No upcoming bookings.{" "}
              {sessionTypeCount === 0 ? (
                <Link className="underline" href="/studio/sessions">
                  Create your first session type
                </Link>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {upcoming.map((b) => (
                <li key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-neutral-500">
                      {formatDateTime(b.startsAt)}
                      {b.contact ? ` · ${b.contact.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      b.paymentStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : b.paymentStatus === "RETAINER_PAID"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {b.paymentStatus === "PAID"
                      ? "Paid"
                      : b.paymentStatus === "RETAINER_PAID"
                        ? "Retainer paid"
                        : "Unpaid"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-display text-lg mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Link href="/studio/sessions" className="btn-secondary justify-start">
              + Session type
            </Link>
            <Link href="/studio/calendar?add=1" className="btn-secondary justify-start">
              + Manual booking
            </Link>
            <Link href="/studio/invoices?new=1" className="btn-secondary justify-start">
              + Invoice
            </Link>
            <Link href="/studio/contracts" className="btn-secondary justify-start">
              + Contract
            </Link>
            <Link href="/studio/contacts" className="btn-secondary justify-start">
              + Contact
            </Link>
            <Link href="/studio/questionnaires" className="btn-secondary justify-start">
              + Questionnaire
            </Link>
          </div>
          <p className="text-xs text-neutral-400 mt-5">
            Clients book through your public booking site; bookings land on the calendar, feed the
            Projects board and show up in the Inbox.
          </p>
        </section>
      </div>
    </div>
  );
}
