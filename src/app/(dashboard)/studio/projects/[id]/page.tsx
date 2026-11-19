import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { calcTotals, contractDerivedStatus, fmtMoney, invoiceEffectiveStatus, parseItems, STAGE_LABELS } from "@/lib/studio";
import { studioHistory } from "@/lib/studio-history";
import { formatDate } from "@/lib/utils";
import { ProjectControls } from "./project-controls";

export const dynamic = "force-dynamic";

// Phase 5B: project card detail, aggregating the client, documents, sessions,
// payments, galleries and emails for this project in one view.
export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const project = await db.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, booking: { include: { sessionType: true } } },
  });
  if (!project) notFound();
  const contact = project.contact;
  const cid = contact?.id ?? "__none__";
  const email = contact?.email ?? "";

  const [bookings, contracts, quotes, invoices, responses, requests, galleries, history, contacts] = await Promise.all([
    db.booking.findMany({ where: { userId: user.id, OR: [{ contactId: cid }, ...(project.bookingId ? [{ id: project.bookingId }] : [])] }, orderBy: { startsAt: "desc" } }),
    db.contract.findMany({ where: { userId: user.id, contactId: cid }, orderBy: { createdAt: "desc" } }),
    db.quote.findMany({ where: { userId: user.id, contactId: cid }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ where: { userId: user.id, contactId: cid }, include: { installments: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "desc" } }),
    db.questionnaireResponse.findMany({ where: { contactId: cid }, include: { questionnaire: true }, orderBy: { createdAt: "desc" } }),
    db.questionnaireRequest.findMany({ where: { userId: user.id, contactId: cid, completedAt: null }, orderBy: { sentAt: "desc" } }),
    email
      ? db.collection.findMany({
          where: {
            userId: user.id,
            OR: [
              { registrations: { some: { email } } },
              { favoriteLists: { some: { clientEmail: email } } },
              { invites: { some: { email } } },
            ],
          },
          select: { id: true, name: true, slug: true, status: true, _count: { select: { photos: true } } },
        })
      : Promise.resolve([]),
    email ? studioHistory(user.id, { email, take: 50 }) : Promise.resolve([]),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const qNames = new Map((await db.questionnaire.findMany({ where: { userId: user.id }, select: { id: true, name: true } })).map((q) => [q.id, q.name]));
  const invoiceRows = invoices.map((i) => {
    const t = calcTotals(parseItems(i.items), i.taxRate, i.discountType, i.discountValue, i.tipCents);
    const paid = i.installments.filter((x) => x.paidAt).reduce((n, x) => n + x.amountCents, 0) || (i.status === "PAID" ? t.total : 0);
    return { ...i, total: t.total, paid, eff: invoiceEffectiveStatus(i.status, i.installments) };
  });
  const totalBilled = invoiceRows.reduce((n, i) => n + i.total, 0);
  const totalPaid = invoiceRows.reduce((n, i) => n + i.paid, 0) + bookings.filter((b) => b.paymentStatus !== "UNPAID").reduce((n, b) => n + b.retainerCents, 0);

  const Group = ({ title, count, children, action }: { title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) => (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">
          {title} <span className="text-sm text-neutral-400 font-sans">({count})</span>
        </h2>
        {action}
      </div>
      {count === 0 ? <p className="text-sm text-neutral-400">Nothing yet.</p> : <div className="divide-y divide-neutral-100 text-sm">{children}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/projects" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Projects
        </Link>
        <span className="text-xs bg-neutral-100 text-neutral-700 rounded-full px-2.5 py-1">{STAGE_LABELS[project.stage] ?? project.stage}</span>
      </div>
      <div>
        <h1 className="font-display text-2xl">{project.name}</h1>
        <p className="text-sm text-neutral-500 mt-1">Created {formatDate(project.createdAt)}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-2">
          <Group title="Sessions" count={bookings.length}>
            {bookings.map((b) => (
              <div key={b.id} className="py-2 flex justify-between gap-3">
                <span>
                  {b.title} · {formatDate(b.startsAt)}
                  {b.meetingLink ? (
                    <a href={b.meetingLink} className="ml-2 text-xs underline text-neutral-500" target="_blank" rel="noreferrer">
                      meeting link
                    </a>
                  ) : null}
                </span>
                <span className="text-xs text-neutral-500">
                  {b.status === "AWAITING_CLIENT" ? "Awaiting client" : b.status.toLowerCase()} · {b.paymentStatus.replace("_", " ").toLowerCase()}
                </span>
              </div>
            ))}
          </Group>

          <Group title="Documents" count={contracts.length + quotes.length + responses.length + requests.length}>
            {contracts.map((c) => (
              <Link key={c.id} href={`/studio/contracts/${c.id}`} className="py-2 flex justify-between hover:bg-neutral-50">
                <span>Contract: {c.title}</span>
                <span className="text-xs text-neutral-500">{contractDerivedStatus(c)}</span>
              </Link>
            ))}
            {quotes.map((q) => (
              <Link key={q.id} href={`/studio/quotes/${q.id}`} className="py-2 flex justify-between hover:bg-neutral-50">
                <span>
                  Quote {q.number}
                  {q.title ? `, ${q.title}` : ""}
                </span>
                <span className="text-xs text-neutral-500">{q.status}</span>
              </Link>
            ))}
            {responses.map((r) => (
              <Link key={r.id} href={`/studio/questionnaires/${r.questionnaireId}`} className="py-2 flex justify-between hover:bg-neutral-50">
                <span>Questionnaire: {r.questionnaire.name}</span>
                <span className="text-xs text-emerald-600">Completed {formatDate(r.createdAt)}</span>
              </Link>
            ))}
            {requests.map((r) => (
              <div key={r.id} className="py-2 flex justify-between">
                <span>Questionnaire: {qNames.get(r.questionnaireId) ?? "Questionnaire"}</span>
                <span className="text-xs text-amber-600">Sent {formatDate(r.sentAt)}, not completed</span>
              </div>
            ))}
          </Group>

          <Group title="Payments" count={invoiceRows.length} action={<span className="text-xs text-neutral-500">{fmtMoney(totalPaid)} paid of {fmtMoney(totalBilled)} invoiced</span>}>
            {invoiceRows.map((i) => (
              <Link key={i.id} href={`/studio/invoices/${i.id}`} className="py-2 flex justify-between hover:bg-neutral-50">
                <span>
                  {i.number}
                  {i.title ? `, ${i.title}` : ""}
                </span>
                <span className="text-xs text-neutral-500">
                  {fmtMoney(i.paid)} / {fmtMoney(i.total)} · {i.eff}
                </span>
              </Link>
            ))}
          </Group>

          <Group title="Galleries" count={galleries.length}>
            {galleries.map((g) => (
              <Link key={g.id} href={`/collections/${g.id}`} className="py-2 flex justify-between hover:bg-neutral-50">
                <span>{g.name}</span>
                <span className="text-xs text-neutral-500">
                  {g._count.photos} items · {g.status.toLowerCase()}
                </span>
              </Link>
            ))}
          </Group>

          <Group
            title="Emails and activity"
            count={history.length}
            action={
              email ? (
                <Link href={`/studio/inbox?email=${encodeURIComponent(email)}`} className="text-xs underline text-neutral-500">
                  Open in inbox
                </Link>
              ) : undefined
            }
          >
            {history.map((h) => (
              <div key={h.id} className="py-2">
                <div className="flex justify-between gap-3">
                  <span className="truncate">
                    {h.direction === "OUT" ? "↗ " : h.direction === "IN" ? "↙ " : ""}
                    {h.subject}
                  </span>
                  <span className="text-xs text-neutral-400 whitespace-nowrap">{formatDate(new Date(h.createdAt))}</span>
                </div>
                {h.meta ? <p className="text-xs text-neutral-400 truncate">{h.meta}</p> : null}
              </div>
            ))}
          </Group>
        </div>

        <div className="space-y-6">
          <section className="card p-5 text-sm space-y-1.5">
            <h2 className="font-display text-lg mb-2">Client</h2>
            {contact ? (
              <>
                <Link href={`/studio/contacts/${contact.id}`} className="font-medium hover:underline">
                  {contact.name}
                </Link>
                {contact.email ? <p className="text-neutral-500">{contact.email}</p> : null}
                {contact.phone ? <p className="text-neutral-500">{contact.phone}</p> : null}
                <p className="text-xs text-neutral-400">{contact.state === "CLIENT" ? "Client" : "Lead"}</p>
              </>
            ) : (
              <p className="text-neutral-400">No client linked yet.</p>
            )}
          </section>
          <ProjectControls
            project={{ id: project.id, name: project.name, stage: project.stage, notes: project.notes, contactId: project.contactId ?? "" }}
            contacts={contacts}
          />
        </div>
      </div>
    </div>
  );
}
