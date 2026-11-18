import { db } from "./db";
import { templateById } from "./templates";
import { slugify } from "./utils";

// Create a website for a user from a template bundle.
export async function createWebsiteForUser(userId: string, opts: { slug: string; templateId: string; logoText: string }) {
  const template = templateById(opts.templateId) ?? templateById("vienna")!;

  let slug = slugify(opts.slug) || "studio";
  let candidate = slug;
  let i = 1;
  while (await db.website.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${++i}`;
  }
  slug = candidate;

  const website = await db.website.create({
    data: {
      userId,
      slug,
      template: template.id,
      palette: template.palette,
      fontTheme: template.fontTheme,
      headerStyle: template.headerStyle,
      logoText: opts.logoText,
      footerText: `© ${new Date().getFullYear()} ${opts.logoText}`.trim(),
    },
  });

  await buildTemplatePages(website.id, template.id);
  return website;
}

// Replace the page set with a template's bundle (blog posts are a separate
// table and survive; SEO fields are preserved for pages of the same type).
export async function applyTemplateToWebsite(websiteId: string, templateId: string) {
  const template = templateById(templateId);
  if (!template) throw new Error("Unknown template");

  const existing = await db.sitePage.findMany({ where: { websiteId } });
  const seoByType = new Map(existing.map((p) => [p.type, { seoTitle: p.seoTitle, seoDescription: p.seoDescription }]));

  await db.sitePage.deleteMany({ where: { websiteId } });
  await buildTemplatePages(websiteId, template.id, seoByType);

  await db.website.update({
    where: { id: websiteId },
    data: {
      template: template.id,
      palette: template.palette,
      fontTheme: template.fontTheme,
      headerStyle: template.headerStyle,
    },
  });
}

async function buildTemplatePages(
  websiteId: string,
  templateId: string,
  seoByType?: Map<string, { seoTitle: string; seoDescription: string }>
) {
  const template = templateById(templateId)!;
  const pages = template.pages();
  for (let order = 0; order < pages.length; order++) {
    const page = pages[order];
    const seo = seoByType?.get(page.type);
    await db.sitePage.create({
      data: {
        websiteId,
        type: page.type,
        title: page.title,
        slug: page.slug,
        order,
        visible: true,
        blocks: JSON.stringify(page.blocks),
        seoTitle: seo?.seoTitle ?? "",
        seoDescription: seo?.seoDescription ?? "",
      },
    });
  }
}
