import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TEMPLATES, TEMPLATE_FAMILIES } from "@/lib/templates";
import { SITE_PALETTES, SITE_FONT_THEMES, HEADER_STYLES, SPACING_OPTIONS, BUTTON_SHAPES, ARROW_STYLES } from "@/lib/website";
import { DesignClient } from "./design-client";
import { AnimationSettings, FontsSettings } from "./extras-client";
import { siteExt } from "@/lib/site-ext";

export const dynamic = "force-dynamic";

export default async function WebsiteDesignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");
  const ext = siteExt(website);

  return (
    <>
    <DesignClient
      current={{
        template: website.template,
        palette: website.palette,
        fontTheme: website.fontTheme,
        headerStyle: website.headerStyle,
        logoText: website.logoText,
        logoUrl: website.logoUrl,
        tagline: website.tagline,
        spacing: website.spacing,
        buttonShape: website.buttonShape,
        arrowStyle: website.arrowStyle,
      }}
      families={TEMPLATE_FAMILIES}
      spacingOptions={SPACING_OPTIONS.map((o) => ({ id: o.id, name: o.name, desc: o.desc }))}
      buttonShapes={BUTTON_SHAPES.map((o) => ({ id: o.id, name: o.name, radius: o.radius }))}
      arrowStyles={ARROW_STYLES.map((o) => ({ id: o.id, name: o.name, glyph: o.glyph }))}
      templates={TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        desc: t.desc,
        family: t.family,
        palette: SITE_PALETTES.find((p) => p.id === t.palette) ?? SITE_PALETTES[0],
      }))}
      palettes={[...SITE_PALETTES]}
      fontThemes={SITE_FONT_THEMES.map((f) => ({ id: f.id, name: f.name, display: f.display, body: f.body }))}
      headerStyles={[...HEADER_STYLES]}
    />
    <AnimationSettings initial={{ style: ext.animationStyle, speed: ext.animationSpeed }} />
    <FontsSettings />
    </>
  );
}
