import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyScheduledSends, contractDerivedStatus } from "@/lib/studio";
import { ContractEditor } from "./contract-editor";

export const dynamic = "force-dynamic";

export default async function ContractEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await applyScheduledSends(user.id);

  const contract = await db.contract.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, template: true, booking: true },
  });
  if (!contract) notFound();

  const contacts = await db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

  return (
    <ContractEditor
      contract={{
        id: contract.id,
        title: contract.title,
        body: contract.body,
        status: contract.status,
        derived: contractDerivedStatus(contract),
        token: contract.token,
        contactId: contract.contactId ?? "",
        contactName: contract.contact?.name ?? "",
        templateName: contract.template?.name ?? "",
        bookingTitle: contract.booking?.title ?? "",
        expiresAt: contract.expiresAt ? contract.expiresAt.toISOString().slice(0, 10) : "",
        scheduledSendAt: contract.scheduledSendAt
          ? new Date(contract.scheduledSendAt.getTime() - contract.scheduledSendAt.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          : "",
        secondSignerEmail: contract.secondSignerEmail,
        signerName: contract.signerName,
        signedAt: contract.signedAt?.toISOString() ?? "",
        signerIp: contract.signerIp,
        signerUserAgent: contract.signerUserAgent,
        secondSignerName: contract.secondSignerName,
        secondSignedAt: contract.secondSignedAt?.toISOString() ?? "",
        secondSignerIp: contract.secondSignerIp,
        secondSignerUserAgent: contract.secondSignerUserAgent,
        sentAt: contract.sentAt?.toISOString() ?? "",
      }}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
