import { notFound } from "next/navigation";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/studio";
import { whereLabel } from "@/lib/availability";
import { sessionDateLabel } from "@/lib/studio-flow";
import { ManageClient } from "./manage-client";
import { ReschedulePanel } from "./reschedule-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking" };

const STATUS_COPY: Record<string, string> = {
  AWAITING_CLIENT: "Awaiting your confirmation",
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  WAITLIST: "On the waitlist",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export default async function ManageBookingPage({ params }: { params: { token: string } }) {
  const b = await db.booking.findUnique({
    where: { clientToken: params.token },
    include: { contact: true, sessionType: { include: { questionnaire: true } }, contract: true, response: true, user: true },
  });
  if (!b) notFound();
  const profile = await db.studioProfile.findUnique({ where: { userId: b.userId } });
  const business = b.user.businessName || b.user.name;
  const where = b.sessionType ? whereLabel(b.sessionType, b) : "";
  const fields = b.sessionType?.questionnaire
    ? (JSON.parse(b.sessionType.questionnaire.fields || "[]") as { id: string; type: string; label: string; options: string; required: boolean }[])
    : [];

  const brand = await brandFor(b.userId);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink branded" style={brandVars(brand)}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-sm text-neutral-500">Your booking</span>
          <BrandMark brand={brand} size="sm" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="font-display text-2xl">{b.title}</h1>
          <p className="text-sm text-neutral-500 mt-1">{sessionDateLabel(b.startsAt)}</p>
        </div>
        <div className="card p-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-neutral-500">Status</span>
            <span className={b.status === "CONFIRMED" ? "text-emerald-600" : b.status === "AWAITING_CLIENT" ? "text-amber-600" : ""}>
              {b.approvalState === "REQUESTED" ? "Waiting for the photographer's approval" : STATUS_COPY[b.status] ?? b.status}
            </span>
          </div>
          {where ? (
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Where</span>
              <span className="text-right break-all">
                {b.meetingLink ? (
                  <a className="underline" href={b.meetingLink} target="_blank" rel="noreferrer">
                    {where}
                  </a>
                ) : (
                  where
                )}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-neutral-500">Total</span>
            <span>{fmtMoney(b.totalCents)}</span>
          </div>
          {b.retainerCents > 0 ? (
            <div className="flex justify-between">
              <span className="text-neutral-500">Retainer</span>
              <span>
                {fmtMoney(b.retainerCents)} · {b.paymentStatus === "UNPAID" ? "due" : "paid"}
              </span>
            </div>
          ) : null}
          {b.contract ? (
            <div className="flex justify-between">
              <span className="text-neutral-500">Contract</span>
              <a className="underline" href={`/sign/${b.contract.token}`}>
                {b.contract.status === "SIGNED" ? "Signed, view" : "Open"}
              </a>
            </div>
          ) : null}
          {b.sessionType?.cancellationPolicy ? <p className="text-xs text-neutral-400 pt-2">{b.sessionType.cancellationPolicy}</p> : null}
        </div>

        {(b.status === "CONFIRMED" || b.status === "PENDING") && b.startsAt.getTime() > Date.now() ? (
          <ReschedulePanel token={params.token} currentLabel={sessionDateLabel(b.startsAt)} />
        ) : null}

        {b.status === "AWAITING_CLIENT" ? (
          <ManageClient
            token={params.token}
            questionnaire={b.sessionType?.questionnaire && !b.response ? { name: b.sessionType.questionnaire.name, fields } : null}
            contract={b.contract && b.contract.status !== "SIGNED" ? { token: b.contract.token, title: b.contract.title, body: b.contract.body } : null}
            payment={b.retainerCents > 0 && b.paymentStatus === "UNPAID" ? { cents: b.retainerCents } : null}
            payMethods={{
              stripe: profile?.showStripe ?? true,
              paypal: profile?.showPaypal ?? false,
              manual: !!(profile?.showManual && profile.manualEnabled),
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
