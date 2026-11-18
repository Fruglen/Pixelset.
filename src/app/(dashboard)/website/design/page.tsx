import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TEMPLATES } from "@/lib/templates";
import { SITE_PALETTES, SITE_FONT_THEMES, HEADER_STYLES } from "@/lib/website";
import { DesignClient } from "./design-client";

export const dynamic = "force-dynamic";

export default async function WebsiteDesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");

  return (
    <DesignClient
      current={{
        template: website.template,
        palette: website.palette,
        fontTheme: website.fontTheme,
        headerStyle: website.headerStyle,
        logoText: website.logoText,
        logoUrl: website.logoUrl,
        tagline: website.tagline,
      }}
      templates={TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        desc: t.desc,
        palette: SITE_PALETTES.find((p) => p.id === t.palette) ?? SITE_PALETTES[0],
      }))}
      palettes={[...SITE_PALETTES]}
      fontThemes={SITE_FONT_THEMES.map((f) => ({ id: f.id, name: f.name, display: f.display, body: f.body }))}
      headerStyles={[...HEADER_STYLES]}
    />
  );
}
