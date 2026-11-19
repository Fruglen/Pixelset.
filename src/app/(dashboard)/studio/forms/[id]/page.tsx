import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FormEditor } from "./form-editor";

export const dynamic = "force-dynamic";

export default async function LeadFormEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const form = await db.leadForm.findFirst({ where: { id: params.id, userId: user.id } });
  if (!form) notFound();
  const recent = await db.studioMessage.findMany({
    where: { userId: user.id, kind: "LEAD", meta: { contains: `Lead form ${form.name}` } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return (
    <FormEditor
      form={{
        id: form.id,
        name: form.name,
        token: form.token,
        heading: form.heading,
        intro: form.intro,
        thanks: form.thanks,
        createProject: form.createProject,
        active: form.active,
        fields: JSON.parse(form.fields || "[]"),
      }}
      business={user.businessName || user.name}
      submissions={recent.map((m) => ({ id: m.id, name: m.name, email: m.email, body: m.body, createdAt: m.createdAt.toISOString() }))}
    />
  );
}
