import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { applyScheduledSends, contractDerivedStatus } from "@/lib/studio";
import { ContractsClient } from "./contracts-client";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await applyScheduledSends(user.id);

  const [templates, contracts, contacts, sessionTypes] = await Promise.all([
    db.contractTemplate.findMany({
      where: { userId: user.id },
      include: { _count: { select: { contracts: true, sessionTypes: true } } },
      orderBy: { name: "asc" },
    }),
    db.contract.findMany({
      where: { userId: user.id },
      include: { contact: true, template: true },
      orderBy: { createdAt: "desc" },
    }),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.sessionType.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <ContractsClient
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        contracts: t._count.contracts,
        sessionTypes: t._count.sessionTypes,
      }))}
      contracts={contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: contractDerivedStatus(c),
        contactName: c.contact?.name ?? "",
        templateName: c.template?.name ?? "",
        createdAt: c.createdAt.toISOString(),
        signedAt: c.signedAt?.toISOString() ?? "",
      }))}
      contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
      sessionTypes={sessionTypes.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
