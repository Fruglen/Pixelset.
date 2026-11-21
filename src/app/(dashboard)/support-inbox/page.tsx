import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSupportOwner, SUPPORT_TOPICS } from "@/lib/support";
import { resendConnected } from "@/lib/mailer";
import SupportInboxClient from "./support-inbox-client";

export const dynamic = "force-dynamic";

// Fix batch 2026-11-20: the site owner's support inbox. Only the support
// owner (SUPPORT_INBOX_EMAILS) can open it; everyone else gets a 404.
export default async function SupportInboxPage() {
  const session = await getCurrentSession();
  const me = session ? await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }) : null;
  if (!isSupportOwner(me?.email)) notFound();
  const messages = await db.supportMessage.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const accounts = await db.user.findMany({
    where: { id: { in: Array.from(new Set(messages.map((m) => m.userId))) } },
    select: { id: true, businessName: true, name: true },
  });
  const accountName = new Map(accounts.map((a) => [a.id, a.businessName || a.name]));
  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Support inbox</h1>
      <p className="text-sm text-neutral-500 mb-5">
        Messages sent from the Support button in every dashboard. Replies go to the sender by email
        {resendConnected() ? "." : ", and no email service is connected right now, so replies are recorded here as logged only."}
      </p>
      <SupportInboxClient
        topics={Object.fromEntries(SUPPORT_TOPICS.map((t) => [t.id, t.label]))}
        messages={messages.map((m) => ({
          id: m.id,
          account: accountName.get(m.userId) || "Deleted account",
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          topic: m.topic,
          body: m.body,
          page: m.page,
          status: m.status,
          reply: m.reply,
          replyNote: m.replyNote,
          repliedAt: m.repliedAt ? m.repliedAt.toISOString() : null,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
