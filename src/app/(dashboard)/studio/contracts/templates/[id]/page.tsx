import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const template = await db.contractTemplate.findFirst({ where: { id: params.id, userId: user.id } });
  if (!template) notFound();

  return <TemplateEditor template={{ id: template.id, name: template.name, body: template.body, brandLogoUrl: template.brandLogoUrl, brandColor: template.brandColor, headerImageUrl: template.headerImageUrl }} />;
}
