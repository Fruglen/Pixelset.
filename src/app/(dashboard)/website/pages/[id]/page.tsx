import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks";
import { PageEditor } from "./editor-client";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");
  const page = await db.sitePage.findFirst({ where: { id: params.id, websiteId: website.id } });
  if (!page) notFound();

  return (
    <PageEditor
      page={{
        id: page.id,
        type: page.type,
        title: page.title,
        slug: page.slug,
        visible: page.visible,
      }}
      initialBlocks={parseBlocks(page.blocks)}
      siteSlug={website.slug}
    />
  );
}
