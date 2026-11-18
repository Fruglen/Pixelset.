import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_TEMPLATES } from "@/lib/emails";
import EmailTemplatesClient from "./emails-client";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const user = (await getCurrentUser())!;
  const custom = await db.emailTemplate.findMany({ where: { userId: user.id } });
  const customByKey = new Map(custom.map((t) => [t.key, t]));

  return (
    <EmailTemplatesClient
      templates={DEFAULT_TEMPLATES.map((t) => {
        const c = customByKey.get(t.key);
        return {
          key: t.key,
          name: t.name,
          description: t.description,
          tokens: t.tokens,
          subject: c?.subject ?? t.subject,
          body: c?.body ?? t.body,
          customized: !!c,
        };
      })}
    />
  );
}
