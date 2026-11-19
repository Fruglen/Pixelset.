import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks";
import { SITE_PALETTES, sitePaletteById, siteFontById } from "@/lib/website";
import { PageEditor } from "./editor-client";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");
  const page = await db.sitePage.findFirst({ where: { id: params.id, websiteId: website.id } });
  if (!page) notFound();
  const sessionTypes = await db.sessionType.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, isMini: true, active: true, published: true },
    orderBy: [{ isMini: "asc" }, { createdAt: "asc" }],
  });
  const pal = sitePaletteById(website.palette);
  const font = siteFontById(website.fontTheme);

  return (
    <PageEditor
      page={{
        id: page.id,
        type: page.type,
        title: page.title,
        slug: page.slug,
        visible: page.visible,
        password: String((page as unknown as Record<string, unknown>).password ?? ""),
      }}
      initialBlocks={parseBlocks(page.blocks)}
      siteSlug={website.slug}
      sitePalette={{ bg: pal.bg, text: pal.text, accent: pal.accent, muted: pal.muted, subtle: pal.subtle }}
      siteFonts={{ display: font.display, body: font.body }}
      palettes={SITE_PALETTES.map((p) => ({ id: p.id, name: p.name, bg: p.bg, text: p.text, accent: p.accent, muted: p.muted, subtle: p.subtle }))}
      sessionTypes={sessionTypes.map((t) => ({ id: t.id, name: t.name, open: t.isMini ? t.published : t.active, mini: t.isMini }))}
    />
  );
}
