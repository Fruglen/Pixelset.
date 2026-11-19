import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/studio";
import { outstandingCents } from "@/lib/studio-payments";
import { sessionDateLabel } from "@/lib/studio-flow";

export const dynamic = "force-dynamic";

// Night build: the Studio Manager mobile app. An installable web app shell
// over the same account data (manifest at /api/studio/mobile-manifest):
// today first, big touch targets, the jobs a photographer does on their
// phone at a shoot: check the day, take a payment, answer the inbox.
export const metadata: Metadata = {
  title: "Studio app",
  manifest: "/api/studio/mobile-manifest",
};

export default async function StudioAppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600_000);
  const week = new Date(start.getTime() + 7 * 24 * 3600_000);

  const [today, upcomingCount, unread, outstanding, awaiting] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, startsAt: { gte: start, lt: end }, status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } },
      include: { contact: true },
      orderBy: { startsAt: "asc" },
    }),
    db.booking.count({ where: { userId: user.id, startsAt: { gte: end, lt: week }, status: "CONFIRMED" } }),
    db.studioMessage.count({ where: { userId: user.id, read: false } }),
    outstandingCents(user.id),
    db.booking.count({ where: { userId: user.id, approvalState: "REQUESTED" } }),
  ]);

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="font-display text-2xl">Today</h1>
        <p className="text-sm text-neutral-500">
          {start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {upcomingCount} more sessions this
          week
        </p>
      </div>

      {awaiting > 0 ? (
        <Link href="/studio/calendar" className="block card p-4 bg-amber-50 border-amber-200 text-sm">
          {awaiting} booking request{awaiting === 1 ? "" : "s"} waiting for your approval. Tap to review.
        </Link>
      ) : null}

      <section className="space-y-2">
        {today.length === 0 ? (
          <p className="card p-5 text-sm text-neutral-500">No sessions today. Enjoy the quiet.</p>
        ) : (
          today.map((b) => (
            <div key={b.id} className="card p-4">
              <p className="font-medium">{b.title}</p>
              <p className="text-sm text-neutral-500">
                {sessionDateLabel(b.startsAt)}
                {b.contact ? ` · ${b.contact.name}` : ""}
              </p>
              <p className="text-xs mt-1">
                <span className={b.status === "CONFIRMED" ? "text-emerald-600" : "text-amber-600"}>{b.status.replace("_", " ")}</span>
                {b.paymentStatus !== "PAID" && b.retainerCents > 0 ? (
                  <span className="text-neutral-500"> · retainer {b.paymentStatus === "UNPAID" ? "due" : "part paid"}</span>
                ) : null}
              </p>
            </div>
          ))
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/studio/inbox" className="card p-4 text-center">
          <p className="text-2xl font-display">{unread}</p>
          <p className="text-xs text-neutral-500 mt-1">Unread inbox</p>
        </Link>
        <Link href="/studio/reports" className="card p-4 text-center">
          <p className="text-2xl font-display">{fmtMoney(outstanding)}</p>
          <p className="text-xs text-neutral-500 mt-1">Outstanding invoices</p>
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[
          { href: "/studio/calendar", label: "Calendar" },
          { href: "/studio/sessions", label: "Book a client" },
          { href: "/studio/invoices", label: "Invoices + Tap to Pay" },
          { href: "/studio/contacts", label: "Clients" },
          { href: "/studio/projects", label: "Projects" },
          { href: "/studio/contracts", label: "Contracts" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="btn-secondary !py-3.5 text-center">
            {a.label}
          </Link>
        ))}
      </section>

      <section className="card p-4 text-sm space-y-2">
        <p className="font-medium">Put this on your home screen</p>
        <p className="text-neutral-600">
          On iPhone: open this page in Safari, tap Share, then Add to Home Screen. On Android: open it in Chrome, tap the menu, then
          Install app. It opens full screen like a native app, signed in to this same account, and Tap to Pay works from any invoice.
        </p>
        <p className="text-xs text-neutral-400">
          This is a packaged web app shell over the same Studio data, not a separate App Store binary.
        </p>
      </section>
    </div>
  );
}
